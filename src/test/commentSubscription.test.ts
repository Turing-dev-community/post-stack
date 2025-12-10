import request from 'supertest';
import { setupPrismaMock } from './utils/mockPrisma';
import { prisma } from '../lib/prisma';
import app from '../index';
import { generateToken } from '../utils/auth';
import { CommentSubscriptionDelegate, ExtendedPrismaClient } from '../types/commentSubscription';

const { prisma: prismaMock } = setupPrismaMock(prisma, app);

// Type-safe accessor for commentSubscription mock since model is not in schema
const commentSubscriptionMock: CommentSubscriptionDelegate =
  (prismaMock as unknown as ExtendedPrismaClient).commentSubscription;

describe('Comment Subscription API (mocked)', () => {
  const userId = 'user-1';
  const userId2 = 'user-2';
  const postId = 'post-1';
  const commentId = 'comment-1';

  const authToken = (() => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
    return generateToken(userId);
  })();

  beforeEach(() => {
    (prismaMock.user.findUnique as jest.Mock).mockResolvedValue({
      id: userId,
      email: 'user@example.com',
      username: 'testuser',
      deletedAt: null,
    });
  });

  describe('POST /api/posts/:postId/comments/:commentId/subscribe', () => {
    it('should subscribe to a comment thread successfully', async () => {
      // Mock post exists
      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue({
        id: postId,
        title: 'Test Post',
      });

      // Mock comment exists and belongs to post
      (prismaMock.comment.findUnique as jest.Mock).mockResolvedValue({
        id: commentId,
        postId: postId,
        deletedAt: null,
      });

      // Mock no existing subscription
      (commentSubscriptionMock.findUnique as jest.Mock).mockResolvedValue(null);

      // Mock subscription creation
      const subscription = {
        id: 'subscription-1',
        userId: userId,
        commentId: commentId,
        createdAt: new Date(),
      };
      (commentSubscriptionMock.create as jest.Mock).mockResolvedValue(subscription);

      const res = await request(app)
        .post(`/api/posts/${postId}/comments/${commentId}/subscribe`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      expect(res.body).toHaveProperty('message', 'Successfully subscribed to comment thread');
      expect(res.body).toHaveProperty('subscription');
      expect(res.body.subscription).toMatchObject({
        id: subscription.id,
        userId: userId,
        commentId: commentId,
      });
    });

    it('should return 404 if post does not exist', async () => {
      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue(null);

      const res = await request(app)
        .post(`/api/posts/${postId}/comments/${commentId}/subscribe`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(res.body).toHaveProperty('error', 'NotFoundError');
      expect(res.body).toHaveProperty('message', 'Post not found');
    });

    it('should return 404 if comment does not exist', async () => {
      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue({
        id: postId,
        title: 'Test Post',
      });

      (prismaMock.comment.findUnique as jest.Mock).mockResolvedValue(null);

      const res = await request(app)
        .post(`/api/posts/${postId}/comments/${commentId}/subscribe`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(res.body).toHaveProperty('error', 'NotFoundError');
      expect(res.body).toHaveProperty('message', 'Comment not found');
    });

    it('should return 404 if comment is soft-deleted', async () => {
      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue({
        id: postId,
        title: 'Test Post',
      });

      (prismaMock.comment.findUnique as jest.Mock).mockResolvedValue({
        id: commentId,
        postId: postId,
        deletedAt: new Date(),
      });

      const res = await request(app)
        .post(`/api/posts/${postId}/comments/${commentId}/subscribe`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(res.body).toHaveProperty('error', 'NotFoundError');
      expect(res.body).toHaveProperty('message', 'Comment not found');
    });

    it('should return 404 if comment does not belong to post', async () => {
      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue({
        id: postId,
        title: 'Test Post',
      });

      (prismaMock.comment.findUnique as jest.Mock).mockResolvedValue({
        id: commentId,
        postId: 'different-post-id',
        deletedAt: null,
      });

      const res = await request(app)
        .post(`/api/posts/${postId}/comments/${commentId}/subscribe`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(res.body).toHaveProperty('error', 'NotFoundError');
      expect(res.body).toHaveProperty('message', 'Comment does not belong to this post');
    });

    it('should return 409 if already subscribed', async () => {
      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue({
        id: postId,
        title: 'Test Post',
      });

      (prismaMock.comment.findUnique as jest.Mock).mockResolvedValue({
        id: commentId,
        postId: postId,
        deletedAt: null,
      });

      // Mock existing subscription
      (commentSubscriptionMock.findUnique as jest.Mock).mockResolvedValue({
        id: 'existing-subscription',
        userId: userId,
        commentId: commentId,
      });

      const res = await request(app)
        .post(`/api/posts/${postId}/comments/${commentId}/subscribe`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(409);

      expect(res.body).toHaveProperty('error', 'ConflictError');
      expect(res.body).toHaveProperty('message', 'You are already subscribed to this comment thread');
    });

    it('should return 401 when not authenticated', async () => {
      const res = await request(app)
        .post(`/api/posts/${postId}/comments/${commentId}/subscribe`)
        .expect(401);

      expect(res.body).toHaveProperty('error', 'Access token required');
    });
  });

  describe('DELETE /api/posts/:postId/comments/:commentId/subscribe', () => {
    it('should unsubscribe from a comment thread successfully', async () => {
      // Mock post exists
      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue({
        id: postId,
        title: 'Test Post',
      });

      // Mock comment exists and belongs to post
      (prismaMock.comment.findUnique as jest.Mock).mockResolvedValue({
        id: commentId,
        postId: postId,
      });

      // Mock subscription exists
      (commentSubscriptionMock.findUnique as jest.Mock).mockResolvedValue({
        id: 'subscription-1',
        userId: userId,
        commentId: commentId,
      });

      // Mock subscription deletion
      (commentSubscriptionMock.delete as jest.Mock).mockResolvedValue({
        id: 'subscription-1',
        userId: userId,
        commentId: commentId,
      });

      const res = await request(app)
        .delete(`/api/posts/${postId}/comments/${commentId}/subscribe`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('message', 'Successfully unsubscribed from comment thread');
    });

    it('should return 404 if post does not exist', async () => {
      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue(null);

      const res = await request(app)
        .delete(`/api/posts/${postId}/comments/${commentId}/subscribe`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(res.body).toHaveProperty('error', 'NotFoundError');
      expect(res.body).toHaveProperty('message', 'Post not found');
    });

    it('should return 404 if comment does not exist', async () => {
      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue({
        id: postId,
        title: 'Test Post',
      });

      (prismaMock.comment.findUnique as jest.Mock).mockResolvedValue(null);

      const res = await request(app)
        .delete(`/api/posts/${postId}/comments/${commentId}/subscribe`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(res.body).toHaveProperty('error', 'NotFoundError');
      expect(res.body).toHaveProperty('message', 'Comment not found');
    });

    it('should return 404 if comment does not belong to post', async () => {
      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue({
        id: postId,
        title: 'Test Post',
      });

      (prismaMock.comment.findUnique as jest.Mock).mockResolvedValue({
        id: commentId,
        postId: 'different-post-id',
      });

      const res = await request(app)
        .delete(`/api/posts/${postId}/comments/${commentId}/subscribe`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(res.body).toHaveProperty('error', 'NotFoundError');
      expect(res.body).toHaveProperty('message', 'Comment does not belong to this post');
    });

    it('should return 404 if comment is soft-deleted', async () => {
      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue({
        id: postId,
        title: 'Test Post',
      });

      (prismaMock.comment.findUnique as jest.Mock).mockResolvedValue({
        id: commentId,
        postId: postId,
        deletedAt: new Date(),
      });

      const res = await request(app)
        .delete(`/api/posts/${postId}/comments/${commentId}/subscribe`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(res.body).toHaveProperty('error', 'NotFoundError');
      expect(res.body).toHaveProperty('message', 'Comment not found');
    });

    it('should return 404 if not subscribed', async () => {
      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue({
        id: postId,
        title: 'Test Post',
      });

      (prismaMock.comment.findUnique as jest.Mock).mockResolvedValue({
        id: commentId,
        postId: postId,
        deletedAt: null,
      });

      // Mock no subscription exists
      (commentSubscriptionMock.findUnique as jest.Mock).mockResolvedValue(null);

      const res = await request(app)
        .delete(`/api/posts/${postId}/comments/${commentId}/subscribe`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(res.body).toHaveProperty('error', 'NotFoundError');
      expect(res.body).toHaveProperty('message', 'You are not subscribed to this comment thread');
    });

    it('should return 401 when not authenticated', async () => {
      const res = await request(app)
        .delete(`/api/posts/${postId}/comments/${commentId}/subscribe`)
        .expect(401);

      expect(res.body).toHaveProperty('error', 'Access token required');
    });
  });
});

