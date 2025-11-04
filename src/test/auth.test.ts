import { prisma } from './setup';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

describe('Authentication Routes', () => {
  const baseUrl = `http://localhost:${process.env.PORT}/api`;

  describe('POST /api/auth/signup', () => {
    it('should create a new user successfully', async () => {
      const userData = {
        email: 'test@example.com',
        username: 'testuser',
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
      expect(data).toHaveProperty('message', 'User created successfully');
      expect(data).toHaveProperty('user');
      expect(data).toHaveProperty('token');
      expect(data.user.email).toBe(userData.email);
      expect(data.user.username).toBe(userData.username);

      // Verify user was created in database
      const user = await prisma.user.findUnique({
        where: { email: userData.email },
      });
      expect(user).toBeTruthy();
      expect(user?.username).toBe(userData.username);
    });

    it('should return error if email already exists', async () => {
      // First, create a user
      await prisma.user.create({
        data: {
          email: 'existing@example.com',
          username: 'existinguser',
          password: await bcrypt.hash('Password123', 12),
        },
      });

      const userData = {
        email: 'existing@example.com',
        username: 'newuser',
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

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error', 'User already exists');
    });

    it('should return validation error for invalid email', async () => {
      const userData = {
        email: 'invalid-email',
        username: 'testuser',
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

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error', 'Validation failed');
    });

    it('should return validation error for weak password', async () => {
      const userData = {
        email: 'test@example.com',
        username: 'testuser',
        password: 'weak',
      };

      const response = await fetch(`${baseUrl}/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      const data: any = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error', 'Validation failed');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      // First, create a user
      const hashedPassword = await bcrypt.hash('Password123', 12);
      const user = await prisma.user.create({
        data: {
          email: 'test@example.com',
          username: 'testuser',
          password: hashedPassword,
        },
      });

      const loginData = {
        email: 'test@example.com',
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
      expect(data).toHaveProperty('user');
      expect(data).toHaveProperty('token');
      expect(data.user.email).toBe(loginData.email);
      expect(data.user.username).toBe('testuser');
    });

    it('should return error for invalid credentials', async () => {
      const loginData = {
        email: 'nonexistent@example.com',
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

      expect(response.status).toBe(401);
      expect(data).toHaveProperty('error', 'Invalid credentials');
    });

    it('should return error for wrong password', async () => {
      // First, create a user
      const hashedPassword = await bcrypt.hash('Password123', 12);
      await prisma.user.create({
        data: {
          email: 'test@example.com',
          username: 'testuser',
          password: hashedPassword,
        },
      });

      const loginData = {
        email: 'test@example.com',
        password: 'WrongPassword',
      };

      const response = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(loginData),
      });

      const data: any = await response.json();

      expect(response.status).toBe(401);
      expect(data).toHaveProperty('error', 'Invalid credentials');
    });
  });

  describe('GET /api/auth/profile', () => {
    it('should return user profile when authenticated', async () => {
      // First, create a user
      const hashedPassword = await bcrypt.hash('Password123', 12);
      const user = await prisma.user.create({
        data: {
          email: 'test@example.com',
          username: 'testuser',
          password: hashedPassword,
        },
      });

      // Generate JWT token
      const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '1d' });

      const response = await fetch(`${baseUrl}/auth/profile`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data: any = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('user');
      expect(data.user.email).toBe('test@example.com');
      expect(data.user.username).toBe('testuser');
    });

    it('should return error when not authenticated', async () => {
      const response = await fetch(`${baseUrl}/auth/profile`, {
        method: 'GET',
      });

      const data: any = await response.json();

      expect(response.status).toBe(401);
      expect(data).toHaveProperty('error', 'Access token required');
    });

    it('should return error with invalid token', async () => {
      const response = await fetch(`${baseUrl}/auth/profile`, {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer invalid-token',
        },
      });

      const data: any = await response.json();

      expect(response.status).toBe(403);
      expect(data).toHaveProperty('error', 'Invalid or expired token');
    });

    it('should return profile with profilePicture and about fields', async () => {
      const hashedPassword = await bcrypt.hash('Password123', 12);
      const user = await prisma.user.create({
        data: {
          email: 'test@example.com',
          username: 'testuser',
          password: hashedPassword,
          profilePicture: 'https://example.com/picture.jpg',
          about: 'This is a test about section with sufficient length',
        },
      });

      const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '1d' });

      const response = await fetch(`${baseUrl}/auth/profile`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data: any = await response.json();

      expect(response.status).toBe(200);
      expect(data.user).toHaveProperty('profilePicture', 'https://example.com/picture.jpg');
      expect(data.user).toHaveProperty('about', 'This is a test about section with sufficient length');
    });
  });

  describe('PUT /api/auth/profile', () => {
    it('should update profile with valid profilePicture and about', async () => {
      const hashedPassword = await bcrypt.hash('Password123', 12);
      const user = await prisma.user.create({
        data: {
          email: 'test@example.com',
          username: 'testuser',
          password: hashedPassword,
        },
      });

      const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '1d' });

      const updateData = {
        profilePicture: 'https://example.com/picture.jpg',
        about: 'This is a test about section with sufficient length to pass validation',
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
      expect(data).toHaveProperty('message', 'Profile updated successfully');
      expect(data.user).toHaveProperty('profilePicture', updateData.profilePicture);
      expect(data.user).toHaveProperty('about', updateData.about);

      // Verify in database
      const updatedUser = await prisma.user.findUnique({
        where: { id: user.id },
      });
      expect(updatedUser?.profilePicture).toBe(updateData.profilePicture);
      expect(updatedUser?.about).toBe(updateData.about);
    });

    it('should reject invalid URL for profilePicture', async () => {
      const hashedPassword = await bcrypt.hash('Password123', 12);
      const user = await prisma.user.create({
        data: {
          email: 'test@example.com',
          username: 'testuser',
          password: hashedPassword,
        },
      });

      const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '1d' });

      const updateData = {
        profilePicture: 'not-a-valid-url',
        about: 'This is a test about section with sufficient length',
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

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error', 'Validation failed');
    });

    it('should reject about text that is too short', async () => {
      const hashedPassword = await bcrypt.hash('Password123', 12);
      const user = await prisma.user.create({
        data: {
          email: 'test@example.com',
          username: 'testuser',
          password: hashedPassword,
        },
      });

      const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '1d' });

      const updateData = {
        about: 'short',
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

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error', 'Validation failed');
    });

    it('should reject about text that is too long', async () => {
      const hashedPassword = await bcrypt.hash('Password123', 12);
      const user = await prisma.user.create({
        data: {
          email: 'test@example.com',
          username: 'testuser',
          password: hashedPassword,
        },
      });

      const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '1d' });

      const updateData = {
        about: 'a'.repeat(1001), // 1001 characters, exceeds max of 1000
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

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error', 'Validation failed');
    });

    it('should require authentication to update profile', async () => {
      const updateData = {
        profilePicture: 'https://example.com/picture.jpg',
        about: 'This is a test about section with sufficient length',
      };

      const response = await fetch(`${baseUrl}/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      expect(response.status).toBe(401);
      const data: any = await response.json();
      expect(data).toHaveProperty('error', 'Access token required');
    });
  });
});
