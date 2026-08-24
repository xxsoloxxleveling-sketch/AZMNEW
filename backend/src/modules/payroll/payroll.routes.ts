import { Router } from 'express';
import { payrollController } from './payroll.controller';
import { validateBody } from '../../middleware/validate.middleware';
import { runPayrollSchema, markPayrollPaidSchema } from './payroll.schema';
import { authenticate } from '../../middleware/auth.middleware';
import { authorizeRoles } from '../../middleware/role.middleware';
import { Role } from '@prisma/client';

const router = Router();

// Protect all payroll routes
router.use(authenticate);

// Payroll Expense Overview
router.get(
  '/overview',
  authorizeRoles(Role.SUPER_ADMIN, Role.ADMIN, Role.ACCOUNTANT),
  payrollController.getOverview
);

// Run Payroll for all active staff for a month
router.post(
  '/run',
  authorizeRoles(Role.SUPER_ADMIN, Role.ADMIN, Role.ACCOUNTANT),
  validateBody(runPayrollSchema),
  payrollController.run
);

// Mark Payroll as Paid (creates SALARY_EXPENSE Transaction)
router.post(
  '/:id/mark-paid',
  authorizeRoles(Role.SUPER_ADMIN, Role.ADMIN, Role.ACCOUNTANT),
  validateBody(markPayrollPaidSchema),
  payrollController.markPaid
);

// List all payroll records
router.get(
  '/',
  authorizeRoles(Role.SUPER_ADMIN, Role.ADMIN, Role.ACCOUNTANT),
  payrollController.getAll
);

// Get single payroll record by ID
router.get(
  '/:id',
  authorizeRoles(Role.SUPER_ADMIN, Role.ADMIN, Role.ACCOUNTANT),
  payrollController.getById
);

export default router;
