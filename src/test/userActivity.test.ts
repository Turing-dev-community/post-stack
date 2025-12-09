import { PrismaClient } from '@prisma/client';
import { mockDeep } from 'jest-mock-extended';

// Mock prisma before importing it
jest.mock('../lib/prisma', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));

import request from 'supertest';
import { setupPrismaMock } from './utils/mockPrisma';
import { prisma } from '../lib/prisma';
import app from '../index';

const { prisma: prismaMock } = setupPrismaMock(prisma, app);

describe('User Activity Feed API', () => {
  const userId = 'user-1';
  const otherUserId = 'user-2';

  beforeEach(() => {
    // Clear cache before each test
    const cache = require('../middleware/cache').cache;
    if (cache) {
      cache.flushAll();
    }
    // Reset all mocks
    jest.clearAllMocks();
  });

  const createMockPost = (overrides: any = {}) => ({
    id: overrides.id || 'post-1',
    title: overrides.title || 'Test Post',
    content: overrides.content || '# Test Content',
    slug: overrides.slug || 'test-post',
    published: overrides.published !== undefined ? overrides.published : true,
    featured: overrides.featured !== undefined ? overrides.featured : false,
    allowComments: true,
    createdAt: overrides.createdAt || new Date('2024-01-15T10:00:00Z'),
    updatedAt: overrides.updatedAt || new Date('2024-01-15T10:00:00Z'),
    authorId: overrides.authorId || userId,
    categoryId: overrides.categoryId || null,
    metaDescription: null,
    metaTitle: null,
    ogImage: null,
    viewCount: 0,
    author: {
      id: overrides.authorId || userId,
      username: 'testuser',
    },
    category: overrides.category || null,
    tags: overrides.tags || [],
  });

  const createMockComment = (overrides: any = {}) => ({
    id: overrides.id || 'comment-1',
    content: overrides.content || 'Test comment',
    postId: overrides.postId || 'post-1',
    userId: overrides.userId || userId,
    parentId: overrides.parentId || null,
    createdAt: overrides.createdAt || new Date('2024-01-14T10:00:00Z'),
    updatedAt: overrides.updatedAt || new Date('2024-01-14T10:00:00Z'),
    user: {
      id: overrides.userId || userId,
      username: 'testuser',
    },
    post: {
      id: overrides.postId || 'post-1',
      title: 'Test Post',
      slug: 'test-post',
    },
  });

  describe('GET /api/users/:userId/activity', () => {
    it('should return user activity feed with posts and comments', async () => {
      const mockUser = {
        id: userId,
        deletedAt: null,
      };

      const mockPosts = [
        createMockPost({
          id: 'post-1',
          title: 'Post 1',
          createdAt: new Date('2024-01-15T10:00:00Z'),
        }),
      ];

      const mockComments = [
        createMockComment({
          id: 'comment-1',
          content: 'Comment 1',
          createdAt: new Date('2024-01-14T10:00:00Z'),
        }),
      ];

      (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prismaMock.post.findMany as jest.Mock).mockResolvedValue(mockPosts);
      (prismaMock.comment.findMany as jest.Mock).mockResolvedValue(mockComments);
      (prismaMock.postLike.findMany as jest.Mock).mockResolvedValue([]);
      (prismaMock.commentLike.findMany as jest.Mock).mockResolvedValue([]);
      (prismaMock.post.count as jest.Mock).mockResolvedValue(1);
      (prismaMock.comment.count as jest.Mock).mockResolvedValue(1);
      (prismaMock.postLike.count as jest.Mock).mockResolvedValue(0);
      (prismaMock.commentLike.count as jest.Mock).mockResolvedValue(0);

      const res = await request(app)
        .get(`/api/users/${userId}/activity`)
        .expect(200);

      expect(res.body).toHaveProperty('activities');
      expect(res.body).toHaveProperty('pagination');
      expect(Array.isArray(res.body.activities)).toBe(true);
      expect(res.body.activities.length).toBe(2); // 1 post + 1 comment
      expect(res.body.activities[0].type).toBe('post'); // Newest first
      expect(res.body.activities[1].type).toBe('comment');
    });

    it('should sort activities by createdAt descending (newest first)', async () => {
      const mockUser = {
        id: userId,
        deletedAt: null,
      };

      const mockPosts = [
        createMockPost({
          id: 'post-1',
          createdAt: new Date('2024-01-13T10:00:00Z'),
        }),
        createMockPost({
          id: 'post-2',
          createdAt: new Date('2024-01-15T10:00:00Z'),
        }),
      ];

      const mockComments = [
        createMockComment({
          id: 'comment-1',
          createdAt: new Date('2024-01-14T10:00:00Z'),
        }),
      ];

      (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prismaMock.post.findMany as jest.Mock).mockResolvedValue(mockPosts);
      (prismaMock.comment.findMany as jest.Mock).mockResolvedValue(mockComments);
      (prismaMock.postLike.findMany as jest.Mock).mockResolvedValue([]);
      (prismaMock.commentLike.findMany as jest.Mock).mockResolvedValue([]);
      (prismaMock.post.count as jest.Mock).mockResolvedValue(2);
      (prismaMock.comment.count as jest.Mock).mockResolvedValue(1);
      (prismaMock.postLike.count as jest.Mock).mockResolvedValue(0);
      (prismaMock.commentLike.count as jest.Mock).mockResolvedValue(0);

      const res = await request(app)
        .get(`/api/users/${userId}/activity?limit=50`)
        .expect(200);

      expect(res.body.activities.length).toBe(3);
      // Should be sorted: post-2 (newest), comment-1, post-1 (oldest)
      expect(res.body.activities[0].id).toBe('post-2');
      expect(res.body.activities[1].id).toBe('comment-1');
      expect(res.body.activities[2].id).toBe('post-1');
    });

    it('should return 404 when user does not exist', async () => {
      (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(null);

      const res = await request(app)
        .get(`/api/users/non-existent-user/activity`)
        .expect(404);

      expect(res.body).toHaveProperty('error', 'User not found');
    });

    it('should return 404 when user is deactivated', async () => {
      const deactivatedUserId = 'deactivated-user';
      const mockUser = {
        id: deactivatedUserId,
        deletedAt: new Date('2024-01-01T10:00:00Z'),
      };

      (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const res = await request(app)
        .get(`/api/users/${deactivatedUserId}/activity`)
        .expect(404);

      expect(res.body).toHaveProperty('error', 'User not found');
    });

    it('should only include published posts', async () => {
      const testUserId = 'test-user-posts';
      const mockUser = {
        id: testUserId,
        deletedAt: null,
      };

      const mockPosts = [
        createMockPost({
          id: 'post-1',
          published: true,
          authorId: testUserId,
        }),
      ];

      (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prismaMock.post.findMany as jest.Mock).mockResolvedValue(mockPosts);
      (prismaMock.comment.findMany as jest.Mock).mockResolvedValue([]);
      (prismaMock.postLike.findMany as jest.Mock).mockResolvedValue([]);
      (prismaMock.commentLike.findMany as jest.Mock).mockResolvedValue([]);
      (prismaMock.post.count as jest.Mock).mockResolvedValue(1);
      (prismaMock.comment.count as jest.Mock).mockResolvedValue(0);
      (prismaMock.postLike.count as jest.Mock).mockResolvedValue(0);
      (prismaMock.commentLike.count as jest.Mock).mockResolvedValue(0);

      await request(app)
        .get(`/api/users/${testUserId}/activity`)
        .expect(200);

      expect(prismaMock.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            authorId: testUserId,
            published: true,
          }),
        })
      );
    });

    it('should only include comments on published posts', async () => {
      const testUserId = 'test-user-comments';
      const mockUser = {
        id: testUserId,
        deletedAt: null,
      };

      const mockComments = [
        createMockComment({
          id: 'comment-1',
          userId: testUserId,
        }),
      ];

      (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prismaMock.post.findMany as jest.Mock).mockResolvedValue([]);
      (prismaMock.comment.findMany as jest.Mock).mockResolvedValue(mockComments);
      (prismaMock.postLike.findMany as jest.Mock).mockResolvedValue([]);
      (prismaMock.commentLike.findMany as jest.Mock).mockResolvedValue([]);
      (prismaMock.post.count as jest.Mock).mockResolvedValue(0);
      (prismaMock.comment.count as jest.Mock).mockResolvedValue(1);
      (prismaMock.postLike.count as jest.Mock).mockResolvedValue(0);
      (prismaMock.commentLike.count as jest.Mock).mockResolvedValue(0);

      await request(app)
        .get(`/api/users/${testUserId}/activity`)
        .expect(200);

      expect(prismaMock.comment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: testUserId,
            post: {
              published: true,
            },
          }),
        })
      );
    });

    it('should support pagination', async () => {
      const mockUser = {
        id: userId,
        deletedAt: null,
      };

      const mockPosts = Array(5).fill(null).map((_, i) =>
        createMockPost({
          id: `post-${i + 1}`,
          createdAt: new Date(`2024-01-${15 - i}T10:00:00Z`),
        })
      );

      const mockComments = Array(5).fill(null).map((_, i) =>
        createMockComment({
          id: `comment-${i + 1}`,
          createdAt: new Date(`2024-01-${10 - i}T10:00:00Z`),
        })
      );

      (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prismaMock.post.findMany as jest.Mock).mockResolvedValue(mockPosts);
      (prismaMock.comment.findMany as jest.Mock).mockResolvedValue(mockComments);
      (prismaMock.postLike.findMany as jest.Mock).mockResolvedValue([]);
      (prismaMock.commentLike.findMany as jest.Mock).mockResolvedValue([]);
      (prismaMock.post.count as jest.Mock).mockResolvedValue(5);
      (prismaMock.comment.count as jest.Mock).mockResolvedValue(5);
      (prismaMock.postLike.count as jest.Mock).mockResolvedValue(0);
      (prismaMock.commentLike.count as jest.Mock).mockResolvedValue(0);

      const res = await request(app)
        .get(`/api/users/${userId}/activity?page=1&limit=5`)
        .expect(200);

      expect(res.body.activities.length).toBe(5);
      expect(res.body.pagination).toEqual({
        page: 1,
        limit: 5,
        total: 10,
        totalPages: 2,
      });
    });

    it('should return empty activities array when user has no activity', async () => {
      const emptyUserId = 'user-empty-activity';
      const mockUser = {
        id: emptyUserId,
        deletedAt: null,
      };

      (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prismaMock.post.findMany as jest.Mock).mockResolvedValue([]);
      (prismaMock.comment.findMany as jest.Mock).mockResolvedValue([]);
      (prismaMock.postLike.findMany as jest.Mock).mockResolvedValue([]);
      (prismaMock.commentLike.findMany as jest.Mock).mockResolvedValue([]);
      (prismaMock.post.count as jest.Mock).mockResolvedValue(0);
      (prismaMock.comment.count as jest.Mock).mockResolvedValue(0);
      (prismaMock.postLike.count as jest.Mock).mockResolvedValue(0);
      (prismaMock.commentLike.count as jest.Mock).mockResolvedValue(0);

      const res = await request(app)
        .get(`/api/users/${emptyUserId}/activity`)
        .expect(200);

      expect(res.body.activities).toEqual([]);
      expect(res.body.pagination.total).toBe(0);
    });

    it('should include post details in post activities', async () => {
      const testUserId = 'test-user-post-details';
      const mockUser = {
        id: testUserId,
        deletedAt: null,
      };

      const mockPost = createMockPost({
        id: 'post-1',
        title: 'Test Post',
        slug: 'test-post',
        authorId: testUserId,
        category: {
          id: 'category-1',
          name: 'Technology',
          slug: 'technology',
        },
        tags: [
          { tag: { id: 'tag-1', name: 'Tech' } },
        ],
      });

      (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prismaMock.post.findMany as jest.Mock).mockResolvedValue([mockPost]);
      (prismaMock.comment.findMany as jest.Mock).mockResolvedValue([]);
      (prismaMock.postLike.findMany as jest.Mock).mockResolvedValue([]);
      (prismaMock.commentLike.findMany as jest.Mock).mockResolvedValue([]);
      (prismaMock.post.count as jest.Mock).mockResolvedValue(1);
      (prismaMock.comment.count as jest.Mock).mockResolvedValue(0);
      (prismaMock.postLike.count as jest.Mock).mockResolvedValue(0);
      (prismaMock.commentLike.count as jest.Mock).mockResolvedValue(0);

      const res = await request(app)
        .get(`/api/users/${testUserId}/activity`)
        .expect(200);

      const postActivity = res.body.activities.find((a: any) => a.type === 'post');
      expect(postActivity).toBeDefined();
      expect(postActivity).toMatchObject({
        type: 'post',
        id: 'post-1',
        title: 'Test Post',
        slug: 'test-post',
        author: {
          id: testUserId,
          username: 'testuser',
        },
        category: {
          id: 'category-1',
          name: 'Technology',
          slug: 'technology',
        },
        tags: [{ id: 'tag-1', name: 'Tech' }],
      });
    });

    it('should include comment details in comment activities', async () => {
      const testUserId = 'test-user-comment-details';
      const mockUser = {
        id: testUserId,
        deletedAt: null,
      };

      const mockComment = createMockComment({
        id: 'comment-1',
        content: 'Great post!',
        postId: 'post-1',
        userId: testUserId,
      });

      (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prismaMock.post.findMany as jest.Mock).mockResolvedValue([]);
      (prismaMock.comment.findMany as jest.Mock).mockResolvedValue([mockComment]);
      (prismaMock.postLike.findMany as jest.Mock).mockResolvedValue([]);
      (prismaMock.commentLike.findMany as jest.Mock).mockResolvedValue([]);
      (prismaMock.post.count as jest.Mock).mockResolvedValue(0);
      (prismaMock.comment.count as jest.Mock).mockResolvedValue(1);
      (prismaMock.postLike.count as jest.Mock).mockResolvedValue(0);
      (prismaMock.commentLike.count as jest.Mock).mockResolvedValue(0);

      const res = await request(app)
        .get(`/api/users/${testUserId}/activity`)
        .expect(200);

      const commentActivity = res.body.activities.find((a: any) => a.type === 'comment');
      expect(commentActivity).toBeDefined();
      expect(commentActivity).toMatchObject({
        type: 'comment',
        id: 'comment-1',
        content: 'Great post!',
        postId: 'post-1',
        user: {
          id: testUserId,
          username: 'testuser',
        },
        post: {
          id: 'post-1',
          title: 'Test Post',
          slug: 'test-post',
        },
      });
    });

    it('should use default pagination when not provided', async () => {
      const testUserId = 'test-user-pagination';
      const mockUser = {
        id: testUserId,
        deletedAt: null,
      };

      (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prismaMock.post.findMany as jest.Mock).mockResolvedValue([]);
      (prismaMock.comment.findMany as jest.Mock).mockResolvedValue([]);
      (prismaMock.postLike.findMany as jest.Mock).mockResolvedValue([]);
      (prismaMock.commentLike.findMany as jest.Mock).mockResolvedValue([]);
      (prismaMock.post.count as jest.Mock).mockResolvedValue(0);
      (prismaMock.comment.count as jest.Mock).mockResolvedValue(0);
      (prismaMock.postLike.count as jest.Mock).mockResolvedValue(0);
      (prismaMock.commentLike.count as jest.Mock).mockResolvedValue(0);

      const res = await request(app)
        .get(`/api/users/${testUserId}/activity`)
        .expect(200);

      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.limit).toBe(20);
      expect(res.body.pagination.total).toBe(0);
      expect(res.body.pagination.totalPages).toBe(0);
    });

    it('should handle mixed activity types correctly', async () => {
      const testUserId = 'test-user-mixed';
      const mockUser = {
        id: testUserId,
        deletedAt: null,
      };

      const mockPosts = [
        createMockPost({
          id: 'post-1',
          authorId: testUserId,
          createdAt: new Date('2024-01-15T10:00:00Z'),
        }),
        createMockPost({
          id: 'post-2',
          authorId: testUserId,
          createdAt: new Date('2024-01-13T10:00:00Z'),
        }),
      ];

      const mockComments = [
        createMockComment({
          id: 'comment-1',
          userId: testUserId,
          createdAt: new Date('2024-01-14T10:00:00Z'),
        }),
        createMockComment({
          id: 'comment-2',
          userId: testUserId,
          createdAt: new Date('2024-01-12T10:00:00Z'),
        }),
        createMockComment({
          id: 'comment-3',
          userId: testUserId,
          createdAt: new Date('2024-01-11T10:00:00Z'),
        }),
      ];

      (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prismaMock.post.findMany as jest.Mock).mockResolvedValue(mockPosts);
      (prismaMock.comment.findMany as jest.Mock).mockResolvedValue(mockComments);
      (prismaMock.postLike.findMany as jest.Mock).mockResolvedValue([]);
      (prismaMock.commentLike.findMany as jest.Mock).mockResolvedValue([]);
      (prismaMock.post.count as jest.Mock).mockResolvedValue(2);
      (prismaMock.comment.count as jest.Mock).mockResolvedValue(3);
      (prismaMock.postLike.count as jest.Mock).mockResolvedValue(0);
      (prismaMock.commentLike.count as jest.Mock).mockResolvedValue(0);

      const res = await request(app)
        .get(`/api/users/${testUserId}/activity?limit=50`)
        .expect(200);

      expect(res.body.activities.length).toBe(5);
      // Should be sorted by createdAt descending
      expect(res.body.activities[0].type).toBe('post');
      expect(res.body.activities[0].id).toBe('post-1');
      expect(res.body.activities[1].type).toBe('comment');
      expect(res.body.activities[1].id).toBe('comment-1');
      expect(res.body.activities[2].type).toBe('post');
      expect(res.body.activities[2].id).toBe('post-2');
    });

    it('should include post likes in activity feed', async () => {
      const testUserId = 'test-user-likes';
      const mockUser = {
        id: testUserId,
        deletedAt: null,
      };

      const mockPostLike = {
        id: 'like-1',
        userId: testUserId,
        postId: 'post-1',
        createdAt: new Date('2024-01-13T10:00:00Z'),
        post: {
          id: 'post-1',
          title: 'Liked Post',
          slug: 'liked-post',
          author: {
            id: 'author-1',
            username: 'author',
          },
          category: {
            id: 'category-1',
            name: 'Technology',
            slug: 'technology',
          },
        },
      };

      (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prismaMock.post.findMany as jest.Mock).mockResolvedValue([]);
      (prismaMock.comment.findMany as jest.Mock).mockResolvedValue([]);
      (prismaMock.postLike.findMany as jest.Mock).mockResolvedValue([mockPostLike]);
      (prismaMock.commentLike.findMany as jest.Mock).mockResolvedValue([]);
      (prismaMock.post.count as jest.Mock).mockResolvedValue(0);
      (prismaMock.comment.count as jest.Mock).mockResolvedValue(0);
      (prismaMock.postLike.count as jest.Mock).mockResolvedValue(1);
      (prismaMock.commentLike.count as jest.Mock).mockResolvedValue(0);

      const res = await request(app)
        .get(`/api/users/${testUserId}/activity`)
        .expect(200);

      expect(res.body.activities.length).toBe(1);
      expect(res.body.activities[0]).toMatchObject({
        type: 'post_like',
        id: 'like-1',
        postId: 'post-1',
        post: {
          id: 'post-1',
          title: 'Liked Post',
          slug: 'liked-post',
        },
      });
    });

    it('should include comment likes in activity feed', async () => {
      const testUserId = 'test-user-comment-likes';
      const mockUser = {
        id: testUserId,
        deletedAt: null,
      };

      const mockCommentLike = {
        id: 'comment-like-1',
        userId: testUserId,
        commentId: 'comment-1',
        createdAt: new Date('2024-01-12T10:00:00Z'),
        comment: {
          id: 'comment-1',
          content: 'Liked comment',
          user: {
            id: 'commenter-1',
            username: 'commenter',
          },
          post: {
            id: 'post-1',
            title: 'Post Title',
            slug: 'post-title',
          },
        },
      };

      (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prismaMock.post.findMany as jest.Mock).mockResolvedValue([]);
      (prismaMock.comment.findMany as jest.Mock).mockResolvedValue([]);
      (prismaMock.postLike.findMany as jest.Mock).mockResolvedValue([]);
      (prismaMock.commentLike.findMany as jest.Mock).mockResolvedValue([mockCommentLike]);
      (prismaMock.post.count as jest.Mock).mockResolvedValue(0);
      (prismaMock.comment.count as jest.Mock).mockResolvedValue(0);
      (prismaMock.postLike.count as jest.Mock).mockResolvedValue(0);
      (prismaMock.commentLike.count as jest.Mock).mockResolvedValue(1);

      const res = await request(app)
        .get(`/api/users/${testUserId}/activity`)
        .expect(200);

      expect(res.body.activities.length).toBe(1);
      expect(res.body.activities[0]).toMatchObject({
        type: 'comment_like',
        id: 'comment-like-1',
        commentId: 'comment-1',
        comment: {
          id: 'comment-1',
          content: 'Liked comment',
        },
        post: {
          id: 'post-1',
          title: 'Post Title',
          slug: 'post-title',
        },
      });
    });

    it('should sort all activity types by createdAt descending', async () => {
      const testUserId = 'test-user-all-activities';
      const mockUser = {
        id: testUserId,
        deletedAt: null,
      };

      const mockPosts = [
        createMockPost({
          id: 'post-1',
          authorId: testUserId,
          createdAt: new Date('2024-01-15T10:00:00Z'),
        }),
      ];

      const mockComments = [
        createMockComment({
          id: 'comment-1',
          userId: testUserId,
          createdAt: new Date('2024-01-14T10:00:00Z'),
        }),
      ];

      const mockPostLike = {
        id: 'like-1',
        userId: testUserId,
        postId: 'post-2',
        createdAt: new Date('2024-01-13T10:00:00Z'),
        post: {
          id: 'post-2',
          title: 'Liked Post',
          slug: 'liked-post',
          author: {
            id: 'author-1',
            username: 'author',
          },
          category: null,
        },
      };

      const mockCommentLike = {
        id: 'comment-like-1',
        userId: testUserId,
        commentId: 'comment-2',
        createdAt: new Date('2024-01-12T10:00:00Z'),
        comment: {
          id: 'comment-2',
          content: 'Liked comment',
          user: {
            id: 'commenter-1',
            username: 'commenter',
          },
        },
        post: {
          id: 'post-3',
          title: 'Post Title',
          slug: 'post-title',
        },
      };

      (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prismaMock.post.findMany as jest.Mock).mockResolvedValue(mockPosts);
      (prismaMock.comment.findMany as jest.Mock).mockResolvedValue(mockComments);
      (prismaMock.postLike.findMany as jest.Mock).mockResolvedValue([mockPostLike]);
      (prismaMock.commentLike.findMany as jest.Mock).mockResolvedValue([mockCommentLike]);
      (prismaMock.post.count as jest.Mock).mockResolvedValue(1);
      (prismaMock.comment.count as jest.Mock).mockResolvedValue(1);
      (prismaMock.postLike.count as jest.Mock).mockResolvedValue(1);
      (prismaMock.commentLike.count as jest.Mock).mockResolvedValue(1);

      const res = await request(app)
        .get(`/api/users/${testUserId}/activity?limit=50`)
        .expect(200);

      expect(res.body.activities.length).toBe(4);
      // Should be sorted by createdAt descending: post, comment, post_like, comment_like
      expect(res.body.activities[0].type).toBe('post');
      expect(res.body.activities[0].id).toBe('post-1');
      expect(res.body.activities[1].type).toBe('comment');
      expect(res.body.activities[1].id).toBe('comment-1');
      expect(res.body.activities[2].type).toBe('post_like');
      expect(res.body.activities[2].id).toBe('like-1');
      expect(res.body.activities[3].type).toBe('comment_like');
      expect(res.body.activities[3].id).toBe('comment-like-1');
    });

    it('should only include likes on published posts', async () => {
      const testUserId = 'test-user-published-likes';
      const mockUser = {
        id: testUserId,
        deletedAt: null,
      };

      (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prismaMock.post.findMany as jest.Mock).mockResolvedValue([]);
      (prismaMock.comment.findMany as jest.Mock).mockResolvedValue([]);
      (prismaMock.postLike.findMany as jest.Mock).mockResolvedValue([]);
      (prismaMock.commentLike.findMany as jest.Mock).mockResolvedValue([]);
      (prismaMock.post.count as jest.Mock).mockResolvedValue(0);
      (prismaMock.comment.count as jest.Mock).mockResolvedValue(0);
      (prismaMock.postLike.count as jest.Mock).mockResolvedValue(0);
      (prismaMock.commentLike.count as jest.Mock).mockResolvedValue(0);

      await request(app)
        .get(`/api/users/${testUserId}/activity`)
        .expect(200);

      expect(prismaMock.postLike.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: testUserId,
            post: {
              published: true,
            },
          }),
        })
      );

      expect(prismaMock.commentLike.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: testUserId,
            comment: {
              post: {
                published: true,
              },
            },
          }),
        })
      );
    });

    it('should include likes in pagination total count', async () => {
      const testUserId = 'test-user-pagination-likes';
      const mockUser = {
        id: testUserId,
        deletedAt: null,
      };

      (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prismaMock.post.findMany as jest.Mock).mockResolvedValue([]);
      (prismaMock.comment.findMany as jest.Mock).mockResolvedValue([]);
      (prismaMock.postLike.findMany as jest.Mock).mockResolvedValue([]);
      (prismaMock.commentLike.findMany as jest.Mock).mockResolvedValue([]);
      (prismaMock.post.count as jest.Mock).mockResolvedValue(5);
      (prismaMock.comment.count as jest.Mock).mockResolvedValue(3);
      (prismaMock.postLike.count as jest.Mock).mockResolvedValue(2);
      (prismaMock.commentLike.count as jest.Mock).mockResolvedValue(1);

      const res = await request(app)
        .get(`/api/users/${testUserId}/activity`)
        .expect(200);

      // Total should include all activity types: 5 posts + 3 comments + 2 post likes + 1 comment like = 11
      expect(res.body.pagination.total).toBe(11);
    });
  });
});

