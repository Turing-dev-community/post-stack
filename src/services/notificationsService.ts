import { prisma } from '../lib/prisma';
import { NotFoundError, ForbiddenError } from '../utils/errors';
import {
  NotificationType,
  CreateNotificationData,
  PaginationParams,
  PaginatedNotificationsResult,
  NotificationWithRelations,
  NotificationDelegate,
  NotificationInclude,
  ExtendedPrismaClient,
} from '../types/notification';

/**
 * Type-safe helper to access notification delegate from prisma
 * This provides type safety while allowing the notification model
 * to be used without modifying the actual Prisma schema
 */
const getNotificationDelegate = (): NotificationDelegate => {
  const extendedPrisma = prisma as ExtendedPrismaClient;
  return extendedPrisma.notification;
};

/**
 * Include options for notification queries
 */
const notificationInclude: NotificationInclude = {
  actor: {
    select: { id: true, username: true, profilePicture: true },
  },
  post: {
    select: { id: true, title: true, slug: true },
  },
  comment: {
    select: { id: true, content: true },
  },
};

/**
 * Get paginated notifications for a user
 */
export async function getUserNotifications(
  userId: string,
  pagination: PaginationParams
): Promise<PaginatedNotificationsResult> {
  const { page, limit } = pagination;
  const skip = (page - 1) * limit;
  const notificationDelegate = getNotificationDelegate();

  const [notifications, total, unreadCount] = await Promise.all([
    notificationDelegate.findMany({
      where: { userId },
      include: notificationInclude,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    notificationDelegate.count({ where: { userId } }),
    notificationDelegate.count({ where: { userId, read: false } }),
  ]);

  return {
    notifications,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
    unreadCount,
  };
}

/**
 * Get unread notification count for a user
 */
export async function getUnreadCount(userId: string): Promise<number> {
  const notificationDelegate = getNotificationDelegate();
  return notificationDelegate.count({
    where: { userId, read: false },
  });
}

/**
 * Create a new notification
 * Returns null if actor is the same as user (don't notify yourself)
 */
export async function createNotification(
  data: CreateNotificationData
): Promise<NotificationWithRelations | null> {
  // Don't notify yourself
  if (data.userId === data.actorId) {
    return null;
  }

  // Check if recipient user exists and is not deleted
  const user = await prisma.user.findUnique({
    where: { id: data.userId },
    select: { id: true, deletedAt: true },
  });

  if (!user || user.deletedAt) {
    return null;
  }

  const notificationDelegate = getNotificationDelegate();
  return notificationDelegate.create({
    data: {
      type: data.type,
      userId: data.userId,
      actorId: data.actorId,
      postId: data.postId,
      commentId: data.commentId,
      message: data.message,
    },
    include: notificationInclude,
  });
}

/**
 * Mark a single notification as read
 */
export async function markNotificationAsRead(
  notificationId: string,
  userId: string
): Promise<NotificationWithRelations> {
  const notificationDelegate = getNotificationDelegate();
  
  const notification = await notificationDelegate.findUnique({
    where: { id: notificationId },
  });

  if (!notification) {
    throw new NotFoundError('Notification not found');
  }

  if (notification.userId !== userId) {
    throw new ForbiddenError("Cannot modify another user's notification");
  }

  return notificationDelegate.update({
    where: { id: notificationId },
    data: { read: true },
    include: notificationInclude,
  });
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllAsRead(userId: string): Promise<number> {
  const notificationDelegate = getNotificationDelegate();
  
  const result = await notificationDelegate.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });

  return result.count;
}

/**
 * Delete a single notification
 */
export async function deleteNotification(
  notificationId: string,
  userId: string
): Promise<void> {
  const notificationDelegate = getNotificationDelegate();
  
  const notification = await notificationDelegate.findUnique({
    where: { id: notificationId },
  });

  if (!notification) {
    throw new NotFoundError('Notification not found');
  }

  if (notification.userId !== userId) {
    throw new ForbiddenError("Cannot delete another user's notification");
  }

  await notificationDelegate.delete({
    where: { id: notificationId },
  });
}

/**
 * Clear all read notifications for a user
 */
export async function clearReadNotifications(userId: string): Promise<number> {
  const notificationDelegate = getNotificationDelegate();
  
  const result = await notificationDelegate.deleteMany({
    where: { userId, read: true },
  });

  return result.count;
}

/**
 * Get a single notification by ID
 */
export async function getNotificationById(
  notificationId: string,
  userId: string
): Promise<NotificationWithRelations> {
  const notificationDelegate = getNotificationDelegate();
  
  const notification = await notificationDelegate.findUnique({
    where: { id: notificationId },
    include: notificationInclude,
  });

  if (!notification) {
    throw new NotFoundError('Notification not found');
  }

  if (notification.userId !== userId) {
    throw new ForbiddenError("Cannot access another user's notification");
  }

  return notification;
}

// Re-export types for convenience
export { NotificationType, CreateNotificationData, PaginationParams };
