import { Request, Response, NextFunction } from 'express';
import { attendanceService } from './attendance.service';
import { sessionQuerySchema, rosterQuerySchema } from './attendance.schema';

function operator(req: Request): string {
  if (!req.user?.id) throw Object.assign(new Error('Authenticated attendance operator is required.'), { statusCode: 401 });
  return req.user.id;
}
export class AttendanceController {
  private async respond(res: Response, next: NextFunction, work: () => Promise<unknown>, status = 200) {
    try { const data = await work(); res.status(status).json({ success: true, data }); } catch (error) { next(error); }
  }
  open = (req: Request, res: Response, next: NextFunction) => this.respond(res, next, () => attendanceService.openSession(req.body.examHallId, operator(req)), 201);
  list = (req: Request, res: Response, next: NextFunction) => this.respond(res, next, () => attendanceService.listSessions(sessionQuerySchema.parse(req.query)));
  detail = (req: Request, res: Response, next: NextFunction) => this.respond(res, next, () => attendanceService.getSession(req.params.sessionId));
  candidates = (req: Request, res: Response, next: NextFunction) => this.respond(res, next, () => attendanceService.getCandidates(req.params.sessionId, rosterQuerySchema.parse(req.query)));
  mark = (req: Request, res: Response, next: NextFunction) => this.respond(res, next, () => attendanceService.mark(req.params.sessionId, req.body, operator(req)), 201);
  close = (req: Request, res: Response, next: NextFunction) => this.respond(res, next, () => attendanceService.closeSession(req.params.sessionId, req.body.markRemainingAbsent, operator(req)));
  scan = (req: Request, res: Response, next: NextFunction) => this.respond(res, next, () => attendanceService.scanOrMarkAttendance(req.body, operator(req)), 201);
  getToday = (_req: Request, res: Response, next: NextFunction) => this.respond(res, next, () => attendanceService.getTodayAttendance());
  getStudentHistory = (req: Request, res: Response, next: NextFunction) => this.respond(res, next, () => attendanceService.getStudentAttendanceHistory(req.params.id, rosterQuerySchema.parse(req.query)));
}
export const attendanceController = new AttendanceController();
