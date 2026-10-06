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

// Hall administration and candidate placement are internal admin data.
router.use(authenticate, authorizeRoles(Role.SUPER_ADMIN, Role.ADMIN));
router.get('/', examHallsController.getAll);
router.get('/candidates', examHallsController.getCandidates);
router.get('/:id', examHallsController.getById);

// Admin-only creation, update, deletion, and allocation
router.post(
  '/',
  validateBody(createExamHallSchema),
  examHallsController.create
);

router.patch(
  '/:id',
  validateBody(updateExamHallSchema),
  examHallsController.update
);

router.delete(
  '/:id',
  examHallsController.delete
);

router.post(
  '/:id/batch-assign',
  validateBody(batchAssignSchema),
  examHallsController.batchAssign
);

router.patch(
  '/students/:studentId/allocation',
  validateBody(updateAllocationSchema),
  examHallsController.updateStudentAllocation
);

router.delete(
  '/students/:studentId/allocation',
  examHallsController.unassignStudent
);

export default router;
