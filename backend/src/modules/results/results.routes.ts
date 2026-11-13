import { Router } from 'express';
import { resultsController } from './results.controller';
import { validateQuery } from '../../middleware/validate.middleware';
import { adminResultsPageQuerySchema } from './results.schema';
import { authenticate } from '../../middleware/auth.middleware';
import { authorizeRoles } from '../../middleware/role.middleware';
import { Role } from '@prisma/client';

const router = Router();

// Public Results & Merit endpoints
router.get('/search', resultsController.publicResultsUnavailable);
router.get('/merit-list', resultsController.publicResultsUnavailable);

// Staff-only, read-only access to legacy aggregate scores linked to an exam sitting.
// These values are deliberately returned as unverified and cannot be published here.
const adminRouter = Router();
adminRouter.use(authenticate, authorizeRoles(Role.SUPER_ADMIN, Role.ADMIN));
adminRouter.get('/sessions', resultsController.getAdminSessions);
adminRouter.get('/sessions/:sessionId/results', validateQuery(adminResultsPageQuerySchema), resultsController.getAdminSessionResults);
router.use('/admin', adminRouter);

export default router;
