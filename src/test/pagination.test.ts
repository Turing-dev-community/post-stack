import request from 'supertest';
import jwt from 'jsonwebtoken';
import { setupPrismaMock } from './utils/mockPrisma';
import app from '../index';
import { prisma } from '../lib/prisma';
const { prisma: mockPrismaClient } = setupPrismaMock(prisma, app);


interface PaginatedPostsResponse {
  posts: unknown[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

interface ValidationErrorResponse {
  error: string;
  details?: unknown[];
}

interface UserFollowersResponse {
  followers?: unknown[];
  following?: unknown[];
  page: number;
  limit: number;
  total?: number;
}

describe('Pagination Validation', () => {
  let authToken: string;
  let userId: string;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    // Set up default mock user for authenticated routes
    userId = 'test-user-id';
    authToken = jwt.sign({ userId }, process.env.JWT_SECRET || 'test-secret');

    // Mock user.findUnique for authentication middleware
    (mockPrismaClient.user.findUnique as jest.Mock).mockResolvedValue({
      id: userId,
      email: 'test@example.com',
      username: 'testuser',
      deletedAt: null,
    });

    // Set up default mocks for successful requests
    // Mock posts.findMany for GET /api/posts
    (mockPrismaClient.post.findMany as jest.Mock).mockResolvedValue([]);
    (mockPrismaClient.post.count as jest.Mock).mockResolvedValue(0);
    (mockPrismaClient.postLike.count as jest.Mock).mockResolvedValue(0);

    // Mock savedPost operations for GET /api/posts/saved
    (mockPrismaClient.savedPost.findMany as jest.Mock).mockResolvedValue([]);
    (mockPrismaClient.savedPost.count as jest.Mock).mockResolvedValue(0);

    // Mock follow operations for GET /api/users/:userId/followers and /following
    (mockPrismaClient.follow.findMany as jest.Mock).mockResolvedValue([]);
    (mockPrismaClient.follow.count as jest.Mock).mockResolvedValue(0);
  });

  describe('GET /api/posts - Pagination Validation', () => {
    it('should accept valid pagination parameters', async () => {
      const response = await request(app)
        .get('/api/posts')
        .query({ page: 1, limit: 10 })
        .expect(200);

      const data = response.body as PaginatedPostsResponse;
      expect(data).toHaveProperty('pagination');
      expect(data.pagination.page).toBe(1);
      expect(data.pagination.limit).toBe(10);
    });

    it('should use default values when pagination parameters are not provided', async () => {
      const response = await request(app)
        .get('/api/posts')
        .expect(200);

      const data = response.body as PaginatedPostsResponse;
      expect(data).toHaveProperty('pagination');
      expect(data.pagination.page).toBe(1);
      expect(data.pagination.limit).toBe(10);
    });

    it('should reject negative page number', async () => {
      const response = await request(app)
        .get('/api/posts')
        .query({ page: -1, limit: 10 })
        .expect(400);

      const data = response.body as ValidationErrorResponse;
      expect(data).toHaveProperty('error', 'Validation failed');
      expect(data.details).toBeDefined();
    });

    it('should reject zero page number', async () => {
      const response = await request(app)
        .get('/api/posts')
        .query({ page: 0, limit: 10 })
        .expect(400);

      const data = response.body as ValidationErrorResponse;
      expect(data).toHaveProperty('error', 'Validation failed');
    });

    it('should reject negative limit', async () => {
      const response = await request(app)
        .get('/api/posts')
        .query({ page: 1, limit: -5 })
        .expect(400);

      const data = response.body as ValidationErrorResponse;
      expect(data).toHaveProperty('error', 'Validation failed');
    });

    it('should reject zero limit', async () => {
      const response = await request(app)
        .get('/api/posts')
        .query({ page: 1, limit: 0 })
        .expect(400);

      const data = response.body as ValidationErrorResponse;
      expect(data).toHaveProperty('error', 'Validation failed');
    });

    it('should reject limit greater than 100', async () => {
      const response = await request(app)
        .get('/api/posts')
        .query({ page: 1, limit: 101 })
        .expect(400);

      const data = response.body as ValidationErrorResponse;
      expect(data).toHaveProperty('error', 'Validation failed');
    });

    it('should accept limit of 100 (maximum allowed)', async () => {
      const response = await request(app)
        .get('/api/posts')
        .query({ page: 1, limit: 100 })
        .expect(200);

      const data = response.body as PaginatedPostsResponse;
      expect(data.pagination.limit).toBe(100);
    });

    it('should reject non-numeric page value', async () => {
      const response = await request(app)
        .get('/api/posts')
        .query({ page: 'abc', limit: 10 })
        .expect(400);

      const data = response.body as ValidationErrorResponse;
      expect(data).toHaveProperty('error', 'Validation failed');
    });

    it('should reject non-numeric limit value', async () => {
      const response = await request(app)
        .get('/api/posts')
        .query({ page: 1, limit: 'xyz' })
        .expect(400);

      const data = response.body as ValidationErrorResponse;
      expect(data).toHaveProperty('error', 'Validation failed');
    });

    it('should reject decimal page number', async () => {
      const response = await request(app)
        .get('/api/posts')
        .query({ page: 1.5, limit: 10 })
        .expect(400);

      const data = response.body as ValidationErrorResponse;
      expect(data).toHaveProperty('error', 'Validation failed');
    });

    it('should reject decimal limit', async () => {
      const response = await request(app)
        .get('/api/posts')
        .query({ page: 1, limit: 10.5 })
        .expect(400);

      const data = response.body as ValidationErrorResponse;
      expect(data).toHaveProperty('error', 'Validation failed');
    });
  });

  describe('GET /api/posts/trending - Pagination Validation', () => {
    it('should reject invalid pagination parameters', async () => {
      const response = await request(app)
        .get('/api/posts/trending')
        .query({ page: -1, limit: 200 })
        .expect(400);

      const data = response.body as ValidationErrorResponse;
      expect(data).toHaveProperty('error', 'Validation failed');
    });

    it('should accept valid pagination parameters', async () => {
      const response = await request(app)
        .get('/api/posts/trending')
        .query({ page: 1, limit: 5 })
        .expect(200);

      const data = response.body as PaginatedPostsResponse;
      expect(data).toHaveProperty('pagination');
    });
  });

  describe('GET /api/posts/my-posts - Pagination Validation', () => {
    it('should reject invalid pagination parameters', async () => {
      const response = await request(app)
        .get('/api/posts/my-posts')
        .query({ page: 0, limit: 0 })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      const data = response.body as ValidationErrorResponse;
      expect(data).toHaveProperty('error', 'Validation failed');
    });

    it('should accept valid pagination parameters', async () => {
      const response = await request(app)
        .get('/api/posts/my-posts')
        .query({ page: 1, limit: 20 })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const data = response.body as PaginatedPostsResponse;
      expect(data).toHaveProperty('pagination');
    });
  });

  describe('GET /api/posts/saved - Pagination Validation', () => {
    it('should reject invalid pagination parameters', async () => {
      const response = await request(app)
        .get('/api/posts/saved')
        .query({ page: -5, limit: 150 })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      const data = response.body as ValidationErrorResponse;
      expect(data).toHaveProperty('error', 'Validation failed');
    });

    it('should accept valid pagination parameters', async () => {
      const response = await request(app)
        .get('/api/posts/saved')
        .query({ page: 1, limit: 15 })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const data = response.body as PaginatedPostsResponse;
      expect(data).toHaveProperty('pagination');
    });
  });

  describe('GET /api/users/:userId/followers - Pagination Validation', () => {
    it('should reject invalid pagination parameters', async () => {
      const response = await request(app)
        .get(`/api/users/${userId}/followers`)
        .query({ page: -1, limit: 0 })
        .expect(400);

      const data = response.body as ValidationErrorResponse;
      expect(data).toHaveProperty('error', 'Validation failed');
    });

    it('should accept valid pagination parameters', async () => {
      const response = await request(app)
        .get(`/api/users/${userId}/followers`)
        .query({ page: 1, limit: 20 })
        .expect(200);

      const data = response.body as UserFollowersResponse;
      expect(data).toHaveProperty('page');
      expect(data).toHaveProperty('limit');
    });
  });

  describe('GET /api/users/:userId/following - Pagination Validation', () => {
    it('should reject invalid pagination parameters', async () => {
      const response = await request(app)
        .get(`/api/users/${userId}/following`)
        .query({ page: 0, limit: 101 })
        .expect(400);

      const data = response.body as ValidationErrorResponse;
      expect(data).toHaveProperty('error', 'Validation failed');
    });

    it('should accept valid pagination parameters', async () => {
      const response = await request(app)
        .get(`/api/users/${userId}/following`)
        .query({ page: 1, limit: 20 })
        .expect(200);

      const data = response.body as UserFollowersResponse;
      expect(data).toHaveProperty('page');
      expect(data).toHaveProperty('limit');
    });
  });
});
