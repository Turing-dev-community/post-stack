import { Router } from 'express';
import { getHealth, getLiveness, getReadiness } from '../controllers/healthController';
import { asyncHandler } from '../middleware/validation';

const router = Router();

/**
 * @route   GET /health
 * @desc    Comprehensive health check with database connectivity
 * @access  Public
 */
router.get('/', asyncHandler(getHealth));

/**
 * @route   GET /health/live
 * @desc    Liveness probe - is the server running?
 * @access  Public
 */
router.get('/live', getLiveness);

/**
 * @route   GET /health/ready
 * @desc    Readiness probe - is the server ready to accept traffic?
 * @access  Public
 */
router.get('/ready', asyncHandler(getReadiness));

export default router;

