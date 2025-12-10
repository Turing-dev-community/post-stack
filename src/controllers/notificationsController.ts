import { Response } from 'express';
import { AuthRequest } from '../utils/auth';
import { ResponseHandler } from '../utils/response';
import { checkAuth } from '../utils/authDecorator';
import * as notificationsService from '../services/notificationsService';

/**
 * Get paginated notifications for the authenticated user
 */
export async function getNotifications(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const response = new ResponseHandler(res);

  if (!checkAuth(req, res)) return;

  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const result = await notificationsService.getUserNotifications(req.user.id, {
      page,
      limit,
    });

    response.ok({
      notifications: result.notifications,
      pagination: result.pagination,
      unreadCount: result.unreadCount,
    });
  } catch (error) {
    response.error(error);
  }
}

/**
 * Get unread notification count for the authenticated user
 */
export async function getUnreadCount(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const response = new ResponseHandler(res);

  if (!checkAuth(req, res)) return;

  try {
    const count = await notificationsService.getUnreadCount(req.user.id);

    response.ok({
      unreadCount: count,
    });
  } catch (error) {
    response.error(error);
  }
}

/**
 * Get a single notification by ID
 */
export async function getNotificationById(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const response = new ResponseHandler(res);

  if (!checkAuth(req, res)) return;

  try {
    const { id } = req.params;
    const notification = await notificationsService.getNotificationById(
      id,
      req.user.id
    );

    response.ok({
      notification,
    });
  } catch (error) {
    response.error(error);
  }
}

/**
 * Mark a single notification as read
 */
export async function markAsRead(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const response = new ResponseHandler(res);

  if (!checkAuth(req, res)) return;

  try {
    const { id } = req.params;
    const notification = await notificationsService.markNotificationAsRead(
      id,
      req.user.id
    );

    response.ok({
      message: 'Notification marked as read',
      notification,
    });
  } catch (error) {
    response.error(error);
  }
}

/**
 * Mark all notifications as read for the authenticated user
 */
export async function markAllAsRead(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const response = new ResponseHandler(res);

  if (!checkAuth(req, res)) return;

  try {
    const count = await notificationsService.markAllAsRead(req.user.id);

    response.ok({
      message: 'All notifications marked as read',
      count,
    });
  } catch (error) {
    response.error(error);
  }
}

/**
 * Delete a single notification
 */
export async function deleteNotification(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const response = new ResponseHandler(res);

  if (!checkAuth(req, res)) return;

  try {
    const { id } = req.params;
    await notificationsService.deleteNotification(id, req.user.id);

    response.ok({
      message: 'Notification deleted successfully',
    });
  } catch (error) {
    response.error(error);
  }
}

/**
 * Clear all read notifications for the authenticated user
 */
export async function clearReadNotifications(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const response = new ResponseHandler(res);

  if (!checkAuth(req, res)) return;

  try {
    const count = await notificationsService.clearReadNotifications(req.user.id);

    response.ok({
      message: 'Read notifications cleared',
      count,
    });
  } catch (error) {
    response.error(error);
  }
}

