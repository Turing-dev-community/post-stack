import { Router } from 'express';
import { authenticateToken } from '../utils/auth';
import { validateSignup, validateLogin, validatePasswordChange, validateReactivate } from '../middleware/validators';
import { handleValidationErrors } from '../middleware/validation';
import { signup, login, changePassword, reactivateAccount, deactivateAccount, refreshAccessToken, logout, logoutAll } from '../controllers/authController';

const router = Router();

router.post('/signup', validateSignup, handleValidationErrors, signup);

router.post('/login', validateLogin, handleValidationErrors, login);

router.post('/refresh', refreshAccessToken);

router.post('/logout', logout);

router.post('/logout-all', authenticateToken, logoutAll);

router.post('/reactivate', validateReactivate, handleValidationErrors, reactivateAccount);

router.put('/password', authenticateToken, validatePasswordChange, handleValidationErrors, changePassword);

router.delete('/account', authenticateToken, deactivateAccount);

export default router;
