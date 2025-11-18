import { Router } from 'express';
import { authenticateToken } from '../utils/auth';
import { validateSignup, validateLogin, validateProfileUpdate } from '../middleware/validators';
import { handleValidationErrors } from '../middleware/validation';
import { signup, login, getProfile, updateProfile, deactivateAccount } from '../controllers/authController';

const router = Router();

router.post('/signup', validateSignup, handleValidationErrors, signup);

router.post('/login', validateLogin, handleValidationErrors, login);

router.get('/profile', authenticateToken, getProfile);

router.put('/profile', authenticateToken, validateProfileUpdate, handleValidationErrors, updateProfile);

router.delete('/account', authenticateToken, deactivateAccount);

export default router;
