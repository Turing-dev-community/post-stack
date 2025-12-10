import request from 'supertest';
import { setupPrismaMock } from './utils/mockPrisma';
import { prisma } from '../lib/prisma';
import app from '../index';
import { generateToken } from '../utils/auth';
import { NotificationType, NotificationWithRelations, ExtendedPrismaClient, Notification } from '../types/notification';

const { prisma: prismaMock } = setupPrismaMock(prisma, app);

// Type helper for jest.Mock
type JestMock<T> = jest.Mock<T>;

// Type helper to get User type with selected fields from prisma instance
type UserWithSelect = {
  id: string;
  email: string;
  username: string;
  deletedAt: Date | null;
} | null;

// Cast to ExtendedPrismaClient to access notification property
const extendedPrismaMock = prismaMock as ExtendedPrismaClient & typeof prismaMock;

describe('Notifications API', () => {
  it('should have mocking properly configured', () => {
    expect(prismaMock.isMocked).toBe(true);
  });

  describe('GET /api/notifications', () => {
    it('should return paginated notifications for authenticated user', async () => {
      const userId = 'user-1';
      const mockNotifications: NotificationWithRelations[] = [
        {
          id: 'notif-1',
          type: NotificationType.COMMENT_REPLY,
          userId,
          actorId: 'user-2',
          postId: 'post-1',
          commentId: 'comment-1',
          message: 'user2 replied to your comment',
          read: false,
          createdAt: new Date(),
          actor: { id: 'user-2', username: 'user2', profilePicture: null },
          post: { id: 'post-1', title: 'Test Post', slug: 'test-post' },
          comment: { id: 'comment-1', content: 'This is a comment' },
        },
        {
          id: 'notif-2',
          type: NotificationType.POST_LIKE,
          userId,
          actorId: 'user-3',
          postId: 'post-2',
          commentId: null,
          message: 'user3 liked your post',
          read: true,
          createdAt: new Date(),
          actor: { id: 'user-3', username: 'user3', profilePicture: null },
          post: { id: 'post-2', title: 'Another Post', slug: 'another-post' },
          comment: null,
        },
      ];

      (prismaMock.user.findUnique as JestMock<Promise<UserWithSelect>>).mockResolvedValue({
        id: userId,
        email: 'test@example.com',
        username: 'testuser',
        deletedAt: null,
      });

      (extendedPrismaMock.notification.findMany as JestMock<Promise<NotificationWithRelations[]>>).mockResolvedValue(mockNotifications);
      (extendedPrismaMock.notification.count as JestMock<Promise<number>>)
        .mockResolvedValueOnce(2) // total count
        .mockResolvedValueOnce(1); // unread count

      const token = generateToken(userId);
      const response = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveProperty('notifications');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body).toHaveProperty('unreadCount');
      expect(response.body.notifications).toHaveLength(2);
      expect(response.body.pagination.total).toBe(2);
      expect(response.body.unreadCount).toBe(1);
    });

    it('should return empty notifications for user with no notifications', async () => {
      const userId = 'user-1';

      (prismaMock.user.findUnique as JestMock<Promise<UserWithSelect>>).mockResolvedValue({
        id: userId,
        email: 'test@example.com',
        username: 'testuser',
        deletedAt: null,
      });

      (extendedPrismaMock.notification.findMany as JestMock<Promise<NotificationWithRelations[]>>).mockResolvedValue([]);
      (extendedPrismaMock.notification.count as JestMock<Promise<number>>)
        .mockResolvedValueOnce(0) // total count
        .mockResolvedValueOnce(0); // unread count

      const token = generateToken(userId);
      const response = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.notifications).toHaveLength(0);
      expect(response.body.pagination.total).toBe(0);
      expect(response.body.unreadCount).toBe(0);
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app)
        .get('/api/notifications')
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Access token required');
    });

    it('should support pagination query parameters', async () => {
      const userId = 'user-1';

      (prismaMock.user.findUnique as JestMock<Promise<UserWithSelect>>).mockResolvedValue({
        id: userId,
        email: 'test@example.com',
        username: 'testuser',
        deletedAt: null,
      });

      (extendedPrismaMock.notification.findMany as JestMock<Promise<NotificationWithRelations[]>>).mockResolvedValue([]);
      (extendedPrismaMock.notification.count as JestMock<Promise<number>>)
        .mockResolvedValueOnce(50) // total count
        .mockResolvedValueOnce(10); // unread count

      const token = generateToken(userId);
      const response = await request(app)
        .get('/api/notifications?page=2&limit=10')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.pagination.page).toBe(2);
      expect(response.body.pagination.limit).toBe(10);
      expect(response.body.pagination.total).toBe(50);
      expect(response.body.pagination.pages).toBe(5);
    });
  });

  describe('GET /api/notifications/unread-count', () => {
    it('should return unread notification count', async () => {
      const userId = 'user-1';

      (prismaMock.user.findUnique as JestMock<Promise<UserWithSelect>>).mockResolvedValue({
        id: userId,
        email: 'test@example.com',
        username: 'testuser',
        deletedAt: null,
      });

      (extendedPrismaMock.notification.count as JestMock<Promise<number>>).mockResolvedValue(5);

      const token = generateToken(userId);
      const response = await request(app)
        .get('/api/notifications/unread-count')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveProperty('unreadCount', 5);
    });

    it('should return 0 when no unread notifications', async () => {
      const userId = 'user-1';

      (prismaMock.user.findUnique as JestMock<Promise<UserWithSelect>>).mockResolvedValue({
        id: userId,
        email: 'test@example.com',
        username: 'testuser',
        deletedAt: null,
      });

      (extendedPrismaMock.notification.count as JestMock<Promise<number>>).mockResolvedValue(0);

      const token = generateToken(userId);
      const response = await request(app)
        .get('/api/notifications/unread-count')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveProperty('unreadCount', 0);
    });
  });

  describe('GET /api/notifications/:id', () => {
    it('should return a single notification', async () => {
      const userId = 'user-1';
      const notificationId = 'notif-1';
      const mockNotification: NotificationWithRelations = {
        id: notificationId,
        type: NotificationType.COMMENT_REPLY,
        userId,
        actorId: 'user-2',
        postId: 'post-1',
        commentId: 'comment-1',
        message: 'user2 replied to your comment',
        read: false,
        createdAt: new Date(),
        actor: { id: 'user-2', username: 'user2', profilePicture: null },
        post: { id: 'post-1', title: 'Test Post', slug: 'test-post' },
        comment: { id: 'comment-1', content: 'This is a comment' },
      };

      (prismaMock.user.findUnique as JestMock<Promise<UserWithSelect>>).mockResolvedValue({
        id: userId,
        email: 'test@example.com',
        username: 'testuser',
        deletedAt: null,
      });

      (extendedPrismaMock.notification.findUnique as JestMock<Promise<NotificationWithRelations | null>>).mockResolvedValue(
        mockNotification
      );

      const token = generateToken(userId);
      const response = await request(app)
        .get(`/api/notifications/${notificationId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveProperty('notification');
      expect(response.body.notification.id).toBe(notificationId);
    });

    it('should return 404 for non-existent notification', async () => {
      const userId = 'user-1';

      (prismaMock.user.findUnique as JestMock<Promise<UserWithSelect>>).mockResolvedValue({
        id: userId,
        email: 'test@example.com',
        username: 'testuser',
        deletedAt: null,
      });

      (extendedPrismaMock.notification.findUnique as JestMock<Promise<NotificationWithRelations | null>>).mockResolvedValue(null);

      const token = generateToken(userId);
      const response = await request(app)
        .get('/api/notifications/non-existent-id')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);

      expect(response.body).toHaveProperty('error', 'NotFoundError');
    });

    it("should return 403 when accessing another user's notification", async () => {
      const userId = 'user-1';
      const anotherUserId = 'user-2';
      const notificationId = 'notif-1';

      (prismaMock.user.findUnique as JestMock<Promise<UserWithSelect>>).mockResolvedValue({
        id: userId,
        email: 'test@example.com',
        username: 'testuser',
        deletedAt: null,
      });

      (extendedPrismaMock.notification.findUnique as JestMock<Promise<NotificationWithRelations | null>>).mockResolvedValue({
        id: notificationId,
        type: NotificationType.COMMENT_REPLY,
        userId: anotherUserId, // Different user
        actorId: 'user-3',
        postId: null,
        commentId: null,
        message: 'test',
        read: false,
        createdAt: new Date(),
        actor: { id: 'user-3', username: 'user3', profilePicture: null },
        post: null,
        comment: null,
      });

      const token = generateToken(userId);
      const response = await request(app)
        .get(`/api/notifications/${notificationId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      expect(response.body).toHaveProperty('error', 'ForbiddenError');
    });
  });

  describe('PATCH /api/notifications/:id/read', () => {
    it('should mark notification as read', async () => {
      const userId = 'user-1';
      const notificationId = 'notif-1';
      const mockNotification: NotificationWithRelations = {
        id: notificationId,
        type: NotificationType.COMMENT_REPLY,
        userId,
        actorId: 'user-2',
        postId: null,
        commentId: null,
        message: 'user2 replied to your comment',
        read: false,
        createdAt: new Date(),
        actor: { id: 'user-2', username: 'user2', profilePicture: null },
        post: null,
        comment: null,
      };

      (prismaMock.user.findUnique as JestMock<Promise<UserWithSelect>>).mockResolvedValue({
        id: userId,
        email: 'test@example.com',
        username: 'testuser',
        deletedAt: null,
      });

      (extendedPrismaMock.notification.findUnique as JestMock<Promise<NotificationWithRelations | null>>).mockResolvedValue(
        mockNotification
      );

      (extendedPrismaMock.notification.update as JestMock<Promise<NotificationWithRelations>>).mockResolvedValue({
        ...mockNotification,
        read: true,
      });

      const token = generateToken(userId);
      const response = await request(app)
        .patch(`/api/notifications/${notificationId}/read`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Notification marked as read');
      expect(response.body).toHaveProperty('notification');
      expect(response.body.notification.read).toBe(true);
    });

    it('should return 404 for non-existent notification', async () => {
      const userId = 'user-1';

      (prismaMock.user.findUnique as JestMock<Promise<UserWithSelect>>).mockResolvedValue({
        id: userId,
        email: 'test@example.com',
        username: 'testuser',
        deletedAt: null,
      });

      (extendedPrismaMock.notification.findUnique as JestMock<Promise<NotificationWithRelations | null>>).mockResolvedValue(null);

      const token = generateToken(userId);
      const response = await request(app)
        .patch('/api/notifications/non-existent-id/read')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);

      expect(response.body).toHaveProperty('error', 'NotFoundError');
    });

    it("should return 403 when marking another user's notification as read", async () => {
      const userId = 'user-1';
      const anotherUserId = 'user-2';
      const notificationId = 'notif-1';

      (prismaMock.user.findUnique as JestMock<Promise<UserWithSelect>>).mockResolvedValue({
        id: userId,
        email: 'test@example.com',
        username: 'testuser',
        deletedAt: null,
      });

      (extendedPrismaMock.notification.findUnique as JestMock<Promise<NotificationWithRelations | null>>).mockResolvedValue({
        id: notificationId,
        type: NotificationType.COMMENT_REPLY,
        userId: anotherUserId,
        actorId: 'user-3',
        postId: null,
        commentId: null,
        message: 'test',
        read: false,
        createdAt: new Date(),
        actor: { id: 'user-3', username: 'user3', profilePicture: null },
        post: null,
        comment: null,
      });

      const token = generateToken(userId);
      const response = await request(app)
        .patch(`/api/notifications/${notificationId}/read`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      expect(response.body).toHaveProperty('error', 'ForbiddenError');
    });
  });

  describe('PATCH /api/notifications/read-all', () => {
    it('should mark all notifications as read', async () => {
      const userId = 'user-1';

      (prismaMock.user.findUnique as JestMock<Promise<UserWithSelect>>).mockResolvedValue({
        id: userId,
        email: 'test@example.com',
        username: 'testuser',
        deletedAt: null,
      });

      (extendedPrismaMock.notification.updateMany as JestMock<Promise<{ count: number }>>).mockResolvedValue({ count: 5 });

      const token = generateToken(userId);
      const response = await request(app)
        .patch('/api/notifications/read-all')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'All notifications marked as read');
      expect(response.body).toHaveProperty('count', 5);
    });

    it('should return count 0 when no unread notifications', async () => {
      const userId = 'user-1';

      (prismaMock.user.findUnique as JestMock<Promise<UserWithSelect>>).mockResolvedValue({
        id: userId,
        email: 'test@example.com',
        username: 'testuser',
        deletedAt: null,
      });

      (extendedPrismaMock.notification.updateMany as JestMock<Promise<{ count: number }>>).mockResolvedValue({ count: 0 });

      const token = generateToken(userId);
      const response = await request(app)
        .patch('/api/notifications/read-all')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveProperty('count', 0);
    });
  });

  describe('DELETE /api/notifications/:id', () => {
    it('should delete a notification', async () => {
      const userId = 'user-1';
      const notificationId = 'notif-1';

      (prismaMock.user.findUnique as JestMock<Promise<UserWithSelect>>).mockResolvedValue({
        id: userId,
        email: 'test@example.com',
        username: 'testuser',
        deletedAt: null,
      });

      (extendedPrismaMock.notification.findUnique as JestMock<Promise<NotificationWithRelations | null>>).mockResolvedValue({
        id: notificationId,
        type: NotificationType.COMMENT_REPLY,
        userId,
        actorId: 'user-2',
        postId: null,
        commentId: null,
        message: 'test',
        read: false,
        createdAt: new Date(),
        actor: { id: 'user-2', username: 'user2', profilePicture: null },
        post: null,
        comment: null,
      });

      (extendedPrismaMock.notification.delete as JestMock<Promise<Notification>>).mockResolvedValue({
        id: notificationId,
        type: NotificationType.COMMENT_REPLY,
        userId,
        actorId: 'user-2',
        postId: null,
        commentId: null,
        message: 'test',
        read: false,
        createdAt: new Date(),
      });

      const token = generateToken(userId);
      const response = await request(app)
        .delete(`/api/notifications/${notificationId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Notification deleted successfully');
    });

    it('should return 404 for non-existent notification', async () => {
      const userId = 'user-1';

      (prismaMock.user.findUnique as JestMock<Promise<UserWithSelect>>).mockResolvedValue({
        id: userId,
        email: 'test@example.com',
        username: 'testuser',
        deletedAt: null,
      });

      (extendedPrismaMock.notification.findUnique as JestMock<Promise<NotificationWithRelations | null>>).mockResolvedValue(null);

      const token = generateToken(userId);
      const response = await request(app)
        .delete('/api/notifications/non-existent-id')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);

      expect(response.body).toHaveProperty('error', 'NotFoundError');
    });

    it("should return 403 when deleting another user's notification", async () => {
      const userId = 'user-1';
      const anotherUserId = 'user-2';
      const notificationId = 'notif-1';

      (prismaMock.user.findUnique as JestMock<Promise<UserWithSelect>>).mockResolvedValue({
        id: userId,
        email: 'test@example.com',
        username: 'testuser',
        deletedAt: null,
      });

      (extendedPrismaMock.notification.findUnique as JestMock<Promise<NotificationWithRelations | null>>).mockResolvedValue({
        id: notificationId,
        type: NotificationType.COMMENT_REPLY,
        userId: anotherUserId,
        actorId: 'user-3',
        postId: null,
        commentId: null,
        message: 'test',
        read: false,
        createdAt: new Date(),
        actor: { id: 'user-3', username: 'user3', profilePicture: null },
        post: null,
        comment: null,
      });

      const token = generateToken(userId);
      const response = await request(app)
        .delete(`/api/notifications/${notificationId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      expect(response.body).toHaveProperty('error', 'ForbiddenError');
    });
  });

  describe('DELETE /api/notifications/clear', () => {
    it('should clear all read notifications', async () => {
      const userId = 'user-1';

      (prismaMock.user.findUnique as JestMock<Promise<UserWithSelect>>).mockResolvedValue({
        id: userId,
        email: 'test@example.com',
        username: 'testuser',
        deletedAt: null,
      });

      (extendedPrismaMock.notification.deleteMany as JestMock<Promise<{ count: number }>>).mockResolvedValue({ count: 10 });

      const token = generateToken(userId);
      const response = await request(app)
        .delete('/api/notifications/clear')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Read notifications cleared');
      expect(response.body).toHaveProperty('count', 10);
    });

    it('should return count 0 when no read notifications to clear', async () => {
      const userId = 'user-1';

      (prismaMock.user.findUnique as JestMock<Promise<UserWithSelect>>).mockResolvedValue({
        id: userId,
        email: 'test@example.com',
        username: 'testuser',
        deletedAt: null,
      });

      (extendedPrismaMock.notification.deleteMany as JestMock<Promise<{ count: number }>>).mockResolvedValue({ count: 0 });

      const token = generateToken(userId);
      const response = await request(app)
        .delete('/api/notifications/clear')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveProperty('count', 0);
    });
  });

  describe('Authentication required for all endpoints', () => {
    it('should return 401 for GET /api/notifications without auth', async () => {
      const response = await request(app).get('/api/notifications').expect(401);
      expect(response.body).toHaveProperty('error', 'Access token required');
    });

    it('should return 401 for GET /api/notifications/unread-count without auth', async () => {
      const response = await request(app).get('/api/notifications/unread-count').expect(401);
      expect(response.body).toHaveProperty('error', 'Access token required');
    });

    it('should return 401 for GET /api/notifications/:id without auth', async () => {
      const response = await request(app).get('/api/notifications/some-id').expect(401);
      expect(response.body).toHaveProperty('error', 'Access token required');
    });

    it('should return 401 for PATCH /api/notifications/:id/read without auth', async () => {
      const response = await request(app).patch('/api/notifications/some-id/read').expect(401);
      expect(response.body).toHaveProperty('error', 'Access token required');
    });

    it('should return 401 for PATCH /api/notifications/read-all without auth', async () => {
      const response = await request(app).patch('/api/notifications/read-all').expect(401);
      expect(response.body).toHaveProperty('error', 'Access token required');
    });

    it('should return 401 for DELETE /api/notifications/:id without auth', async () => {
      const response = await request(app).delete('/api/notifications/some-id').expect(401);
      expect(response.body).toHaveProperty('error', 'Access token required');
    });

    it('should return 401 for DELETE /api/notifications/clear without auth', async () => {
      const response = await request(app).delete('/api/notifications/clear').expect(401);
      expect(response.body).toHaveProperty('error', 'Access token required');
    });
  });

  describe('Edge Cases and Input Validation', () => {
    describe('Notification ID Validation', () => {
      it('should return 400 for whitespace-only notification ID', async () => {
        const userId = 'user-1';
        const token = generateToken(userId);

        // Whitespace-only ID should be trimmed and fail validation
        // Use URL-encoded whitespace to ensure proper route matching
        const response = await request(app)
          .get('/api/notifications/%20%20%20') // URL-encoded whitespace
          .set('Authorization', `Bearer ${token}`)
          .expect(400);
        
        expect(response.body).toHaveProperty('error', 'ValidationError');
      });

      it('should return 400 for notification ID that is too long', async () => {
        const userId = 'user-1';
        const token = generateToken(userId);
        const longId = 'a'.repeat(256); // Exceeds 255 character limit

        (prismaMock.user.findUnique as JestMock<Promise<UserWithSelect>>).mockResolvedValue({
          id: userId,
          email: 'test@example.com',
          username: 'testuser',
          deletedAt: null,
        });

        const response = await request(app)
          .get(`/api/notifications/${longId}`)
          .set('Authorization', `Bearer ${token}`)
          .expect(400);

        expect(response.body).toHaveProperty('error', 'ValidationError');
      });

      it('should return 400 for empty notification ID in PATCH request', async () => {
        const userId = 'user-1';
        const token = generateToken(userId);

        (prismaMock.user.findUnique as JestMock<Promise<UserWithSelect>>).mockResolvedValue({
          id: userId,
          email: 'test@example.com',
          username: 'testuser',
          deletedAt: null,
        });

        // Use URL-encoded whitespace to ensure proper route matching
        const response = await request(app)
          .patch('/api/notifications/%20%20%20/read') // URL-encoded whitespace
          .set('Authorization', `Bearer ${token}`)
          .expect(400);

        expect(response.body).toHaveProperty('error', 'ValidationError');
      });

      it('should return 400 for empty notification ID in DELETE request', async () => {
        const userId = 'user-1';
        const token = generateToken(userId);

        (prismaMock.user.findUnique as JestMock<Promise<UserWithSelect>>).mockResolvedValue({
          id: userId,
          email: 'test@example.com',
          username: 'testuser',
          deletedAt: null,
        });

        // Use URL-encoded whitespace to ensure route matching
        const response = await request(app)
          .delete('/api/notifications/%20%20%20') // URL-encoded whitespace
          .set('Authorization', `Bearer ${token}`)
          .expect(400);

        expect(response.body).toHaveProperty('error', 'ValidationError');
      });
    });

    describe('Pagination Edge Cases', () => {
      it('should return 400 for negative page number', async () => {
        const userId = 'user-1';
        const token = generateToken(userId);

        (prismaMock.user.findUnique as JestMock<Promise<UserWithSelect>>).mockResolvedValue({
          id: userId,
          email: 'test@example.com',
          username: 'testuser',
          deletedAt: null,
        });

        const response = await request(app)
          .get('/api/notifications?page=-1')
          .set('Authorization', `Bearer ${token}`)
          .expect(400);

        expect(response.body).toHaveProperty('error', 'ValidationError');
      });

      it('should return 400 for zero page number', async () => {
        const userId = 'user-1';
        const token = generateToken(userId);

        (prismaMock.user.findUnique as JestMock<Promise<UserWithSelect>>).mockResolvedValue({
          id: userId,
          email: 'test@example.com',
          username: 'testuser',
          deletedAt: null,
        });

        const response = await request(app)
          .get('/api/notifications?page=0')
          .set('Authorization', `Bearer ${token}`)
          .expect(400);

        expect(response.body).toHaveProperty('error', 'ValidationError');
      });

      it('should return 400 for negative limit', async () => {
        const userId = 'user-1';
        const token = generateToken(userId);

        (prismaMock.user.findUnique as JestMock<Promise<UserWithSelect>>).mockResolvedValue({
          id: userId,
          email: 'test@example.com',
          username: 'testuser',
          deletedAt: null,
        });

        const response = await request(app)
          .get('/api/notifications?limit=-5')
          .set('Authorization', `Bearer ${token}`)
          .expect(400);

        expect(response.body).toHaveProperty('error', 'ValidationError');
      });

      it('should return 400 for limit exceeding maximum (100)', async () => {
        const userId = 'user-1';
        const token = generateToken(userId);

        (prismaMock.user.findUnique as JestMock<Promise<UserWithSelect>>).mockResolvedValue({
          id: userId,
          email: 'test@example.com',
          username: 'testuser',
          deletedAt: null,
        });

        const response = await request(app)
          .get('/api/notifications?limit=101')
          .set('Authorization', `Bearer ${token}`)
          .expect(400);

        expect(response.body).toHaveProperty('error', 'ValidationError');
      });

      it('should return 400 for non-numeric page', async () => {
        const userId = 'user-1';
        const token = generateToken(userId);

        (prismaMock.user.findUnique as JestMock<Promise<UserWithSelect>>).mockResolvedValue({
          id: userId,
          email: 'test@example.com',
          username: 'testuser',
          deletedAt: null,
        });

        const response = await request(app)
          .get('/api/notifications?page=abc')
          .set('Authorization', `Bearer ${token}`)
          .expect(400);

        expect(response.body).toHaveProperty('error', 'ValidationError');
      });

      it('should return 400 for non-numeric limit', async () => {
        const userId = 'user-1';
        const token = generateToken(userId);

        (prismaMock.user.findUnique as JestMock<Promise<UserWithSelect>>).mockResolvedValue({
          id: userId,
          email: 'test@example.com',
          username: 'testuser',
          deletedAt: null,
        });

        const response = await request(app)
          .get('/api/notifications?limit=xyz')
          .set('Authorization', `Bearer ${token}`)
          .expect(400);

        expect(response.body).toHaveProperty('error', 'ValidationError');
      });

      it('should handle very large page numbers gracefully', async () => {
        const userId = 'user-1';
        const token = generateToken(userId);

        (prismaMock.user.findUnique as JestMock<Promise<UserWithSelect>>).mockResolvedValue({
          id: userId,
          email: 'test@example.com',
          username: 'testuser',
          deletedAt: null,
        });

        (extendedPrismaMock.notification.findMany as JestMock<Promise<NotificationWithRelations[]>>).mockResolvedValue([]);
        (extendedPrismaMock.notification.count as JestMock<Promise<number>>)
          .mockResolvedValueOnce(0)
          .mockResolvedValueOnce(0);

        // Very large page number should still work (returns empty results)
        const response = await request(app)
          .get('/api/notifications?page=999999')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body.notifications).toHaveLength(0);
        expect(response.body.pagination.page).toBe(999999);
      });
    });

    describe('Boundary Conditions', () => {
      it('should handle maximum limit value (100)', async () => {
        const userId = 'user-1';
        const token = generateToken(userId);

        (prismaMock.user.findUnique as JestMock<Promise<UserWithSelect>>).mockResolvedValue({
          id: userId,
          email: 'test@example.com',
          username: 'testuser',
          deletedAt: null,
        });

        (extendedPrismaMock.notification.findMany as JestMock<Promise<NotificationWithRelations[]>>).mockResolvedValue([]);
        (extendedPrismaMock.notification.count as JestMock<Promise<number>>)
          .mockResolvedValueOnce(0)
          .mockResolvedValueOnce(0);

        const response = await request(app)
          .get('/api/notifications?limit=100')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body.pagination.limit).toBe(100);
      });

      it('should handle minimum limit value (1)', async () => {
        const userId = 'user-1';
        const token = generateToken(userId);

        (prismaMock.user.findUnique as JestMock<Promise<UserWithSelect>>).mockResolvedValue({
          id: userId,
          email: 'test@example.com',
          username: 'testuser',
          deletedAt: null,
        });

        (extendedPrismaMock.notification.findMany as JestMock<Promise<NotificationWithRelations[]>>).mockResolvedValue([]);
        (extendedPrismaMock.notification.count as JestMock<Promise<number>>)
          .mockResolvedValueOnce(0)
          .mockResolvedValueOnce(0);

        const response = await request(app)
          .get('/api/notifications?limit=1')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body.pagination.limit).toBe(1);
      });

      it('should handle minimum page value (1)', async () => {
        const userId = 'user-1';
        const token = generateToken(userId);

        (prismaMock.user.findUnique as JestMock<Promise<UserWithSelect>>).mockResolvedValue({
          id: userId,
          email: 'test@example.com',
          username: 'testuser',
          deletedAt: null,
        });

        (extendedPrismaMock.notification.findMany as JestMock<Promise<NotificationWithRelations[]>>).mockResolvedValue([]);
        (extendedPrismaMock.notification.count as JestMock<Promise<number>>)
          .mockResolvedValueOnce(0)
          .mockResolvedValueOnce(0);

        const response = await request(app)
          .get('/api/notifications?page=1')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body.pagination.page).toBe(1);
      });
    });
  });
});
