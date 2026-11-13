import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate } from '../../middleware/auth.middleware';
import { authorizeRoles } from '../../middleware/role.middleware';
import { validateBody, validateQuery } from '../../middleware/validate.middleware';
import { resultsController } from './results.controller';
import {
  adminResultsPageQuerySchema,
  correctResultSchema,
  createDraftResultSchema,
  createExaminationSchema,
  dmcIssueSchema,
  dmcPrepareSchema,
  dmcRevokeSchema,
  examinationPublicationSchema,
  officialExaminationsQuerySchema,
  officialResultsPageQuerySchema,
} from './results.schema';

const router = Router();

// Public result search remains fail-closed. Verification references disclose no candidate identity or marks.
router.get('/search', resultsController.publicResultsUnavailable);
router.get('/merit-list', resultsController.publicResultsUnavailable);
router.get('/verification/:reference', resultsController.verifyOfficialDmc);

const adminRouter = Router();
adminRouter.use(
  authenticate,
  authorizeRoles(Role.SUPER_ADMIN, Role.ADMIN),
  (_req, res, next) => {
    res.set('Cache-Control', 'private, no-store, max-age=0');
    res.set('Pragma', 'no-cache');
    next();
  },
);

// Legacy aggregate results remain a separate, explicitly unverified staff read model.
adminRouter.get('/sessions', resultsController.getAdminSessions);
adminRouter.get('/sessions/:sessionId/results', validateQuery(adminResultsPageQuerySchema), resultsController.getAdminSessionResults);

// Official-result read APIs. Static selectors are registered before the resultId route.
adminRouter.get('/examinations', validateQuery(officialExaminationsQuerySchema), resultsController.getOfficialExaminations);
adminRouter.get('/results', validateQuery(officialResultsPageQuerySchema), resultsController.getOfficialResults);
adminRouter.get('/students/:studentId', resultsController.getStudentOfficialHistory);
adminRouter.get('/:resultId/corrections', resultsController.getOfficialCorrections);
adminRouter.get('/:resultId/dmc/official/issuances', resultsController.getOfficialDmcIssuances);
adminRouter.get('/:resultId/dmc/official/preparations/:preparationId/preview', resultsController.previewOfficialDmc);
adminRouter.get('/:resultId/dmc/official/:issuanceId', resultsController.downloadOfficialDmc);
adminRouter.get('/:resultId/dmc/electronic', resultsController.downloadElectronicDmc);
adminRouter.get('/:resultId', resultsController.getOfficialResult);

// Only SUPER_ADMIN can mutate official results or issue/revoke documents.
adminRouter.post('/examinations', authorizeRoles(Role.SUPER_ADMIN), validateBody(createExaminationSchema), resultsController.createOfficialExamination);
adminRouter.post('/examinations/:examId/publication', authorizeRoles(Role.SUPER_ADMIN), validateBody(examinationPublicationSchema), resultsController.publishOfficialExamination);
adminRouter.post('/examinations/:examId/results', authorizeRoles(Role.SUPER_ADMIN), validateBody(createDraftResultSchema), resultsController.createOfficialDraftResult);
adminRouter.post('/:resultId/corrections', authorizeRoles(Role.SUPER_ADMIN), validateBody(correctResultSchema), resultsController.correctOfficialResult);
adminRouter.post('/:resultId/dmc/official/prepare', authorizeRoles(Role.SUPER_ADMIN), validateBody(dmcPrepareSchema), resultsController.prepareOfficialDmc);
adminRouter.post('/:resultId/dmc/official/issue', authorizeRoles(Role.SUPER_ADMIN), validateBody(dmcIssueSchema), resultsController.issueOfficialDmc);
adminRouter.post('/:resultId/dmc/official/:issuanceId/revoke', authorizeRoles(Role.SUPER_ADMIN), validateBody(dmcRevokeSchema), resultsController.revokeOfficialDmc);

router.use('/admin', adminRouter);

export default router;
