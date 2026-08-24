import { Router } from 'express';
import { attendanceController } from './attendance.controller';
import { validateBody } from '../../middleware/validate.middleware';
import { attendanceScanRateLimiter } from '../../middleware/rateLimit.middleware';
import { scanAttendanceSchema } from './attendance.schema';
import { authenticate } from '../../middleware/auth.middleware';
import { authorizeRoles } from '../../middleware/role.middleware';
import { Role } from '@prisma/client';

const router = Router();

// Protect all attendance routes
router.use(authenticate);

// Unified QR Scan & Manual Attendance Marking
router.post(
  '/scan',
  attendanceScanRateLimiter,
  authorizeRoles(Role.SUPER_ADMIN, Role.ADMIN, Role.TEACHER),
  validateBody(scanAttendanceSchema),
  attendanceController.scan
);

// Today's summary & live attendance list
router.get(
  '/today',
  authorizeRoles(Role.SUPER_ADMIN, Role.ADMIN, Role.TEACHER, Role.ACCOUNTANT),
  attendanceController.getToday
);

// Student attendance history
router.get(
  '/student/:id',
  authorizeRoles(Role.SUPER_ADMIN, Role.ADMIN, Role.TEACHER),
  attendanceController.getStudentHistory
);

export default router;
