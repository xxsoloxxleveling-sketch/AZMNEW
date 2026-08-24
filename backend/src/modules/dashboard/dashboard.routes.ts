import { Router } from 'express';
import { dashboardController } from './dashboard.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { authorizeRoles } from '../../middleware/role.middleware';
import { Role } from '@prisma/client';

const router = Router();

// Protect dashboard route
router.use(authenticate);

router.get(
  '/overview',
  authorizeRoles(Role.SUPER_ADMIN, Role.ADMIN, Role.TEACHER, Role.ACCOUNTANT),
  dashboardController.getOverview
);

export default router;
