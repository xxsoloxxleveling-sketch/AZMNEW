import { Router } from 'express';
import { validateBody, validateQuery } from '../../middleware/validate.middleware';
import { interviewAssessmentController as controller } from './assessment.controller';
import { assessmentMeritQuerySchema, assessmentPanelSchema, assessmentRosterQuerySchema, assessmentSaveSchema, meritAwardSaveSchema } from './assessment.schema';

// Mounted below the existing authenticated ADMIN / SUPER_ADMIN interview boundary.
const router = Router({ mergeParams: true });
router.get('/roster', validateQuery(assessmentRosterQuerySchema), controller.roster);
router.get('/panels', controller.panels);
router.put('/panels/:panel', validateBody(assessmentPanelSchema), controller.savePanel);
router.get('/candidates/:placementId', controller.candidate);
router.get('/candidates/:placementId/history', controller.history);
router.post('/candidates/:placementId/save', validateBody(assessmentSaveSchema), controller.save);
router.post('/candidates/:placementId/submit', validateBody(assessmentSaveSchema), controller.submit);
router.put('/candidates/:placementId/merit-award', validateBody(meritAwardSaveSchema), controller.saveMeritAward);
router.get('/candidates/:placementId/merit-award/history', controller.meritAwardHistory);
router.get('/merit', validateQuery(assessmentMeritQuerySchema), controller.merit);
export default router;
