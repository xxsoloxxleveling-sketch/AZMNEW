import { Router } from 'express';
import { dashboardController } from './dashboard.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { authorizeRoles } from '../../middleware/role.middleware';
import { Role } from '@prisma/client';

const router = Router();

// Protected routes (Admin / Teachers / Super Admin)
router.use(authenticate);

router.get(
  '/overview',
  dashboardController.getOverview
);

export default router;
