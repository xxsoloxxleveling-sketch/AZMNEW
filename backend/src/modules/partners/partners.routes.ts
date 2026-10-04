import { Router } from 'express';
import { partnersController } from './partners.controller';
import { validateBody } from '../../middleware/validate.middleware';
import {
  registerPartnerSchema,
  createPartnerSchema,
  updatePartnerProfileSchema,
  updatePartnerStatusSchema,
} from './partners.schema';
import { authenticate } from '../../middleware/auth.middleware';
import { authorizeRoles } from '../../middleware/role.middleware';
import { registrationRateLimiter } from '../../middleware/rateLimit.middleware';
import { Role } from '@prisma/client';

const router = Router();

// Public partner registration
router.post(
  '/register',
  registrationRateLimiter,
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

router.post(
  '/',
  authorizeRoles(Role.SUPER_ADMIN, Role.ADMIN),
  validateBody(createPartnerSchema),
  partnersController.create
);

router.get(
  '/:id/status-history',
  authorizeRoles(Role.SUPER_ADMIN, Role.ADMIN),
  partnersController.getStatusHistory
);

router.patch(
  '/:id/status',
  authorizeRoles(Role.SUPER_ADMIN, Role.ADMIN),
  validateBody(updatePartnerStatusSchema),
  partnersController.updateStatus
);

router.get(
  '/:id',
  authorizeRoles(Role.SUPER_ADMIN, Role.ADMIN),
  partnersController.getById
);

router.patch(
  '/:id',
  authorizeRoles(Role.SUPER_ADMIN, Role.ADMIN),
  validateBody(updatePartnerProfileSchema),
  partnersController.updateProfile
);

export default router;
