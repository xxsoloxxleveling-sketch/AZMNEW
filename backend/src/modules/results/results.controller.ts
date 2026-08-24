import { Request, Response, NextFunction } from 'express';
import { resultsService } from './results.service';

export class ResultsController {
  async search(req: Request, res: Response, next: NextFunction) {
    try {
      const query = (req.query.query as string) || '';
      const result = await resultsService.searchCandidateResult(query);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getMeritList(req: Request, res: Response, next: NextFunction) {
    try {
      const list = await resultsService.getPublicMeritList({
        category: req.query.category as string,
        district: req.query.district as string,
        search: req.query.search as string,
      });
      res.status(200).json({
        success: true,
        data: list,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const resultsController = new ResultsController();
