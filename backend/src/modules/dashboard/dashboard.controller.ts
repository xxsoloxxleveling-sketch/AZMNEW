import { Request, Response, NextFunction } from 'express';
import { dashboardService } from './dashboard.service';

export class DashboardController {
  async getOverview(_req: Request, res: Response, next: NextFunction) {
    try {
      const overview = await dashboardService.getOverview();
      res.status(200).json({
        success: true,
        data: overview,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const dashboardController = new DashboardController();
