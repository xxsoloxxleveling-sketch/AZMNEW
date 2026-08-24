import { Request, Response, NextFunction } from 'express';
import { attendanceService } from './attendance.service';

export class AttendanceController {
  async scan(req: Request, res: Response, next: NextFunction) {
    try {
      const markedByUserId = req.user?.id || 'system_scanner';
      const result = await attendanceService.scanOrMarkAttendance(req.body, markedByUserId);

      res.status(201).json({
        success: true,
        message: result.message,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getToday(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await attendanceService.getTodayAttendance(req.query as any);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getStudentHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await attendanceService.getStudentAttendanceHistory(req.params.id);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const attendanceController = new AttendanceController();
