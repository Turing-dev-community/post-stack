import request from 'supertest';
import { setupPrismaMock } from './utils/mockPrisma';
import { prisma } from '../lib/prisma';
import app from '../index';
import { generateToken } from '../utils/auth';
import { invalidateCache } from '../middleware/cache';

const { prisma: prismaMock } = setupPrismaMock(prisma, app);

describe('Comments API (mocked)', () => {
  const userId = 'user-1';
  const userId2 = 'user-2';
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

  describe('POST /api/posts/:postId/comments', () => {
    it('creates a comment when authenticated', async () => {
      const postId = 'post-1';
      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue({ id: postId, slug: 'post-slug' });
      (prismaMock.comment.create as jest.Mock).mockResolvedValue({
        id: 'comment-1',
        content: 'This is a test comment',
        postId,
        userId,
        parentId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: { id: userId, username: 'testuser' },
      });

      const res = await request(app)
        .post(`/api/posts/${postId}/comments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ content: 'This is a test comment' })
        .expect(201);

      expect(res.body).toHaveProperty('message', 'Comment created successfully');
      expect(res.body.comment).toMatchObject({ content: 'This is a test comment', postId, userId });
    });

    it('returns 401 when not authenticated', async () => {
      const postId = 'post-unauth';
      const res = await request(app)
        .post(`/api/posts/${postId}/comments`)
        .send({ content: 'comment' })
        .expect(401);
      expect(res.body).toHaveProperty('error', 'Access token required');
    });

    it('trims and sanitizes content', async () => {
      const postId = 'post-trim';
      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue({ id: postId, slug: 'post-trim-slug' });

      (prismaMock.comment.create as jest.Mock).mockImplementation(async (args: any) => ({
        id: 'comment-trim',
        content: args.data.content,
        postId,
        userId,
        parentId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: { id: userId, username: 'testuser' },
      }));

      const res1 = await request(app)
        .post(`/api/posts/${postId}/comments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ content: '   This comment should be trimmed.   ' })
        .expect(201);
      expect(res1.body.comment.content).toBe('This comment should be trimmed.');

      const res2 = await request(app)
        .post(`/api/posts/${postId}/comments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ content: 'Nice post <script>alert(999)</script> indeed' })
        .expect(201);
      expect(res2.body.comment.content).toBe('Nice post indeed');
    });
  });

  describe('POST /api/posts/:postId/comments/:commentId/reply', () => {
    it('creates a reply to a comment', async () => {
      const postId = 'post-reply';
      const parentId = 'comment-parent';
      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue({ id: postId, slug: 'post-reply-slug' });

      (prismaMock.comment.findUnique as jest.Mock).mockResolvedValueOnce({ id: parentId, postId });

      (prismaMock.comment.findUnique as jest.Mock).mockResolvedValueOnce({ id: parentId, parentId: null });

      (prismaMock.comment.create as jest.Mock).mockResolvedValue({
        id: 'comment-reply',
        content: 'This is a reply',
        postId,
        userId,
        parentId,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: { id: userId, username: 'testuser' },
      });

      const res = await request(app)
        .post(`/api/posts/${postId}/comments/${parentId}/reply`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ content: 'This is a reply' })
        .expect(201);

      expect(res.body).toHaveProperty('message', 'Reply created successfully');
      expect(res.body.comment).toMatchObject({ parentId, postId, content: 'This is a reply' });
    });

    it('enforces max thread depth of 5', async () => {
      const postId = 'post-depth';
      const deepId = 'comment-deep';
      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue({ id: postId, slug: 'post-depth-slug' });

      (prismaMock.comment.findUnique as jest.Mock).mockResolvedValueOnce({ id: deepId, postId });

      const chain = [1, 2, 3, 4, 5];
      for (let i = 0; i < chain.length; i++) {
        (prismaMock.comment.findUnique as jest.Mock).mockResolvedValueOnce({ id: `c${i}`, parentId: `c${i + 1}` });
      }
      (prismaMock.comment.findUnique as jest.Mock).mockResolvedValueOnce({ id: 'c5', parentId: null });

      const res = await request(app)
        .post(`/api/posts/${postId}/comments/${deepId}/reply`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ content: 'overflow' })
        .expect(400);
      expect(res.body).toHaveProperty('error', 'Maximum thread depth of 5 levels reached');
    });
  });

  describe('GET /api/posts/:postId/comments', () => {
    it('returns top-level comments with nested replies and like count', async () => {
      const postId = 'post-get';
      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue({ id: postId, authorId: 'author-1' });

      (prismaMock.comment.findMany as jest.Mock).mockResolvedValueOnce([
        {
          id: 'c1',
          content: 'First comment',
          postId,
          userId,
          parentId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          user: { id: userId, username: 'testuser' },
        },
      ]);

      (prismaMock.commentLike.groupBy as jest.Mock).mockResolvedValueOnce([
        { commentId: 'c1', _count: { commentId: 3 } },
        { commentId: 'c1-r1', _count: { commentId: 1 } },
      ]);

      (prismaMock.userCommenterStats.findMany as jest.Mock).mockResolvedValue([]);

      (prismaMock.comment.findMany as jest.Mock).mockResolvedValueOnce([
        {
          id: 'c1-r1',
          content: 'Reply to first',
          postId,
          userId,
          parentId: 'c1',
          createdAt: new Date(),
          updatedAt: new Date(),
          user: { id: userId, username: 'testuser' },
        },
      ]);

      (prismaMock.comment.findMany as jest.Mock).mockResolvedValueOnce([]);

      const res = await request(app)
        .get(`/api/posts/${postId}/comments`)
        .expect(200);

      expect(res.body).toHaveProperty('comments');
      expect(res.body.comments.length).toBe(1);
      expect(res.body.comments[0]).toHaveProperty('likeCount', 3);
      expect(res.body.comments[0].replies.length).toBe(1);
      expect(res.body.comments[0].replies[0]).toHaveProperty('content', 'Reply to first');
      expect(res.body.comments[0].replies[0]).toHaveProperty('likeCount', 1);
    });

    it('uses batch query to fetch like counts (N+1 fix verification)', async () => {
      const postId = 'post-batch';
      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue({ id: postId, authorId: 'author-1' });

      // Multiple top-level comments
      (prismaMock.comment.findMany as jest.Mock).mockResolvedValueOnce([
        {
          id: 'c1',
          content: 'Comment 1',
          postId,
          userId,
          parentId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          user: { id: userId, username: 'testuser' },
        },
        {
          id: 'c2',
          content: 'Comment 2',
          postId,
          userId: userId2,
          parentId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          user: { id: userId2, username: 'testuser2' },
        },
      ]);

      // Mock single batch groupBy call for all like counts
      (prismaMock.commentLike.groupBy as jest.Mock).mockResolvedValueOnce([
        { commentId: 'c1', _count: { commentId: 5 } },
        { commentId: 'c2', _count: { commentId: 2 } },
        { commentId: 'c1-r1', _count: { commentId: 1 } },
      ]);

      (prismaMock.userCommenterStats.findMany as jest.Mock).mockResolvedValue([]);

      // Replies for first comment
      (prismaMock.comment.findMany as jest.Mock).mockResolvedValueOnce([
        {
          id: 'c1-r1',
          content: 'Reply to c1',
          postId,
          userId,
          parentId: 'c1',
          createdAt: new Date(),
          updatedAt: new Date(),
          user: { id: userId, username: 'testuser' },
        },
      ]);

      // No nested replies for c1-r1
      (prismaMock.comment.findMany as jest.Mock).mockResolvedValueOnce([]);

      // No replies for second comment
      (prismaMock.comment.findMany as jest.Mock).mockResolvedValueOnce([]);

      const res = await request(app)
        .get(`/api/posts/${postId}/comments`)
        .expect(200);

      expect(res.body).toHaveProperty('comments');
      expect(res.body.comments.length).toBe(2);
      
      // Verify like counts are correctly applied from the batch query
      expect(res.body.comments[0]).toHaveProperty('likeCount', 5);
      expect(res.body.comments[1]).toHaveProperty('likeCount', 2);
      expect(res.body.comments[0].replies[0]).toHaveProperty('likeCount', 1);

      // Verify groupBy was called only once (not once per comment)
      expect(prismaMock.commentLike.groupBy).toHaveBeenCalledTimes(1);
    });

    it('handles comments with no likes correctly', async () => {
      const postId = 'post-no-likes';
      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue({ id: postId, authorId: 'author-1' });

      (prismaMock.comment.findMany as jest.Mock).mockResolvedValueOnce([
        {
          id: 'c1',
          content: 'Unloved comment',
          postId,
          userId,
          parentId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          user: { id: userId, username: 'testuser' },
        },
      ]);

      // Empty groupBy result when no likes exist
      (prismaMock.commentLike.groupBy as jest.Mock).mockResolvedValueOnce([]);

      (prismaMock.userCommenterStats.findMany as jest.Mock).mockResolvedValue([]);
      (prismaMock.comment.findMany as jest.Mock).mockResolvedValueOnce([]);

      const res = await request(app)
        .get(`/api/posts/${postId}/comments`)
        .expect(200);

      expect(res.body).toHaveProperty('comments');
      expect(res.body.comments.length).toBe(1);
      expect(res.body.comments[0]).toHaveProperty('likeCount', 0);
    });
  });

  describe('Comment likes', () => {
    it('likes a comment', async () => {
      const postId = 'post-like';
      const commentId = 'c-like';
      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue({ id: postId, slug: 'post-like-slug' });
      (prismaMock.comment.findUnique as jest.Mock).mockResolvedValue({ id: commentId, postId });
      (prismaMock.commentLike.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaMock.commentLike.create as jest.Mock).mockResolvedValue({ userId, commentId });
      (prismaMock.commentLike.count as jest.Mock).mockResolvedValue(1);

      const res = await request(app)
        .post(`/api/posts/${postId}/comments/${commentId}/like`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);
      expect(res.body).toHaveProperty('message', 'Comment liked successfully');
      expect(res.body).toHaveProperty('likeCount', 1);
    });

    it('prevents duplicate likes', async () => {
      const postId = 'post-like-dup';
      const commentId = 'c-like-dup';
      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue({ id: postId, slug: 'post-like-dup-slug' });
      (prismaMock.comment.findUnique as jest.Mock).mockResolvedValue({ id: commentId, postId });
      (prismaMock.commentLike.findUnique as jest.Mock).mockResolvedValue({ userId, commentId });

      const res = await request(app)
        .post(`/api/posts/${postId}/comments/${commentId}/like`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
      expect(res.body).toHaveProperty('error', 'You have already liked this comment');
    });

    it('unlikes a comment', async () => {
      const postId = 'post-unlike';
      const commentId = 'c-unlike';
      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue({ id: postId, slug: 'post-unlike-slug' });
      (prismaMock.comment.findUnique as jest.Mock).mockResolvedValue({ id: commentId, postId });
      (prismaMock.commentLike.findUnique as jest.Mock).mockResolvedValue({ userId, commentId });
      (prismaMock.commentLike.delete as jest.Mock).mockResolvedValue({});
      (prismaMock.commentLike.count as jest.Mock).mockResolvedValue(0);

      const res = await request(app)
        .delete(`/api/posts/${postId}/comments/${commentId}/like`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      expect(res.body).toHaveProperty('message', 'Comment unliked successfully');
      expect(res.body).toHaveProperty('likeCount', 0);
    });
  });

  describe('PUT /api/posts/:postId/comments/:commentId', () => {
    it('should update comment successfully when user owns the comment', async () => {
      const postId = 'post-1';
      const commentId = 'comment-1';
      const userId = 'user-1';
      const authToken = generateToken(userId);
      const newContent = 'Updated comment content';

      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue({
        id: postId,
        slug: 'test-post',
      });

      (prismaMock.comment.findUnique as jest.Mock).mockResolvedValue({
        id: commentId,
        postId: postId,
        userId: userId,
        content: 'Original content',
      });

      (prismaMock.comment.update as jest.Mock).mockResolvedValue({
        id: commentId,
        postId: postId,
        userId: userId,
        content: newContent,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: {
          id: userId,
          username: 'testuser',
        },
      });

      (prismaMock.commentLike.count as jest.Mock).mockResolvedValue(5);

      const res = await request(app)
        .put(`/api/posts/${postId}/comments/${commentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ content: newContent })
        .expect(200);

      expect(res.body).toHaveProperty('message', 'Comment updated successfully');
      expect(res.body).toHaveProperty('comment');
      expect(res.body.comment).toHaveProperty('content', newContent);
      expect(res.body.comment).toHaveProperty('likeCount', 5);
    });

    it('should return 401 when not authenticated', async () => {
      const postId = 'post-1';
      const commentId = 'comment-1';

      const res = await request(app)
        .put(`/api/posts/${postId}/comments/${commentId}`)
        .send({ content: 'Updated content' })
        .expect(401);

      expect(res.body).toHaveProperty('error', 'Access token required');
    });

    it('should return 404 when post does not exist', async () => {
      const postId = 'non-existent-post';
      const commentId = 'comment-1';
      const userId = 'user-1';
      const authToken = generateToken(userId);

      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue(null);

      const res = await request(app)
        .put(`/api/posts/${postId}/comments/${commentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ content: 'Updated content' })
        .expect(404);

      expect(res.body).toHaveProperty('error', 'NotFoundError');
      expect(res.body).toHaveProperty('message', 'Post not found');
    });

    it('should return 404 when comment does not exist', async () => {
      const postId = 'post-1';
      const commentId = 'non-existent-comment';
      const userId = 'user-1';
      const authToken = generateToken(userId);

      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue({
        id: postId,
        slug: 'test-post',
      });

      (prismaMock.comment.findUnique as jest.Mock).mockResolvedValue(null);

      const res = await request(app)
        .put(`/api/posts/${postId}/comments/${commentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ content: 'Updated content' })
        .expect(404);

      expect(res.body).toHaveProperty('error', 'NotFoundError');
      expect(res.body).toHaveProperty('message', 'Comment not found');
    });

    it('should return 403 when user does not own the comment', async () => {
      const postId = 'post-1';
      const commentId = 'comment-1';
      const userId = 'user-1';
      const otherUserId = 'user-2';
      const authToken = generateToken(userId);

      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue({
        id: postId,
        slug: 'test-post',
      });

      (prismaMock.comment.findUnique as jest.Mock).mockResolvedValue({
        id: commentId,
        postId: postId,
        userId: otherUserId, // Different user
        content: 'Original content',
      });

      const res = await request(app)
        .put(`/api/posts/${postId}/comments/${commentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ content: 'Updated content' })
        .expect(403);

      expect(res.body).toHaveProperty('error', 'ForbiddenError');
      expect(res.body).toHaveProperty('message', 'You can only edit your own comments');
    });

    it('should return 400 when content is missing', async () => {
      const postId = 'post-1';
      const commentId = 'comment-1';
      const userId = 'user-1';
      const authToken = generateToken(userId);

      const res = await request(app)
        .put(`/api/posts/${postId}/comments/${commentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(res.body).toHaveProperty('error', 'ValidationError');
    });

    it('should return 400 when content is empty', async () => {
      const postId = 'post-1';
      const commentId = 'comment-1';
      const userId = 'user-1';
      const authToken = generateToken(userId);

      const res = await request(app)
        .put(`/api/posts/${postId}/comments/${commentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ content: '' })
        .expect(400);

      expect(res.body).toHaveProperty('error', 'ValidationError');
    });
  });

  describe('DELETE /api/posts/:postId/comments/:commentId', () => {
    it('should delete comment successfully when user owns the comment', async () => {
      const postId = 'post-1';
      const commentId = 'comment-1';
      const userId = 'user-1';
      const authToken = generateToken(userId);

      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue({
        id: postId,
        slug: 'test-post',
      });

      (prismaMock.comment.findFirst as jest.Mock).mockResolvedValue({
        id: commentId,
        postId: postId,
        userId: userId,
        deletedAt: null,
        content: 'Comment to delete',
      });

      (prismaMock.comment.update as jest.Mock).mockResolvedValue({
        id: commentId,
        deletedAt: new Date(),
      });

      (prismaMock.comment.findMany as jest.Mock).mockResolvedValue([]);

      const res = await request(app)
        .delete(`/api/posts/${postId}/comments/${commentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('message', 'Comment deleted successfully');
      expect(prismaMock.comment.update).toHaveBeenCalledWith({
        where: { id: commentId },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('should return 401 when not authenticated', async () => {
      const postId = 'post-1';
      const commentId = 'comment-1';

      const res = await request(app)
        .delete(`/api/posts/${postId}/comments/${commentId}`)
        .expect(401);

      expect(res.body).toHaveProperty('error', 'Access token required');
    });

    it('should return 404 when post does not exist', async () => {
      const postId = 'non-existent-post';
      const commentId = 'comment-1';
      const userId = 'user-1';
      const authToken = generateToken(userId);

      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue(null);

      const res = await request(app)
        .delete(`/api/posts/${postId}/comments/${commentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(res.body).toHaveProperty('error', 'NotFoundError');
      expect(res.body).toHaveProperty('message', 'Post not found');
    });

    it('should return 404 when comment does not exist', async () => {
      const postId = 'post-1';
      const commentId = 'non-existent-comment';
      const userId = 'user-1';
      const authToken = generateToken(userId);

      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue({
        id: postId,
        slug: 'test-post',
      });

      (prismaMock.comment.findFirst as jest.Mock).mockResolvedValue(null);

      const res = await request(app)
        .delete(`/api/posts/${postId}/comments/${commentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(res.body).toHaveProperty('error', 'NotFoundError');
      expect(res.body).toHaveProperty('message', 'Comment not found');
    });

    it('should return 403 when user does not own the comment', async () => {
      const postId = 'post-1';
      const commentId = 'comment-1';
      const userId = 'user-1';
      const otherUserId = 'user-2';
      const authToken = generateToken(userId);

      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue({
        id: postId,
        slug: 'test-post',
      });

      (prismaMock.comment.findFirst as jest.Mock).mockResolvedValue({
        id: commentId,
        postId: postId,
        userId: otherUserId, // Different user
        deletedAt: null,
        content: 'Comment to delete',
      });

      const res = await request(app)
        .delete(`/api/posts/${postId}/comments/${commentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      expect(res.body).toHaveProperty('error', 'ForbiddenError');
      expect(res.body).toHaveProperty('message', 'You can only delete your own comments');
    });

    it('should cascade delete nested replies when deleting a comment', async () => {
      const postId = 'post-1';
      const commentId = 'comment-1';
      const userId = 'user-1';
      const authToken = generateToken(userId);

      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue({
        id: postId,
        slug: 'test-post',
      });

      (prismaMock.comment.findFirst as jest.Mock).mockResolvedValue({
        id: commentId,
        postId: postId,
        userId: userId,
        deletedAt: null,
        content: 'Comment with replies',
      });


      (prismaMock.comment.findMany as jest.Mock).mockResolvedValueOnce([
        { id: 'reply-1' },
        { id: 'reply-2' },
      ]);


      (prismaMock.comment.findMany as jest.Mock).mockResolvedValue([]);

      (prismaMock.comment.update as jest.Mock).mockResolvedValue({});

      const res = await request(app)
        .delete(`/api/posts/${postId}/comments/${commentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('message', 'Comment deleted successfully');

      expect(prismaMock.comment.update).toHaveBeenCalledWith({
        where: { id: commentId },
        data: { deletedAt: expect.any(Date) },
      });

      expect(prismaMock.comment.update).toHaveBeenCalledWith({
        where: { id: 'reply-1' },
        data: { deletedAt: expect.any(Date) },
      });
      expect(prismaMock.comment.update).toHaveBeenCalledWith({
        where: { id: 'reply-2' },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('should return 404 when trying to delete already soft-deleted comment', async () => {
      const postId = 'post-1';
      const commentId = 'comment-1';
      const userId = 'user-1';
      const authToken = generateToken(userId);

      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue({
        id: postId,
        slug: 'test-post',
      });

      (prismaMock.comment.findFirst as jest.Mock).mockResolvedValue(null);

      const res = await request(app)
        .delete(`/api/posts/${postId}/comments/${commentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(res.body).toHaveProperty('error', 'NotFoundError');
      expect(res.body).toHaveProperty('message', 'Comment not found');
    });

    it('should exclude soft-deleted comments from query results', async () => {
      const postId = 'post-1';

      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue({
        id: postId,
        allowComments: true,
      });

      (prismaMock.comment.findMany as jest.Mock).mockResolvedValueOnce([
        {
          id: 'comment-1',
          content: 'Active comment',
          postId,
          userId,
          parentId: null,
          deletedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          user: { id: userId, username: 'testuser' },
        },
      ]);

      // Mock batch groupBy for like counts
      (prismaMock.commentLike.groupBy as jest.Mock).mockResolvedValue([
        { commentId: 'comment-1', _count: { commentId: 0 } },
      ]);
      
      (prismaMock.comment.findMany as jest.Mock).mockResolvedValue([]);
      (prismaMock.userCommenterStats.findMany as jest.Mock).mockResolvedValue([]);

      const res = await request(app)
        .get(`/api/posts/${postId}/comments`)
        .expect(200);

      expect(res.body.comments).toHaveLength(1);
      expect(res.body.comments[0].id).toBe('comment-1');
      expect(res.body.comments[0].content).toBe('Active comment');

      expect(prismaMock.comment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            postId,
            deletedAt: null,
          }),
        })
      );
    });
  });

  describe('GET /api/posts/recent-comments - Get recent comments', () => {
    beforeEach(() => {
      // Clear cache before each test to ensure fresh data
      invalidateCache.invalidateAll();
      // Mock userCommenterStats to return empty array by default
      (prismaMock.userCommenterStats.findMany as jest.Mock).mockResolvedValue([]);
    });

    const createMockComment = (id: string, postId: string, userId: string, createdAt: Date, content: string = 'Test comment') => ({
      id,
      content,
      postId,
      userId,
      parentId: null,
      createdAt,
      updatedAt: createdAt,
      user: {
        id: userId,
        username: userId === 'user-1' ? 'testuser' : 'testuser2',
      },
      post: {
        id: postId,
        title: `Post ${postId}`,
        slug: `post-${postId}`,
        authorId: `author-${postId}`,
      },
    });

    it('should return recent comments with pagination', async () => {
      const now = new Date();
      const comment1 = createMockComment('comment-1', 'post-1', userId, new Date(now.getTime() - 1000));
      const comment2 = createMockComment('comment-2', 'post-2', userId2, new Date(now.getTime() - 2000));

      (prismaMock.comment.findMany as jest.Mock).mockClear().mockResolvedValue([comment1, comment2]);
      
      // Mock batch groupBy call instead of individual count calls (N+1 fix)
      (prismaMock.commentLike.groupBy as jest.Mock).mockClear().mockResolvedValueOnce([
        { commentId: 'comment-1', _count: { commentId: 5 } },
        { commentId: 'comment-2', _count: { commentId: 3 } },
      ]);
      
      (prismaMock.comment.count as jest.Mock).mockClear().mockResolvedValue(2);
      (prismaMock.userCommenterStats.findMany as jest.Mock).mockClear().mockResolvedValue([]);

      const res = await request(app)
        .get('/api/posts/recent-comments')
        .expect(200);

      expect(res.body).toHaveProperty('comments');
      expect(res.body).toHaveProperty('pagination');
      expect(res.body.comments).toHaveLength(2);
      expect(res.body.comments[0]).toHaveProperty('id', 'comment-1');
      expect(res.body.comments[0]).toHaveProperty('likeCount', 5);
      expect(res.body.comments[0]).toHaveProperty('user');
      expect(res.body.comments[0]).toHaveProperty('post');
      expect(res.body.pagination).toMatchObject({
        page: 1,
        limit: 20,
        total: 2,
        totalPages: 1,
      });
    });

    it('should return only top-level comments (no replies)', async () => {
      const now = new Date();
      const comment1 = createMockComment('comment-1', 'post-1', userId, new Date(now.getTime() - 1000));

      (prismaMock.comment.findMany as jest.Mock).mockClear().mockResolvedValue([comment1]);
      (prismaMock.commentLike.groupBy as jest.Mock).mockClear().mockResolvedValue([]);
      (prismaMock.comment.count as jest.Mock).mockClear().mockResolvedValue(1);

      await request(app)
        .get('/api/posts/recent-comments')
        .expect(200);

      expect(prismaMock.comment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            parentId: null,
            post: {
              published: true,
            },
          }),
          orderBy: {
            createdAt: 'desc',
          },
        })
      );
    });

    it('should return only comments from published posts', async () => {
      const now = new Date();
      const comment1 = createMockComment('comment-1', 'post-1', userId, new Date(now.getTime() - 1000));

      (prismaMock.comment.findMany as jest.Mock).mockClear().mockResolvedValue([comment1]);
      (prismaMock.commentLike.groupBy as jest.Mock).mockClear().mockResolvedValue([]);
      (prismaMock.comment.count as jest.Mock).mockClear().mockResolvedValue(1);

      await request(app)
        .get('/api/posts/recent-comments')
        .expect(200);

      expect(prismaMock.comment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            post: {
              published: true,
            },
          }),
        })
      );
    });

    it('should support pagination with page and limit', async () => {
      const now = new Date();
      const comment1 = createMockComment('comment-1', 'post-1', userId, new Date(now.getTime() - 1000));

      (prismaMock.comment.findMany as jest.Mock).mockClear().mockResolvedValue([comment1]);
      (prismaMock.commentLike.groupBy as jest.Mock).mockClear().mockResolvedValue([]);
      (prismaMock.comment.count as jest.Mock).mockClear().mockResolvedValue(25);

      const res = await request(app)
        .get('/api/posts/recent-comments?page=2&limit=10')
        .expect(200);

      expect(prismaMock.comment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        })
      );
      expect(res.body.pagination).toMatchObject({
        page: 2,
        limit: 10,
        total: 25,
        totalPages: 3,
      });
    });

    it('should order comments by createdAt descending (newest first)', async () => {
      const now = new Date();
      const comment1 = createMockComment('comment-1', 'post-1', userId, new Date(now.getTime() - 1000));
      const comment2 = createMockComment('comment-2', 'post-2', userId2, new Date(now.getTime() - 2000));

      (prismaMock.comment.findMany as jest.Mock).mockClear().mockResolvedValue([comment1, comment2]);
      (prismaMock.commentLike.groupBy as jest.Mock).mockClear().mockResolvedValue([]);
      (prismaMock.comment.count as jest.Mock).mockClear().mockResolvedValue(2);

      await request(app)
        .get('/api/posts/recent-comments')
        .expect(200);

      expect(prismaMock.comment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: {
            createdAt: 'desc',
          },
        })
      );
    });

    it('should include user information for each comment', async () => {
      const now = new Date();
      const comment1 = createMockComment('comment-1', 'post-1', userId, new Date(now.getTime() - 1000));

      (prismaMock.comment.findMany as jest.Mock).mockClear().mockResolvedValue([comment1]);
      (prismaMock.commentLike.groupBy as jest.Mock).mockClear().mockResolvedValue([]);
      (prismaMock.comment.count as jest.Mock).mockClear().mockResolvedValue(1);

      const res = await request(app)
        .get('/api/posts/recent-comments')
        .expect(200);

      expect(res.body.comments[0]).toHaveProperty('user');
      expect(res.body.comments[0].user).toHaveProperty('id', userId);
      expect(res.body.comments[0].user).toHaveProperty('username', 'testuser');
    });

    it('should include post information for each comment', async () => {
      const now = new Date();
      const comment1 = createMockComment('comment-1', 'post-1', userId, new Date(now.getTime() - 1000));

      (prismaMock.comment.findMany as jest.Mock).mockClear().mockResolvedValue([comment1]);
      (prismaMock.commentLike.groupBy as jest.Mock).mockClear().mockResolvedValue([]);
      (prismaMock.comment.count as jest.Mock).mockClear().mockResolvedValue(1);

      const res = await request(app)
        .get('/api/posts/recent-comments')
        .expect(200);

      expect(res.body.comments[0]).toHaveProperty('post');
      expect(res.body.comments[0].post).toHaveProperty('id', 'post-1');
      expect(res.body.comments[0].post).toHaveProperty('title', 'Post post-1');
      expect(res.body.comments[0].post).toHaveProperty('slug', 'post-post-1');
    });

    it('should include like count for each comment', async () => {
      const now = new Date();
      const comment1 = createMockComment('comment-1', 'post-1', userId, new Date(now.getTime() - 1000));

      (prismaMock.comment.findMany as jest.Mock).mockClear().mockResolvedValue([comment1]);
      (prismaMock.commentLike.groupBy as jest.Mock).mockClear().mockResolvedValue([
        { commentId: 'comment-1', _count: { commentId: 7 } },
      ]);
      (prismaMock.comment.count as jest.Mock).mockClear().mockResolvedValue(1);

      const res = await request(app)
        .get('/api/posts/recent-comments')
        .expect(200);

      expect(res.body.comments[0]).toHaveProperty('likeCount', 7);
      expect(prismaMock.commentLike.groupBy).toHaveBeenCalledTimes(1);
    });

    it('should return empty array when no comments exist', async () => {
      (prismaMock.comment.findMany as jest.Mock).mockClear().mockResolvedValue([]);
      (prismaMock.commentLike.groupBy as jest.Mock).mockClear().mockResolvedValue([]);
      (prismaMock.comment.count as jest.Mock).mockClear().mockResolvedValue(0);

      const res = await request(app)
        .get('/api/posts/recent-comments')
        .expect(200);

      expect(res.body.comments).toEqual([]);
      expect(res.body.pagination).toMatchObject({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
      });
    });

    it('should use default pagination when not provided', async () => {
      const now = new Date();
      const comment1 = createMockComment('comment-1', 'post-1', userId, new Date(now.getTime() - 1000));

      (prismaMock.comment.findMany as jest.Mock).mockClear().mockResolvedValue([comment1]);
      (prismaMock.commentLike.groupBy as jest.Mock).mockClear().mockResolvedValue([]);
      (prismaMock.comment.count as jest.Mock).mockClear().mockResolvedValue(1);

      await request(app)
        .get('/api/posts/recent-comments')
        .expect(200);

      expect(prismaMock.comment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 20,
        })
      );
    });

    it('should validate pagination parameters', async () => {
      const res = await request(app)
        .get('/api/posts/recent-comments?page=0')
        .expect(400);

      expect(res.body).toHaveProperty('error');
    });

    it('should validate limit is within allowed range', async () => {
      const res = await request(app)
        .get('/api/posts/recent-comments?limit=101')
        .expect(400);

      expect(res.body).toHaveProperty('error');
    });
  });

  describe('PATCH /api/posts/:id/comments/settings', () => {
    it('allows the author to disable comments and blocks creation after', async () => {
      (prismaMock.post.findUnique as jest.Mock).mockResolvedValueOnce({ id: 'p1', slug: 's', authorId: userId });
      (prismaMock.post.update as jest.Mock).mockResolvedValue({
        id: 'p1',
        slug: 's',
        allowComments: false,
        title: 't',
        content: 'c',
        published: true,
        featured: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        authorId: userId,
        categoryId: null,
        metaDescription: null,
        metaTitle: null,
        ogImage: null,
        viewCount: 0,
        author: { id: userId, username: 'testuser' },
        category: null,
        tags: [],
      });

      const toggleRes = await request(app)
        .patch('/api/posts/p1/comments/settings')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ allowComments: false })
        .expect(200);

      expect(toggleRes.body).toHaveProperty('message', 'Comment settings updated successfully');
      expect(toggleRes.body.post.allowComments).toBe(false);

      (prismaMock.post.findUnique as jest.Mock).mockResolvedValueOnce({ id: 'p1', slug: 's', allowComments: false });
      const createRes = await request(app)
        .post('/api/posts/p1/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ content: 'Hello' })
        .expect(403);
      expect(createRes.body).toHaveProperty('error', 'Comments are disabled for this post');
    });

    it('forbids non-owner from toggling comment settings', async () => {
      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue({ id: 'p1', slug: 's', authorId: 'other' });
      const res = await request(app)
        .patch('/api/posts/p1/comments/settings')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ allowComments: false })
        .expect(403);
      expect(res.body).toHaveProperty('error', 'Not authorized to update this post');
    });
  });

  describe('Deactivated User Filtering', () => {
    const activeUserId = 'active-user-1';
    const deactivatedUserId = 'deactivated-user-1';
    const postId = 'post-1';
    const activeAuthToken = (() => {
      process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
      return generateToken(activeUserId);
    })();

    beforeEach(() => {
      jest.clearAllMocks();
      invalidateCache.invalidateAll();

      // Mock userCommenterStats to return empty array by default
      (prismaMock.userCommenterStats.findMany as jest.Mock).mockResolvedValue([]);

      // Mock authenticateToken middleware for active and deactivated users
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
        // Fallback for other users (like userId from parent scope)
        if (args.where.id === userId) {
          return {
            id: userId,
            email: 'user@example.com',
            username: 'testuser',
            deletedAt: null,
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
        (prismaMock.commentLike.groupBy as jest.Mock).mockResolvedValue([]);

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

        (prismaMock.commentLike.groupBy as jest.Mock).mockResolvedValue([]);

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

        (prismaMock.commentLike.groupBy as jest.Mock).mockResolvedValue([]);

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
        (prismaMock.commentLike.groupBy as jest.Mock).mockResolvedValue([]);
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
        (prismaMock.commentLike.groupBy as jest.Mock).mockResolvedValue([]);
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

        (prismaMock.commentLike.groupBy as jest.Mock).mockResolvedValue([]);

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
})  
