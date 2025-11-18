import request from 'supertest';
import { setupPrismaMock } from './utils/mockPrisma';
import { prisma } from '../lib/prisma';
import app from '../index';
import bcrypt from 'bcryptjs';
import { generateToken } from '../utils/auth';

const { prisma: prismaMock } = setupPrismaMock(prisma, app);

describe('Authentication Routes (mocked)', () => {
  it('should have mocking properly configured', () => {
    expect((prismaMock as any).isMocked).toBe(true);
  });

  describe('POST /api/auth/signup', () => {
    it('should create a new user successfully', async () => {
      (prismaMock.user.findFirst as unknown as jest.Mock).mockResolvedValue(null);
      const created = {
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
        createdAt: new Date(),
      };
      (prismaMock.user.create as unknown as jest.Mock).mockResolvedValue(created);

      const response = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'test@example.com', username: 'testuser', password: 'Password123' })
        .expect(201);

      expect(response.body).toHaveProperty('message', 'User created successfully');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe('test@example.com');
      expect(response.body).toHaveProperty('token');
    });

    it('should return error if email already exists', async () => {
      (prismaMock.user.findFirst as unknown as jest.Mock).mockResolvedValue({
        id: 'user-1',
        email: 'existing@example.com',
        username: 'existinguser',
      });

      const response = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'existing@example.com', username: 'newuser', password: 'Password123' })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'User already exists');
    });

    it('should return validation error for invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'invalid-email', username: 'testuser', password: 'Password123' })
        .expect(400);
      expect(response.body).toHaveProperty('error', 'Validation failed');
    });

    it('should return validation error for weak password', async () => {
      const response = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'test@example.com', username: 'testuser', password: 'weak' })
        .expect(400);
      expect(response.body).toHaveProperty('error', 'Validation failed');
    });

    it('should trim email and username on signup', async () => {
      (prismaMock.user.findFirst as unknown as jest.Mock).mockResolvedValue(null);
      const created = {
        id: 'user-2',
        email: 'spaced@example.com',
        username: 'spaceduser',
        createdAt: new Date(),
      };
      (prismaMock.user.create as unknown as jest.Mock).mockResolvedValue(created);

      const userData = {
        email: '   spaced@example.com   ',
        username: '   spaceduser   ',
        password: 'Password123',
      };

      const response = await request(app)
        .post('/api/auth/signup')
        .send(userData)
        .expect(201);

      expect(response.body.user.email).toBe('spaced@example.com');
      expect(response.body.user.username).toBe('spaceduser');
      expect(prismaMock.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'spaced@example.com',
            username: 'spaceduser',
          }),
        })
      );
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      const hashed = await bcrypt.hash('Password123', 12);
      (prismaMock.user.findUnique as unknown as jest.Mock).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
        password: hashed,
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'Password123' })
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Login successful');
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('token');
      expect(response.body.user.username).toBe('testuser');
    });

    it('should return error for invalid credentials', async () => {
      (prismaMock.user.findUnique as unknown as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nonexistent@example.com', password: 'Password123' })
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Invalid credentials');
    });

    it('should return error for wrong password', async () => {
      const hashed = await bcrypt.hash('Password123', 12);
      (prismaMock.user.findUnique as unknown as jest.Mock).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
        password: hashed,
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'WrongPassword' })
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Invalid credentials');
    });

    it('should login successfully with trimmed email', async () => {
      const hashedPassword = await bcrypt.hash('Password123', 12);
      (prismaMock.user.findUnique as unknown as jest.Mock).mockResolvedValue({
        id: 'user-2',
        email: 'trimlogin@example.com',
        username: 'trimlogin',
        password: hashedPassword,
        deletedAt: null,
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: '   trimlogin@example.com   ', password: 'Password123' })
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Login successful');
      expect(response.body.user.email).toBe('trimlogin@example.com');
    });
  });


  describe('DELETE /api/auth/account', () => {
    it('should deactivate account when authenticated', async () => {
      const userId = 'user-1';

      (prismaMock.user.findUnique as unknown as jest.Mock).mockResolvedValueOnce({
        id: userId,
        email: 'test@example.com',
        username: 'testuser',
        deletedAt: null,
      });

      (prismaMock.user.findUnique as unknown as jest.Mock).mockResolvedValueOnce({
        id: userId,
        deletedAt: null,
      });
      (prismaMock.user.update as unknown as jest.Mock).mockResolvedValue({ id: userId });

      const token = generateToken(userId);
      const response = await request(app)
        .delete('/api/auth/account')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Account deactivated successfully');
      expect(response.body).toHaveProperty('note');
    });

    it('should return error when not authenticated', async () => {
      const response = await request(app).delete('/api/auth/account').expect(401);
      expect(response.body).toHaveProperty('error', 'Access token required');
    });

    it('should return error when trying to deactivate already deactivated account', async () => {
      const userId = 'user-1';

      (prismaMock.user.findUnique as unknown as jest.Mock).mockResolvedValue({
        id: userId,
        email: 'test@example.com',
        username: 'testuser',
        deletedAt: new Date(),
      });

      const token = generateToken(userId);
      const response = await request(app)
        .delete('/api/auth/account')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
      expect(response.body).toHaveProperty('error', 'Account has been deactivated');
    });

    it('should prevent login after account deactivation', async () => {
      (prismaMock.user.findUnique as unknown as jest.Mock).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
        password: await bcrypt.hash('Password123', 12),
        deletedAt: new Date(),
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'Password123' })
        .expect(403);
      expect(response.body).toHaveProperty('error', 'Account has been deactivated');
    });

    it('should prevent authentication with token after account deactivation', async () => {
      const userId = 'user-1';
      const token = generateToken(userId);
      (prismaMock.user.findUnique as unknown as jest.Mock).mockResolvedValue({
        id: userId,
        email: 'test@example.com',
        username: 'testuser',
        deletedAt: new Date(),
      });

      const response = await request(app)
        .get('/api/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
      expect(response.body).toHaveProperty('error', 'Account has been deactivated');
    });
  });
});
