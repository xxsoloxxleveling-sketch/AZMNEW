import { Request, Response, NextFunction } from 'express';
import { resultsService } from './results.service';
import { officialResultsService } from './official-results.service';
import { examControlService } from '../attendance/examControl.service';
import { verifyAccessToken } from '../../lib/jwt';
import {
  adminResultsPageQuerySchema,
  correctResultSchema,
  createDraftResultSchema,
  createExaminationSchema,
  dmcIssueSchema,
  dmcLegacyReplaceSchema,
  dmcPrepareSchema,
  dmcRevokeSchema,
  examinationPublicationSchema,
  officialExaminationsQuerySchema,
  officialResultsPageQuerySchema,
  bindOfficialAttemptSchema,
} from './results.schema';

function sendPublicResultsUnavailable(res: Response) {
  res.set('Cache-Control', 'private, no-store, max-age=0');
  return res.status(404).json({
    success: false,
    error: {
      code: 'RESULTS_NOT_PUBLISHED',
      message: 'No examination results are currently published.',
    },
  });
}

export class ResultsController {
  constructor() {
    // Express invokes route handlers without a receiver; retain the controller
    // instance for helpers such as actor(), noStore(), and sendPdf().
    this.verifyOfficialDmc = this.verifyOfficialDmc.bind(this);
    this.getOfficialExaminations = this.getOfficialExaminations.bind(this);
    this.getOfficialResults = this.getOfficialResults.bind(this);
    this.getStudentOfficialHistory = this.getStudentOfficialHistory.bind(this);
    this.getOfficialResult = this.getOfficialResult.bind(this);
    this.getOfficialCorrections = this.getOfficialCorrections.bind(this);
    this.createOfficialExamination = this.createOfficialExamination.bind(this);
    this.publishOfficialExamination = this.publishOfficialExamination.bind(this);
    this.createOfficialDraftResult = this.createOfficialDraftResult.bind(this);
    this.correctOfficialResult = this.correctOfficialResult.bind(this);
    this.prepareOfficialDmc = this.prepareOfficialDmc.bind(this);
    this.previewOfficialDmc = this.previewOfficialDmc.bind(this);
    this.issueOfficialDmc = this.issueOfficialDmc.bind(this);
    this.replaceLegacyOfficialDmc = this.replaceLegacyOfficialDmc.bind(this);
    this.getOfficialDmcIssuances = this.getOfficialDmcIssuances.bind(this);
    this.downloadOfficialDmc = this.downloadOfficialDmc.bind(this);
    this.downloadElectronicDmc = this.downloadElectronicDmc.bind(this);
    this.revokeOfficialDmc = this.revokeOfficialDmc.bind(this);
    this.getOfficialAttemptChoices = this.getOfficialAttemptChoices.bind(this);
    this.bindOfficialAttempt = this.bindOfficialAttempt.bind(this);
  }

  private actor(req: Request) {
    if (!req.user) throw Object.assign(new Error('Authentication required.'), { statusCode: 401, code: 'AUTHENTICATION_REQUIRED' });
    return { id: req.user.id, name: req.user.name };
  }

  private noStore(res: Response) {
    res.set('Cache-Control', 'private, no-store, max-age=0');
    res.set('Pragma', 'no-cache');
    res.set('X-Content-Type-Options', 'nosniff');
  }

  private sendPdf(res: Response, pdf: Buffer, filename: string, disposition: 'inline' | 'attachment' = 'inline') {
    this.noStore(res);
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `${disposition}; filename="${filename}"`);
    res.set('Content-Length', String(pdf.length));
    return res.status(200).send(pdf);
  }

  publicResultsUnavailable(_req: Request, res: Response) {
    return sendPublicResultsUnavailable(res);
  }

  async search(_req: Request, res: Response, _next: NextFunction) {
    return sendPublicResultsUnavailable(res);
  }

  async getMeritList(_req: Request, res: Response, _next: NextFunction) {
    return sendPublicResultsUnavailable(res);
  }
  async getAdminSessions(_req: Request, res: Response, next: NextFunction) {
    try {
      const sessions = await resultsService.listAdminResultSessions();
      res.status(200).json({ success: true, data: sessions });
    } catch (error) {
      next(error);
    }
  }

  async getAdminSessionResults(req: Request, res: Response, next: NextFunction) {
    try {
      const query = adminResultsPageQuerySchema.parse(req.query);
      const results = await resultsService.listAdminSessionResults(req.params.sessionId, query);
      res.status(200).json({ success: true, data: results });
    } catch (error) {
      next(error);
    }
  }

  async verifyOfficialDmc(req: Request, res: Response, next: NextFunction) {
    try {
      this.noStore(res);
      const data = await officialResultsService.verifyDmc(req.params.reference);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async getOfficialExaminations(req: Request, res: Response, next: NextFunction) {
    try {
      const query = officialExaminationsQuerySchema.parse(req.query);
      const data = await officialResultsService.listExaminations({ search: query.search, limit: query.limit ?? 100 });
      this.noStore(res);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async getOfficialResults(req: Request, res: Response, next: NextFunction) {
    try {
      const query = officialResultsPageQuerySchema.parse(req.query);
      const data = await officialResultsService.listOfficialResults(query);
      this.noStore(res);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async getStudentOfficialHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await officialResultsService.listStudentResults(req.params.studentId);
      this.noStore(res);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async getOfficialAttemptChoices(req: Request, res: Response, next: NextFunction) {
    try { this.noStore(res); res.status(200).json({success:true,data:await officialResultsService.listStudentAttempts(req.params.studentId)}); }
    catch(error){ next(error); }
  }

  async bindOfficialAttempt(req: Request, res: Response, next: NextFunction) {
    try {
      const input=bindOfficialAttemptSchema.parse(req.body);
      const actor=this.actor(req);
      const tokenVersion=verifyAccessToken(req.get('Authorization')!.split(' ')[1]).tokenVersion;
      const data=await examControlService.bindOfficialResult(req.params.resultId,input.sessionId,input.evidence,actor.id,tokenVersion);
      this.noStore(res); res.status(200).json({success:true,data});
    } catch(error){ next(error); }
  }

  async getOfficialResult(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await officialResultsService.getResult(req.params.resultId);
      this.noStore(res);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async getOfficialCorrections(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await officialResultsService.listCorrectionHistory(req.params.resultId);
      this.noStore(res);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async createOfficialExamination(req: Request, res: Response, next: NextFunction) {
    try {
      const input = createExaminationSchema.parse(req.body);
      const data = await officialResultsService.createExamination(input, this.actor(req));
      this.noStore(res);
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async publishOfficialExamination(req: Request, res: Response, next: NextFunction) {
    try {
      const input = examinationPublicationSchema.parse(req.body);
      const data = await officialResultsService.publishExamination(req.params.examId, input, this.actor(req));
      this.noStore(res);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async createOfficialDraftResult(req: Request, res: Response, next: NextFunction) {
    try {
      const input = createDraftResultSchema.parse(req.body);
      const data = await officialResultsService.createDraftResult(req.params.examId, input, this.actor(req));
      this.noStore(res);
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async correctOfficialResult(req: Request, res: Response, next: NextFunction) {
    try {
      const input = correctResultSchema.parse(req.body);
      const data = await officialResultsService.correctResult(req.params.resultId, input, this.actor(req));
      this.noStore(res);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async prepareOfficialDmc(req: Request, res: Response, next: NextFunction) {
    try {
      const input = dmcPrepareSchema.parse(req.body);
      const data = await officialResultsService.prepareOfficialDmc(req.params.resultId, input.expectedRevision, this.actor(req));
      this.noStore(res);
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async previewOfficialDmc(req: Request, res: Response, next: NextFunction) {
    try {
      const { pdf, documentNumber } = await officialResultsService.renderOfficialPreparationPreview(req.params.resultId, req.params.preparationId, this.actor(req));
      return this.sendPdf(res, pdf, `${documentNumber}.pdf`);
    } catch (error) {
      next(error);
    }
  }

  async issueOfficialDmc(req: Request, res: Response, next: NextFunction) {
    try {
      const input = dmcIssueSchema.parse(req.body);
      const data = await officialResultsService.issueOfficialDmc(req.params.resultId, {
        preparationId: input.preparationId!,
        expectedRevision: input.expectedRevision!,
        idempotencyKey: input.idempotencyKey!,
      }, this.actor(req));
      this.noStore(res);
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async replaceLegacyOfficialDmc(req: Request, res: Response, next: NextFunction) {
    try {
      const input = dmcLegacyReplaceSchema.parse(req.body);
      const data = await officialResultsService.replaceLegacyOfficialDmc(
        req.params.resultId, req.params.issuanceId, input, this.actor(req),
      );
      this.noStore(res);
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async getOfficialDmcIssuances(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await officialResultsService.listOfficialDmcIssuances(req.params.resultId);
      this.noStore(res);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async downloadOfficialDmc(req: Request, res: Response, next: NextFunction) {
    try {
      const { pdf, filename } = await officialResultsService.renderOfficialDmc(req.params.resultId, req.params.issuanceId);
      return this.sendPdf(res, pdf, filename);
    } catch (error) {
      next(error);
    }
  }

  async downloadElectronicDmc(req: Request, res: Response, next: NextFunction) {
    try {
      const { pdf, filename } = await officialResultsService.renderElectronicDmc(req.params.resultId);
      return this.sendPdf(res, pdf, filename);
    } catch (error) {
      next(error);
    }
  }

  async revokeOfficialDmc(req: Request, res: Response, next: NextFunction) {
    try {
      const input = dmcRevokeSchema.parse(req.body);
      const data = await officialResultsService.revokeOfficialDmc(req.params.resultId, req.params.issuanceId, input.reason, this.actor(req));
      this.noStore(res);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

export const resultsController = new ResultsController();
