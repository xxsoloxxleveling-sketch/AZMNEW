import { Router } from 'express';
import { partnersController } from './partners.controller';
import { validateBody } from '../../middleware/validate.middleware';
import {
  registerPartnerSchema,
  updatePartnerStatusSchema,
} from './partners.schema';
import { authenticate } from '../../middleware/auth.middleware';
import { authorizeRoles } from '../../middleware/role.middleware';
import { Role } from '@prisma/client';

const router = Router();

// Public partner registration
router.post(
  '/register',
  validateBody(registerPartnerSchema),
  partnersController.register
);

// Public/Direct partner registration PDF download
router.get('/:id/registration-pdf', partnersController.getRegistrationPdf);

// Protected routes (Admin only)
router.use(authenticate);

router.get(
  '/',
  authorizeRoles(Role.SUPER_ADMIN, Role.ADMIN),
  partnersController.getAll
);

router.get(
  '/:id',
  authorizeRoles(Role.SUPER_ADMIN, Role.ADMIN),
  partnersController.getById
);

router.patch(
  '/:id/status',
  authorizeRoles(Role.SUPER_ADMIN, Role.ADMIN),
  validateBody(updatePartnerStatusSchema),
  partnersController.updateStatus
);

export default router;
