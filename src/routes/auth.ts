import { Router } from 'express';
import { authenticateToken } from '../utils/auth';
import { validateSignup, validateLogin } from '../middleware/validators';
import { handleValidationErrors } from '../middleware/validation';
import { signup, login, deactivateAccount } from '../controllers/authController';

const router = Router();

router.post('/signup', validateSignup, handleValidationErrors, signup);

router.post('/login', validateLogin, handleValidationErrors, login);

router.delete('/account', authenticateToken, deactivateAccount);

export default router;
