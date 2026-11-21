import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate } from '../../middleware/auth.middleware';
import { authorizeRoles } from '../../middleware/role.middleware';
import { validateBody, validateQuery } from '../../middleware/validate.middleware';
import { interviewsController } from './interviews.controller';
import assessmentRouter from './assessment.routes';
import {
  auditQuerySchema, autoAllocateCommitSchema, autoAllocatePreviewSchema, candidateQuerySchema,
  createAssignmentsSchema, createHallSchema, createRoundSchema, finalizeRoundSchema,
  lockAssignmentSchema, removeAssignmentSchema, unlockAssignmentSchema, updateAssignmentSchema,
  updateHallSchema, resultApprovalSchema, fixedSchedulePreviewSchema, fixedScheduleCommitSchema,
} from './interviews.schema';

const router = Router();
router.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Pragma', 'no-cache');
  next();
});
router.use(authenticate, authorizeRoles(Role.SUPER_ADMIN, Role.ADMIN));
router.use('/:roundId/assessment', assessmentRouter);

router.get('/rounds', interviewsController.listRounds);
router.post('/rounds', validateBody(createRoundSchema), interviewsController.createRound);
router.post('/rounds/:roundId/publish', interviewsController.publishRound);
router.post('/rounds/:roundId/results/approval', validateBody(resultApprovalSchema), interviewsController.approveResults);
router.post('/rounds/:roundId/finalize', validateBody(finalizeRoundSchema), interviewsController.finalizeRound);
router.get('/rounds/:roundId/audit', validateQuery(auditQuerySchema), interviewsController.audit);

router.get('/:roundId/overview', interviewsController.overview);
router.get('/:roundId/fixed-schedule', interviewsController.fixedSchedule);
router.post('/:roundId/fixed-schedule/preview', authorizeRoles(Role.SUPER_ADMIN),
  validateBody(fixedSchedulePreviewSchema), interviewsController.previewFixedSchedule);
router.post('/:roundId/fixed-schedule/commit', authorizeRoles(Role.SUPER_ADMIN),
  validateBody(fixedScheduleCommitSchema), interviewsController.commitFixedSchedule);
router.get('/:roundId/candidates', validateQuery(candidateQuerySchema), interviewsController.candidates);
router.get('/:roundId/halls', interviewsController.halls);
router.post('/:roundId/halls', validateBody(createHallSchema), interviewsController.createHall);
router.patch('/halls/:hallId', validateBody(updateHallSchema), interviewsController.updateHall);

router.post('/:roundId/assignments', validateBody(createAssignmentsSchema), interviewsController.createAssignments);
router.patch('/assignments/:assignmentId', validateBody(updateAssignmentSchema), interviewsController.moveAssignment);
router.delete('/assignments/:assignmentId', validateBody(removeAssignmentSchema), interviewsController.removeAssignment);
router.post('/assignments/:assignmentId/lock', validateBody(lockAssignmentSchema), interviewsController.lockAssignment);
router.post('/assignments/:assignmentId/unlock', validateBody(unlockAssignmentSchema), interviewsController.unlockAssignment);

router.post('/:roundId/auto-allocate/preview', validateBody(autoAllocatePreviewSchema), interviewsController.previewAutoAllocation);
router.post('/:roundId/auto-allocate/commit', validateBody(autoAllocateCommitSchema), interviewsController.commitAutoAllocation);

export default router;
