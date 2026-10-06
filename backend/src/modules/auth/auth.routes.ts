import { Router } from 'express';
import { authController } from './auth.controller';
import { validateBody } from '../../middleware/validate.middleware';
import { loginSchema, refreshSchema, changePasswordSchema } from './auth.schema';
import { authenticate } from '../../middleware/auth.middleware';
import { loginRateLimiter } from '../../middleware/rateLimit.middleware';

const router = Router();

// Public routes
router.post('/login', loginRateLimiter, validateBody(loginSchema), authController.login);
router.post('/refresh', validateBody(refreshSchema), authController.refresh);
router.post('/logout', authController.logout);

// Protected routes
router.get('/me', authenticate, authController.me);
router.post('/change-password', authenticate, validateBody(changePasswordSchema), authController.changePassword);

export default router;
