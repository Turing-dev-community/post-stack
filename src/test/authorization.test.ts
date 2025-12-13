import request from 'supertest';
import { setupPrismaMock } from './utils/mockPrisma';
import { prisma } from '../lib/prisma';
import app from '../index';
import { generateToken } from '../utils/auth';
import type { Role } from '../middleware/authorization';

// Role constants
const Role = {
  AUTHOR: 'AUTHOR' as const,
  ADMIN: 'ADMIN' as const,
};

const { prisma: prismaMock } = setupPrismaMock(prisma, app);

describe('Role-Based Authorization', () => {
  describe('Authentication with Roles', () => {

    it('should reject request if user is deactivated', async () => {
      const userId = 'user-1';
      const mockUser = {
        id: userId,
        email: 'test@example.com',
        username: 'testuser',
        role: Role.AUTHOR,
        deletedAt: new Date(),
      };

      (prismaMock.user.findUnique as unknown as jest.Mock).mockResolvedValue(mockUser);

      const token = generateToken(userId);

      // Test with a route that requires authentication (follow user)
      await request(app)
        .post('/api/users/user-2/follow')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });
  });

  describe('Role Hierarchy', () => {
    const createMockUser = (role: Role, email?: string, userId?: string) => ({
      id: userId || 'user-1',
      email: email || 'test@example.com',
      username: 'testuser',
      role: role,
      deletedAt: null,
    });

    const setupFollowersMocks = () => {
      (prismaMock.follow.findMany as unknown as jest.Mock).mockResolvedValue([]);
      (prismaMock.follow.count as unknown as jest.Mock).mockResolvedValue(0);
    };

    it('should allow AUTHOR to access regular routes', async () => {
      const mockUser = createMockUser(Role.AUTHOR);
      (prismaMock.user.findUnique as unknown as jest.Mock).mockResolvedValue(mockUser);
      setupFollowersMocks();

      const token = generateToken(mockUser.id);

      const response = await request(app)
        .get('/api/users/user-2/followers')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.status).toBe(200);
    });
  });

  describe('Signup with Default Role', () => {
    it('should create user with AUTHOR role by default', async () => {
      (prismaMock.user.findFirst as unknown as jest.Mock).mockResolvedValue(null);

      const createdUser = {
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
        role: Role.AUTHOR,
        createdAt: new Date(),
      };

      (prismaMock.user.create as unknown as jest.Mock).mockResolvedValue(createdUser);

      const response = await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'test@example.com',
          username: 'testuser',
          password: 'Password123',
        })
        .expect(201);

      expect(response.body.user).toHaveProperty('role', Role.AUTHOR);
    });
  });

  describe('Login with Role', () => {
    it('should return AUTHOR role in login response for regular user', async () => {
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('Password123', 12);

      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
        password: hashedPassword,
        role: Role.AUTHOR,
        deletedAt: null,
      };

      (prismaMock.user.findUnique as unknown as jest.Mock).mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Password123',
        })
        .expect(200);

      expect(response.body.user).toHaveProperty('role', Role.AUTHOR);
    });

    it('should return ADMIN role in login response for admin user', async () => {
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('Password123', 12);

      const mockUser = {
        id: 'admin-1',
        email: 'admin@example.com',
        username: 'admin',
        password: hashedPassword,
        role: Role.ADMIN,
        deletedAt: null,
      };

      (prismaMock.user.findUnique as unknown as jest.Mock).mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@example.com',
          password: 'Password123',
        })
        .expect(200);

      expect(response.body.user).toHaveProperty('role', Role.ADMIN);
    });
  });

  describe('Admin-Only Routes', () => {
    it('should allow ADMIN to create category', async () => {
      const mockAdmin = {
        id: 'admin-1',
        email: 'admin@example.com',
        username: 'admin',
        role: Role.ADMIN,
        deletedAt: null,
      };

      (prismaMock.user.findUnique as unknown as jest.Mock).mockResolvedValue(mockAdmin);
      (prismaMock.category.findFirst as unknown as jest.Mock).mockResolvedValue(null);
      (prismaMock.category.create as unknown as jest.Mock).mockResolvedValue({
        id: 'cat-1',
        name: 'Technology',
        slug: 'technology',
        createdAt: new Date(),
      });

      const token = generateToken(mockAdmin.id);

      const response = await request(app)
        .post('/api/categories')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Technology' })
        .expect(201);

      expect(response.body).toHaveProperty('message', 'Category created successfully');
      expect(response.body.category).toHaveProperty('name', 'Technology');
    });

    it('should deny AUTHOR access to create category', async () => {
      const mockAuthor = {
        id: 'author-1',
        email: 'author@example.com',
        username: 'author',
        role: Role.AUTHOR,
        deletedAt: null,
      };

      (prismaMock.user.findUnique as unknown as jest.Mock).mockResolvedValue(mockAuthor);

      const token = generateToken(mockAuthor.id);

      const response = await request(app)
        .post('/api/categories')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Technology' })
        .expect(403);

      expect(response.body).toHaveProperty('error', 'ForbiddenError');
      expect(response.body.message).toContain('Access denied');
      expect(response.body.message).toContain('ADMIN');
    });

    it('should allow ADMIN to access admin-protected routes', async () => {
      const mockAdmin = {
        id: 'admin-1',
        email: 'admin@example.com',
        username: 'admin',
        role: Role.ADMIN,
        deletedAt: null,
      };

      (prismaMock.user.findUnique as unknown as jest.Mock).mockResolvedValue(mockAdmin);
      (prismaMock.category.findFirst as unknown as jest.Mock).mockResolvedValue(null);
      (prismaMock.category.create as unknown as jest.Mock).mockResolvedValue({
        id: 'cat-1',
        name: 'Science',
        slug: 'science',
        createdAt: new Date(),
      });

      const token = generateToken(mockAdmin.id);

      const response = await request(app)
        .post('/api/categories')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Science' })
        .expect(201);

      expect(response.status).toBe(201);
      expect(response.body.category.name).toBe('Science');
    });

    it('should deny non-admin users from accessing admin routes', async () => {
      const mockAuthor = {
        id: 'author-1',
        email: 'author@example.com',
        username: 'author',
        role: Role.AUTHOR,
        deletedAt: null,
      };

      (prismaMock.user.findUnique as unknown as jest.Mock).mockResolvedValue(mockAuthor);

      const token = generateToken(mockAuthor.id);

      const response = await request(app)
        .post('/api/categories')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Technology' })
        .expect(403);

      expect(response.body.error).toBe('ForbiddenError');
      expect(response.body.message).toContain('Access denied');
    });
  });

  describe('Author-Only Routes', () => {
    it('should allow AUTHOR to access post creation route', async () => {
      const mockAuthor = {
        id: 'author-1',
        email: 'author@example.com',
        username: 'author',
        role: Role.AUTHOR,
        deletedAt: null,
      };

      (prismaMock.user.findUnique as unknown as jest.Mock).mockResolvedValue(mockAuthor);

      const token = generateToken(mockAuthor.id);

      // Test that requireAuthor middleware allows access
      // The request may fail validation or other checks, but should not be 403 Forbidden
      const response = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Test Post',
          content: 'Test content',
        });

      // Authorization passed - should not be 403 Forbidden
      // Other errors (400, 500) are acceptable as they indicate authorization passed
      expect(response.status).not.toBe(403);
      expect(response.body.error).not.toBe('ForbiddenError');
    });

    it('should allow AUTHOR to access image upload route', async () => {
      const mockAuthor = {
        id: 'author-1',
        email: 'author@example.com',
        username: 'author',
        role: Role.AUTHOR,
        deletedAt: null,
      };

      (prismaMock.user.findUnique as unknown as jest.Mock).mockResolvedValue(mockAuthor);

      const token = generateToken(mockAuthor.id);

      // The route should accept the request (authorization passes)
      // Actual file validation will happen in the controller
      // We're just testing that requireAuthor middleware allows access
      const response = await request(app)
        .post('/api/images/upload')
        .set('Authorization', `Bearer ${token}`)
        .expect((res) => {
          // Should not be 403 Forbidden (authorization passed)
          expect(res.status).not.toBe(403);
        });

      // Authorization passed - the error might be from missing file, but that's expected
      expect(response.status).not.toBe(403);
    });

    it('should allow ADMIN to access author-only routes (inheritance)', async () => {
      const mockAdmin = {
        id: 'admin-1',
        email: 'admin@example.com',
        username: 'admin',
        role: Role.ADMIN,
        deletedAt: null,
      };

      (prismaMock.user.findUnique as unknown as jest.Mock).mockResolvedValue(mockAdmin);

      const token = generateToken(mockAdmin.id);

      // Test that requireAuthor middleware allows ADMIN access (role hierarchy)
      // The request may fail validation or other checks, but should not be 403 Forbidden
      const response = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Admin Post',
          content: 'Admin content',
        });

      // Authorization passed - should not be 403 Forbidden
      // ADMIN role should inherit AUTHOR permissions
      expect(response.status).not.toBe(403);
      expect(response.body.error).not.toBe('ForbiddenError');
    });
  });
});

