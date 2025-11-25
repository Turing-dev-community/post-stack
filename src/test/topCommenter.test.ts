import request from 'supertest';
import { setupPrismaMock } from './utils/mockPrisma';
import { prisma } from '../lib/prisma';
import app from '../index';
import { generateToken } from '../utils/auth';

const { prisma: prismaMock } = setupPrismaMock(prisma, app);

describe('Top Commenter Feature', () => {
  const userId = 'user-1';
  const postAuthorId = 'author-1';
  const postId = 'post-1';
  const authToken = generateToken(userId);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should have mocking properly configured', () => {
    expect((prismaMock as any).isMocked).toBe(true);
  });

  describe('Comment Stats Tracking', () => {
    it('should create commenter stats when first comment is created', async () => {
      const mockPost = {
        id: postId,
        authorId: postAuthorId,
        slug: 'test-post',
        allowComments: true,
      };

      const mockComment = {
        id: 'comment-1',
        content: 'First comment',
        postId,
        userId,
        parentId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: {
          id: userId,
          username: 'testuser',
        },
      };

      (prismaMock.user.findUnique as jest.Mock).mockResolvedValue({
        id: userId,
        deletedAt: null,
      });
      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue(mockPost);
      (prismaMock.comment.create as jest.Mock).mockResolvedValue(mockComment);
      (prismaMock.userCommenterStats.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaMock.userCommenterStats.create as jest.Mock).mockResolvedValue({
        id: 'stats-1',
        postAuthorId,
        commenterId: userId,
        commentCount: 1,
        lastCommentAt: new Date(),
      });

      await request(app)
        .post(`/api/posts/${postId}/comments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ content: 'First comment' })
        .expect(201);

      expect(prismaMock.userCommenterStats.create).toHaveBeenCalledWith({
        data: {
          postAuthorId,
          commenterId: userId,
          commentCount: 1,
          lastCommentAt: expect.any(Date),
        },
      });
    });

    it('should increment commenter stats when subsequent comments are created', async () => {
      const mockPost = {
        id: postId,
        authorId: postAuthorId,
        slug: 'test-post',
        allowComments: true,
      };

      const mockComment = {
        id: 'comment-2',
        content: 'Second comment',
        postId,
        userId,
        parentId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: {
          id: userId,
          username: 'testuser',
        },
      };

      const existingStats = {
        id: 'stats-1',
        postAuthorId,
        commenterId: userId,
        commentCount: 1,
      };

      (prismaMock.user.findUnique as jest.Mock).mockResolvedValue({
        id: userId,
        deletedAt: null,
      });
      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue(mockPost);
      (prismaMock.comment.create as jest.Mock).mockResolvedValue(mockComment);
      (prismaMock.userCommenterStats.findUnique as jest.Mock).mockResolvedValue(existingStats);
      (prismaMock.userCommenterStats.update as jest.Mock).mockResolvedValue({
        ...existingStats,
        commentCount: 2,
      });

      await request(app)
        .post(`/api/posts/${postId}/comments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ content: 'Second comment' })
        .expect(201);

      expect(prismaMock.userCommenterStats.update).toHaveBeenCalledWith({
        where: {
          postAuthorId_commenterId: {
            postAuthorId,
            commenterId: userId,
          },
        },
        data: {
          commentCount: { increment: 1 },
          lastCommentAt: expect.any(Date),
        },
      });
    });

    it('should not track stats when user comments on their own post', async () => {
      const mockPost = {
        id: postId,
        authorId: userId, 
        slug: 'test-post',
        allowComments: true,
      };

      const mockComment = {
        id: 'comment-3',
        content: 'Comment on own post',
        postId,
        userId,
        parentId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: {
          id: userId,
          username: 'testuser',
        },
      };

      (prismaMock.user.findUnique as jest.Mock).mockResolvedValue({
        id: userId,
        deletedAt: null,
      });
      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue(mockPost);
      (prismaMock.comment.create as jest.Mock).mockResolvedValue(mockComment);

      await request(app)
        .post(`/api/posts/${postId}/comments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ content: 'Comment on own post' })
        .expect(201);

      expect(prismaMock.userCommenterStats.findUnique).not.toHaveBeenCalled();
      expect(prismaMock.userCommenterStats.create).not.toHaveBeenCalled();
      expect(prismaMock.userCommenterStats.update).not.toHaveBeenCalled();
    });

    it('should decrement stats when comment is deleted', async () => {
      const mockPost = {
        id: postId,
        authorId: postAuthorId,
        slug: 'test-post',
      };

      const mockComment = {
        id: 'comment-4',
        postId,
        userId,
      };

      const existingStats = {
        id: 'stats-1',
        postAuthorId,
        commenterId: userId,
        commentCount: 3,
      };

      (prismaMock.user.findUnique as jest.Mock).mockResolvedValue({
        id: userId,
        deletedAt: null,
      });
      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue(mockPost);
      (prismaMock.comment.findUnique as jest.Mock).mockResolvedValue(mockComment);
      (prismaMock.comment.delete as jest.Mock).mockResolvedValue(mockComment);
      (prismaMock.userCommenterStats.findUnique as jest.Mock).mockResolvedValue(existingStats);
      (prismaMock.userCommenterStats.update as jest.Mock).mockResolvedValue({
        ...existingStats,
        commentCount: 2,
      });

      await request(app)
        .delete(`/api/posts/${postId}/comments/comment-4`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(prismaMock.userCommenterStats.update).toHaveBeenCalledWith({
        where: {
          postAuthorId_commenterId: {
            postAuthorId,
            commenterId: userId,
          },
        },
        data: {
          commentCount: { decrement: 1 },
        },
      });
    });

    it('should delete stats entry when last comment is deleted', async () => {
      const mockPost = {
        id: postId,
        authorId: postAuthorId,
        slug: 'test-post',
      };

      const mockComment = {
        id: 'comment-5',
        postId,
        userId,
      };

      const existingStats = {
        id: 'stats-1',
        postAuthorId,
        commenterId: userId,
        commentCount: 1,
      };

      (prismaMock.user.findUnique as jest.Mock).mockResolvedValue({
        id: userId,
        deletedAt: null,
      });
      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue(mockPost);
      (prismaMock.comment.findUnique as jest.Mock).mockResolvedValue(mockComment);
      (prismaMock.comment.delete as jest.Mock).mockResolvedValue(mockComment);
      (prismaMock.userCommenterStats.findUnique as jest.Mock).mockResolvedValue(existingStats);
      (prismaMock.userCommenterStats.delete as jest.Mock).mockResolvedValue(existingStats);

      await request(app)
        .delete(`/api/posts/${postId}/comments/comment-5`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(prismaMock.userCommenterStats.delete).toHaveBeenCalledWith({
        where: {
          postAuthorId_commenterId: {
            postAuthorId,
            commenterId: userId,
          },
        },
      });
    });
  });

  describe('Top Commenter Badge Display', () => {
    it('should mark user as top commenter when they have 5+ comments', async () => {
      const mockPost = {
        id: postId,
        authorId: postAuthorId,
        allowComments: true,
      };

      const mockComments = [
        {
          id: 'comment-1',
          content: 'Comment',
          postId,
          userId,
          parentId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          user: { id: userId, username: 'topcommenter' },
        },
      ];

      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue(mockPost);
      (prismaMock.comment.findMany as jest.Mock).mockResolvedValue(mockComments);
      (prismaMock.commentLike.count as jest.Mock).mockResolvedValue(0);
      (prismaMock.userCommenterStats.findMany as jest.Mock).mockResolvedValue([
        {
          commenterId: userId,
          commentCount: 5,
        },
      ]);

      const res = await request(app).get(`/api/posts/${postId}/comments`).expect(200);

      expect(res.body.comments[0].isTopCommenter).toBe(true);
    });

    it('should not mark user as top commenter when they have fewer than 5 comments', async () => {
      const mockPost = {
        id: postId,
        authorId: postAuthorId,
        allowComments: true,
      };

      const mockComments = [
        {
          id: 'comment-1',
          content: 'Comment',
          postId,
          userId,
          parentId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          user: { id: userId, username: 'regularuser' },
        },
      ];

      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue(mockPost);
      (prismaMock.comment.findMany as jest.Mock).mockResolvedValue(mockComments);
      (prismaMock.commentLike.count as jest.Mock).mockResolvedValue(0);
      (prismaMock.userCommenterStats.findMany as jest.Mock).mockResolvedValue([
        {
          commenterId: userId,
          commentCount: 3,
        },
      ]);

      const res = await request(app).get(`/api/posts/${postId}/comments`).expect(200);

      expect(res.body.comments[0].isTopCommenter).toBe(false);
    });

    it('should not mark post author as top commenter on their own post', async () => {
      const mockPost = {
        id: postId,
        authorId: postAuthorId,
        allowComments: true,
      };

      const mockComments = [
        {
          id: 'comment-1',
          content: 'Comment',
          postId,
          userId: postAuthorId, 
          parentId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          user: { id: postAuthorId, username: 'author' },
        },
      ];

      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue(mockPost);
      (prismaMock.comment.findMany as jest.Mock).mockResolvedValue(mockComments);
      (prismaMock.commentLike.count as jest.Mock).mockResolvedValue(0);
      (prismaMock.userCommenterStats.findMany as jest.Mock).mockResolvedValue([]);

      const res = await request(app).get(`/api/posts/${postId}/comments`).expect(200);

      expect(res.body.comments[0].isTopCommenter).toBe(false);
    });

    it('should include isTopCommenter flag in recent comments endpoint', async () => {
      const mockComments = [
        {
          id: 'comment-1',
          content: 'Comment',
          postId,
          userId,
          parentId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          user: { id: userId, username: 'topcommenter' },
          post: {
            id: postId,
            title: 'Test Post',
            slug: 'test-post',
            authorId: postAuthorId,
          },
        },
      ];

      (prismaMock.comment.findMany as jest.Mock).mockResolvedValue(mockComments);
      (prismaMock.commentLike.count as jest.Mock).mockResolvedValue(0);
      (prismaMock.comment.count as jest.Mock).mockResolvedValue(1);
      (prismaMock.userCommenterStats.findMany as jest.Mock).mockResolvedValue([
        {
          commenterId: userId,
          commentCount: 6,
        },
      ]);

      const res = await request(app).get('/api/posts/recent-comments').expect(200);

      expect(res.body.comments[0]).toHaveProperty('isTopCommenter');
      expect(res.body.comments[0].isTopCommenter).toBe(true);
    });

    it('should mark nested replies with top commenter status', async () => {
      const mockPost = {
        id: postId,
        authorId: postAuthorId,
        allowComments: true,
      };

      const topLevelComment = {
        id: 'comment-1',
        content: 'Top level',
        postId,
        userId: 'user-2',
        parentId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: { id: 'user-2', username: 'regularuser' },
      };

      const reply = {
        id: 'comment-2',
        content: 'Reply',
        postId,
        userId, 
        parentId: 'comment-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        user: { id: userId, username: 'topcommenter' },
      };

      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue(mockPost);
      
      (prismaMock.comment.findMany as jest.Mock)
        .mockResolvedValueOnce([topLevelComment]) 
        .mockResolvedValueOnce([reply]) 
        .mockResolvedValueOnce([]); 
      
      (prismaMock.commentLike.count as jest.Mock).mockResolvedValue(0);
      
      (prismaMock.userCommenterStats.findMany as jest.Mock)
        .mockResolvedValueOnce([
          { commenterId: 'user-2', commentCount: 2 },
        ]) 
        .mockResolvedValueOnce([
          { commenterId: userId, commentCount: 7 },
        ]); 

      const res = await request(app).get(`/api/posts/${postId}/comments`).expect(200);

      expect(res.body.comments[0].isTopCommenter).toBe(false);
      expect(res.body.comments[0].replies[0].isTopCommenter).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple commenters correctly', async () => {
      const mockPost = {
        id: postId,
        authorId: postAuthorId,
        allowComments: true,
      };

      const mockComments = [
        {
          id: 'comment-1',
          content: 'Comment 1',
          postId,
          userId: 'user-1',
          parentId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          user: { id: 'user-1', username: 'topcommenter1' },
        },
        {
          id: 'comment-2',
          content: 'Comment 2',
          postId,
          userId: 'user-2',
          parentId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          user: { id: 'user-2', username: 'regularuser' },
        },
        {
          id: 'comment-3',
          content: 'Comment 3',
          postId,
          userId: 'user-3',
          parentId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          user: { id: 'user-3', username: 'topcommenter2' },
        },
      ];

      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue(mockPost);
      (prismaMock.comment.findMany as jest.Mock).mockResolvedValue(mockComments);
      (prismaMock.commentLike.count as jest.Mock).mockResolvedValue(0);
      (prismaMock.userCommenterStats.findMany as jest.Mock).mockResolvedValue([
        { commenterId: 'user-1', commentCount: 5 },
        { commenterId: 'user-2', commentCount: 2 },
        { commenterId: 'user-3', commentCount: 10 },
      ]);

      const res = await request(app).get(`/api/posts/${postId}/comments`).expect(200);

      expect(res.body.comments[0].isTopCommenter).toBe(true); 
      expect(res.body.comments[1].isTopCommenter).toBe(false); 
      expect(res.body.comments[2].isTopCommenter).toBe(true); 
    });

    it('should handle no stats gracefully', async () => {
      const mockPost = {
        id: postId,
        authorId: postAuthorId,
        allowComments: true,
      };

      const mockComments = [
        {
          id: 'comment-1',
          content: 'First ever comment',
          postId,
          userId,
          parentId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          user: { id: userId, username: 'newuser' },
        },
      ];

      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue(mockPost);
      (prismaMock.comment.findMany as jest.Mock).mockResolvedValue(mockComments);
      (prismaMock.commentLike.count as jest.Mock).mockResolvedValue(0);
      (prismaMock.userCommenterStats.findMany as jest.Mock).mockResolvedValue([]);

      const res = await request(app).get(`/api/posts/${postId}/comments`).expect(200);

      expect(res.body.comments[0].isTopCommenter).toBe(false);
    });
  });
});
