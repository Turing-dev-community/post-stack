import { Router } from 'express';
import { authenticateToken } from '../utils/auth';
import { followUser, unfollowUser, getFollowers, getFollowing } from '../controllers/usersController';
import { validatePagination } from '../middleware/validators';
import { handleValidationErrors } from '../middleware/validation';

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

export default router;
