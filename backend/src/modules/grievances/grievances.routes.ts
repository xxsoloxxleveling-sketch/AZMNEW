import { Router } from 'express';
import { grievancesController } from './grievances.controller';
import { validateBody } from '../../middleware/validate.middleware';
import { createGrievanceSchema, updateGrievanceSchema } from './grievances.schema';
import { authenticate } from '../../middleware/auth.middleware';
import { authorizeRoles } from '../../middleware/role.middleware';
import { registrationRateLimiter } from '../../middleware/rateLimit.middleware';
import { Role } from '@prisma/client';

const router = Router();

// Public submission with rate limiting and schema validation
router.post('/', registrationRateLimiter, validateBody(createGrievanceSchema), grievancesController.create);

// Admin-only management endpoints
router.get('/', authenticate, authorizeRoles(Role.SUPER_ADMIN, Role.ADMIN), grievancesController.getAll);
router.get('/:id', authenticate, authorizeRoles(Role.SUPER_ADMIN, Role.ADMIN), grievancesController.getById);
router.patch(
  '/:id',
  authenticate,
  authorizeRoles(Role.SUPER_ADMIN, Role.ADMIN),
  validateBody(updateGrievanceSchema),
  grievancesController.update
);

export default router;
