import request from 'supertest';
import { setupPrismaMock } from './utils/mockPrisma';
import { prisma } from '../lib/prisma';
import app from '../index';
import { generateToken } from '../utils/auth';

const { prisma: prismaMock } = setupPrismaMock(prisma, app);

describe('Post Scheduling API', () => {
  const userId = 'user-1';
  const postId = 'post-1';
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

  const createMockPost = (overrides: any = {}) => ({
    id: postId,
    title: 'Test Post',
    content: '# Test Content',
    slug: 'test-post',
    published: false,
    featured: false,
    allowComments: true,
    scheduledAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    authorId: userId,
    categoryId: null,
    metaDescription: null,
    metaTitle: null,
    ogImage: null,
    viewCount: 0,
    author: {
      id: userId,
      username: 'testuser',
    },
    category: null,
    tags: [],
    ...overrides,
  });

  describe('POST /api/posts/:id/schedule - Schedule a post', () => {
    it('should schedule a post for future publication', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1); // 1 day in the future

      const mockPost = createMockPost({
        authorId: userId,
        scheduledAt: null,
      });

      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue(mockPost);
      (prismaMock.post.update as jest.Mock).mockResolvedValue({
        ...mockPost,
        scheduledAt: futureDate,
        published: false,
      });

      const res = await request(app)
        .post(`/api/posts/${postId}/schedule`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ scheduledAt: futureDate.toISOString() })
        .expect(200);

      expect(res.body).toHaveProperty('message', 'Post scheduled successfully');
      expect(res.body.post).toHaveProperty('scheduledAt');
      expect(res.body.post.published).toBe(false);
      expect(prismaMock.post.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: postId },
          data: expect.objectContaining({
            scheduledAt: expect.any(Date),
            published: false,
          }),
        })
      );
    });

    it('should return 401 when not authenticated', async () => {
      const res = await request(app)
        .post(`/api/posts/${postId}/schedule`)
        .send({ scheduledAt: new Date().toISOString() })
        .expect(401);

      expect(res.body).toHaveProperty('error', 'Access token required');
    });

    it('should return 404 when post does not exist', async () => {
      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue(null);

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);

      const res = await request(app)
        .post(`/api/posts/${postId}/schedule`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ scheduledAt: futureDate.toISOString() })
        .expect(404);

      expect(res.body).toHaveProperty('error', 'Post not found');
    });

    it('should return 403 when user does not own the post', async () => {
      const mockPost = createMockPost({
        authorId: 'other-user-id',
      });

      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue(mockPost);

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);

      const res = await request(app)
        .post(`/api/posts/${postId}/schedule`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ scheduledAt: futureDate.toISOString() })
        .expect(403);

      expect(res.body).toHaveProperty('error', 'Not authorized to schedule this post');
    });

    it('should return 400 when scheduledAt is missing', async () => {
      const mockPost = createMockPost({
        authorId: userId,
      });

      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue(mockPost);

      const res = await request(app)
        .post(`/api/posts/${postId}/schedule`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(res.body).toHaveProperty('error', 'scheduledAt is required');
    });

    it('should return 400 when scheduledAt is in the past', async () => {
      const mockPost = createMockPost({
        authorId: userId,
      });

      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue(mockPost);

      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const res = await request(app)
        .post(`/api/posts/${postId}/schedule`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ scheduledAt: pastDate.toISOString() })
        .expect(400);

      expect(res.body).toHaveProperty('error', 'scheduledAt must be in the future');
    });

    it('should set published to false when scheduling', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);

      const mockPost = createMockPost({
        authorId: userId,
        published: true, // Currently published
      });

      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue(mockPost);
      (prismaMock.post.update as jest.Mock).mockResolvedValue({
        ...mockPost,
        scheduledAt: futureDate,
        published: false,
      });

      await request(app)
        .post(`/api/posts/${postId}/schedule`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ scheduledAt: futureDate.toISOString() })
        .expect(200);

      expect(prismaMock.post.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            published: false,
          }),
        })
      );
    });
  });

  describe('DELETE /api/posts/:id/schedule - Unschedule a post', () => {
    it('should unschedule a post', async () => {
      const scheduledDate = new Date();
      scheduledDate.setDate(scheduledDate.getDate() + 1);

      const mockPost = createMockPost({
        authorId: userId,
        scheduledAt: scheduledDate,
        published: false,
      });

      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue(mockPost);
      (prismaMock.post.update as jest.Mock).mockResolvedValue({
        ...mockPost,
        scheduledAt: null,
        published: false,
      });

      const res = await request(app)
        .delete(`/api/posts/${postId}/schedule`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('message', 'Post unscheduled successfully');
      expect(res.body.post.scheduledAt).toBeNull();
      expect(prismaMock.post.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: postId },
          data: expect.objectContaining({
            scheduledAt: null,
          }),
        })
      );
    });

    it('should return 401 when not authenticated', async () => {
      const res = await request(app)
        .delete(`/api/posts/${postId}/schedule`)
        .expect(401);

      expect(res.body).toHaveProperty('error', 'Access token required');
    });

    it('should return 404 when post does not exist', async () => {
      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue(null);

      const res = await request(app)
        .delete(`/api/posts/${postId}/schedule`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(res.body).toHaveProperty('error', 'Post not found');
    });

    it('should return 403 when user does not own the post', async () => {
      const mockPost = createMockPost({
        authorId: 'other-user-id',
        scheduledAt: new Date(),
      });

      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue(mockPost);

      const res = await request(app)
        .delete(`/api/posts/${postId}/schedule`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      expect(res.body).toHaveProperty('error', 'Not authorized to unschedule this post');
    });

    it('should return 400 when post is not scheduled', async () => {
      const mockPost = createMockPost({
        authorId: userId,
        scheduledAt: null,
      });

      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue(mockPost);

      const res = await request(app)
        .delete(`/api/posts/${postId}/schedule`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(res.body).toHaveProperty('error', 'Post is not scheduled');
    });

    it('should publish post immediately when publishNow is true', async () => {
      const scheduledDate = new Date();
      scheduledDate.setDate(scheduledDate.getDate() + 1);

      const mockPost = createMockPost({
        authorId: userId,
        scheduledAt: scheduledDate,
        published: false,
      });

      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue(mockPost);
      (prismaMock.post.update as jest.Mock).mockResolvedValue({
        ...mockPost,
        scheduledAt: null,
        published: true,
      });

      const res = await request(app)
        .delete(`/api/posts/${postId}/schedule`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ publishNow: true })
        .expect(200);

      expect(res.body.post.published).toBe(true);
      expect(res.body.post.scheduledAt).toBeNull();
      expect(prismaMock.post.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            published: true,
            scheduledAt: null,
          }),
        })
      );
    });

    it('should keep current published state when publishNow is false', async () => {
      const scheduledDate = new Date();
      scheduledDate.setDate(scheduledDate.getDate() + 1);

      const mockPost = createMockPost({
        authorId: userId,
        scheduledAt: scheduledDate,
        published: false,
      });

      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue(mockPost);
      (prismaMock.post.update as jest.Mock).mockResolvedValue({
        ...mockPost,
        scheduledAt: null,
        published: false,
      });

      const res = await request(app)
        .delete(`/api/posts/${postId}/schedule`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ publishNow: false })
        .expect(200);

      expect(res.body.post.published).toBe(false);
    });
  });

  describe('POST /api/posts - Create post with scheduledAt', () => {
    it('should create a post with scheduledAt', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);

      const mockPost = createMockPost({
        scheduledAt: futureDate,
        published: false,
      });

      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue(null); // No existing post
      (prismaMock.post.create as jest.Mock).mockResolvedValue(mockPost);

      const res = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test Post',
          content: '# Test Content',
          scheduledAt: futureDate.toISOString(),
        })
        .expect(201);

      expect(res.body.post).toHaveProperty('scheduledAt');
      expect(res.body.post.published).toBe(false);
      expect(prismaMock.post.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            scheduledAt: expect.any(Date),
            published: false,
          }),
        })
      );
    });

    it('should auto-publish if scheduledAt is in the past', async () => {
      const pastDate = new Date();
      pastDate.setMinutes(pastDate.getMinutes() - 1);

      const mockPost = createMockPost({
        scheduledAt: null,
        published: true,
      });

      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaMock.post.create as jest.Mock).mockResolvedValue(mockPost);

      const res = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test Post',
          content: '# Test Content',
          scheduledAt: pastDate.toISOString(),
        })
        .expect(201);

      expect(res.body.post.published).toBe(true);
      expect(res.body.post.scheduledAt).toBeNull();
    });
  });

  describe('PUT /api/posts/:id - Update post with scheduledAt', () => {
    it('should update a post with scheduledAt', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);

      const existingPost = createMockPost({
        authorId: userId,
        scheduledAt: null,
      });

      const updatedPost = createMockPost({
        authorId: userId,
        scheduledAt: futureDate,
        published: false,
      });

      (prismaMock.post.findUnique as jest.Mock).mockResolvedValueOnce(existingPost);
      
      const mockTxPostUpdate = jest.fn().mockResolvedValue(updatedPost);
      const mockTxPostTagDeleteMany = jest.fn().mockResolvedValue({ count: 0 });
      
      (prismaMock.$transaction as jest.Mock).mockImplementation(async (callback: any) => {
        const tx = {
          postTag: {
            deleteMany: mockTxPostTagDeleteMany,
          },
          post: {
            update: mockTxPostUpdate,
          },
        };
        return callback(tx);
      });

      const res = await request(app)
        .put(`/api/posts/${postId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Updated Post',
          content: '# Updated Content',
          scheduledAt: futureDate.toISOString(),
        })
        .expect(200);

      expect(res.body.post).toHaveProperty('scheduledAt');
      expect(res.body.post.published).toBe(false);
    });

    it('should clear scheduledAt when set to null', async () => {
      const scheduledDate = new Date();
      scheduledDate.setDate(scheduledDate.getDate() + 1);

      const existingPost = createMockPost({
        authorId: userId,
        scheduledAt: scheduledDate,
      });

      const updatedPost = createMockPost({
        authorId: userId,
        scheduledAt: null,
      });

      (prismaMock.post.findUnique as jest.Mock).mockResolvedValueOnce(existingPost);
      
      const mockTxPostUpdate = jest.fn().mockResolvedValue(updatedPost);
      const mockTxPostTagDeleteMany = jest.fn().mockResolvedValue({ count: 0 });
      
      (prismaMock.$transaction as jest.Mock).mockImplementation(async (callback: any) => {
        const tx = {
          postTag: {
            deleteMany: mockTxPostTagDeleteMany,
          },
          post: {
            update: mockTxPostUpdate,
          },
        };
        return callback(tx);
      });

      const res = await request(app)
        .put(`/api/posts/${postId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Updated Post',
          content: '# Updated Content',
          scheduledAt: null,
        })
        .expect(200);

      expect(res.body.post.scheduledAt).toBeNull();
    });
  });

});

