import { prisma } from './setup';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

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
  const baseUrl = `http://localhost:${process.env.PORT}/api`;
  let authToken: string;
  let userId: string;

  beforeEach(async () => {
    // Create test user with unique email/username to avoid conflicts
    // Only create user - no post needed for most pagination validation tests
    const timestamp = Date.now();
    const hashedPassword = await bcrypt.hash('Password123', 12);
    const user = await prisma.user.create({
      data: {
        email: `pagination-${timestamp}@example.com`,
        username: `paginationuser${timestamp}`,
        password: hashedPassword,
      },
    });
    userId = user.id;
    authToken = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!);
  });

  describe('GET /api/posts - Pagination Validation', () => {
    it('should accept valid pagination parameters', async () => {
      const response = await fetch(`${baseUrl}/posts?page=1&limit=10`);
      expect(response.status).toBe(200);
      const data = await response.json() as PaginatedPostsResponse;
      expect(data).toHaveProperty('pagination');
      expect(data.pagination.page).toBe(1);
      expect(data.pagination.limit).toBe(10);
    });

    it('should use default values when pagination parameters are not provided', async () => {
      const response = await fetch(`${baseUrl}/posts`);
      expect(response.status).toBe(200);
      const data = await response.json() as PaginatedPostsResponse;
      expect(data).toHaveProperty('pagination');
      expect(data.pagination.page).toBe(1);
      expect(data.pagination.limit).toBe(10);
    });

    it('should reject negative page number', async () => {
      const response = await fetch(`${baseUrl}/posts?page=-1&limit=10`);
      expect(response.status).toBe(400);
      const data = await response.json() as ValidationErrorResponse;
      expect(data).toHaveProperty('error', 'Validation failed');
      expect(data.details).toBeDefined();
    });

    it('should reject zero page number', async () => {
      const response = await fetch(`${baseUrl}/posts?page=0&limit=10`);
      expect(response.status).toBe(400);
      const data = await response.json() as ValidationErrorResponse;
      expect(data).toHaveProperty('error', 'Validation failed');
    });

    it('should reject negative limit', async () => {
      const response = await fetch(`${baseUrl}/posts?page=1&limit=-5`);
      expect(response.status).toBe(400);
      const data = await response.json() as ValidationErrorResponse;
      expect(data).toHaveProperty('error', 'Validation failed');
    });

    it('should reject zero limit', async () => {
      const response = await fetch(`${baseUrl}/posts?page=1&limit=0`);
      expect(response.status).toBe(400);
      const data = await response.json() as ValidationErrorResponse;
      expect(data).toHaveProperty('error', 'Validation failed');
    });

    it('should reject limit greater than 100', async () => {
      const response = await fetch(`${baseUrl}/posts?page=1&limit=101`);
      expect(response.status).toBe(400);
      const data = await response.json() as ValidationErrorResponse;
      expect(data).toHaveProperty('error', 'Validation failed');
    });

    it('should accept limit of 100 (maximum allowed)', async () => {
      const response = await fetch(`${baseUrl}/posts?page=1&limit=100`);
      expect(response.status).toBe(200);
      const data = await response.json() as PaginatedPostsResponse;
      expect(data.pagination.limit).toBe(100);
    });

    it('should reject non-numeric page value', async () => {
      const response = await fetch(`${baseUrl}/posts?page=abc&limit=10`);
      expect(response.status).toBe(400);
      const data = await response.json() as ValidationErrorResponse;
      expect(data).toHaveProperty('error', 'Validation failed');
    });

    it('should reject non-numeric limit value', async () => {
      const response = await fetch(`${baseUrl}/posts?page=1&limit=xyz`);
      expect(response.status).toBe(400);
      const data = await response.json() as ValidationErrorResponse;
      expect(data).toHaveProperty('error', 'Validation failed');
    });

    it('should reject decimal page number', async () => {
      const response = await fetch(`${baseUrl}/posts?page=1.5&limit=10`);
      expect(response.status).toBe(400);
      const data = await response.json() as ValidationErrorResponse;
      expect(data).toHaveProperty('error', 'Validation failed');
    });

    it('should reject decimal limit', async () => {
      const response = await fetch(`${baseUrl}/posts?page=1&limit=10.5`);
      expect(response.status).toBe(400);
      const data = await response.json() as ValidationErrorResponse;
      expect(data).toHaveProperty('error', 'Validation failed');
    });
  });

  describe('GET /api/posts/trending - Pagination Validation', () => {
    it('should reject invalid pagination parameters', async () => {
      const response = await fetch(`${baseUrl}/posts/trending?page=-1&limit=200`);
      expect(response.status).toBe(400);
      const data = await response.json() as ValidationErrorResponse;
      expect(data).toHaveProperty('error', 'Validation failed');
    });

    it('should accept valid pagination parameters', async () => {
      const response = await fetch(`${baseUrl}/posts/trending?page=1&limit=5`);
      expect(response.status).toBe(200);
      const data = await response.json() as PaginatedPostsResponse;
      expect(data).toHaveProperty('pagination');
    });
  });

  describe('GET /api/posts/my-posts - Pagination Validation', () => {
    it('should reject invalid pagination parameters', async () => {
      const response = await fetch(`${baseUrl}/posts/my-posts?page=0&limit=0`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      expect(response.status).toBe(400);
      const data = await response.json() as ValidationErrorResponse;
      expect(data).toHaveProperty('error', 'Validation failed');
    });

    it('should accept valid pagination parameters', async () => {
      const response = await fetch(`${baseUrl}/posts/my-posts?page=1&limit=20`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      expect(response.status).toBe(200);
      const data = await response.json() as PaginatedPostsResponse;
      expect(data).toHaveProperty('pagination');
    });
  });

  describe('GET /api/posts/saved - Pagination Validation', () => {
    it('should reject invalid pagination parameters', async () => {
      const response = await fetch(`${baseUrl}/posts/saved?page=-5&limit=150`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      expect(response.status).toBe(400);
      const data = await response.json() as ValidationErrorResponse;
      expect(data).toHaveProperty('error', 'Validation failed');
    });

    it('should accept valid pagination parameters', async () => {
      const response = await fetch(`${baseUrl}/posts/saved?page=1&limit=15`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      expect(response.status).toBe(200);
      const data = await response.json() as PaginatedPostsResponse;
      expect(data).toHaveProperty('pagination');
    });
  });

  describe('GET /api/users/:userId/followers - Pagination Validation', () => {
    it('should reject invalid pagination parameters', async () => {
      const response = await fetch(`${baseUrl}/users/${userId}/followers?page=-1&limit=0`);
      expect(response.status).toBe(400);
      const data = await response.json() as ValidationErrorResponse;
      expect(data).toHaveProperty('error', 'Validation failed');
    });

    it('should accept valid pagination parameters', async () => {
      const response = await fetch(`${baseUrl}/users/${userId}/followers?page=1&limit=20`);
      expect(response.status).toBe(200);
      const data = await response.json() as UserFollowersResponse;
      expect(data).toHaveProperty('page');
      expect(data).toHaveProperty('limit');
    });
  });

  describe('GET /api/users/:userId/following - Pagination Validation', () => {
    it('should reject invalid pagination parameters', async () => {
      const response = await fetch(`${baseUrl}/users/${userId}/following?page=0&limit=101`);
      expect(response.status).toBe(400);
      const data = await response.json() as ValidationErrorResponse;
      expect(data).toHaveProperty('error', 'Validation failed');
    });

    it('should accept valid pagination parameters', async () => {
      const response = await fetch(`${baseUrl}/users/${userId}/following?page=1&limit=20`);
      expect(response.status).toBe(200);
      const data = await response.json() as UserFollowersResponse;
      expect(data).toHaveProperty('page');
      expect(data).toHaveProperty('limit');
    });
  });
});

