/**
 * Notification types - mirrors what would be in Prisma schema
 * Used for mocking without modifying the actual database schema
 */

import { PrismaClient } from '@prisma/client';

export enum NotificationType {
  COMMENT_REPLY = 'COMMENT_REPLY',
  POST_COMMENT = 'POST_COMMENT',
  POST_LIKE = 'POST_LIKE',
  COMMENT_LIKE = 'COMMENT_LIKE',
  NEW_FOLLOWER = 'NEW_FOLLOWER',
  POST_MENTION = 'POST_MENTION',
  THREAD_SUBSCRIPTION = 'THREAD_SUBSCRIPTION',
}

/**
 * Notification model interface
 */
export interface Notification {
  id: string;
  type: NotificationType;
  userId: string;
  actorId: string;
  postId: string | null;
  commentId: string | null;
  message: string;
  read: boolean;
  createdAt: Date;
}

/**
 * Notification with related entities
 */
export interface NotificationWithRelations extends Notification {
  actor: {
    id: string;
    username: string;
    profilePicture: string | null;
  };
  post: {
    id: string;
    title: string;
    slug: string;
  } | null;
  comment: {
    id: string;
    content: string;
  } | null;
}

/**
 * Create notification input data
 */
export interface CreateNotificationData {
  type: NotificationType;
  userId: string;
  actorId: string;
  postId?: string;
  commentId?: string;
  message: string;
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page: number;
  limit: number;
}

/**
 * Paginated notifications result
 */
export interface PaginatedNotificationsResult {
  notifications: NotificationWithRelations[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  unreadCount: number;
}

/**
 * Notification include options for queries
 */
export interface NotificationInclude {
  actor: {
    select: { id: true; username: true; profilePicture: true };
  };
  post: {
    select: { id: true; title: true; slug: true };
  };
  comment: {
    select: { id: true; content: true };
  };
}

/**
 * Notification where clause for queries
 */
export interface NotificationWhereInput {
  id?: string;
  userId?: string;
  read?: boolean;
}

/**
 * Notification create input
 */
export interface NotificationCreateInput {
  type: NotificationType;
  userId: string;
  actorId: string;
  postId?: string;
  commentId?: string;
  message: string;
}

/**
 * Notification update input
 */
export interface NotificationUpdateInput {
  read?: boolean;
}

/**
 * Batch operation result
 */
export interface BatchPayload {
  count: number;
}

/**
 * Notification delegate interface - mirrors Prisma's delegate pattern
 */
export interface NotificationDelegate {
  findMany(args: {
    where?: NotificationWhereInput;
    include?: NotificationInclude;
    orderBy?: { createdAt: 'asc' | 'desc' };
    skip?: number;
    take?: number;
  }): Promise<NotificationWithRelations[]>;

  findUnique(args: {
    where: { id: string };
    include?: NotificationInclude;
  }): Promise<NotificationWithRelations | null>;

  count(args: { where?: NotificationWhereInput }): Promise<number>;

  create(args: {
    data: NotificationCreateInput;
    include?: NotificationInclude;
  }): Promise<NotificationWithRelations>;

  update(args: {
    where: { id: string };
    data: NotificationUpdateInput;
    include?: NotificationInclude;
  }): Promise<NotificationWithRelations>;

  updateMany(args: {
    where: NotificationWhereInput;
    data: NotificationUpdateInput;
  }): Promise<BatchPayload>;

  delete(args: { where: { id: string } }): Promise<Notification>;

  deleteMany(args: { where: NotificationWhereInput }): Promise<BatchPayload>;
}

/**
 * Extended PrismaClient type with notification support
 * This allows type-safe access to notification operations
 * without modifying the actual Prisma schema
 */
export interface ExtendedPrismaClient extends PrismaClient {
  notification: NotificationDelegate;
}
