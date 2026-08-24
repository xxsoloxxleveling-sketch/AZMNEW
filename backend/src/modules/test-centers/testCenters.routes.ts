import { Router } from 'express';
import { testCentersController } from './testCenters.controller';
import { validateBody } from '../../middleware/validate.middleware';
import { createTestCenterSchema, updateTestCenterSchema } from './testCenters.schema';
import { authenticate } from '../../middleware/auth.middleware';
import { authorizeRoles } from '../../middleware/role.middleware';
import { Role } from '@prisma/client';

const router = Router();

// Public / Authenticated read endpoints
router.get('/', testCentersController.getAll);
router.get('/:id', testCentersController.getById);

// Admin-protected creation, update, and deletion endpoints
router.post(
  '/',
  authenticate,
  authorizeRoles(Role.SUPER_ADMIN, Role.ADMIN),
  validateBody(createTestCenterSchema),
  testCentersController.create
);

router.patch(
  '/:id',
  authenticate,
  authorizeRoles(Role.SUPER_ADMIN, Role.ADMIN),
  validateBody(updateTestCenterSchema),
  testCentersController.update
);

router.delete(
  '/:id',
  authenticate,
  authorizeRoles(Role.SUPER_ADMIN, Role.ADMIN),
  testCentersController.delete
);

export default router;
