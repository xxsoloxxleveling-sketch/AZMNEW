import { NextFunction, Request, Response } from 'express';
import { interviewAssessmentService } from './assessment.service';
import { AssessmentRosterQuery } from './assessment.schema';

function respond(work: (req: Request) => Promise<unknown>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try { res.json({ success: true, data: await work(req) }); } catch (error) { next(error); }
  };
}
export const interviewAssessmentController = {
  roster: respond(req => interviewAssessmentService.roster(req.params.roundId, req.query as unknown as AssessmentRosterQuery)),
  panels: respond(req => interviewAssessmentService.panels(req.params.roundId)),
  savePanel: respond(req => interviewAssessmentService.savePanel(req.params.roundId, Number(req.params.panel), req.body, req.user!)),
  candidate: respond(req => interviewAssessmentService.candidate(req.params.roundId, req.params.placementId)),
  history: respond(req => interviewAssessmentService.history(req.params.roundId, req.params.placementId)),
  save: respond(req => interviewAssessmentService.save(req.params.roundId, req.params.placementId, req.body, req.user!)),
  submit: respond(req => interviewAssessmentService.save(req.params.roundId, req.params.placementId, req.body, req.user!, true)),
  merit: respond(req => interviewAssessmentService.merit(req.params.roundId, req.query.className as string | undefined)),
};
