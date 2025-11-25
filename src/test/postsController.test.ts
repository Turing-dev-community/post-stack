import request from 'supertest';
import { setupPrismaMock } from './utils/mockPrisma';
import { prisma } from '../lib/prisma';
import app from '../index';
import { generateToken } from '../utils/auth';
import { invalidateCache } from '../middleware/cache';

const { prisma: prismaMock } = setupPrismaMock(prisma, app);

describe('Posts Controller - Deactivated User Filtering (mocked)', () => {
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

  describe('PUT /api/posts/:id - Slug Collision Handling', () => {
    it('should generate new slug when title changes without collision', async () => {
      const postId = 'post-to-update';
      const existingPost = {
        id: postId,
        title: 'Original Title',
        content: '# Content',
        slug: 'original-title',
        published: true,
        featured: false,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        authorId: activeUserId,
        categoryId: null,
        viewCount: 0,
      };

      (prismaMock.post.findUnique as jest.Mock)
        .mockResolvedValueOnce(existingPost) // For existing post check
        .mockResolvedValueOnce(null); // For slug collision check (no collision)

      (prismaMock.$transaction as jest.Mock).mockImplementation(async (callback: any) => {
        return callback({
          postTag: {
            deleteMany: jest.fn().mockResolvedValue({}),
          },
          post: {
            update: jest.fn().mockResolvedValue({
              ...existingPost,
              title: 'Completely New Title',
              slug: 'completely-new-title',
              updatedAt: new Date(),
              author: { id: activeUserId, username: 'activeuser' },
              category: null,
              tags: [],
            }),
          },
        });
      });

      (prismaMock.postLike.count as jest.Mock).mockResolvedValue(0);

      const response = await request(app)
        .put(`/api/posts/${postId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Completely New Title',
          content: '# Updated Content',
        })
        .expect(200);

      expect(response.body.post.slug).toBe('completely-new-title');
    });

    it('should append -2 suffix when new slug conflicts with existing post', async () => {
      const postId = 'post-to-update';
      const existingPost = {
        id: postId,
        title: 'Original Title',
        content: '# Content',
        slug: 'original-title',
        published: true,
        featured: false,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        authorId: activeUserId,
        categoryId: null,
        viewCount: 0,
      };

      // Mock: existing post check
      (prismaMock.post.findUnique as jest.Mock)
        .mockResolvedValueOnce(existingPost) // For existing post check
        .mockResolvedValueOnce({ id: 'other-post-id' }) // For slug collision check (base slug exists)
        .mockResolvedValueOnce(null); // For slug collision check (-2 doesn't exist)

      (prismaMock.$transaction as jest.Mock).mockImplementation(async (callback: any) => {
        return callback({
          postTag: {
            deleteMany: jest.fn().mockResolvedValue({}),
          },
          post: {
            update: jest.fn().mockResolvedValue({
              ...existingPost,
              title: 'My Awesome Post',
              slug: 'my-awesome-post-2',
              updatedAt: new Date(),
              author: { id: activeUserId, username: 'activeuser' },
              category: null,
              tags: [],
            }),
          },
        });
      });

      (prismaMock.postLike.count as jest.Mock).mockResolvedValue(0);

      const response = await request(app)
        .put(`/api/posts/${postId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'My Awesome Post',
          content: '# Updated Content',
        })
        .expect(200);

      expect(response.body.post.slug).toBe('my-awesome-post-2');
    });

    it('should find next available suffix when multiple collisions exist', async () => {
      const postId = 'post-to-update';
      const existingPost = {
        id: postId,
        title: 'Original Title',
        content: '# Content',
        slug: 'original-title',
        published: true,
        featured: false,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        authorId: activeUserId,
        categoryId: null,
        viewCount: 0,
      };

      // Mock: existing post check
      (prismaMock.post.findUnique as jest.Mock)
        .mockResolvedValueOnce(existingPost) // For existing post check
        .mockResolvedValueOnce({ id: 'other-post-1' }) // Base slug exists
        .mockResolvedValueOnce({ id: 'other-post-2' }) // -2 exists
        .mockResolvedValueOnce(null); // -3 doesn't exist

      (prismaMock.$transaction as jest.Mock).mockImplementation(async (callback: any) => {
        return callback({
          postTag: {
            deleteMany: jest.fn().mockResolvedValue({}),
          },
          post: {
            update: jest.fn().mockResolvedValue({
              ...existingPost,
              title: 'Test Post',
              slug: 'test-post-3',
              updatedAt: new Date(),
              author: { id: activeUserId, username: 'activeuser' },
              category: null,
              tags: [],
            }),
          },
        });
      });

      (prismaMock.postLike.count as jest.Mock).mockResolvedValue(0);

      const response = await request(app)
        .put(`/api/posts/${postId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test Post',
          content: '# Updated Content',
        })
        .expect(200);

      expect(response.body.post.slug).toBe('test-post-3');
    });

    it('should not conflict with own slug when updating title', async () => {
      const postId = 'post-to-update';
      const existingPost = {
        id: postId,
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
      };

      // Mock: existing post check
      (prismaMock.post.findUnique as jest.Mock)
        .mockResolvedValueOnce(existingPost) // For existing post check
        .mockResolvedValueOnce({ id: postId }); // For slug collision check (same post, should be excluded)

      (prismaMock.$transaction as jest.Mock).mockImplementation(async (callback: any) => {
        return callback({
          postTag: {
            deleteMany: jest.fn().mockResolvedValue({}),
          },
          post: {
            update: jest.fn().mockResolvedValue({
              ...existingPost,
              title: 'My Post',
              slug: 'my-post', // Same slug (excluded from collision check)
              updatedAt: new Date(),
              author: { id: activeUserId, username: 'activeuser' },
              category: null,
              tags: [],
            }),
          },
        });
      });

      (prismaMock.postLike.count as jest.Mock).mockResolvedValue(0);

      const response = await request(app)
        .put(`/api/posts/${postId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'My Post', // Same title, same slug
          content: '# Updated Content',
        })
        .expect(200);

      expect(response.body.post.slug).toBe('my-post');
    });

    it('should keep same slug when title does not change', async () => {
      const postId = 'post-to-update';
      const existingPost = {
        id: postId,
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
      };

      (prismaMock.post.findUnique as jest.Mock).mockResolvedValueOnce(existingPost);

      (prismaMock.$transaction as jest.Mock).mockImplementation(async (callback: any) => {
        return callback({
          postTag: {
            deleteMany: jest.fn().mockResolvedValue({}),
          },
          post: {
            update: jest.fn().mockResolvedValue({
              ...existingPost,
              content: '# Updated Content',
              featured: true,
              slug: 'my-post', // Same slug (title didn't change)
              updatedAt: new Date(),
              author: { id: activeUserId, username: 'activeuser' },
              category: null,
              tags: [],
            }),
          },
        });
      });

      (prismaMock.postLike.count as jest.Mock).mockResolvedValue(0);

      const response = await request(app)
        .put(`/api/posts/${postId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'My Post', // Same title
          content: '# Updated Content',
          featured: true,
        })
        .expect(200);

      expect(response.body.post.slug).toBe('my-post');
    });
  });

  describe('POST /api/posts - Post Excerpt Feature', () => {
    it('should create a post with explicit excerpt', async () => {
      const postData = {
        title: 'Post with Excerpt',
        content: '# Content',
        excerpt: 'This is a custom excerpt for the post',
        published: false,
      };

      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue(null); // No slug collision
      (prismaMock.post.create as jest.Mock).mockResolvedValue({
        id: 'post-1',
        ...postData,
        slug: 'post-with-excerpt',
        featured: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        authorId: activeUserId,
        categoryId: null,
        metaTitle: null,
        metaDescription: null,
        ogImage: null,
        viewCount: 0,
        author: { id: activeUserId, username: 'activeuser' },
        category: null,
        tags: [],
      });
      (prismaMock.postLike.count as jest.Mock).mockResolvedValue(0);

      const response = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(postData)
        .expect(201);

      expect(response.body.post.excerpt).toBe('This is a custom excerpt for the post');
      expect(prismaMock.post.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            excerpt: 'This is a custom excerpt for the post',
          }),
        })
      );
    });

    it('should use metaDescription as excerpt when excerpt is not provided', async () => {
      const postData = {
        title: 'Post without Excerpt',
        content: '# Content',
        metaDescription: 'This is the meta description',
        published: false,
      };

      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaMock.post.create as jest.Mock).mockResolvedValue({
        id: 'post-2',
        ...postData,
        excerpt: 'This is the meta description', // Should use metaDescription
        slug: 'post-without-excerpt',
        featured: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        authorId: activeUserId,
        categoryId: null,
        metaTitle: null,
        ogImage: null,
        viewCount: 0,
        author: { id: activeUserId, username: 'activeuser' },
        category: null,
        tags: [],
      });
      (prismaMock.postLike.count as jest.Mock).mockResolvedValue(0);

      const response = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(postData)
        .expect(201);

      expect(response.body.post.excerpt).toBe('This is the meta description');
      expect(prismaMock.post.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            excerpt: 'This is the meta description',
          }),
        })
      );
    });

    it('should set excerpt to null when neither excerpt nor metaDescription is provided', async () => {
      const postData = {
        title: 'Post without Excerpt or Meta',
        content: '# Content',
        published: false,
      };

      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaMock.post.create as jest.Mock).mockResolvedValue({
        id: 'post-3',
        ...postData,
        excerpt: null,
        slug: 'post-without-excerpt-or-meta',
        featured: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        authorId: activeUserId,
        categoryId: null,
        metaTitle: null,
        metaDescription: null,
        ogImage: null,
        viewCount: 0,
        author: { id: activeUserId, username: 'activeuser' },
        category: null,
        tags: [],
      });
      (prismaMock.postLike.count as jest.Mock).mockResolvedValue(0);

      const response = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(postData)
        .expect(201);

      expect(response.body.post.excerpt).toBeNull();
      expect(prismaMock.post.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            excerpt: null,
          }),
        })
      );
    });

    it('should reject excerpt longer than 500 characters', async () => {
      const longExcerpt = 'a'.repeat(501);
      const postData = {
        title: 'Post with Long Excerpt',
        content: '# Content',
        excerpt: longExcerpt,
        published: false,
      };

      const response = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(postData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('ValidationError');
      response.body.details.some(
        (detail: any) => detail.msg === "Excerpt must be 500 characters or less"
      );
      expect(prismaMock.post.create).not.toHaveBeenCalled();
    });
  });

  describe('PUT /api/posts/:id - Post Excerpt Updates', () => {
    it('should update post with new excerpt', async () => {
      const postId = 'post-to-update-excerpt';
      const existingPost = {
        id: postId,
        title: 'Original Title',
        content: '# Content',
        slug: 'original-title',
        published: true,
        featured: false,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        authorId: activeUserId,
        categoryId: null,
        excerpt: 'Old excerpt',
        metaDescription: 'Old meta description',
        viewCount: 0,
      };

      (prismaMock.post.findUnique as jest.Mock).mockResolvedValueOnce(existingPost);

      (prismaMock.$transaction as jest.Mock).mockImplementation(async (callback: any) => {
        return callback({
          postTag: {
            deleteMany: jest.fn().mockResolvedValue({}),
          },
          post: {
            update: jest.fn().mockResolvedValue({
              ...existingPost,
              excerpt: 'New excerpt',
              updatedAt: new Date(),
              author: { id: activeUserId, username: 'activeuser' },
              category: null,
              tags: [],
            }),
          },
        });
      });

      (prismaMock.postLike.count as jest.Mock).mockResolvedValue(0);

      const response = await request(app)
        .put(`/api/posts/${postId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Original Title',
          content: '# Content',
          excerpt: 'New excerpt',
        })
        .expect(200);

      expect(response.body.post.excerpt).toBe('New excerpt');
    });

    it('should clear excerpt when set to null', async () => {
      const postId = 'post-to-clear-excerpt';
      const existingPost = {
        id: postId,
        title: 'Original Title',
        content: '# Content',
        slug: 'original-title',
        published: true,
        featured: false,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        authorId: activeUserId,
        categoryId: null,
        excerpt: 'Existing excerpt',
        metaDescription: 'Meta description',
        viewCount: 0,
      };

      (prismaMock.post.findUnique as jest.Mock).mockResolvedValueOnce(existingPost);

      (prismaMock.$transaction as jest.Mock).mockImplementation(async (callback: any) => {
        return callback({
          postTag: {
            deleteMany: jest.fn().mockResolvedValue({}),
          },
          post: {
            update: jest.fn().mockResolvedValue({
              ...existingPost,
              excerpt: null,
              updatedAt: new Date(),
              author: { id: activeUserId, username: 'activeuser' },
              category: null,
              tags: [],
            }),
          },
        });
      });

      (prismaMock.postLike.count as jest.Mock).mockResolvedValue(0);

      const response = await request(app)
        .put(`/api/posts/${postId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Original Title',
          content: '# Content',
          excerpt: null,
        })
        .expect(200);

      expect(response.body.post.excerpt).toBeNull();
    });

    it('should update excerpt to new metaDescription when excerpt matches old metaDescription', async () => {
      const postId = 'post-with-matching-excerpt';
      const existingPost = {
        id: postId,
        title: 'Original Title',
        content: '# Content',
        slug: 'original-title',
        published: true,
        featured: false,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        authorId: activeUserId,
        categoryId: null,
        excerpt: 'Old meta description', // Matches old metaDescription
        metaDescription: 'Old meta description',
        viewCount: 0,
      };

      (prismaMock.post.findUnique as jest.Mock).mockResolvedValueOnce(existingPost);

      (prismaMock.$transaction as jest.Mock).mockImplementation(async (callback: any) => {
        return callback({
          postTag: {
            deleteMany: jest.fn().mockResolvedValue({}),
          },
          post: {
            update: jest.fn().mockResolvedValue({
              ...existingPost,
              excerpt: 'New meta description', // Should update to new metaDescription
              metaDescription: 'New meta description',
              updatedAt: new Date(),
              author: { id: activeUserId, username: 'activeuser' },
              category: null,
              tags: [],
            }),
          },
        });
      });

      (prismaMock.postLike.count as jest.Mock).mockResolvedValue(0);

      const response = await request(app)
        .put(`/api/posts/${postId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Original Title',
          content: '# Content',
          metaDescription: 'New meta description', // Only updating metaDescription
        })
        .expect(200);

      expect(response.body.post.excerpt).toBe('New meta description');
      expect(response.body.post.metaDescription).toBe('New meta description');
    });

    it('should preserve custom excerpt when metaDescription is updated', async () => {
      const postId = 'post-with-custom-excerpt';
      const existingPost = {
        id: postId,
        title: 'Original Title',
        content: '# Content',
        slug: 'original-title',
        published: true,
        featured: false,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        authorId: activeUserId,
        categoryId: null,
        excerpt: 'Custom excerpt text', // Custom excerpt, different from metaDescription
        metaDescription: 'Old meta description',
        viewCount: 0,
      };

      (prismaMock.post.findUnique as jest.Mock).mockResolvedValueOnce(existingPost);

      (prismaMock.$transaction as jest.Mock).mockImplementation(async (callback: any) => {
        return callback({
          postTag: {
            deleteMany: jest.fn().mockResolvedValue({}),
          },
          post: {
            update: jest.fn().mockResolvedValue({
              ...existingPost,
              metaDescription: 'New meta description', // Only metaDescription updated
              // excerpt should remain unchanged
              updatedAt: new Date(),
              author: { id: activeUserId, username: 'activeuser' },
              category: null,
              tags: [],
            }),
          },
        });
      });

      (prismaMock.postLike.count as jest.Mock).mockResolvedValue(0);

      const response = await request(app)
        .put(`/api/posts/${postId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Original Title',
          content: '# Content',
          metaDescription: 'New meta description',
        })
        .expect(200);

      expect(response.body.post.excerpt).toBe('Custom excerpt text'); // Should preserve custom excerpt
      expect(response.body.post.metaDescription).toBe('New meta description');
    });
  });

  describe('POST /api/posts/bulk - Post Excerpt in Bulk Creation', () => {
    it('should create multiple posts with excerpt support', async () => {
      const postsData = [
        {
          title: 'Bulk Post 1',
          content: '# Content 1',
          excerpt: 'Custom excerpt for post 1',
          published: false,
        },
        {
          title: 'Bulk Post 2',
          content: '# Content 2',
          metaDescription: 'Meta description for post 2',
          published: false,
        },
        {
          title: 'Bulk Post 3',
          content: '# Content 3',
          published: false,
        },
      ];

      const mockPosts = [
        {
          id: 'post-1',
          title: 'Bulk Post 1',
          content: '# Content 1',
          slug: 'bulk-post-1',
          excerpt: 'Custom excerpt for post 1',
          metaDescription: null,
          published: false,
          featured: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          authorId: activeUserId,
          categoryId: null,
          metaTitle: null,
          ogImage: null,
          viewCount: 0,
          author: { id: activeUserId, username: 'activeuser' },
          category: null,
          tags: [],
        },
        {
          id: 'post-2',
          title: 'Bulk Post 2',
          content: '# Content 2',
          slug: 'bulk-post-2',
          excerpt: 'Meta description for post 2', // Should use metaDescription
          metaDescription: 'Meta description for post 2',
          published: false,
          featured: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          authorId: activeUserId,
          categoryId: null,
          metaTitle: null,
          ogImage: null,
          viewCount: 0,
          author: { id: activeUserId, username: 'activeuser' },
          category: null,
          tags: [],
        },
        {
          id: 'post-3',
          title: 'Bulk Post 3',
          content: '# Content 3',
          slug: 'bulk-post-3',
          excerpt: null, // No excerpt or metaDescription
          metaDescription: null,
          published: false,
          featured: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          authorId: activeUserId,
          categoryId: null,
          metaTitle: null,
          ogImage: null,
          viewCount: 0,
          author: { id: activeUserId, username: 'activeuser' },
          category: null,
          tags: [],
        },
      ];

      // Mock slug checks
      (prismaMock.post.findMany as jest.Mock).mockResolvedValue([]); // No existing slugs

      (prismaMock.$transaction as jest.Mock).mockImplementation(async (promises: any[]) => {
        return Promise.all(
          promises.map((_, index) => Promise.resolve(mockPosts[index]))
        );
      });

      const response = await request(app)
        .post('/api/posts/bulk')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ posts: postsData })
        .expect(201);

      expect(response.body.posts).toHaveLength(3);
      expect(response.body.posts[0].excerpt).toBe('Custom excerpt for post 1');
      expect(response.body.posts[1].excerpt).toBe('Meta description for post 2'); // Should use metaDescription
      expect(response.body.posts[2].excerpt).toBeNull(); // No excerpt or metaDescription
    });

    it('should validate excerpt length for each post in bulk creation', async () => {
      const longExcerpt = 'a'.repeat(501);
      const postsData = [
        {
          title: 'Valid Post',
          content: '# Content',
          excerpt: 'Valid excerpt',
          published: false,
        },
        {
          title: 'Invalid Post',
          content: '# Content',
          excerpt: longExcerpt, // Too long
          published: false,
        },
      ];

      const response = await request(app)
        .post('/api/posts/bulk')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ posts: postsData })
        .expect(400);

        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toBe('ValidationError');
        response.body.details.some(
          (detail: any) => detail.msg === "Excerpt must be 500 characters or less"
        );      expect(prismaMock.post.create).not.toHaveBeenCalled();
    });
  });
});

