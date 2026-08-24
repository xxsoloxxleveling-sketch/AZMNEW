import { Router } from 'express';
import { feesController } from './fees.controller';
import { validateBody } from '../../middleware/validate.middleware';
import { generateChallanSchema, markPaidSchema } from './fees.schema';
import { authenticate } from '../../middleware/auth.middleware';
import { authorizeRoles } from '../../middleware/role.middleware';
import { Role } from '@prisma/client';

const router = Router();

// Protect all fee routes with authentication & role permissions
router.use(authenticate);

// Fee Collection Overview
router.get(
  '/overview',
  authorizeRoles(Role.SUPER_ADMIN, Role.ADMIN, Role.ACCOUNTANT),
  feesController.getOverview
);

// Challan Generation
router.post(
  '/generate-challan',
  authorizeRoles(Role.SUPER_ADMIN, Role.ADMIN, Role.ACCOUNTANT),
  validateBody(generateChallanSchema),
  feesController.generateChallan
);

// Mark Challan Paid (creates FEE_INCOME Transaction)
router.post(
  '/:id/mark-paid',
  authorizeRoles(Role.SUPER_ADMIN, Role.ADMIN, Role.ACCOUNTANT),
  validateBody(markPaidSchema),
  feesController.markPaid
);

// List all fee records
router.get(
  '/',
  authorizeRoles(Role.SUPER_ADMIN, Role.ADMIN, Role.ACCOUNTANT),
  feesController.getAll
);

// Get single fee record by ID
router.get(
  '/:id',
  authorizeRoles(Role.SUPER_ADMIN, Role.ADMIN, Role.ACCOUNTANT),
  feesController.getById
);

export default router;
