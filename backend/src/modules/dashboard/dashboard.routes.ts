import { Router } from 'express';
import { dashboardController } from './dashboard.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { authorizeRoles } from '../../middleware/role.middleware';
import { Role } from '@prisma/client';

const router = Router();

router.get(
  '/overview',
  dashboardController.getOverview
);

// Protected routes (Admin / Teachers)
router.use(authenticate);

export default router;
