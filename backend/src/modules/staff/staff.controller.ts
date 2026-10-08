import { Request, Response, NextFunction } from 'express';
import { staffService } from './staff.service';
import { StaffQueryInput } from './staff.schema';

export class StaffController {
  async paySalaryOnce(req: Request, res: Response, next: NextFunction) {
    try {
      const key = req.get('Idempotency-Key')?.trim();
      if (!key || key.length > 200 || /[^\x21-\x7e]/.test(key)) {
        res.status(400).json({ success: false, message: 'A valid Idempotency-Key (1–200 characters) is required.' }); return;
      }
      const payment = await staffService.paySalaryOnce(req.params.id, req.body, { userId: req.user!.id, name: req.user!.name, email: req.user!.email }, key);
      res.set('Cache-Control', 'no-store');
      res.status(201).json({ success: true, data: payment });
    } catch (error) { next(error); }
  }

  async exportTeachers(req: Request, res: Response, next: NextFunction) {
    try {
      if (req.query.format && !['csv', 'json'].includes(String(req.query.format))) {
        res.status(400).json({ success: false, message: 'Supported formats: csv, json.' }); return;
      }
      const teachers = await staffService.exportTeachers();
      if (req.query.format === 'csv') {
        const textCell = (v: unknown) => { const value = String(v ?? ''); return '"' + (/^[=+\-@\t\r\n]/.test(value) || /^[0-9]/.test(value) ? "'" + value : value).replace(/"/g, '""') + '"'; };
        const rows = [['Staff ID','Full Name','Designation','Phone','Masked CNIC','Date Joined','Staff Status','Default Salary Amount','Portal Email','Portal Account Status','Created Date'], ...teachers.map(s => [s.id,s.fullName,s.role,s.phone,s.cnic,s.joinDate.toISOString(),s.status,s.salary,s.portalAccount?.email || 'Not created',s.portalAccount?.status || 'No account',s.createdAt.toISOString()])];
        const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date());
        res.set('Cache-Control','no-store');
        res.set('Content-Disposition', 'attachment; filename="AZMAIO_Teacher_Directory_' + date + '.csv"');
        res.type('text/csv; charset=utf-8').send('\uFEFF' + rows.map(row => row.map(textCell).join(',')).join('\r\n')); return;
      }
      res.set('Cache-Control','no-store').json({ success: true, data: { teachers } });
    } catch (error) { next(error); }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const staff = await staffService.createStaff(req.body);
      res.set('Cache-Control', 'no-store');
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
      const result = await staffService.getStaffList(req.query as unknown as StaffQueryInput);
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
