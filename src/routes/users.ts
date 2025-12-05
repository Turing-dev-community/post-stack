import { Router } from 'express';
import { authenticateToken } from '../utils/auth';
import { followUser, unfollowUser, getFollowers, getFollowing, getUserActivity, getUserPublicProfile, deleteUser } from '../controllers/usersController';
import { validatePagination } from '../middleware/validators';
import { handleValidationErrors } from '../middleware/validation';
import { cacheMiddleware } from '../middleware/cache';
import { CACHE_CONFIG } from '../constants/cache';

const router = Router();

// Public endpoint to view any user's profile
router.get(
  '/:userId/profile',
  cacheMiddleware(CACHE_CONFIG.TTL_DEFAULT),
  getUserPublicProfile
);

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

router.delete(
  '/',
  deleteUser
);

export default router;
