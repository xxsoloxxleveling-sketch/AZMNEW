import { Request, Response, NextFunction } from 'express';
import { payrollService } from './payroll.service';

export class PayrollController {
  async run(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await payrollService.runPayroll(req.body);
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

      const result = await payrollService.markPayrollPaid(
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
      const result = await payrollService.getPayrollList(req.query as any);
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
      const result = await payrollService.getPayrollOverview(month);
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
      const result = await payrollService.getPayrollById(req.params.id);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const payrollController = new PayrollController();
