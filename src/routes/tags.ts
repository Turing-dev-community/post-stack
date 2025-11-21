import { Router } from 'express';
import { getTags, createTag, updateTag, deleteTag } from '../controllers/tagsController';
import { authenticateToken } from '../utils/auth';
import { requireAdmin } from '../middleware/authorization';
import { validateTag } from '../middleware/validators';
import { handleValidationErrors } from '../middleware/validation';

const router = Router();

// Public route: Get all tags
router.get('/', getTags);

// Admin-only routes: Tag CRUD operations
router.post(
  '/',
  authenticateToken,
  requireAdmin,
  validateTag,
  handleValidationErrors,
  createTag
);

router.put(
  '/:tagId',
  authenticateToken,
  requireAdmin,
  validateTag,
  handleValidationErrors,
  updateTag
);

router.delete(
  '/:tagId',
  authenticateToken,
  requireAdmin,
  deleteTag
);

export default router;

