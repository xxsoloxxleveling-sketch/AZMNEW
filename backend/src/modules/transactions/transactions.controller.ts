import { Request, Response, NextFunction } from 'express';
import { transactionsService } from './transactions.service';
import {
  transactionQuerySchema,
  transactionSummaryQuerySchema,
  voidTransactionSchema,
  createManualTransactionSchema,
} from './transactions.schema';

export class TransactionsController {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const query = transactionQuerySchema.parse(req.query);
      const result = await transactionsService.getTransactions(query);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const query = transactionSummaryQuerySchema.parse(req.query);
      const result = await transactionsService.getTransactionSummary(query);
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
      const result = await transactionsService.getTransactionById(req.params.id);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async createManual(req: Request, res: Response, next: NextFunction) {
    try {
      const body = createManualTransactionSchema.parse(req.body);
      const user = req.user;
      const rawKey = req.headers['idempotency-key'] || req.headers['x-idempotency-key'];
      const idempotencyKey =
        typeof rawKey === 'string'
          ? rawKey.trim()
          : Array.isArray(rawKey)
          ? rawKey[0].trim()
          : undefined;
      const result = await transactionsService.createManualTransaction(body, user, idempotencyKey);
      res.status(result.isReplay ? 200 : 201).json({
        success: true,
        data: result.transaction,
      });
    } catch (error) {
      next(error);
    }
  }

  async void(req: Request, res: Response, next: NextFunction) {
    try {
      const body = voidTransactionSchema.parse(req.body);
      const user = req.user;
      const result = await transactionsService.voidTransaction(req.params.id, body.reason, user);
      res.status(200).json({
        success: true,
        message: result.message,
        data: result.transaction,
      });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await transactionsService.deleteTransaction(req.params.id);
      res.status(200).json({
        success: true,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const transactionsController = new TransactionsController();
