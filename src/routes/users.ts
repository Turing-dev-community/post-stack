import { Router } from 'express';
import { authenticateToken } from '../utils/auth';
import { usersController } from '../controllers/usersController';

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
  usersController.getFollowers
);

router.get(
  '/:userId/following',
  usersController.getFollowing
);

export default router;

