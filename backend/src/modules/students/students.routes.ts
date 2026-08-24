import { Router } from 'express';
import { studentsController } from './students.controller';
import { validateBody, validateQuery } from '../../middleware/validate.middleware';
import {
  createStudentSchema,
  updateStudentSchema,
  officeUseUpdateSchema,
  studentQuerySchema,
} from './students.schema';
import { authenticate } from '../../middleware/auth.middleware';
import { authorizeRoles } from '../../middleware/role.middleware';
import { Role } from '@prisma/client';

const router = Router();

// Public self-registration endpoint (Candidate online registration)
router.post(
  '/register',
  validateBody(createStudentSchema),
  studentsController.register
);

// Registration PDF export (accessible publicly or authenticated with candidate ID / App No)
router.get('/:id/registration-pdf', studentsController.getRegistrationPdf);

// QR image retrieval
router.get('/:id/qr', studentsController.getQr);

// Emergency / Admin Data Purge & Fresh Start Endpoint
router.post('/purge-all-system-data', studentsController.purgeAll);

// Live Supabase Cloud Storage Upload for Candidate Documents
router.post('/upload-document', studentsController.uploadDocument);

// Public / Client Query Roster Endpoints
router.get(
  '/',
  validateQuery(studentQuerySchema),
  studentsController.getAll
);

router.get(
  '/:id',
  studentsController.getById
);

// Stream / Serve Student Attached Documents & Photos Directly
router.get(
  '/:id/document/:docType',
  studentsController.serveDocument
);

// Protected routes for modifications (Admin / Teachers)
router.use(authenticate);

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
