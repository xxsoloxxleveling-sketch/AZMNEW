import { Request, Response, NextFunction } from 'express';
import { examHallsService } from './examHalls.service';

export class ExamHallsController {
  async getAll(_req: Request, res: Response, next: NextFunction) {
    try {
      const halls = await examHallsService.getExamHalls();
      res.status(200).json({
        success: true,
        data: halls,
      });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const hall = await examHallsService.getExamHallById(req.params.id);
      res.status(200).json({
        success: true,
        data: hall,
      });
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const hall = await examHallsService.createExamHall(req.body);
      res.status(201).json({
        success: true,
        message: 'Exam hall created successfully',
        data: hall,
      });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const updated = await examHallsService.updateExamHall(req.params.id, req.body);
      res.status(200).json({
        success: true,
        message: 'Exam hall updated successfully',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await examHallsService.deleteExamHall(req.params.id);
      res.status(200).json({
        success: true,
        message: 'Exam hall deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async batchAssign(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await examHallsService.batchAssign(req.params.id, req.body);
      res.status(200).json({
        success: true,
        message: `Successfully allocated candidates to hall`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateStudentAllocation(req: Request, res: Response, next: NextFunction) {
    try {
      const updated = await examHallsService.updateStudentAllocation(req.params.studentId, req.body);
      res.status(200).json({
        success: true,
        message: 'Student allocation updated successfully',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  async unassignStudent(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await examHallsService.unassignStudent(req.params.studentId);
      res.status(200).json({
        success: true,
        message: 'Student unassigned from hall successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const examHallsController = new ExamHallsController();
