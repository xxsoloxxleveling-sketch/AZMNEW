import { Request, Response, NextFunction } from 'express';
import { resultsService } from './results.service';
import { adminResultsPageQuerySchema } from './results.schema';

function sendPublicResultsUnavailable(res: Response) {
  res.set('Cache-Control', 'no-store');
  return res.status(404).json({
    success: false,
    error: {
      code: 'RESULTS_NOT_PUBLISHED',
      message: 'No examination results are currently published.',
    },
  });
}

export class ResultsController {
  publicResultsUnavailable(_req: Request, res: Response) {
    return sendPublicResultsUnavailable(res);
  }

  async search(_req: Request, res: Response, _next: NextFunction) {
    return sendPublicResultsUnavailable(res);
  }

  async getMeritList(_req: Request, res: Response, _next: NextFunction) {
    return sendPublicResultsUnavailable(res);
  }
  async getAdminSessions(_req: Request, res: Response, next: NextFunction) {
    try {
      const sessions = await resultsService.listAdminResultSessions();
      res.status(200).json({ success: true, data: sessions });
    } catch (error) {
      next(error);
    }
  }

  async getAdminSessionResults(req: Request, res: Response, next: NextFunction) {
    try {
      const query = adminResultsPageQuerySchema.parse(req.query);
      const results = await resultsService.listAdminSessionResults(req.params.sessionId, query);
      res.status(200).json({ success: true, data: results });
    } catch (error) {
      next(error);
    }
  }
}

export const resultsController = new ResultsController();
