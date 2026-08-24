import { Router } from 'express';
import { authController } from './auth.controller';
import { validateBody } from '../../middleware/validate.middleware';
import { loginRateLimiter } from '../../middleware/rateLimit.middleware';
import { loginSchema, refreshSchema } from './auth.schema';
import { authenticate } from '../../middleware/auth.middleware';
import { authorizeRoles } from '../../middleware/role.middleware';
import { Role } from '@prisma/client';

const router = Router();

// Public routes
router.post('/login', loginRateLimiter, validateBody(loginSchema), authController.login);
router.post('/refresh', validateBody(refreshSchema), authController.refresh);
router.post('/logout', authController.logout);

// Protected routes
router.get('/me', authenticate, authController.me);
router.get(
  '/test-protected',
  authenticate,
  authorizeRoles(Role.SUPER_ADMIN, Role.ADMIN),
  authController.testProtected
);
router.get(
  '/super-admin-only',
  authenticate,
  authorizeRoles(Role.SUPER_ADMIN),
  authController.superAdminOnly
);

export default router;
