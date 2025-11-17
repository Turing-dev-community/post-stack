import { Router } from 'express';
import { authenticateToken } from '../utils/auth';
import { usersController } from '../controllers/usersController';
import { validatePagination } from '../middleware/validators';
import { handleValidationErrors } from '../middleware/validation';

const router = Router();

router.post(
  '/:userId/follow',
  authenticateToken,
  usersController.followUser
);

router.delete(
  '/:userId/follow',
  authenticateToken,
  usersController.unfollowUser
);

router.get(
  '/:userId/followers',
  validatePagination,
  handleValidationErrors,
  usersController.getFollowers
);

router.get(
  '/:userId/following',
  validatePagination,
  handleValidationErrors,
  usersController.getFollowing
);

export default router;
