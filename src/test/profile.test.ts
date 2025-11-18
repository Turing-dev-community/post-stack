import request from 'supertest';
import { setupPrismaMock } from './utils/mockPrisma';
import { prisma } from '../lib/prisma';
import app from '../index';
import { generateToken } from '../utils/auth';

const { prisma: prismaMock } = setupPrismaMock(prisma, app);

describe('Profile Routes', () => {
  it('should have mocking properly configured', () => {
    expect((prismaMock as any).isMocked).toBe(true);
  });

  describe('GET /api/profile', () => {
    it('should return user profile when authenticated', async () => {
      const userId = 'user-1';
      (prismaMock.user.findUnique as unknown as jest.Mock).mockResolvedValue({
        id: userId,
        email: 'test@example.com',
        username: 'testuser',
        deletedAt: null,
      });
      (prismaMock.follow.count as unknown as jest.Mock)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(3);

      const token = generateToken(userId);
      const response = await request(app)
        .get('/api/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe('test@example.com');
      expect(response.body.user.followerCount).toBe(5);
      expect(response.body.user.followingCount).toBe(3);
    });

    it('should return error when not authenticated', async () => {
      const response = await request(app).get('/api/profile').expect(401);
      expect(response.body).toHaveProperty('error', 'Access token required');
    });

    it('should return error with invalid token', async () => {
      const response = await request(app)
        .get('/api/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(403);
      expect(response.body).toHaveProperty('error', 'Invalid or expired token');
    });

    it('should return profile with profilePicture and about fields', async () => {
      const userId = 'user-1';
      (prismaMock.user.findUnique as unknown as jest.Mock).mockResolvedValue({
        id: userId,
        email: 'test@example.com',
        username: 'testuser',
        profilePicture: 'https://example.com/picture.jpg',
        about: 'This is a test about section with sufficient length',
        deletedAt: null,
        _count: { posts: 0 },
      });
      (prismaMock.follow.count as unknown as jest.Mock)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      const token = generateToken(userId);
      const response = await request(app)
        .get('/api/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.user).toHaveProperty('profilePicture', 'https://example.com/picture.jpg');
      expect(response.body.user).toHaveProperty(
        'about',
        'This is a test about section with sufficient length'
      );
    });
  });

  describe('PUT /api/profile', () => {
    it('should update profile with valid profilePicture and about', async () => {
      const userId = 'user-1';

      (prismaMock.user.findUnique as unknown as jest.Mock).mockResolvedValueOnce({
        id: userId,
        email: 'test@example.com',
        username: 'testuser',
        deletedAt: null,
      });

      (prismaMock.user.update as unknown as jest.Mock).mockResolvedValue({
        id: userId,
        email: 'test@example.com',
        username: 'testuser',
        profilePicture: 'https://example.com/picture.jpg',
        about: 'This is a test about section with sufficient length to pass validation',
        createdAt: new Date(),
        _count: { posts: 0 },
      });
      (prismaMock.follow.count as unknown as jest.Mock)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(2);

      const token = generateToken(userId);
      const response = await request(app)
        .put('/api/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({
          profilePicture: 'https://example.com/picture.jpg',
          about: 'This is a test about section with sufficient length to pass validation',
        })
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Profile updated successfully');
      expect(response.body.user).toHaveProperty('profilePicture');
      expect(response.body.user).toHaveProperty('about');
    });

    it('should reject invalid URL for profilePicture', async () => {
      const userId = 'user-1';
      (prismaMock.user.findUnique as unknown as jest.Mock).mockResolvedValue({
        id: userId,
        email: 'test@example.com',
        username: 'testuser',
        deletedAt: null,
      });
      const token = generateToken(userId);
      const response = await request(app)
        .put('/api/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ profilePicture: 'not-a-valid-url', about: 'Valid about content text here' })
        .expect(400);
      expect(response.body).toHaveProperty('error', 'Validation failed');
    });

    it('should reject about text that is too short', async () => {
      const userId = 'user-1';
      (prismaMock.user.findUnique as unknown as jest.Mock).mockResolvedValue({
        id: userId,
        email: 'test@example.com',
        username: 'testuser',
        deletedAt: null,
      });
      const token = generateToken(userId);
      const response = await request(app)
        .put('/api/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ about: 'short' })
        .expect(400);
      expect(response.body).toHaveProperty('error', 'Validation failed');
    });

    it('should reject about text that is too long', async () => {
      const userId = 'user-1';
      (prismaMock.user.findUnique as unknown as jest.Mock).mockResolvedValue({
        id: userId,
        email: 'test@example.com',
        username: 'testuser',
        deletedAt: null,
      });
      const token = generateToken(userId);
      const updateData = {
        about: 'a'.repeat(1001),
      };

      const response = await request(app)
        .put('/api/profile')
        .set('Authorization', `Bearer ${token}`)
        .send(updateData)
        .expect(400);
      expect(response.body).toHaveProperty('error', 'Validation failed');
    });

    it('should require authentication to update profile', async () => {
      const updateData = {
        profilePicture: 'https://example.com/picture.jpg',
        about: 'This is a test about section with sufficient length',
      };

      const response = await request(app)
        .put('/api/profile')
        .send(updateData)
        .expect(401);
      expect(response.body).toHaveProperty('error', 'Access token required');
    });

    it('should trim profilePicture and about on update', async () => {
      const userId = 'user-3';
      (prismaMock.user.findUnique as unknown as jest.Mock).mockResolvedValue({
        id: userId,
        email: 'trimprofile@example.com',
        username: 'trimprofile',
        deletedAt: null,
      });
      (prismaMock.user.update as unknown as jest.Mock).mockResolvedValue({
        id: userId,
        email: 'trimprofile@example.com',
        username: 'trimprofile',
        profilePicture: 'https://example.com/pic.jpg',
        about: 'This about will be trimmed.',
        createdAt: new Date(),
        _count: { posts: 0 },
      });
      (prismaMock.follow.count as unknown as jest.Mock)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      const token = generateToken(userId);

      const response = await request(app)
        .put('/api/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({
          profilePicture: '   https://example.com/pic.jpg   ',
          about: '   This about will be trimmed.   ',
        })
        .expect(200);

      expect(response.body.user.profilePicture).toBe('https://example.com/pic.jpg');
      expect(response.body.user.about).toBe('This about will be trimmed.');
    });

    it('should sanitize script tags in about field', async () => {
      const userId = 'user-4';
      (prismaMock.user.findUnique as unknown as jest.Mock).mockResolvedValue({
        id: userId,
        email: 'sanitizeprofile@example.com',
        username: 'sanitizeprofile',
        deletedAt: null,
      });
      (prismaMock.user.update as unknown as jest.Mock).mockResolvedValue({
        id: userId,
        email: 'sanitizeprofile@example.com',
        username: 'sanitizeprofile',
        profilePicture: null,
        about: 'Hello World',
        createdAt: new Date(),
        _count: { posts: 0 },
      });
      (prismaMock.follow.count as unknown as jest.Mock)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      const token = generateToken(userId);

      const response = await request(app)
        .put('/api/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({
          about: 'Hello <script>alert(1)</script> World',
        })
        .expect(200);

      expect(response.body.user.about).toBe('Hello World');
    });
  });
});

describe('GET /api/profile - follower counts', () => {
  it('returns follower and following counts', async () => {
    const userId = 'user-100';

    (prismaMock.user.findUnique as unknown as jest.Mock).mockResolvedValue({
      id: userId,
      email: 'profilecounts@example.com',
      username: 'profilecounts',
      deletedAt: null,
      _count: { posts: 2 },
    });

    (prismaMock.follow.count as unknown as jest.Mock)
      .mockResolvedValueOnce(3) 
      .mockResolvedValueOnce(1);

    const token = generateToken(userId);

    const response = await request(app)
      .get('/api/profile')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const data = response.body;

    expect(data).toHaveProperty('user');
    expect(data.user).toHaveProperty('followerCount', 3);
    expect(data.user).toHaveProperty('followingCount', 1);
    expect(data.user).toHaveProperty('_count');
  });
});
