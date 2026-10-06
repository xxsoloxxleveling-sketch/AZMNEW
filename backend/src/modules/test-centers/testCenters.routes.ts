import { Router } from 'express';
import { testCentersController } from './testCenters.controller';
import { validateBody } from '../../middleware/validate.middleware';
import { createTestCenterSchema, updateTestCenterSchema } from './testCenters.schema';
import { authenticate } from '../../middleware/auth.middleware';
import { authorizeRoles } from '../../middleware/role.middleware';
import { Role } from '@prisma/client';

const router = Router();

// No public registration caller uses these internal administration endpoints.
router.use(authenticate, authorizeRoles(Role.SUPER_ADMIN, Role.ADMIN));
router.get('/', testCentersController.getAll);
router.get('/:id', testCentersController.getById);

// Admin-protected creation, update, and deletion endpoints
router.post(
  '/',
  validateBody(createTestCenterSchema),
  testCentersController.create
);

router.patch(
  '/:id',
  validateBody(updateTestCenterSchema),
  testCentersController.update
);

router.delete(
  '/:id',
  testCentersController.delete
);

export default router;
