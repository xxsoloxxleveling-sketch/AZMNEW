import { Request, Response, NextFunction } from 'express';
import { feesService } from './fees.service';

export class FeesController {
  async generateChallan(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await feesService.generateChallans(req.body);
      res.status(201).json({
        success: true,
        message: result.message,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async markPaid(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user;
      const actor = user
        ? { id: user.id, name: user.name || null, email: user.email }
        : undefined;
      const idempotencyKey = (req.headers['idempotency-key'] ||
        req.headers['x-idempotency-key']) as string | undefined;

      const result = await feesService.markFeePaid(
        req.params.id,
        req.body,
        actor,
        idempotencyKey
      );
      res.status(200).json({
        success: true,
        message: result.message,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await feesService.getFees(req.query as any);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getOverview(req: Request, res: Response, next: NextFunction) {
    try {
      const month = req.query.month as string | undefined;
      const result = await feesService.getFeeOverview(month);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await feesService.getFeeById(req.params.id);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const feesController = new FeesController();
