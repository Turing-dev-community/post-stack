import request from 'supertest';
import { setupPrismaMock } from './utils/mockPrisma';
import { prisma } from '../lib/prisma';
import app from '../index';
import { generateToken } from '../utils/auth';
import { invalidateCache } from '../middleware/cache';

const { prisma: prismaMock } = setupPrismaMock(prisma, app);

describe('Comments Deactivated User Filtering (mocked)', () => {
  const activeUserId = 'active-user-1';
  const deactivatedUserId = 'deactivated-user-1';
  const postId = 'post-1';
  const authToken = (() => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
    return generateToken(activeUserId);
  })();

  beforeEach(() => {
    jest.clearAllMocks();
    invalidateCache.invalidateAll();
    
    // Mock authenticateToken middleware
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

  describe('GET /api/posts/:postId/comments', () => {
    it('should exclude comments from deactivated users', async () => {
      const activeComment = {
        id: 'comment-active',
        content: 'Active comment',
        postId,
        userId: activeUserId,
        parentId: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        user: { id: activeUserId, username: 'activeuser' },
      };

      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue({
        id: postId,
        allowComments: true,
      });
      (prismaMock.comment.findMany as jest.Mock).mockResolvedValue([activeComment]);
      (prismaMock.commentLike.count as jest.Mock).mockResolvedValue(0);

      const response = await request(app)
        .get(`/api/posts/${postId}/comments`)
        .expect(200);

      expect(response.body.comments).toHaveLength(1);
      expect(response.body.comments[0].user.id).toBe(activeUserId);
      expect(response.body.comments[0].user.id).not.toBe(deactivatedUserId);

      // Verify the query included user filter
      expect(prismaMock.comment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            postId,
            parentId: null,
            user: {
              deletedAt: null,
            },
          }),
        })
      );
    });

    it('should exclude nested replies from deactivated users', async () => {
      const activeComment = {
        id: 'comment-active',
        content: 'Active comment',
        postId,
        userId: activeUserId,
        parentId: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        user: { id: activeUserId, username: 'activeuser' },
      };

      const activeReply = {
        id: 'reply-active',
        content: 'Active reply',
        postId,
        userId: activeUserId,
        parentId: 'comment-active',
        createdAt: new Date('2024-01-02'),
        updatedAt: new Date('2024-01-02'),
        user: { id: activeUserId, username: 'activeuser' },
      };

      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue({
        id: postId,
        allowComments: true,
      });
      
      // Mock for top-level comments and nested replies
      (prismaMock.comment.findMany as jest.Mock)
        .mockResolvedValueOnce([activeComment]) // Top-level comments
        .mockResolvedValueOnce([activeReply]) // Nested replies for comment-active
        .mockResolvedValueOnce([]); // No further nested replies

      (prismaMock.commentLike.count as jest.Mock).mockResolvedValue(0);

      const response = await request(app)
        .get(`/api/posts/${postId}/comments`)
        .expect(200);

      expect(response.body.comments).toHaveLength(1);
      expect(response.body.comments[0].replies).toHaveLength(1);
      expect(response.body.comments[0].replies[0].user.id).toBe(activeUserId);

      // Verify nested replies query also includes user filter
      expect(prismaMock.comment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            parentId: 'comment-active',
            postId,
            user: {
              deletedAt: null,
            },
          }),
        })
      );
    });

    it('should handle comment thread with mix of active and deactivated users', async () => {
      const activeComment = {
        id: 'comment-active',
        content: 'Active comment',
        postId,
        userId: activeUserId,
        parentId: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        user: { id: activeUserId, username: 'activeuser' },
      };

      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue({
        id: postId,
        allowComments: true,
      });
      (prismaMock.comment.findMany as jest.Mock)
        .mockResolvedValueOnce([activeComment]) // Top-level comments
        .mockResolvedValueOnce([]); // No replies (deactivated user's reply filtered out)

      (prismaMock.commentLike.count as jest.Mock).mockResolvedValue(0);

      const response = await request(app)
        .get(`/api/posts/${postId}/comments`)
        .expect(200);

      expect(response.body.comments).toHaveLength(1);
      expect(response.body.comments[0].replies).toHaveLength(0);
      expect(response.body.comments[0].user.id).toBe(activeUserId);
    });
  });

  describe('GET /api/posts/recent-comments', () => {
    it('should exclude comments from deactivated users', async () => {
      const activeComment = {
        id: 'comment-active',
        content: 'Active comment',
        postId,
        userId: activeUserId,
        parentId: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        user: { id: activeUserId, username: 'activeuser' },
        post: {
          id: postId,
          title: 'Test Post',
          slug: 'test-post',
        },
      };

      (prismaMock.comment.findMany as jest.Mock).mockResolvedValue([activeComment]);
      (prismaMock.commentLike.count as jest.Mock).mockResolvedValue(0);
      (prismaMock.comment.count as jest.Mock).mockResolvedValue(1);

      const response = await request(app)
        .get('/api/posts/recent-comments')
        .expect(200);

      expect(response.body.comments).toHaveLength(1);
      expect(response.body.comments[0].user.id).toBe(activeUserId);
      expect(response.body.pagination.total).toBe(1);

      // Verify the query included user filter
      expect(prismaMock.comment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            parentId: null,
            user: {
              deletedAt: null,
            },
            post: {
              published: true,
            },
          }),
        })
      );

      // Verify count query also includes user filter
      expect(prismaMock.comment.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            parentId: null,
            user: {
              deletedAt: null,
            },
            post: {
              published: true,
            },
          }),
        })
      );
    });

    it('should handle pagination correctly when filtering deactivated users', async () => {
      const activeComment = {
        id: 'comment-active',
        content: 'Active comment',
        postId,
        userId: activeUserId,
        parentId: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        user: { id: activeUserId, username: 'activeuser' },
        post: {
          id: postId,
          title: 'Test Post',
          slug: 'test-post',
        },
      };

      (prismaMock.comment.findMany as jest.Mock).mockResolvedValue([activeComment]);
      (prismaMock.commentLike.count as jest.Mock).mockResolvedValue(0);
      (prismaMock.comment.count as jest.Mock).mockResolvedValue(1);

      const response = await request(app)
        .get('/api/posts/recent-comments?page=1&limit=20')
        .expect(200);

      expect(response.body.comments).toHaveLength(1);
      expect(response.body.pagination.total).toBe(1);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(20);
    });
  });

  describe('Nested replies filtering', () => {
    it('should filter deactivated users from all nested reply levels', async () => {
      const activeComment = {
        id: 'comment-active',
        content: 'Active comment',
        postId,
        userId: activeUserId,
        parentId: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        user: { id: activeUserId, username: 'activeuser' },
      };

      const activeReply1 = {
        id: 'reply-active-1',
        content: 'Active reply level 1',
        postId,
        userId: activeUserId,
        parentId: 'comment-active',
        createdAt: new Date('2024-01-02'),
        updatedAt: new Date('2024-01-02'),
        user: { id: activeUserId, username: 'activeuser' },
      };

      const activeReply2 = {
        id: 'reply-active-2',
        content: 'Active reply level 2',
        postId,
        userId: activeUserId,
        parentId: 'reply-active-1',
        createdAt: new Date('2024-01-03'),
        updatedAt: new Date('2024-01-03'),
        user: { id: activeUserId, username: 'activeuser' },
      };

      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue({
        id: postId,
        allowComments: true,
      });
      (prismaMock.comment.findMany as jest.Mock)
        .mockResolvedValueOnce([activeComment]) // Top-level
        .mockResolvedValueOnce([activeReply1]) // Level 1 replies
        .mockResolvedValueOnce([activeReply2]) // Level 2 replies
        .mockResolvedValueOnce([]); // Level 3 replies (none)

      (prismaMock.commentLike.count as jest.Mock).mockResolvedValue(0);

      const response = await request(app)
        .get(`/api/posts/${postId}/comments`)
        .expect(200);

      expect(response.body.comments).toHaveLength(1);
      expect(response.body.comments[0].replies).toHaveLength(1);
      expect(response.body.comments[0].replies[0].replies).toHaveLength(1);
      
      // Verify all nested levels only have active users
      expect(response.body.comments[0].user.id).toBe(activeUserId);
      expect(response.body.comments[0].replies[0].user.id).toBe(activeUserId);
      expect(response.body.comments[0].replies[0].replies[0].user.id).toBe(activeUserId);
    });
  });
});

