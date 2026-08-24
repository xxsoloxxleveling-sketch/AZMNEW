import { Router } from 'express';
import { examHallsController } from './examHalls.controller';
import { validateBody } from '../../middleware/validate.middleware';
import {
  createExamHallSchema,
  updateExamHallSchema,
  batchAssignSchema,
  updateAllocationSchema,
} from './examHalls.schema';
import { authenticate } from '../../middleware/auth.middleware';
import { authorizeRoles } from '../../middleware/role.middleware';
import { Role } from '@prisma/client';

const router = Router();

// Public / Authenticated read endpoints
router.get('/', examHallsController.getAll);
router.get('/:id', examHallsController.getById);

// Admin-only creation, update, deletion, and allocation
router.post(
  '/',
  authenticate,
  authorizeRoles(Role.SUPER_ADMIN, Role.ADMIN),
  validateBody(createExamHallSchema),
  examHallsController.create
);

router.patch(
  '/:id',
  authenticate,
  authorizeRoles(Role.SUPER_ADMIN, Role.ADMIN),
  validateBody(updateExamHallSchema),
  examHallsController.update
);

router.delete(
  '/:id',
  authenticate,
  authorizeRoles(Role.SUPER_ADMIN, Role.ADMIN),
  examHallsController.delete
);

router.post(
  '/:id/batch-assign',
  authenticate,
  authorizeRoles(Role.SUPER_ADMIN, Role.ADMIN),
  validateBody(batchAssignSchema),
  examHallsController.batchAssign
);

router.patch(
  '/students/:studentId/allocation',
  authenticate,
  authorizeRoles(Role.SUPER_ADMIN, Role.ADMIN),
  validateBody(updateAllocationSchema),
  examHallsController.updateStudentAllocation
);

router.delete(
  '/students/:studentId/allocation',
  authenticate,
  authorizeRoles(Role.SUPER_ADMIN, Role.ADMIN),
  examHallsController.unassignStudent
);

export default router;
