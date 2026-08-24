import { Request, Response, NextFunction } from 'express';
import { partnersService } from './partners.service';

export class PartnersController {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const partner = await partnersService.registerPartner(req.body);
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
      const result = await partnersService.getPartners(req.query as any);
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
      const partner = await partnersService.getPartnerById(req.params.id);
      res.status(200).json({
        success: true,
        data: partner,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const updated = await partnersService.updatePartnerStatus(req.params.id, req.body);
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
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  }
}

export const partnersController = new PartnersController();
