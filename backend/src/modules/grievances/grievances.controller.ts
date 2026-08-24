import { Request, Response, NextFunction } from 'express';
import { grievancesService } from './grievances.service';

export class GrievancesController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const ticket = await grievancesService.createGrievance(req.body);
      res.status(201).json({
        success: true,
        message: 'Grievance ticket registered successfully',
        data: {
          id: ticket.id,
          ticketId: ticket.ticketId,
          status: ticket.status,
          createdAt: ticket.createdAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const tickets = await grievancesService.getGrievances({
        status: req.query.status as string,
        category: req.query.category as string,
        search: req.query.search as string,
      });
      res.status(200).json({
        success: true,
        data: tickets,
      });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const ticket = await grievancesService.getGrievanceById(req.params.id);
      res.status(200).json({
        success: true,
        data: ticket,
      });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const updated = await grievancesService.updateGrievance(req.params.id, req.body);
      res.status(200).json({
        success: true,
        message: 'Grievance ticket updated successfully',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const grievancesController = new GrievancesController();
