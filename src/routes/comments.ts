import { Router } from 'express';
import { authenticateToken } from '../utils/auth';
import { validateComment } from '../middleware/validators';
import { handleValidationErrors } from '../middleware/validation';
import { 
  getCommentsForPost,
  createComment,
  replyToComment,
  likeComment,
  unlikeComment,
} from '../controllers/commentsController';

const router = Router();

router.get('/:postId/comments', getCommentsForPost);

router.post(
  '/:postId/comments',
  authenticateToken,
  validateComment,
  handleValidationErrors,
  createComment
);

router.post(
  '/:postId/comments/:commentId/reply',
  authenticateToken,
  validateComment,
  handleValidationErrors,
  replyToComment
);

router.post(
  '/:postId/comments/:commentId/like',
  authenticateToken,
  likeComment
);

router.delete(
  '/:postId/comments/:commentId/like',
  authenticateToken,
  unlikeComment
);

export default router;
