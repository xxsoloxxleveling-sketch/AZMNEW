import { Request, Response, NextFunction } from 'express';
import { studentsService } from './students.service';

export class StudentsController {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const student = await studentsService.createStudent(req.body);
      res.status(201).json({
        success: true,
        message: 'Candidate registration submitted successfully',
        data: student,
      });
    } catch (error) {
      next(error);
    }
  }

  async adminRegister(req: Request, res: Response, next: NextFunction) {
    try {
      const student = await studentsService.createStudent(req.body);
      res.status(201).json({
        success: true,
        message: 'Student registered by administration successfully',
        data: student,
      });
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const student = await studentsService.createStudent(req.body);
      res.status(201).json({
        success: true,
        message: 'Student created successfully',
        data: student,
      });
    } catch (error) {
      next(error);
    }
  }

  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await studentsService.getStudents(req.query as any);
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
      const student = await studentsService.getStudentById(req.params.id);
      res.status(200).json({
        success: true,
        data: student,
      });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const updated = await studentsService.updateStudent(req.params.id, req.body);
      res.status(200).json({
        success: true,
        message: 'Student updated successfully',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  async approvePayment(req: Request, res: Response, next: NextFunction) {
    try {
      const student = await studentsService.approvePayment(req.params.id);
      res.status(200).json({
        success: true,
        message: 'Student registration payment approved successfully. Roll number is pending batch release.',
        data: student,
      });
    } catch (error) {
      next(error);
    }
  }

  async getRollNumberStatus(_req: Request, res: Response, next: NextFunction) {
    try {
      const status = await studentsService.getRollNumberStatus();
      res.status(200).json({
        success: true,
        data: status,
      });
    } catch (error) {
      next(error);
    }
  }

  async issueRollNumbers(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await studentsService.issueRollNumbers(req.body);
      res.status(200).json({
        success: true,
        message: result.message,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateOfficeUse(req: Request, res: Response, next: NextFunction) {
    try {
      const officeRecord = await studentsService.updateOfficeUse(req.params.id, req.body);
      res.status(200).json({
        success: true,
        message: 'Office use record updated successfully',
        data: officeRecord,
      });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await studentsService.deleteStudent(req.params.id);
      res.status(200).json({
        success: true,
        message: 'Student deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async getQr(req: Request, res: Response, next: NextFunction) {
    try {
      const qrData = await studentsService.getStudentQr(req.params.id);

      if (req.query.format === 'image') {
        res.setHeader('Content-Type', 'image/png');
        res.setHeader(
          'Content-Disposition',
          `inline; filename="qr-${qrData.student.rollNumber || 'code'}.png"`
        );
        return res.send(qrData.qrBuffer);
      }

      res.status(200).json({
        success: true,
        data: {
          studentId: qrData.student.id,
          fullName: qrData.student.fullName,
          rollNumber: qrData.student.rollNumber,
          qrToken: qrData.qrToken,
          qrImageUrl: qrData.qrImageUrl,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async getRegistrationPdf(req: Request, res: Response, next: NextFunction) {
    try {
      const { buffer, filename } = await studentsService.generateRegistrationPdf(req.params.id);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', buffer.length);
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  }

  async uploadDocument(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await studentsService.uploadStudentDocument(req.body);
      res.status(200).json({
        success: true,
        message: 'Document uploaded to Supabase Storage successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async serveDocument(req: Request, res: Response, next: NextFunction) {
    try {
      const { id, docType } = req.params;
      const doc = await studentsService.getStudentDocument(id, docType);
      
      res.setHeader('Content-Type', doc.contentType || 'image/jpeg');
      res.setHeader('Content-Length', doc.buffer.length);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.send(doc.buffer);
    } catch (error) {
      next(error);
    }
  }

  async getReleaseConfig(_req: Request, res: Response, next: NextFunction) {
    try {
      const config = await studentsService.getReleaseConfig();
      res.status(200).json({
        success: true,
        data: config,
      });
    } catch (error) {
      next(error);
    }
  }

  async saveReleaseConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const config = await studentsService.saveReleaseConfig(req.body);
      res.status(200).json({
        success: true,
        message: 'Roll number release schedule updated successfully.',
        data: config,
      });
    } catch (error) {
      next(error);
    }
  }

  async searchPublicSlip(req: Request, res: Response, next: NextFunction) {
    try {
      const query = String(req.query.query || req.body?.query || '');
      const result = await studentsService.searchPublicSlip(query);
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async purgeAll(_req: Request, res: Response, next: NextFunction) {
    try {
      const result = await studentsService.purgeAllData();
      res.status(200).json({
        success: true,
        message: 'All system data and storage attachments have been purged successfully.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const studentsController = new StudentsController();
