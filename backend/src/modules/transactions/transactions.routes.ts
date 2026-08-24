import { Router } from 'express';
import { transactionsController } from './transactions.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { authorizeRoles } from '../../middleware/role.middleware';
import { Role } from '@prisma/client';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  authorizeRoles(Role.SUPER_ADMIN, Role.ADMIN, Role.ACCOUNTANT),
  transactionsController.getAll
);

router.get(
  '/:id',
  authorizeRoles(Role.SUPER_ADMIN, Role.ADMIN, Role.ACCOUNTANT),
  transactionsController.getById
);

export default router;
