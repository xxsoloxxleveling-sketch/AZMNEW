import { Request, Response, NextFunction } from 'express';
import { spawn } from 'child_process';
import { studentsService } from './students.service';
import { correctPublishedProvisionalOmrMark, getProvisionalMarkCorrectionHistory, verifyPublishedOmrMark } from './provisionalOmrMarks';
import { addManualExamMark, verifyManualExamMark } from './manualExamMarks';
import { correctManualExamMark, getManualMarkCorrectionHistory } from './manualExamMarkCorrections';
import { generateVerifiedEdmcPdf } from './verifiedEdmcPdf';
import { signUploadSessionToken, verifyAccessToken, verifyUploadSessionToken } from '../../lib/jwt';

let thumbnailBackfillJob: {
  status: 'idle' | 'running' | 'completed' | 'failed';
  summary?: Record<string, unknown>;
  error?: string;
} = { status: 'idle' };

export class StudentsController {
  private async hasCandidateOrStaffAccess(req: Request, studentIdentifier: string): Promise<boolean> {
    const authorization = String(req.headers.authorization || '');
    if (authorization.startsWith('Bearer ')) {
      try {
        verifyAccessToken(authorization.slice(7));
        return true;
      } catch {}
    }
    const cnic = String(
      req.headers['x-candidate-cnic'] ||
      req.headers['x-candidate-key'] ||
      req.body?.cnic ||
      ''
    );
    return studentsService.verifyCandidateIdentity(studentIdentifier, cnic);
  }
  async startThumbnailBackfill(_req: Request, res: Response, next: NextFunction) {
    try {
      if (thumbnailBackfillJob.status === 'running') {
        return res.status(409).json({ success: false, error: { message: 'Thumbnail generation is already running.' } });
      }

      thumbnailBackfillJob = { status: 'running' };
      const child = spawn('npx', ['tsx', 'scripts/backfill-student-thumbnails.ts', '--apply'], {
        cwd: process.cwd(),
        env: process.env,
        shell: process.platform === 'win32',
      });
      let output = '';
      let errorOutput = '';
      child.stdout.on('data', (chunk) => { output += chunk.toString(); });
      child.stderr.on('data', (chunk) => { errorOutput += chunk.toString(); });
      child.on('error', (error) => {
        thumbnailBackfillJob = { status: 'failed', error: error.message };
      });
      child.on('close', (code) => {
        const summaryMatch = output.match(/\{[\s\S]*\}\s*$/);
        let summary: Record<string, unknown> | undefined;
        try {
          summary = summaryMatch ? JSON.parse(summaryMatch[0]) : undefined;
        } catch {}
        thumbnailBackfillJob = code === 0
          ? { status: 'completed', summary }
          : { status: 'failed', summary, error: errorOutput.trim() || 'Thumbnail generation did not complete.' };
      });
      return res.status(202).json({
        success: true,
        message: 'Private profile thumbnail generation has started. You can keep using the portal.',
        data: thumbnailBackfillJob,
      });
    } catch (error) {
      next(error);
    }
  }

  async getThumbnailBackfillStatus(_req: Request, res: Response, next: NextFunction) {
    try {
      return res.status(200).json({ success: true, data: thumbnailBackfillJob });
    } catch (error) {
      next(error);
    }
  }

  async createUploadSession(req: Request, res: Response, next: NextFunction) {
    try {
      const candidateKey = String(req.body?.cnicOrBForm || '').trim();
      if (!/^[A-Za-z0-9-]{5,30}$/.test(candidateKey)) {
        return res.status(400).json({
          success: false,
          error: { message: 'Enter a valid CNIC or B-Form before uploading documents.' },
        });
      }

      return res.status(201).json({
        success: true,
        data: {
          token: signUploadSessionToken(candidateKey),
          expiresInSeconds: 900,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async register(req: Request, res: Response, next: NextFunction) {
    try {
      // Online registration must never create a record unless every required
      // attachment is confirmed in private Storage.
      const student = await studentsService.createStudent({ ...req.body, requireCompleteDocuments: true });
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

  async getSchoolOptions(_req: Request, res: Response, next: NextFunction) {
    try {
      const names = await studentsService.getSchoolOptions();
      res.set('Cache-Control', 'private, no-store');
      res.status(200).json({ success: true, data: names });
    } catch (error) {
      next(error);
    }
  }

  async getDocumentMetadata(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await studentsService.getDocumentMetadata(req.query as any);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async exportPdf(req: Request, res: Response, next: NextFunction) {
    try {
      const { buffer, filename } = await studentsService.exportStudentsPdf(req.query as any);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', buffer.length);
      res.status(200).send(buffer);
    } catch (error) {
      next(error);
    }
  }

  async exportAllPdf(_req: Request, res: Response, next: NextFunction) {
    try {
      const { buffer, filename } = await studentsService.exportAllStudentsPdf();
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', buffer.length);
      res.status(200).send(buffer);
    } catch (error) {
      next(error);
    }
  }

  async exportSelectedPdf(req: Request, res: Response, next: NextFunction) {
    try {
      const { buffer, filename } = await studentsService.exportStudentsPdf(
        { page: 1, limit: 250 },
        req.body.studentIds
      );
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', buffer.length);
      res.status(200).send(buffer);
    } catch (error) {
      next(error);
    }
  }

  async getProvisionalMarkCorrectionHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const history = await getProvisionalMarkCorrectionHistory(req.params.id);
      res.set('Cache-Control', 'private, no-store');
      res.status(200).json({ success: true, data: history });
    } catch (error) {
      next(error);
    }
  }

  async addManualExamMarks(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: { message: 'Login required.' } });
      }
      const result = await addManualExamMark(
        req.params.id,
        req.body.obtainedMarks,
        req.body.evidenceReference,
        req.body.reason,
        req.body.identityReviewed,
        req.body.attendanceReviewed,
        req.user.id,
      );
      res.set('Cache-Control', 'private, no-store, max-age=0');
      return res.status(201).json({
        success: true,
        message: 'Manual examination marks recorded for review. No existing marks were changed.',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  async verifyManualExamMark(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: { message: 'Login required.' } });
      }
      const receipt = await verifyManualExamMark(
        req.params.id,
        req.body.expectedCurrentMarks,
        req.body.evidenceReference,
        req.body.reason,
        req.body.identityReviewed,
        req.body.attendanceReviewed,
        req.body.marksEvidenceReviewed,
        req.user.id,
      );
      res.set('Cache-Control', 'private, no-store, max-age=0');
      return res.status(201).json({
        success: true,
        message: 'Manual examination marks verified. The original score and audit history are unchanged.',
        data: receipt,
      });
    } catch (error) {
      return next(error);
    }
  }

  async getManualMarkCorrectionHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const rows = await getManualMarkCorrectionHistory(req.params.id);
      res.set('Cache-Control', 'private, no-store, max-age=0');
      return res.status(200).json({ success: true, data: rows });
    } catch (error) { return next(error); }
  }

  async correctManualExamMark(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return res.status(401).json({ success: false, error: { message: 'Login required.' } });
      const receipt = await correctManualExamMark(
        req.params.id, req.body.expectedCurrentMarks, req.body.newMarks,
        req.body.expectedCorrectionId, req.body.evidenceReference, req.body.reason,
        req.body.identityReviewed, req.body.attendanceReviewed, req.user.id,
      );
      res.set('Cache-Control', 'private, no-store, max-age=0');
      return res.status(200).json({
        success: true,
        message: 'Correction saved with immutable history. Approve the new score before issuing an updated E-DMC.',
        data: receipt,
      });
    } catch (error) { return next(error); }
  }

  async correctProvisionalOmrMarks(req: Request, res: Response, next: NextFunction) {
    try {
      // The route requires an authenticated SUPER_ADMIN; the SQL function
      // independently verifies the actor and writes the immutable audit.
      if (!req.user) return res.status(401).json({ success: false, error: { message: 'Login required.' } });
      const changed = await correctPublishedProvisionalOmrMark(
        req.params.id,
        req.body.expectedCurrentMarks,
        req.body.newMarks,
        req.body.reason,
        req.user.id,
      );
      res.set('Cache-Control', 'private, no-store');
      res.status(200).json({
        success: true,
        message: 'Provisional marks corrected and audit entry saved.',
        data: changed,
      });
    } catch (error) {
      next(error);
    }
  }

  async downloadVerifiedEdmc(req: Request, res: Response, next: NextFunction) {
    try {
      const { buffer, filename } = await generateVerifiedEdmcPdf(req.params.id);
      res.set('Cache-Control', 'private, no-store, max-age=0');
      res.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
      res.set('Content-Type', 'application/pdf');
      res.set('Content-Disposition', 'attachment; filename="' + filename + '"');
      res.set('Content-Length', String(buffer.length));
      res.status(200).send(buffer);
    } catch (error) {
      next(error);
    }
  }

  async verifySelectedOmrMarks(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return res.status(401).json({ success: false, error: { message: 'Login required.' } });
      const { students, evidenceReference, reason, identityReviewed, paperVersionReviewed, printedClassReviewed } = req.body;
      const verified: Array<{ studentId: string; verifiedMarks: number; verificationId: string }> = [];
      const failed: Array<{ studentId: string; message: string }> = [];
      // The existing security-definer RPC verifies the actor and sealed revision
      // for every student independently, preserving each immutable audit.
      for (const student of students as Array<{ studentId: string; expectedCurrentMarks: number }>) {
        try {
          const receipt = await verifyPublishedOmrMark(
            student.studentId, student.expectedCurrentMarks,
            evidenceReference, reason, identityReviewed,
            paperVersionReviewed, printedClassReviewed, req.user.id,
          );
          verified.push({ studentId: student.studentId, verifiedMarks: receipt.verifiedMarks, verificationId: receipt.verificationId });
        } catch (error) {
          const status = (error as { statusCode?: number }).statusCode;
          const message = status && status >= 400 && status < 500
            ? (error as Error).message
            : 'Verification could not be completed. Review this student separately.';
          failed.push({ studentId: student.studentId, message });
        }
      }
      res.set('Cache-Control', 'private, no-store');
      res.status(200).json({
        success: true,
        data: { verified, failed, total: students.length },
        message: 'Selected student verification completed.',
      });
    } catch (error) {
      next(error);
    }
  }

  async verifyOmrMark(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return res.status(401).json({ success: false, error: { message: 'Login required.' } });
      const verified = await verifyPublishedOmrMark(
        req.params.id,
        req.body.expectedCurrentMarks,
        req.body.evidenceReference,
        req.body.reason,
        req.body.identityReviewed,
        req.body.paperVersionReviewed,
        req.body.printedClassReviewed,
        req.user.id,
      );
      res.set('Cache-Control', 'private, no-store');
      res.status(200).json({
        success: true,
        message: 'Final obtained marks verified with an immutable evidence record.',
        data: verified,
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
      const updated = await studentsService.updateStudent(req.params.id, req.body,
        req.user ? { userId: req.user.id, name: req.user.name, role: req.user.role } : undefined);
      res.status(200).json({
        success: true,
        message: 'Student updated successfully',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  async printReadiness(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ success: true, data: await studentsService.getPrintReadiness(req.body.studentIds) });
    } catch (error) { next(error); }
  }

  async approvePayment(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user;
      const actor = user
        ? { id: user.id, name: user.name || null, email: user.email }
        : undefined;
      const idempotencyKey = (req.headers['idempotency-key'] ||
        req.headers['x-idempotency-key']) as string | undefined;

      const student = await studentsService.approvePayment(
        req.params.id,
        actor,
        idempotencyKey
      );
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

  async deletionProtection(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(200).json({ success: true, data: await studentsService.getDeletionProtection(req.params.id) });
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
      if (!(await this.hasCandidateOrStaffAccess(req, req.params.id))) {
        return res.status(401).json({
          success: false,
          error: { message: 'Enter the matching CNIC / B-Form to access this QR code.' },
        });
      }

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

  getRegistrationPdf = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!(await this.hasCandidateOrStaffAccess(req, req.params.id))) {
        return res.status(401).json({ success: false, error: { message: 'Enter the matching CNIC / B-Form to download this slip.' } });
      }
      const { buffer, filename } = await studentsService.generateRegistrationPdf(req.params.id);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', buffer.length);
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  }

  async getRollSlipPdf(req: Request, res: Response, next: NextFunction) {
    try {
      const { buffer, filename } = await studentsService.getRollSlipPdf(req.params.id);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', buffer.length);
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  }

  async preparePrint(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ success: true, data: await studentsService.preparePrintStudent(req.params.id) });
    } catch (error) { next(error); }
  }

  async getOmrSheetPdf(req: Request, res: Response, next: NextFunction) {
    try {
      const { buffer, filename } = await studentsService.getOmrSheetPdf(req.params.id);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', buffer.length);
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  }

  async getBulkOmrPdf(req: Request, res: Response, next: NextFunction) {
    try {
      const studentIds = Array.isArray(req.body?.studentIds) ? req.body.studentIds : [];
      const { buffer, filename } = await studentsService.getBulkOmrPdf(studentIds);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', buffer.length);
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  }

  async getBulkRollSlipsPdf(req: Request, res: Response, next: NextFunction) {
    try {
      const studentIds = Array.isArray(req.body?.studentIds) ? req.body.studentIds : [];
      const { buffer, filename } = await studentsService.getBulkRollSlipsPdf(studentIds);

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
      const candidateKey = String(req.body?.cnicOrBForm || '').trim();
      const authorization = String(req.headers.authorization || '');
      let authorizedAdmin = false;
      if (authorization.startsWith('Bearer ')) {
        try {
          verifyAccessToken(authorization.slice(7));
          authorizedAdmin = true;
        } catch {}
      }

      if (!authorizedAdmin) {
        const token = String(req.headers['x-upload-session'] || req.body?.uploadSessionToken || '');
        try {
          const session = verifyUploadSessionToken(token);
          if (!candidateKey || session.candidateKey !== candidateKey) {
            throw new Error('Candidate does not match upload session');
          }
        } catch {
          return res.status(401).json({
            success: false,
            error: { message: 'A valid, matching upload session is required.' },
          });
        }
      }

      const result = await studentsService.uploadStudentDocument(req.body);
      res.status(200).json({
        success: true,
        message: 'Document uploaded to Supabase Storage successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  async uploadDocumentBinary(req: Request, res: Response, next: NextFunction) {
    try {
      const candidateKey = String(req.headers['x-candidate-key'] || '').trim();
      const docType = String(req.headers['x-document-type'] || '');
      const authorization = String(req.headers.authorization || '');
      let authorizedAdmin = false;
      if (authorization.startsWith('Bearer ')) {
        try {
          verifyAccessToken(authorization.slice(7));
          authorizedAdmin = true;
        } catch {}
      }

      if (!authorizedAdmin) {
        try {
          const session = verifyUploadSessionToken(String(req.headers['x-upload-session'] || ''));
          if (!candidateKey || session.candidateKey !== candidateKey) throw new Error('Session mismatch');
        } catch {
          return res.status(401).json({
            success: false,
            error: { message: 'A valid, matching upload session is required.' },
          });
        }
      }

      if (!/^(photo|photoThumbnail|bform|fatherCnic|dmc(?:_\d+)?|domicile|paymentReceipt|income|signature)$/.test(docType)) {
        return res.status(400).json({ success: false, error: { message: 'Unsupported document type' } });
      }
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        return res.status(400).json({ success: false, error: { message: 'Binary file body is required.' } });
      }

      const result = await studentsService.uploadStudentDocument({
        cnicOrBForm: candidateKey,
        docType,
        fileName: decodeURIComponent(String(req.headers['x-file-name'] || `${docType}.bin`)),
        fileData: req.body.toString('base64'),
        contentType: String(req.headers['content-type'] || 'application/octet-stream'),
      });
      return res.status(200).json({
        success: true,
        message: 'Document uploaded to private Storage successfully',
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
      res.setHeader('Cache-Control', 'private, no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
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

  async lookupProvisionalOmrMarks(req: Request, res: Response, next: NextFunction) {
    try {
      res.set('Cache-Control', 'private, no-store, max-age=0');
      res.set('Pragma', 'no-cache');
      const result = await studentsService.lookupProvisionalOmrMarks(req.body.cnic);
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async searchPublicSlip(req: Request, res: Response, next: NextFunction) {
    try {
      const query = String(req.body?.query || req.body?.rollNo || req.body?.applicationNo || '').trim();
      const cnic = String(
        req.headers['x-candidate-cnic'] ||
        req.headers['x-candidate-key'] ||
        req.body?.cnic ||
        ''
      ).trim();
      if (!cnic) {
        return res.status(400).json({
          success: false,
          error: 'Matching CNIC / B-Form is required.',
        });
      }
      const result = await studentsService.searchPublicSlip(query || undefined, cnic);
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async findPublicRegistration(req: Request, res: Response, next: NextFunction) {
    try {
      const applicationNo = String(req.body?.applicationNo || req.body?.applicationNumber || '');
      const cnic = String(
        req.headers['x-candidate-cnic'] ||
        req.headers['x-candidate-key'] ||
        req.body?.cnic ||
        ''
      );
      if (!applicationNo || !cnic) {
        return res.status(400).json({
          success: false,
          error: 'Application Number and matching CNIC / B-Form are required.',
        });
      }
      return res.status(200).json(await studentsService.findPublicRegistration(applicationNo, cnic));
    } catch (error) {
      next(error);
    }
  }

  serveCandidatePhoto = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!(await this.hasCandidateOrStaffAccess(req, req.params.id))) {
        return res.status(401).json({ success: false, error: { message: 'Enter the matching CNIC / B-Form to view this photo.' } });
      }
      req.params.docType = 'photoThumbnail';
      return this.serveDocument(req, res, next);
    } catch (error) {
      next(error);
    }
  };


}

export const studentsController = new StudentsController();
