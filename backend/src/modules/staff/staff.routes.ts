import { Router } from 'express';
import { staffController } from './staff.controller';
import { validateBody } from '../../middleware/validate.middleware';
import { createStaffSchema, updateStaffSchema } from './staff.schema';
import { authenticate } from '../../middleware/auth.middleware';
import { authorizeRoles } from '../../middleware/role.middleware';
import { Role } from '@prisma/client';

const router = Router();

// Protect all staff routes
router.use(authenticate);

router.get(
  '/',
  authorizeRoles(Role.SUPER_ADMIN, Role.ADMIN, Role.ACCOUNTANT),
  staffController.getAll
);

router.post(
  '/',
  authorizeRoles(Role.SUPER_ADMIN, Role.ADMIN),
  validateBody(createStaffSchema),
  staffController.create
);

router.get(
  '/:id',
  authorizeRoles(Role.SUPER_ADMIN, Role.ADMIN, Role.ACCOUNTANT),
  staffController.getById
);

router.patch(
  '/:id',
  authorizeRoles(Role.SUPER_ADMIN, Role.ADMIN),
  validateBody(updateStaffSchema),
  staffController.update
);

router.delete(
  '/:id',
  authorizeRoles(Role.SUPER_ADMIN, Role.ADMIN),
  staffController.delete
);

export default router;
