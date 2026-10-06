import express, { Router } from 'express';
import { studentsController } from './students.controller';
import { validateBody, validateQuery } from '../../middleware/validate.middleware';
import {
  createStudentSchema,
  publicRegistrationSchema,
  updateStudentSchema,
  officeUseUpdateSchema,
  studentQuerySchema,
  uploadDocumentSchema,
} from './students.schema';
import { authenticate } from '../../middleware/auth.middleware';
import { authorizeRoles } from '../../middleware/role.middleware';
import {
  registrationRateLimiter,
  uploadSessionRateLimiter,
  documentUploadRateLimiter,
} from '../../middleware/rateLimit.middleware';
import { Role } from '@prisma/client';

const router = Router();

// Public self-registration endpoint (Candidate online registration)
router.post(
  '/register',
  registrationRateLimiter,
  validateBody(publicRegistrationSchema),
  studentsController.register
);

// Registration PDF export (authenticated staff or a candidate with matching CNIC/B-Form)
router.get('/:id/registration-pdf', studentsController.getRegistrationPdf);

// QR image retrieval
router.get('/:id/qr', studentsController.getQr);

// Live Supabase Cloud Storage Upload for Candidate Documents
router.post(
  '/upload-session',
  uploadSessionRateLimiter,
  studentsController.createUploadSession
);

router.post(
  '/upload-document',
  documentUploadRateLimiter,
  validateBody(uploadDocumentSchema),
  studentsController.uploadDocument
);

router.post(
  '/upload-document-binary',
  documentUploadRateLimiter,
  express.raw({ type: ['image/jpeg', 'image/png', 'application/pdf'], limit: '5mb' }),
  studentsController.uploadDocumentBinary
);

// Public Roll Number Release Schedule Config Endpoint
router.get(
  '/release-config',
  studentsController.getReleaseConfig
);

// Public Roll Number Slip Search Endpoint (POST body: query, cnic)
router.post(
  '/search-slip',
  studentsController.searchPublicSlip
);

// Public Candidate Registration Search Endpoint (POST body: applicationNo, cnic)
router.post('/search-registration', studentsController.findPublicRegistration);
router.post('/public/registration/search', studentsController.findPublicRegistration);

// Candidate self-service uses the matching CNIC / B-Form as the verification
// secret. Private staff routes below remain authenticated.
router.get('/:id/photo-thumbnail', studentsController.serveCandidatePhoto);

// Protected routes (Admin / Teachers / Super Admin / Accountants)
router.use(authenticate);

// Private student files are streamed to authenticated staff.
router.get(
  '/:id/document/:docType',
  authorizeRoles(Role.SUPER_ADMIN, Role.ADMIN, Role.TEACHER, Role.ACCOUNTANT),
  studentsController.serveDocument
);

// Update Roll Number Release Schedule Config (SUPER_ADMIN, ADMIN)
router.post(
  '/release-config',
  authorizeRoles(Role.SUPER_ADMIN, Role.ADMIN),
  studentsController.saveReleaseConfig
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
  '/documents',
  authorizeRoles(Role.SUPER_ADMIN, Role.ADMIN),
  studentsController.getDocumentMetadata
);

// One-time, additive migration of legacy profile photos into small private thumbnails.
router.post(
  '/backfill-profile-thumbnails',
  authorizeRoles(Role.SUPER_ADMIN),
  studentsController.startThumbnailBackfill
);
router.get(
  '/backfill-profile-thumbnails/status',
  authorizeRoles(Role.SUPER_ADMIN),
  studentsController.getThumbnailBackfillStatus
);

// Export filtered student roster as branded PDF (SUPER_ADMIN, ADMIN)
router.get(
  '/export-pdf',
  authorizeRoles(Role.SUPER_ADMIN, Role.ADMIN),
  validateQuery(studentQuerySchema),
  studentsController.exportPdf
);

// Bulk OMR Sheet PDF export (SUPER_ADMIN, ADMIN)
router.post(
  '/bulk-omr-pdf',
  authorizeRoles(Role.SUPER_ADMIN, Role.ADMIN),
  studentsController.getBulkOmrPdf
);

// Bulk Roll Slips PDF export (SUPER_ADMIN, ADMIN)
router.post(
  '/bulk-roll-slips-pdf',
  authorizeRoles(Role.SUPER_ADMIN, Role.ADMIN),
  studentsController.getBulkRollSlipsPdf
);

router.get(
  '/:id',
  studentsController.getById
);

// Candidate Roll Number Slip PDF export (SUPER_ADMIN, ADMIN)
router.post(
  '/:id/prepare-print',
  authorizeRoles(Role.SUPER_ADMIN, Role.ADMIN),
  studentsController.preparePrint
);

router.get(
  '/:id/roll-slip-pdf',
  authorizeRoles(Role.SUPER_ADMIN, Role.ADMIN),
  studentsController.getRollSlipPdf
);

// Candidate MCQs OMR Sheet PDF export (SUPER_ADMIN, ADMIN)
router.get(
  '/:id/omr-sheet-pdf',
  authorizeRoles(Role.SUPER_ADMIN, Role.ADMIN),
  studentsController.getOmrSheetPdf
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
