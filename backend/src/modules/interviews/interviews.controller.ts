import { Request, Response, NextFunction } from 'express';
import { interviewsService } from './interviews.service';
import {
  AutoAllocateCommitInput, AutoAllocatePreviewInput, CandidateQuery, CreateAssignmentsInput,
  CreateHallInput, CreateRoundInput, LockAssignmentInput, RemoveAssignmentInput,
  UnlockAssignmentInput, UpdateAssignmentInput, UpdateHallInput,
} from './interviews.schema';

type Work = (req: Request) => Promise<unknown>;
function respond(status: number, work: Work) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(status).json({ success: true, data: await work(req) });
    } catch (error) {
      next(error);
    }
  };
}
const actor = (req: Request) => req.user!;

export const interviewsController = {
  listRounds: respond(200, () => interviewsService.listRounds()),
  createRound: respond(201, req => interviewsService.createRound(req.body as CreateRoundInput, actor(req))),
  overview: respond(200, req => interviewsService.getOverview(req.params.roundId)),
  candidates: respond(200, req => interviewsService.listCandidates(req.params.roundId, req.query as unknown as CandidateQuery)),
  halls: respond(200, req => interviewsService.listHalls(req.params.roundId)),
  createHall: respond(201, req => interviewsService.createHall(req.params.roundId, req.body as CreateHallInput, actor(req))),
  updateHall: respond(200, req => interviewsService.updateHall(req.params.hallId, req.body as UpdateHallInput, actor(req))),
  createAssignments: respond(201, req => interviewsService.createAssignments(req.params.roundId, req.body as CreateAssignmentsInput, actor(req))),
  moveAssignment: respond(200, req => interviewsService.moveAssignment(req.params.assignmentId, req.body as UpdateAssignmentInput, actor(req))),
  lockAssignment: respond(200, req => interviewsService.lockAssignment(req.params.assignmentId, req.body as LockAssignmentInput, actor(req))),
  unlockAssignment: respond(200, req => interviewsService.unlockAssignment(req.params.assignmentId, req.body as UnlockAssignmentInput, actor(req))),
  removeAssignment: respond(200, req => interviewsService.removeAssignment(req.params.assignmentId, req.body as RemoveAssignmentInput, actor(req))),
  previewAutoAllocation: respond(200, req => interviewsService.previewAutoAllocation(
    req.params.roundId, (req.body as AutoAllocatePreviewInput).strategy,
  )),
  commitAutoAllocation: respond(200, req => interviewsService.commitAutoAllocation(
    req.params.roundId, req.body as AutoAllocateCommitInput, actor(req),
  )),
  publishRound: respond(200, req => interviewsService.publishRound(req.params.roundId, actor(req))),
  approveResults: respond(201, req => interviewsService.approveResults(
    req.params.roundId, req.body as { evidenceReference: string; evidenceSha256: string; reason: string }, actor(req),
  )),
  finalizeRound: respond(200, req => interviewsService.finalizeRound(
    req.params.roundId, req.body.reason, actor(req),
  )),
  audit: respond(200, req => interviewsService.listAudit(
    req.params.roundId, Number(req.query.page), Number(req.query.limit),
  )),
};
