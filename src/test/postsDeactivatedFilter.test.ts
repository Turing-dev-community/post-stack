import request from 'supertest';
import { setupPrismaMock } from './utils/mockPrisma';
import { prisma } from '../lib/prisma';
import app from '../index';
import { generateToken } from '../utils/auth';
import { invalidateCache } from '../middleware/cache';

const { prisma: prismaMock } = setupPrismaMock(prisma, app);

describe('Posts Deactivated User Filtering (mocked)', () => {
  const activeUserId = 'active-user-1';
  const deactivatedUserId = 'deactivated-user-1';
  const activeUser2Id = 'active-user-2';
  const authToken = (() => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
    return generateToken(activeUserId);
  })();

  beforeEach(() => {
    jest.clearAllMocks();
    invalidateCache.invalidateAll();
    
    // Mock authenticateToken middleware for active user
    (prismaMock.user.findUnique as jest.Mock).mockImplementation(async (args: any) => {
      if (args.where.id === activeUserId || args.where.email?.includes('active')) {
        return {
          id: activeUserId,
          email: 'active@example.com',
          username: 'activeuser',
          deletedAt: null,
        };
      }
      if (args.where.id === deactivatedUserId || args.where.email?.includes('deactivated')) {
        return {
          id: deactivatedUserId,
          email: 'deactivated@example.com',
          username: 'deactivateduser',
          deletedAt: new Date(),
        };
      }
      return null;
    });
  });

  describe('GET /api/posts', () => {
    it('should exclude posts from deactivated users', async () => {
      const activePost = {
        id: 'post-active',
        title: 'Active Post',
        content: '# Content',
        slug: 'active-post',
        published: true,
        featured: false,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        authorId: activeUserId,
        categoryId: null,
        viewCount: 0,
        author: { id: activeUserId, username: 'activeuser' },
        category: null,
        tags: [],
      };

      const deactivatedPost = {
        id: 'post-deactivated',
        title: 'Deactivated Post',
        content: '# Content',
        slug: 'deactivated-post',
        published: true,
        featured: false,
        createdAt: new Date('2024-01-02'),
        updatedAt: new Date('2024-01-02'),
        authorId: deactivatedUserId,
        categoryId: null,
        viewCount: 0,
        author: { id: deactivatedUserId, username: 'deactivateduser' },
        category: null,
        tags: [],
      };

      (prismaMock.post.findMany as jest.Mock).mockResolvedValue([activePost]);
      (prismaMock.postLike.count as jest.Mock).mockResolvedValue(0);
      (prismaMock.post.count as jest.Mock).mockResolvedValue(1);

      const response = await request(app)
        .get('/api/posts')
        .expect(200);

      expect(response.body).toHaveProperty('posts');
      expect(response.body.posts).toHaveLength(1);
      expect(response.body.posts[0].id).toBe('post-active');
      expect(response.body.posts[0].author.id).toBe(activeUserId);
      expect(response.body.pagination.total).toBe(1);

      // Verify the query included author filter
      expect(prismaMock.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            published: true,
            author: {
              deletedAt: null,
            },
          }),
        })
      );
    });

    it('should handle mixed active and deactivated authors correctly', async () => {
      const activePost1 = {
        id: 'post-active-1',
        title: 'Active Post 1',
        content: '# Content',
        slug: 'active-post-1',
        published: true,
        featured: false,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        authorId: activeUserId,
        categoryId: null,
        viewCount: 0,
        author: { id: activeUserId, username: 'activeuser' },
        category: null,
        tags: [],
      };

      const activePost2 = {
        id: 'post-active-2',
        title: 'Active Post 2',
        content: '# Content',
        slug: 'active-post-2',
        published: true,
        featured: false,
        createdAt: new Date('2024-01-02'),
        updatedAt: new Date('2024-01-02'),
        authorId: activeUser2Id,
        categoryId: null,
        viewCount: 0,
        author: { id: activeUser2Id, username: 'activeuser2' },
        category: null,
        tags: [],
      };

      (prismaMock.post.findMany as jest.Mock).mockResolvedValue([activePost1, activePost2]);
      (prismaMock.postLike.count as jest.Mock).mockResolvedValue(0);
      (prismaMock.post.count as jest.Mock).mockResolvedValue(2);

      const response = await request(app)
        .get('/api/posts')
        .expect(200);

      expect(response.body.posts).toHaveLength(2);
      expect(response.body.posts.every((p: any) => p.author.id !== deactivatedUserId)).toBe(true);
      expect(response.body.pagination.total).toBe(2);
    });
  });

  describe('GET /api/posts/trending', () => {
    it('should exclude posts from deactivated users', async () => {
      const activePost = {
        id: 'post-trending-active',
        title: 'Trending Active Post',
        content: '# Content',
        slug: 'trending-active-post',
        published: true,
        featured: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        authorId: activeUserId,
        categoryId: null,
        viewCount: 100,
        author: { id: activeUserId, username: 'activeuser' },
        category: null,
        tags: [],
      };

      (prismaMock.post.findMany as jest.Mock).mockResolvedValue([activePost]);
      (prismaMock.post.count as jest.Mock).mockResolvedValue(1);

      const response = await request(app)
        .get('/api/posts/trending')
        .expect(200);

      expect(response.body.posts).toHaveLength(1);
      expect(response.body.posts[0].author.id).toBe(activeUserId);

      expect(prismaMock.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            published: true,
            author: {
              deletedAt: null,
            },
          }),
        })
      );
    });
  });

  describe('GET /api/posts/:slug', () => {
    it('should return 404 for post by deactivated user', async () => {
      const deactivatedPost = {
        id: 'post-deactivated',
        title: 'Deactivated Post',
        content: '# Content',
        slug: 'deactivated-post',
        published: true,
        featured: false,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        authorId: deactivatedUserId,
        categoryId: null,
        viewCount: 0,
        author: { id: deactivatedUserId, username: 'deactivateduser', deletedAt: new Date() },
        category: null,
        tags: [],
      };

      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue(deactivatedPost);

      const response = await request(app)
        .get('/api/posts/deactivated-post')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Post not found');

      expect(prismaMock.post.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            slug: 'deactivated-post',
          },
        })
      );
    });

    it('should return 404 for unpublished post', async () => {
      const unpublishedPost = {
        id: 'post-unpublished',
        title: 'Unpublished Post',
        content: '# Content',
        slug: 'unpublished-post',
        published: false,
        featured: false,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        authorId: activeUserId,
        categoryId: null,
        viewCount: 0,
        author: { id: activeUserId, username: 'activeuser', deletedAt: null },
        category: null,
        tags: [],
      };

      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue(unpublishedPost);

      const response = await request(app)
        .get('/api/posts/unpublished-post')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Post not found');
    });

    it('should return post from active user', async () => {
      const activePost = {
        id: 'post-active',
        title: 'Active Post',
        content: '# Content',
        slug: 'active-post',
        published: true,
        featured: false,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        authorId: activeUserId,
        categoryId: null,
        viewCount: 0,
        author: { id: activeUserId, username: 'activeuser', deletedAt: null },
        category: null,
        tags: [],
      };

      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue(activePost);
      (prismaMock.postLike.count as jest.Mock).mockResolvedValue(5);
      (prismaMock.post.update as jest.Mock).mockResolvedValue({ ...activePost, viewCount: 1 });

      const response = await request(app)
        .get('/api/posts/active-post')
        .expect(200);

      expect(response.body.post).toBeDefined();
      expect(response.body.post.author.id).toBe(activeUserId);
      expect(response.body.post.author.deletedAt).toBeUndefined(); // deletedAt should not be in response
    });
  });

  describe('GET /api/posts/:slug/related', () => {
    it('should exclude related posts from deactivated users', async () => {
      const mainPost = {
        id: 'post-main',
        slug: 'main-post',
        published: true,
        tags: [{ tagId: 'tag-1' }],
      };

      const relatedActivePost = {
        id: 'post-related-active',
        title: 'Related Active Post',
        content: '# Content',
        slug: 'related-active-post',
        published: true,
        featured: false,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        authorId: activeUserId,
        categoryId: null,
        viewCount: 0,
        author: { id: activeUserId, username: 'activeuser' },
        category: null,
        tags: [{ tag: { id: 'tag-1', name: 'tech' } }],
      };

      (prismaMock.post.findUnique as jest.Mock).mockResolvedValueOnce(mainPost);
      (prismaMock.post.findMany as jest.Mock).mockResolvedValue([relatedActivePost]);
      (prismaMock.postLike.count as jest.Mock).mockResolvedValue(0);

      const response = await request(app)
        .get('/api/posts/main-post/related')
        .expect(200);

      expect(response.body.posts).toHaveLength(1);
      expect(response.body.posts[0].author.id).toBe(activeUserId);

      expect(prismaMock.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            published: true,
            author: {
              deletedAt: null,
            },
          }),
        })
      );
    });
  });

  describe('GET /api/posts/saved', () => {
    it('should exclude saved posts from deactivated users', async () => {
      const savedPost = {
        id: 'saved-1',
        userId: activeUserId,
        postId: 'post-active',
        createdAt: new Date(),
        post: {
          id: 'post-active',
          title: 'Active Post',
          content: '# Content',
          slug: 'active-post',
          published: true,
          featured: false,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
          authorId: activeUserId,
          categoryId: null,
          viewCount: 0,
          author: { id: activeUserId, username: 'activeuser' },
          category: null,
          tags: [],
        },
      };

      (prismaMock.savedPost.findMany as jest.Mock).mockResolvedValue([savedPost]);
      (prismaMock.postLike.count as jest.Mock).mockResolvedValue(0);
      (prismaMock.savedPost.count as jest.Mock).mockResolvedValue(1);

      const response = await request(app)
        .get('/api/posts/saved')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.posts).toHaveLength(1);
      expect(response.body.posts[0].author.id).toBe(activeUserId);

      expect(prismaMock.savedPost.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: activeUserId,
            post: {
              author: {
                deletedAt: null,
              },
            },
          }),
        })
      );
    });
  });

  describe('GET /api/posts/my-posts', () => {
    it('should show user\'s own posts even if user is deactivated', async () => {
      // Note: This test verifies that getMyPosts doesn't filter by deletedAt
      // because users should see their own posts regardless of account status
      const myPost = {
        id: 'post-my',
        title: 'My Post',
        content: '# Content',
        slug: 'my-post',
        published: true,
        featured: false,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        authorId: activeUserId,
        categoryId: null,
        viewCount: 0,
        author: { id: activeUserId, username: 'activeuser' },
        category: null,
        tags: [],
      };

      (prismaMock.post.findMany as jest.Mock).mockResolvedValue([myPost]);
      (prismaMock.postLike.count as jest.Mock).mockResolvedValue(0);
      (prismaMock.post.count as jest.Mock).mockResolvedValue(1);

      const response = await request(app)
        .get('/api/posts/my-posts')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.posts).toHaveLength(1);
      expect(response.body.posts[0].id).toBe('post-my');

      // Verify getMyPosts doesn't filter by author.deletedAt
      expect(prismaMock.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            authorId: activeUserId,
            // Should NOT have author: { deletedAt: null }
          },
        })
      );
    });
  });

  describe('Pagination with deactivated users', () => {
    it('should return correct total count after filtering deactivated users', async () => {
      const activePost = {
        id: 'post-active',
        title: 'Active Post',
        content: '# Content',
        slug: 'active-post',
        published: true,
        featured: false,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        authorId: activeUserId,
        categoryId: null,
        viewCount: 0,
        author: { id: activeUserId, username: 'activeuser' },
        category: null,
        tags: [],
      };

      (prismaMock.post.findMany as jest.Mock).mockResolvedValue([activePost]);
      (prismaMock.postLike.count as jest.Mock).mockResolvedValue(0);
      (prismaMock.post.count as jest.Mock).mockResolvedValue(1);

      const response = await request(app)
        .get('/api/posts?page=1&limit=10')
        .expect(200);

      expect(response.body.pagination.total).toBe(1);
      expect(response.body.pagination.pages).toBe(1);

      // Verify count query also includes author filter
      expect(prismaMock.post.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            published: true,
            author: {
              deletedAt: null,
            },
          }),
        })
      );
    });
  });
});

