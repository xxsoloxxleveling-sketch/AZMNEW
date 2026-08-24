import { Router } from 'express';
import { resultsController } from './results.controller';
import { validateQuery } from '../../middleware/validate.middleware';
import { resultSearchQuerySchema, meritListQuerySchema } from './results.schema';

const router = Router();

// Public Results & Merit endpoints
router.get('/search', validateQuery(resultSearchQuerySchema), resultsController.search);
router.get('/merit-list', validateQuery(meritListQuerySchema), resultsController.getMeritList);

export default router;
