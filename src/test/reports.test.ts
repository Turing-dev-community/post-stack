import request from 'supertest';
import { setupPrismaMock } from './utils/mockPrisma';
import { prisma } from '../lib/prisma';
import app from '../index';
import { generateToken } from '../utils/auth';

const { prisma: prismaMock } = setupPrismaMock(prisma, app);

describe('Post Reports API', () => {
  const userId = 'user-1';
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

  describe('POST /api/posts/:postId/report', () => {
    it('creates a post report', async () => {
      const postId = 'post-1';
      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue({ id: postId, title: 'T', slug: 't' });
      (prismaMock.postReport.findUnique as jest.Mock).mockResolvedValue(null); // no duplicate
      (prismaMock.postReport.create as jest.Mock).mockResolvedValue({
        id: 'report-1',
        postId,
        reporterId: userId,
        reason: 'Inappropriate content detected',
        status: 'PENDING',
        createdAt: new Date(),
        post: { id: postId, title: 'T', slug: 't' },
        reporter: { id: userId, username: 'testuser' },
      });

      const res = await request(app)
        .post(`/api/posts/${postId}/report`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ reason: 'Inappropriate content detected' })
        .expect(201);

      expect(res.body).toHaveProperty('report');
      expect(res.body.report).toMatchObject({ reason: 'Inappropriate content detected', status: 'PENDING' });
      expect(prismaMock.postReport.create).toHaveBeenCalled();
    });

    it('prevents duplicate report by same user', async () => {
      const postId = 'post-dup';
      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue({ id: postId, title: 'Dup', slug: 'dup' });
      (prismaMock.postReport.findUnique as jest.Mock).mockResolvedValue({ id: 'existing', postId, reporterId: userId });

      const res = await request(app)
        .post(`/api/posts/${postId}/report`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ reason: 'Spam content' })
        .expect(409);

      expect(res.body).toHaveProperty('error', 'You have already reported this post');
    });

    it('returns 404 when post does not exist', async () => {
      const postId = 'missing-post';
      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue(null);

      const res = await request(app)
        .post(`/api/posts/${postId}/report`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ reason: 'Issue' })
        .expect(404);

      expect(res.body).toHaveProperty('error', 'Post not found');
    });
  });

  describe('GET /api/reports', () => {
    it('lists reports with x-admin header', async () => {
      (prismaMock.postReport.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'report-1',
          postId: 'post-1',
          reporterId: userId,
          reason: 'Offensive',
          status: 'PENDING',
          createdAt: new Date(),
          post: { id: 'post-1', title: 'Post', slug: 'post' },
          reporter: { id: userId, username: 'testuser' },
        },
      ]);
      (prismaMock.postReport.count as jest.Mock).mockResolvedValue(1);

      const res = await request(app)
        .get('/api/reports')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-admin', 'true')
        .expect(200);

      expect(res.body).toHaveProperty('reports');
      expect(Array.isArray(res.body.reports)).toBe(true);
      expect(res.body.total).toBe(1);
    });

    it('returns 403 without admin header', async () => {
      const res = await request(app)
        .get('/api/reports')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);
      expect(res.body).toHaveProperty('error', 'Admin access required (temporary header x-admin)');
    });
  });

  describe('PATCH /api/reports/:id', () => {
    it('updates report status', async () => {
      const reportId = 'report-upd';
      (prismaMock.postReport.findUnique as jest.Mock).mockResolvedValue({ id: reportId });
      (prismaMock.postReport.update as jest.Mock).mockResolvedValue({
        id: reportId,
        status: 'REVIEWED',
        postId: 'post-1',
        reporterId: userId,
        reason: 'Reason',
        createdAt: new Date(),
        post: { id: 'post-1', title: 'Post', slug: 'post' },
        reporter: { id: userId, username: 'testuser' },
      });

      const res = await request(app)
        .patch(`/api/reports/${reportId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-admin', 'true')
        .send({ status: 'REVIEWED' })
        .expect(200);

      expect(res.body.report).toHaveProperty('status', 'REVIEWED');
      expect(prismaMock.postReport.update).toHaveBeenCalled();
    });

    it('returns 400 for invalid status', async () => {
      const res = await request(app)
        .patch('/api/reports/report-bad')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-admin', 'true')
        .send({ status: 'INVALID' })
        .expect(400);
      expect(res.body).toHaveProperty('error', 'Invalid status');
    });

    it('returns 404 when report missing', async () => {
      (prismaMock.postReport.findUnique as jest.Mock).mockResolvedValue(null);
      const res = await request(app)
        .patch('/api/reports/report-miss')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-admin', 'true')
        .send({ status: 'REJECTED' })
        .expect(404);
      expect(res.body).toHaveProperty('error', 'Report not found');
    });
  });
});