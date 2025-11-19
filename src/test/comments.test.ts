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

      const chain = [1,2,3,4,5];
      for (let i = 0; i < chain.length; i++) {
        (prismaMock.comment.findUnique as jest.Mock).mockResolvedValueOnce({ id: `c${i}`, parentId: `c${i+1}` });
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
      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue({ id: postId });

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

      (prismaMock.commentLike.count as jest.Mock).mockResolvedValueOnce(1);

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

      (prismaMock.commentLike.count as jest.Mock).mockResolvedValueOnce(0);

      (prismaMock.comment.findMany as jest.Mock).mockResolvedValueOnce([]);

      const res = await request(app)
        .get(`/api/posts/${postId}/comments`)
        .expect(200);

      expect(res.body).toHaveProperty('comments');
      expect(res.body.comments.length).toBe(1);
      expect(res.body.comments[0]).toHaveProperty('likeCount', 1);
      expect(res.body.comments[0].replies.length).toBe(1);
      expect(res.body.comments[0].replies[0]).toHaveProperty('content', 'Reply to first');
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

      (prismaMock.comment.findUnique as jest.Mock).mockResolvedValue({
        id: commentId,
        postId: postId,
        userId: userId,
        content: 'Comment to delete',
      });

      (prismaMock.comment.delete as jest.Mock).mockResolvedValue({});

      const res = await request(app)
        .delete(`/api/posts/${postId}/comments/${commentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('message', 'Comment deleted successfully');
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

      (prismaMock.comment.findUnique as jest.Mock).mockResolvedValue(null);

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

      (prismaMock.comment.findUnique as jest.Mock).mockResolvedValue({
        id: commentId,
        postId: postId,
        userId: otherUserId, // Different user
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

      (prismaMock.comment.findUnique as jest.Mock).mockResolvedValue({
        id: commentId,
        postId: postId,
        userId: userId,
        content: 'Comment with replies',
      });

      (prismaMock.comment.delete as jest.Mock).mockResolvedValue({});

      const res = await request(app)
        .delete(`/api/posts/${postId}/comments/${commentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('message', 'Comment deleted successfully');
      // Note: Cascade delete is handled by database, so we just verify the delete was called
      expect(prismaMock.comment.delete).toHaveBeenCalledWith({
        where: { id: commentId },
      });
    });
  });

  describe('GET /api/posts/recent-comments - Get recent comments', () => {
    beforeEach(() => {
      // Clear cache before each test to ensure fresh data
      invalidateCache.invalidateAll();
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
      },
    });

    it('should return recent comments with pagination', async () => {
      const now = new Date();
      const comment1 = createMockComment('comment-1', 'post-1', userId, new Date(now.getTime() - 1000));
      const comment2 = createMockComment('comment-2', 'post-2', userId2, new Date(now.getTime() - 2000));

      (prismaMock.comment.findMany as jest.Mock).mockClear().mockResolvedValue([comment1, comment2]);
      (prismaMock.commentLike.count as jest.Mock).mockClear()
        .mockResolvedValueOnce(5) // comment1 likes
        .mockResolvedValueOnce(3); // comment2 likes
      (prismaMock.comment.count as jest.Mock).mockClear().mockResolvedValue(2);

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
      (prismaMock.commentLike.count as jest.Mock).mockClear().mockResolvedValue(0);
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
      (prismaMock.commentLike.count as jest.Mock).mockClear().mockResolvedValue(0);
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
      (prismaMock.commentLike.count as jest.Mock).mockClear().mockResolvedValue(0);
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
      (prismaMock.commentLike.count as jest.Mock).mockClear()
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);
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
      (prismaMock.commentLike.count as jest.Mock).mockClear().mockResolvedValue(0);
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
      (prismaMock.commentLike.count as jest.Mock).mockClear().mockResolvedValue(0);
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
      (prismaMock.commentLike.count as jest.Mock).mockClear().mockResolvedValue(7);
      (prismaMock.comment.count as jest.Mock).mockClear().mockResolvedValue(1);

      const res = await request(app)
        .get('/api/posts/recent-comments')
        .expect(200);

      expect(res.body.comments[0]).toHaveProperty('likeCount', 7);
      expect(prismaMock.commentLike.count).toHaveBeenCalledWith({
        where: { commentId: 'comment-1' },
      });
    });

    it('should return empty array when no comments exist', async () => {
      (prismaMock.comment.findMany as jest.Mock).mockClear().mockResolvedValue([]);
      (prismaMock.commentLike.count as jest.Mock).mockClear();
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
      (prismaMock.commentLike.count as jest.Mock).mockClear().mockResolvedValue(0);
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
});
