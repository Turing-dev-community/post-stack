import { Router } from 'express';
import { authenticateToken } from '../utils/auth';
import { validateComment, validateCommentReport } from '../middleware/validators';
import { handleValidationErrors } from '../middleware/validation';
import { 
  getCommentsForPost,
  createComment,
  replyToComment,
  likeComment,
  unlikeComment,
  updateComment,
  deleteComment,
  reportComment,
  moderateComment,
  getModerationQueue,
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

router.put(
  '/:postId/comments/:commentId',
  authenticateToken,
  validateComment,
  handleValidationErrors,
  updateComment
);

router.delete(
  '/:postId/comments/:commentId',
  authenticateToken,
  deleteComment
);

router.post(
  '/:postId/comments/:commentId/report',
  authenticateToken,
  validateCommentReport,
  handleValidationErrors,
  reportComment
);

router.patch(
  '/:postId/comments/:commentId/moderate',
  authenticateToken,
  moderateComment
);

router.get(
  '/:postId/moderation-queue',
  authenticateToken,
  getModerationQueue
);

export default router;
