import { Request, Response, NextFunction } from 'express';
import { partnersService } from './partners.service';
import { partnerQuerySchema } from './partners.schema';

export class PartnersController {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const idempotencyKey = (req.headers['idempotency-key'] || req.headers['x-idempotency-key']) as string | undefined;
      const partner = await partnersService.registerPartner(req.body, idempotencyKey);
      res.status(201).json({
        success: true,
        message: 'Partner institution registered successfully',
        data: partner,
      });
    } catch (error) {
      next(error);
    }
  }

  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const validatedQuery = partnerQuerySchema.parse(req.query);
      const result = await partnersService.getPartners(validatedQuery);
      res.status(200).json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const partner = await partnersService.getPartnerById(req.params.id);
      res.status(200).json({
        success: true,
        data: partner,
      });
    } catch (error) {
      next(error);
    }
  }

  async getStatusHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const history = await partnersService.getStatusHistory(req.params.id);
      res.status(200).json({
        success: true,
        data: history,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const updated = await partnersService.updatePartnerStatus(req.params.id, req.body, user);
      res.status(200).json({
        success: true,
        message: 'Partner institution status updated successfully',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  async getRegistrationPdf(req: Request, res: Response, next: NextFunction) {
    try {
      const { buffer, filename } = await partnersService.generatePartnerRegistrationPdf(
        req.params.id
      );

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', buffer.length);
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  }
}

export const partnersController = new PartnersController();

