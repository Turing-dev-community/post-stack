import { Router } from 'express';
import { authenticateToken } from '../utils/auth';
import { followUser, unfollowUser, getFollowers, getFollowing, getUserActivity } from '../controllers/usersController';
import { validatePagination } from '../middleware/validators';
import { handleValidationErrors } from '../middleware/validation';
import { cacheMiddleware } from '../middleware/cache';
import { CACHE_CONFIG } from '../constants/cache';

const router = Router();

router.post(
  '/:userId/follow',
  authenticateToken,
  followUser
);

router.delete(
  '/:userId/follow',
  authenticateToken,
  unfollowUser
);

router.get(
  '/:userId/followers',
  validatePagination,
  handleValidationErrors,
  getFollowers
);

router.get(
  '/:userId/following',
  validatePagination,
  handleValidationErrors,
  getFollowing
);

router.get(
  '/:userId/activity',
  validatePagination,
  handleValidationErrors,
  cacheMiddleware(CACHE_CONFIG.TTL_USER_ACTIVITY),
  getUserActivity
);

export default router;
