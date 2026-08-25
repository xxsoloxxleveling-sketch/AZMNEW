import { Router } from 'express';
import { studentsController } from './students.controller';
import { validateBody, validateQuery } from '../../middleware/validate.middleware';
import {
  createStudentSchema,
  updateStudentSchema,
  officeUseUpdateSchema,
  studentQuerySchema,
  uploadDocumentSchema,
} from './students.schema';
import { authenticate } from '../../middleware/auth.middleware';
import { authorizeRoles } from '../../middleware/role.middleware';
import { registrationRateLimiter } from '../../middleware/rateLimit.middleware';
import { Role } from '@prisma/client';

const router = Router();

// Public self-registration endpoint (Candidate online registration)
router.post(
  '/register',
  registrationRateLimiter,
  validateBody(createStudentSchema),
  studentsController.register
);

// Registration PDF export (accessible publicly or authenticated with candidate ID / App No)
router.get('/:id/registration-pdf', studentsController.getRegistrationPdf);

// QR image retrieval
router.get('/:id/qr', studentsController.getQr);

// Live Supabase Cloud Storage Upload for Candidate Documents
router.post(
  '/upload-document',
  validateBody(uploadDocumentSchema),
  studentsController.uploadDocument
);

// Stream / Serve Student Attached Documents & Photos Directly
router.get(
  '/:id/document/:docType',
  studentsController.serveDocument
);

// Public Roll Number Release Schedule Config Endpoint
router.get(
  '/release-config',
  studentsController.getReleaseConfig
);

// Protected routes (Admin / Teachers / Super Admin)
router.use(authenticate);

// Update Roll Number Release Schedule Config (SUPER_ADMIN, ADMIN)
router.post(
  '/release-config',
  authorizeRoles(Role.SUPER_ADMIN, Role.ADMIN),
  studentsController.saveReleaseConfig
);

// Emergency / Admin Data Purge & Fresh Start Endpoint (SUPER_ADMIN ONLY)
router.post(
  '/purge-all-system-data',
  authorizeRoles(Role.SUPER_ADMIN),
  studentsController.purgeAll
);

// Roll Number Batch Issuance & Status (SUPER_ADMIN, ADMIN)
router.get(
  '/roll-number-status',
  authorizeRoles(Role.SUPER_ADMIN, Role.ADMIN),
  studentsController.getRollNumberStatus
);

// Batch issue roll numbers
router.post(
  '/issue-roll-numbers',
  authorizeRoles(Role.SUPER_ADMIN, Role.ADMIN),
  studentsController.issueRollNumbers
);

// Student Roster Query Endpoints (Authenticated)
router.get(
  '/',
  validateQuery(studentQuerySchema),
  studentsController.getAll
);

router.get(
  '/:id',
  studentsController.getById
);

// Admin Walk-in Registration
router.post(
  '/admin-register',
  authorizeRoles(Role.SUPER_ADMIN, Role.ADMIN),
  validateBody(createStudentSchema),
  studentsController.adminRegister
);

router.post(
  '/',
  authorizeRoles(Role.SUPER_ADMIN, Role.ADMIN),
  validateBody(createStudentSchema),
  studentsController.create
);
router.patch(
  '/:id',
  authorizeRoles(Role.SUPER_ADMIN, Role.ADMIN),
  validateBody(updateStudentSchema),
  studentsController.update
);
router.delete(
  '/:id',
  authorizeRoles(Role.SUPER_ADMIN, Role.ADMIN),
  studentsController.delete
);

// Approve registration payment & assign official roll number
router.post(
  '/:id/approve-payment',
  authorizeRoles(Role.SUPER_ADMIN, Role.ADMIN, Role.ACCOUNTANT),
  studentsController.approvePayment
);

// Part L: Office Use Record Update
router.patch(
  '/:id/office-use',
  authorizeRoles(Role.SUPER_ADMIN, Role.ADMIN),
  validateBody(officeUseUpdateSchema),
  studentsController.updateOfficeUse
);

export default router;
