import { Router, Response } from 'express';
import { authenticateToken } from '../utils/auth';
import { requireAdmin } from '../middleware/authorization';
import { asyncHandler } from '../middleware/validation';
import { AuthRequest } from '../utils/auth';
import * as analyticsController from '../controllers/postsAnalyticsController';

const router = Router();

// All analytics routes are admin-only
router.use(authenticateToken);
router.use(requireAdmin);

// Get aggregate analytics across all posts
router.get(
	'/aggregate',
	asyncHandler((req: AuthRequest, res: Response) =>
		analyticsController.getAggregateAnalytics(req, res)
	)
);

export default router;

