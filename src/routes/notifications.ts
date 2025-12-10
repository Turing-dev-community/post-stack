import { Router } from 'express';
import { authenticateToken } from '../utils/auth';
import { asyncHandler } from '../middleware/validation';
import { validatePagination, validateNotificationId } from '../middleware/validators';
import { handleValidationErrors } from '../middleware/validation';
import {
  getNotifications,
  getUnreadCount,
  getNotificationById,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearReadNotifications,
} from '../controllers/notificationsController';

const router = Router();

// Get paginated notifications for authenticated user
router.get(
  '/',
  authenticateToken,
  validatePagination,
  handleValidationErrors,
  asyncHandler(getNotifications)
);

// Get unread notification count
router.get(
  '/unread-count',
  authenticateToken,
  asyncHandler(getUnreadCount)
);

// Get a single notification by ID
router.get(
  '/:id',
  authenticateToken,
  validateNotificationId,
  handleValidationErrors,
  asyncHandler(getNotificationById)
);

// Mark a single notification as read
router.patch(
  '/:id/read',
  authenticateToken,
  validateNotificationId,
  handleValidationErrors,
  asyncHandler(markAsRead)
);

// Mark all notifications as read
router.patch(
  '/read-all',
  authenticateToken,
  asyncHandler(markAllAsRead)
);

// Clear all read notifications (must be before /:id route)
router.delete(
  '/clear',
  authenticateToken,
  asyncHandler(clearReadNotifications)
);

// Delete a single notification
router.delete(
  '/:id',
  authenticateToken,
  validateNotificationId,
  handleValidationErrors,
  asyncHandler(deleteNotification)
);

export default router;

