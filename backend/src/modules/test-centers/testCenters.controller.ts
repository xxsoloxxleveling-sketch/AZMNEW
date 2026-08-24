import { Request, Response, NextFunction } from 'express';
import { testCentersService } from './testCenters.service';

export class TestCentersController {
  async getAll(_req: Request, res: Response, next: NextFunction) {
    try {
      const centers = await testCentersService.getTestCenters();
      res.status(200).json({
        success: true,
        data: centers,
      });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const center = await testCentersService.getTestCenterById(req.params.id);
      res.status(200).json({
        success: true,
        data: center,
      });
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const center = await testCentersService.createTestCenter(req.body);
      res.status(201).json({
        success: true,
        message: 'Test center created successfully',
        data: center,
      });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const updated = await testCentersService.updateTestCenter(req.params.id, req.body);
      res.status(200).json({
        success: true,
        message: 'Test center updated successfully',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await testCentersService.deleteTestCenter(req.params.id);
      res.status(200).json({
        success: true,
        message: 'Test center deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const testCentersController = new TestCentersController();
