import { Router } from 'express';
import { transactionsController } from './transactions.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { authorizeRoles } from '../../middleware/role.middleware';
import { Role } from '@prisma/client';

const router = Router();

router.use(authenticate);

// Authoritative Financial Summary
router.get(
  '/summary',
  authorizeRoles(Role.SUPER_ADMIN, Role.ADMIN, Role.ACCOUNTANT),
  transactionsController.getSummary
);

// Paginated Transactions List
router.get(
  '/',
  authorizeRoles(Role.SUPER_ADMIN, Role.ADMIN, Role.ACCOUNTANT),
  transactionsController.getAll
);

// Single Transaction Detail
router.get(
  '/:id',
  authorizeRoles(Role.SUPER_ADMIN, Role.ADMIN, Role.ACCOUNTANT),
  transactionsController.getById
);

// Create Manual Transaction (e.g. OTHER_INCOME, OTHER_EXPENSE)
router.post(
  '/',
  authorizeRoles(Role.SUPER_ADMIN, Role.ADMIN, Role.ACCOUNTANT),
  transactionsController.createManual
);

// Void Transaction (Immutable Ledger Audit Operation)
router.post(
  '/:id/void',
  authorizeRoles(Role.SUPER_ADMIN, Role.ADMIN),
  transactionsController.void
);

// Physical deletion is permanently disabled (HTTP 405 Method Not Allowed)
router.delete(
  '/:id',
  authorizeRoles(Role.SUPER_ADMIN, Role.ADMIN, Role.ACCOUNTANT),
  transactionsController.delete
);

export default router;
