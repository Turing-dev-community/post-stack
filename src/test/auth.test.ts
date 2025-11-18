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
      const userData = {
        email: '   spaced@example.com   ',
        username: '   spaceduser   ',
        password: 'Password123',
      };

      const response = await fetch(`${baseUrl}/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      const data: any = await response.json();

      expect(response.status).toBe(201);
      expect(data.user.email).toBe('spaced@example.com');
      expect(data.user.username).toBe('spaceduser');

      const userInDb = await prisma.user.findUnique({ where: { email: 'spaced@example.com' } });
      expect(userInDb).toBeTruthy();
      expect(userInDb?.username).toBe('spaceduser');
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
      await prisma.user.create({
        data: {
          email: 'trimlogin@example.com',
          username: 'trimlogin',
          password: hashedPassword,
        },
      });

      const loginData = {
        email: '   trimlogin@example.com   ',
        password: 'Password123',
      };

      const response = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(loginData),
      });

      const data: any = await response.json();
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('message', 'Login successful');
      expect(data.user.email).toBe('trimlogin@example.com');
    });
  });

  describe('GET /api/auth/profile', () => {
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
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe('test@example.com');
      expect(response.body.user.followerCount).toBe(5);
      expect(response.body.user.followingCount).toBe(3);
    });

    it('should return error when not authenticated', async () => {
      const response = await request(app).get('/api/auth/profile').expect(401);
      expect(response.body).toHaveProperty('error', 'Access token required');
    });

    it('should return error with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
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
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.user).toHaveProperty('profilePicture', 'https://example.com/picture.jpg');
      expect(response.body.user).toHaveProperty(
        'about',
        'This is a test about section with sufficient length'
      );
    });
  });

  describe('PUT /api/auth/profile', () => {
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
        .put('/api/auth/profile')
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
        .put('/api/auth/profile')
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
        .put('/api/auth/profile')
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
        .put('/api/auth/profile')
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
        .put('/api/auth/profile')
        .send(updateData)
        .expect(401);
      expect(response.body).toHaveProperty('error', 'Access token required');
    });

    it('should trim profilePicture and about on update', async () => {
      const hashedPassword = await bcrypt.hash('Password123', 12);
      const user = await prisma.user.create({
        data: {
          email: 'trimprofile@example.com',
          username: 'trimprofile',
          password: hashedPassword,
        },
      });

      const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '1d' });

      const updateData = {
        profilePicture: '   https://example.com/pic.jpg   ',
        about: '   This about will be trimmed.   ',
      };

      const response = await fetch(`${baseUrl}/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(updateData),
      });

      const data: any = await response.json();
      expect(response.status).toBe(200);
      expect(data.user.profilePicture).toBe('https://example.com/pic.jpg');
      expect(data.user.about).toBe('This about will be trimmed.');
    });

    it('should sanitize script tags in about field', async () => {
      const hashedPassword = await bcrypt.hash('Password123', 12);
      const user = await prisma.user.create({
        data: {
          email: 'sanitizeprofile@example.com',
          username: 'sanitizeprofile',
          password: hashedPassword,
        },
      });

      const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '1d' });

      const updateData = {
        about: 'Hello <script>alert(1)</script> World',
      };

      const response = await fetch(`${baseUrl}/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(updateData),
      });

      const data: any = await response.json();
      expect(response.status).toBe(200);
      expect(data.user.about).toBe('Hello World');
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
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
      expect(response.body).toHaveProperty('error', 'Account has been deactivated');
    });
  });
});
