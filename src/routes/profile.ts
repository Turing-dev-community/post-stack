import { Router } from 'express';
import { authenticateToken } from '../utils/auth';
import { validateProfileUpdate } from '../middleware/validators';
import { handleValidationErrors } from '../middleware/validation';
import { getProfile, updateProfile } from '../controllers/profileController';

const router = Router();

router.get('/', authenticateToken, getProfile);

router.put('/', authenticateToken, validateProfileUpdate, handleValidationErrors, updateProfile);

export default router;
