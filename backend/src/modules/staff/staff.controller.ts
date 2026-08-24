import { Request, Response, NextFunction } from 'express';
import { staffService } from './staff.service';

export class StaffController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const staff = await staffService.createStaff(req.body);
      res.status(201).json({
        success: true,
        message: 'Staff member registered successfully',
        data: staff,
      });
    } catch (error) {
      next(error);
    }
  }

  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await staffService.getStaffList(req.query as any);
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
      const staff = await staffService.getStaffById(req.params.id);
      res.status(200).json({
        success: true,
        data: staff,
      });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const updated = await staffService.updateStaff(req.params.id, req.body);
      res.status(200).json({
        success: true,
        message: 'Staff details updated successfully',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await staffService.deleteStaff(req.params.id);
      res.status(200).json({
        success: true,
        message: 'Staff record deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const staffController = new StaffController();
