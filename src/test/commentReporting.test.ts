import request from 'supertest';
import { setupPrismaMock } from './utils/mockPrisma';
import { prisma } from '../lib/prisma';
import app from '../index';
import { generateToken } from '../utils/auth';
import { ModerationStatus, ReportStatus } from '@prisma/client';

const { prisma: prismaMock } = setupPrismaMock(prisma, app);

describe('Comment Reporting and Moderation API', () => {
  const userId = 'user-1';
  const postAuthorId = 'author-1';
  const reporterId = 'reporter-1';
  const postId = 'post-1';
  const commentId = 'comment-1';

  const userToken = (() => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
    return generateToken(userId);
  })();

  const authorToken = (() => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
    return generateToken(postAuthorId);
  })();

  const reporterToken = (() => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
    return generateToken(reporterId);
  })();

  beforeEach(() => {
    jest.clearAllMocks();

    (prismaMock.user.findUnique as jest.Mock).mockImplementation(({ where }) => {
      if (where.id === userId) {
        return Promise.resolve({
          id: userId,
          email: 'user@example.com',
          username: 'testuser',
          deletedAt: null,
        });
      }
      if (where.id === postAuthorId) {
        return Promise.resolve({
          id: postAuthorId,
          email: 'author@example.com',
          username: 'postauthor',
          deletedAt: null,
        });
      }
      if (where.id === reporterId) {
        return Promise.resolve({
          id: reporterId,
          email: 'reporter@example.com',
          username: 'reporter',
          deletedAt: null,
        });
      }
      return Promise.resolve(null);
    });
  });

  describe('POST /api/posts/:postId/comments/:commentId/report', () => {
    it('should allow users to report a comment', async () => {
      const mockComment = {
        id: commentId,
        content: 'Inappropriate comment',
        postId,
        userId,
        parentId: null,
        moderationStatus: ModerationStatus.APPROVED,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockReport = {
        id: 'report-1',
        commentId,
        reporterId,
        reason: 'This comment is spam',
        status: ReportStatus.PENDING,
        createdAt: new Date(),
        comment: {
          id: commentId,
          content: 'Inappropriate comment',
          postId,
          post: { id: postId, title: 'Test Post', slug: 'test-post' },
        },
        reporter: { id: reporterId, username: 'reporter' },
      };

      (prismaMock.comment.findUnique as jest.Mock).mockResolvedValue(mockComment);
      (prismaMock.commentReport.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaMock.commentReport.create as jest.Mock).mockResolvedValue(mockReport);

      const res = await request(app)
        .post(`/api/posts/${postId}/comments/${commentId}/report`)
        .set('Authorization', `Bearer ${reporterToken}`)
        .send({ reason: 'This comment is spam' })
        .expect(201);

      expect(res.body).toHaveProperty('message', 'Comment reported successfully');
      expect(res.body.report).toMatchObject({
        commentId,
        reporterId,
        reason: 'This comment is spam',
      });
    });

    it('should reject report with short reason', async () => {
      const res = await request(app)
        .post(`/api/posts/${postId}/comments/${commentId}/report`)
        .set('Authorization', `Bearer ${reporterToken}`)
        .send({ reason: 'Bad' })
        .expect(400);

      expect(res.body.error || res.body.errors).toBeDefined();
    });

    it('should prevent duplicate reports from same user', async () => {
      const mockComment = {
        id: commentId,
        content: 'Inappropriate comment',
        postId,
        userId,
        parentId: null,
        moderationStatus: ModerationStatus.APPROVED,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const existingReport = {
        id: 'report-1',
        commentId,
        reporterId,
      };

      (prismaMock.comment.findUnique as jest.Mock).mockResolvedValue(mockComment);
      (prismaMock.commentReport.findUnique as jest.Mock).mockResolvedValue(existingReport);

      const res = await request(app)
        .post(`/api/posts/${postId}/comments/${commentId}/report`)
        .set('Authorization', `Bearer ${reporterToken}`)
        .send({ reason: 'This comment is spam' })
        .expect(409);

      expect(res.body.error).toBe('You have already reported this comment');
    });

    it('should require authentication', async () => {
      await request(app)
        .post(`/api/posts/${postId}/comments/${commentId}/report`)
        .send({ reason: 'This comment is spam' })
        .expect(401);
    });

    it('should return 404 for non-existent comment', async () => {
      (prismaMock.comment.findUnique as jest.Mock).mockResolvedValue(null);

      const res = await request(app)
        .post(`/api/posts/${postId}/comments/${commentId}/report`)
        .set('Authorization', `Bearer ${reporterToken}`)
        .send({ reason: 'This comment is spam' })
        .expect(404);

      expect(res.body.error).toBe('Comment not found');
    });
  });

  describe('PATCH /api/posts/:postId/comments/:commentId/moderate', () => {
    it('should allow post author to hide a comment', async () => {
      const mockPost = {
        id: postId,
        title: 'Test Post',
        slug: 'test-post',
        authorId: postAuthorId,
        allowComments: true,
      };

      const mockComment = {
        id: commentId,
        content: 'Test comment',
        postId,
        userId,
        parentId: null,
        moderationStatus: ModerationStatus.APPROVED,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedComment = {
        ...mockComment,
        moderationStatus: ModerationStatus.HIDDEN,
        user: { id: userId, username: 'testuser' },
      };

      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue(mockPost);
      (prismaMock.comment.findUnique as jest.Mock).mockResolvedValue(mockComment);
      (prismaMock.comment.update as jest.Mock).mockResolvedValue(updatedComment);

      const res = await request(app)
        .patch(`/api/posts/${postId}/comments/${commentId}/moderate`)
        .set('Authorization', `Bearer ${authorToken}`)
        .send({ action: 'hide' })
        .expect(200);

      expect(res.body).toHaveProperty('message', 'Comment hidden successfully');
      expect(res.body.comment.moderationStatus).toBe(ModerationStatus.HIDDEN);
    });

    it('should allow post author to approve a comment', async () => {
      const mockPost = {
        id: postId,
        title: 'Test Post',
        slug: 'test-post',
        authorId: postAuthorId,
        allowComments: true,
      };

      const mockComment = {
        id: commentId,
        content: 'Test comment',
        postId,
        userId,
        parentId: null,
        moderationStatus: ModerationStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedComment = {
        ...mockComment,
        moderationStatus: ModerationStatus.APPROVED,
        user: { id: userId, username: 'testuser' },
      };

      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue(mockPost);
      (prismaMock.comment.findUnique as jest.Mock).mockResolvedValue(mockComment);
      (prismaMock.comment.update as jest.Mock).mockResolvedValue(updatedComment);

      const res = await request(app)
        .patch(`/api/posts/${postId}/comments/${commentId}/moderate`)
        .set('Authorization', `Bearer ${authorToken}`)
        .send({ action: 'approve' })
        .expect(200);

      expect(res.body).toHaveProperty('message', 'Comment approved successfully');
      expect(res.body.comment.moderationStatus).toBe(ModerationStatus.APPROVED);
    });

    it('should reject moderation by non-post-author', async () => {
      const mockPost = {
        id: postId,
        title: 'Test Post',
        slug: 'test-post',
        authorId: postAuthorId,
        allowComments: true,
      };

      const mockComment = {
        id: commentId,
        content: 'Test comment',
        postId,
        userId,
        parentId: null,
        moderationStatus: ModerationStatus.APPROVED,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue(mockPost);
      (prismaMock.comment.findUnique as jest.Mock).mockResolvedValue(mockComment);

      const res = await request(app)
        .patch(`/api/posts/${postId}/comments/${commentId}/moderate`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ action: 'hide' })
        .expect(403);

      expect(res.body.message).toContain('post author');
    });

    it('should reject invalid moderation action', async () => {
      const mockPost = {
        id: postId,
        title: 'Test Post',
        slug: 'test-post',
        authorId: postAuthorId,
        allowComments: true,
      };

      const mockComment = {
        id: commentId,
        content: 'Test comment',
        postId,
        userId,
        parentId: null,
        moderationStatus: ModerationStatus.APPROVED,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue(mockPost);
      (prismaMock.comment.findUnique as jest.Mock).mockResolvedValue(mockComment);

      const res = await request(app)
        .patch(`/api/posts/${postId}/comments/${commentId}/moderate`)
        .set('Authorization', `Bearer ${authorToken}`)
        .send({ action: 'delete' })
        .expect(400);

      expect(res.body.error).toBe('Invalid action. Must be "approve" or "hide"');
    });

    it('should require authentication', async () => {
      await request(app)
        .patch(`/api/posts/${postId}/comments/${commentId}/moderate`)
        .send({ action: 'hide' })
        .expect(401);
    });
  });

  describe('GET /api/posts/:postId/moderation-queue', () => {
    it('should allow post author to view moderation queue', async () => {
      const mockPost = {
        id: postId,
        title: 'Test Post',
        slug: 'test-post',
        authorId: postAuthorId,
        allowComments: true,
      };

      const mockComments = [
        {
          id: 'comment-1',
          content: 'Comment 1',
          postId,
          userId,
          parentId: null,
          moderationStatus: ModerationStatus.PENDING,
          createdAt: new Date(),
          updatedAt: new Date(),
          user: { id: userId, username: 'testuser' },
          reports: [
            {
              id: 'report-1',
              reason: 'Spam',
              reporter: { id: reporterId, username: 'reporter' },
            },
          ],
        },
        {
          id: 'comment-2',
          content: 'Comment 2',
          postId,
          userId,
          parentId: null,
          moderationStatus: ModerationStatus.APPROVED,
          createdAt: new Date(),
          updatedAt: new Date(),
          user: { id: userId, username: 'testuser' },
          reports: [],
        },
      ];

      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue(mockPost);
      (prismaMock.comment.findMany as jest.Mock).mockResolvedValue(mockComments);
      (prismaMock.commentLike.count as jest.Mock).mockResolvedValue(0);

      const res = await request(app)
        .get(`/api/posts/${postId}/moderation-queue`)
        .set('Authorization', `Bearer ${authorToken}`)
        .expect(200);

      expect(res.body.comments).toHaveLength(2);
      expect(res.body.post).toMatchObject({
        id: postId,
        title: 'Test Post',
        slug: 'test-post',
      });
    });

    it('should filter by moderation status', async () => {
      const mockPost = {
        id: postId,
        title: 'Test Post',
        slug: 'test-post',
        authorId: postAuthorId,
        allowComments: true,
      };

      const mockComments = [
        {
          id: 'comment-1',
          content: 'Pending comment',
          postId,
          userId,
          parentId: null,
          moderationStatus: ModerationStatus.PENDING,
          createdAt: new Date(),
          updatedAt: new Date(),
          user: { id: userId, username: 'testuser' },
          reports: [],
        },
      ];

      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue(mockPost);
      (prismaMock.comment.findMany as jest.Mock).mockResolvedValue(mockComments);
      (prismaMock.commentLike.count as jest.Mock).mockResolvedValue(0);

      const res = await request(app)
        .get(`/api/posts/${postId}/moderation-queue?status=PENDING`)
        .set('Authorization', `Bearer ${authorToken}`)
        .expect(200);

      expect(res.body.comments).toHaveLength(1);
      expect(res.body.comments[0].moderationStatus).toBe(ModerationStatus.PENDING);
    });

    it('should reject access by non-post-author', async () => {
      const mockPost = {
        id: postId,
        title: 'Test Post',
        slug: 'test-post',
        authorId: postAuthorId,
        allowComments: true,
      };

      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue(mockPost);

      const res = await request(app)
        .get(`/api/posts/${postId}/moderation-queue`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(res.body.message).toContain('post author');
    });

    it('should require authentication', async () => {
      await request(app)
        .get(`/api/posts/${postId}/moderation-queue`)
        .expect(401);
    });
  });

  describe('GET /api/reports/comments', () => {
    it('should allow admins to view all comment reports', async () => {
      const adminId = 'admin-1';
      const adminEmail = 'admin@example.com';
      const adminToken = generateToken(adminId);

      const mockAdmin = {
        id: adminId,
        email: adminEmail,
        username: 'admin',
        role: 'ADMIN' as const,
        deletedAt: null,
      };

      const mockReports = [
        {
          id: 'report-1',
          commentId: 'comment-1',
          reporterId,
          reason: 'Spam comment',
          status: ReportStatus.PENDING,
          createdAt: new Date(),
          comment: {
            id: 'comment-1',
            content: 'Spam content',
            postId,
            post: { id: postId, title: 'Test Post', slug: 'test-post' },
            user: { id: userId, username: 'testuser' },
          },
          reporter: { id: reporterId, username: 'reporter' },
        },
      ];

      (prismaMock.user.findUnique as jest.Mock).mockImplementation(({ where }) => {
        if (where.id === adminId) {
          return Promise.resolve(mockAdmin);
        }
        return Promise.resolve(null);
      });

      (prismaMock.commentReport.findMany as jest.Mock).mockResolvedValue(mockReports);
      (prismaMock.commentReport.count as jest.Mock).mockResolvedValue(1);

      const res = await request(app)
        .get('/api/reports/comments')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.reports).toHaveLength(1);
      expect(res.body.reports[0]).toMatchObject({
        reason: 'Spam comment',
        status: ReportStatus.PENDING,
      });

    });

    it('should reject access by non-admin users', async () => {
      const res = await request(app)
        .get('/api/reports/comments')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(res.body.error).toBe('Admin access required');
    });
  });

  describe('Comment filtering with moderation status', () => {
    it('should hide HIDDEN comments from regular users', async () => {
      const mockPost = {
        id: postId,
        title: 'Test Post',
        slug: 'test-post',
        authorId: postAuthorId,
        allowComments: true,
      };

      const visibleComments = [
        {
          id: 'comment-1',
          content: 'Approved comment',
          postId,
          userId,
          parentId: null,
          moderationStatus: ModerationStatus.APPROVED,
          createdAt: new Date(),
          updatedAt: new Date(),
          user: { id: userId, username: 'testuser' },
        },
      ];

      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue(mockPost);
      (prismaMock.comment.findMany as jest.Mock).mockResolvedValue(visibleComments);
      (prismaMock.commentLike.count as jest.Mock).mockResolvedValue(0);
      (prismaMock.userCommenterStats.findMany as jest.Mock).mockResolvedValue([]);
      (prismaMock.commentLike.groupBy as jest.Mock).mockClear().mockResolvedValue([]);



      const res = await request(app)
        .get(`/api/posts/${postId}/comments`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.comments).toHaveLength(1);
      expect(res.body.comments[0].moderationStatus).toBe(ModerationStatus.APPROVED);
    });

    it('should show HIDDEN comments to post author', async () => {
      const mockPost = {
        id: postId,
        title: 'Test Post',
        slug: 'test-post',
        authorId: postAuthorId,
        allowComments: true,
      };

      const allComments = [
        {
          id: 'comment-1',
          content: 'Approved comment',
          postId,
          userId,
          parentId: null,
          moderationStatus: ModerationStatus.APPROVED,
          createdAt: new Date(),
          updatedAt: new Date(),
          user: { id: userId, username: 'testuser' },
        },
        {
          id: 'comment-2',
          content: 'Hidden comment',
          postId,
          userId,
          parentId: null,
          moderationStatus: ModerationStatus.HIDDEN,
          createdAt: new Date(),
          updatedAt: new Date(),
          user: { id: userId, username: 'testuser' },
        },
      ];

      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue(mockPost);
      (prismaMock.comment.findMany as jest.Mock).mockResolvedValue(allComments);
      (prismaMock.commentLike.count as jest.Mock).mockResolvedValue(0);
      (prismaMock.userCommenterStats.findMany as jest.Mock).mockResolvedValue([]);
      (prismaMock.commentLike.groupBy as jest.Mock).mockClear().mockResolvedValue([]);


      const res = await request(app)
        .get(`/api/posts/${postId}/comments`)
        .set('Authorization', `Bearer ${authorToken}`)
        .expect(200);

      expect(res.body.comments).toHaveLength(2);
      expect(res.body.comments.some((c: any) => c.moderationStatus === ModerationStatus.HIDDEN)).toBe(true);
    });
  });
});
