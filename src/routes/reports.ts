import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../utils/auth';
import { asyncHandler, handleValidationErrors } from '../middleware/validation';
import { getReports, updateReportStatus } from '../controllers/reportsController';
import { validatePagination } from '../middleware/validators';

const router = Router();

router.get('/', authenticateToken, validatePagination, handleValidationErrors, asyncHandler(
  (req: AuthRequest, res: Response) => getReports(req, res)
));

router.patch('/:id', authenticateToken, asyncHandler(
  (req: AuthRequest, res: Response) => updateReportStatus(req, res)
));

export default router;