import { createHash } from 'node:crypto';
import {
  InterviewAllocationType, InterviewAuditAction, InterviewHallStatus,
  InterviewRoundStatus, Prisma, PrismaClient,
} from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error.middleware';
import {
  ApprovedResultSource, assessInterviewEligibility, InterviewEligibility,
  SESSION_V_CAMPAIGN_REF, SESSION_V_PASS_MARKS,
} from './eligibility';
import { loadFinalWrittenMarks } from './finalWrittenMarks';

import { AllocationCandidate, AllocationHall, AllocationStrategy, buildAllocationPlan } from './allocation';
import {
  AutoAllocateCommitInput, CandidateQuery, CreateAssignmentsInput, CreateHallInput,
  CreateRoundInput, LockAssignmentInput, RemoveAssignmentInput, UnlockAssignmentInput,
  UpdateAssignmentInput, UpdateHallInput,
} from './interviews.schema';

type Db = PrismaClient | Prisma.TransactionClient;
type Actor = { id: string; role: string };
type HallFields = {
  name: string; roomNumber: string; venue: string | null; interviewDate: Date | null;
  reportingTime: string | null; scheduleStartAt: Date | null; scheduleEndAt: Date | null;
  capacity: number; allowedClasses: string[]; description: string | null; status: InterviewHallStatus;
};
type CampaignCandidate = {
  student: any;
  roster: any | null;
  source: ApprovedResultSource | null;
  eligibility: InterviewEligibility;
  assignment: any | null;
  fixedPlacement: any | null;
  assignmentNeedsReview: boolean;
};
type CampaignSnapshot = {
  candidates: CampaignCandidate[];
  exams: any[];
  resultFingerprints: string[];
  assignments: any[];
  fixedPlacements: any[];
  officialResultCount: number;
  campaignDataComplete: boolean;
  approvalSnapshotHash: string;
  resultApprovalCurrent: boolean;
  resultApproval: any | null;
  sourceStatus: string;
  sourceMessage: string;
  qualifiedCount: number;
  notQualifiedCount: number;
  pendingCount: number;
  withheldCount: number;
  duplicateCount: number;
  missingResultCount: number;
  reviewRequiredCount: number;
};

function fail(statusCode: number, message: string, code?: string): AppError {
  const error: AppError = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}
function normalized(value: string | null | undefined): string { return (value ?? '').trim().toLowerCase(); }
function asDate(value: string | null | undefined): Date | null { return value ? new Date(value) : null; }

function hallFields(input: CreateHallInput | UpdateHallInput, current?: any): HallFields {
  const merged = { ...(current ?? {}), ...input } as any;
  const dateText = typeof merged.interviewDate === 'string' ? merged.interviewDate
    : merged.interviewDate instanceof Date ? merged.interviewDate.toISOString().slice(0, 10) : null;
  return {
    name: String(merged.name ?? '').trim(),
    roomNumber: String(merged.roomNumber ?? '').trim(),
    venue: merged.venue?.trim() || null,
    interviewDate: dateText ? new Date(dateText + 'T00:00:00.000Z') : null,
    reportingTime: merged.reportingTime?.trim() || null,
    scheduleStartAt: asDate(merged.scheduleStartAt instanceof Date ? merged.scheduleStartAt.toISOString() : merged.scheduleStartAt),
    scheduleEndAt: asDate(merged.scheduleEndAt instanceof Date ? merged.scheduleEndAt.toISOString() : merged.scheduleEndAt),
    capacity: Number(merged.capacity),
    allowedClasses: Array.isArray(merged.allowedClasses) ? merged.allowedClasses : [],
    description: merged.description?.trim() || null,
    status: merged.status ?? InterviewHallStatus.ACTIVE,
  };
}
function toHallInput(fields: HallFields): Omit<Prisma.InterviewHallUncheckedCreateInput, 'roundId'> {
  return {
    name: fields.name, roomNumber: fields.roomNumber, venue: fields.venue, interviewDate: fields.interviewDate,
    reportingTime: fields.reportingTime, scheduleStartAt: fields.scheduleStartAt, scheduleEndAt: fields.scheduleEndAt,
    capacity: fields.capacity, allowedClasses: fields.allowedClasses, description: fields.description, status: fields.status,
  };
}
function assertRoundEditable(round: any, actor: Actor, override = false, reason?: string) {
  if (round.status === InterviewRoundStatus.FINALIZED) throw fail(409, 'This interview round is finalized and cannot be changed.');
  if (override && actor.role !== 'SUPER_ADMIN') throw fail(403, 'Only a Super Admin can use an interview allocation override.');
  if (round.status === InterviewRoundStatus.PUBLISHED &&
      (actor.role !== 'SUPER_ADMIN' || !override || !reason?.trim())) {
    throw fail(409, 'Published allocations are protected. A Super Admin override and reason are required.');
  }
  if (override && !reason?.trim()) throw fail(400, 'A reason is required for a Super Admin override.');
}
function assertClassAllowed(className: string | null, groupName: string | null, allowedClasses: string[]) {
  if (!allowedClasses.length) return;
  const values = new Set(allowedClasses.map(normalized));
  if (![className, groupName].some(value => value && values.has(normalized(value)))) {
    throw fail(409, 'The student class or academic group is not allowed in this interview hall.');
  }
}
function isOverlapping(startA: Date | null, endA: Date | null, startB: Date | null, endB: Date | null) {
  if (!startA || !endA || !startB || !endB) return true;
  return startA.getTime() < endB.getTime() && startB.getTime() < endA.getTime();
}

export function evaluateInterviewResult(result: ApprovedResultSource | null, threshold: number, maximumMarks: number): InterviewEligibility {
  return assessInterviewEligibility(result, threshold, maximumMarks);
}

export class InterviewsService {
  constructor(private readonly db: PrismaClient = prisma) {}

  private async transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    try {
      return await this.db.$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10000, timeout: 20000,
      });
    } catch (error: any) {
      if (error?.code === 'P2034') throw fail(409, 'Another administrator changed this interview round. Refresh and retry.');
      if (error?.code === 'P2002' || error?.code === '23505') throw fail(409, 'The requested interview change conflicts with a recent change or existing record.');
      throw error;
    }
  }

  private async lockRound(tx: Prisma.TransactionClient, roundId: string) {
    const rows = await tx.$queryRawUnsafe<Array<{ id: string }>>('SELECT "id" FROM "InterviewRound" WHERE "id" = $1 FOR UPDATE', roundId);
    if (!rows.length) throw fail(404, 'Interview round not found.');
    const round = await tx.interviewRound.findUnique({ where: { id: roundId } });
    if (!round) throw fail(404, 'Interview round not found.');
    return round;
  }

  private async audit(tx: Prisma.TransactionClient, input: {
    roundId: string; actorId: string; action: InterviewAuditAction; hallId?: string | null;
    assignmentId?: string | null; studentId?: string | null; reason?: string | null;
    idempotencyKey?: string | null; details?: Record<string, unknown>;
  }) {
    return tx.interviewAllocationAudit.create({
      data: {
        roundId: input.roundId, actorId: input.actorId, action: input.action,
        hallId: input.hallId ?? null, assignmentId: input.assignmentId ?? null,
        studentId: input.studentId ?? null, reason: input.reason ?? null,
        idempotencyKey: input.idempotencyKey ?? null,
        ...(input.details ? { details: input.details as unknown as Prisma.InputJsonObject } : {}),
      },
    });
  }

  async listRounds() {
    return this.db.interviewRound.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      include: { _count: { select: { halls: true, assignments: true } } },
    });
  }

  private async loadCampaignSnapshot(db: Db, sessionRef: string, roundId?: string): Promise<CampaignSnapshot> {
    if (sessionRef !== SESSION_V_CAMPAIGN_REF) {
      return {
        candidates: [], exams: [], resultFingerprints: [], assignments: [], fixedPlacements: [], officialResultCount: 0, campaignDataComplete: false,
        approvalSnapshotHash: '', resultApprovalCurrent: false, resultApproval: null, sourceStatus: 'LEGACY_HALL_SCOPE',
        sourceMessage: 'This stored round is scoped to an individual exam hall. Create the Session V campaign round to combine all original examination halls.',
        qualifiedCount: 0, notQualifiedCount: 0, pendingCount: 0, withheldCount: 0,
        duplicateCount: 0, missingResultCount: 0, reviewRequiredCount: 0,
      };
    }

    const exams = await db.examination.findMany({
      where: { sessionReference: SESSION_V_CAMPAIGN_REF },
      select: {
        id: true, reference: true, sessionReference: true, examDate: true, classGroup: true,
        maximumMarks: true, publicationStatus: true, publishedAt: true, publishedById: true, revision: true,
      },
      orderBy: [{ examDate: 'asc' }, { reference: 'asc' }],
    });
    const resultInclude = {
      examination: {
        select: {
          id: true, reference: true, sessionReference: true, maximumMarks: true,
          publicationStatus: true, publishedAt: true, publishedById: true, revision: true,
          paperKeyRevisions: { select: { paperVersion: true } },
        },
      },
      attendanceSession: {
        select: { id: true, isCurrent: true, status: true, attemptNumber: true, businessDate: true, hallNameSnapshot: true, roomNumberSnapshot: true },
      },
      attemptBinding: { select: { sessionId: true, studentId: true } },
      corrections: {
        select: { previousRevision: true, newRevision: true, occurredAt: true, id: true },
        orderBy: [{ newRevision: 'desc' as const }, { occurredAt: 'desc' as const }, { id: 'desc' as const }],
        take: 1,
      },
    };
    const [resultRows, provisionalRows, manualRows, fixedPlacements, assignments, resultApproval] = await Promise.all([
      db.examinationResult.findMany({
        where: { examination: { sessionReference: SESSION_V_CAMPAIGN_REF } },
        include: resultInclude,
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      }),
      db.omrProvisionalMark.findMany({
        where: { sessionReference: SESSION_V_CAMPAIGN_REF }, select: { studentId: true }, orderBy: { studentId: 'asc' },
      }),
      db.manualExamMark.findMany({
        where: { sessionReference: SESSION_V_CAMPAIGN_REF }, select: { studentId: true }, orderBy: { studentId: 'asc' },
      }),
      db.interviewFixedPlacement.findMany({
        where: { schedule: roundId ? { roundId } : { round: { sessionRef: SESSION_V_CAMPAIGN_REF } } },
        select: { id: true, studentId: true, panel: true, batch: true, sequence: true, slotTime: true, printedMarks: true },
        orderBy: [{ panel: 'asc' }, { batch: 'asc' }, { sequence: 'asc' }],
      }),
      roundId ? db.interviewAssignment.findMany({
        where: { roundId },
        select: {
          id: true, studentId: true, hallId: true, isLocked: true, allocationType: true,
          approvedResultReference: true, resultRevision: true, approvedMarksSnapshot: true,
          queueNumber: true, hall: { select: { name: true, roomNumber: true } },
        },
        orderBy: [{ studentId: 'asc' }, { id: 'asc' }],
      }) : Promise.resolve([]),
      roundId ? db.interviewResultApproval.findFirst({
        where: { roundId, campaignReference: SESSION_V_CAMPAIGN_REF },
        orderBy: [{ approvedAt: 'desc' }, { id: 'desc' }],
      }) : Promise.resolve(null),
    ]);

    const dates = [...new Map(exams.filter(exam => exam.examDate).map(exam => {
      const value = new Date(exam.examDate as Date);
      return [value.toISOString().slice(0, 10), value] as const;
    })).values()];
    const sessions = dates.length ? await db.attendanceSession.findMany({
      where: { businessDate: { in: dates }, isCurrent: true, status: { not: 'CANCELLED' } },
      select: { id: true, businessDate: true, isCurrent: true, status: true, attemptNumber: true, hallNameSnapshot: true, roomNumberSnapshot: true },
      orderBy: [{ businessDate: 'asc' }, { hallNameSnapshot: 'asc' }, { roomNumberSnapshot: 'asc' }, { id: 'asc' }],
    }) : [];
    const rosterRows = sessions.length ? await db.attendanceSessionCandidate.findMany({
      where: { sessionId: { in: sessions.map(session => session.id) } },
      select: { studentId: true, sessionId: true, fullNameSnapshot: true, rollNumberSnapshot: true, applicationNoSnapshot: true, currentClassSnapshot: true },
      orderBy: [{ sessionId: 'asc' }, { studentId: 'asc' }],
    }) : [];

    const ids = [...new Set([
      ...resultRows.map(row => row.studentId),
      ...provisionalRows.map(row => row.studentId),
      ...manualRows.map(row => row.studentId),
      ...fixedPlacements.map(row => row.studentId),
      ...rosterRows.map(row => row.studentId),
      ...assignments.map(row => row.studentId),
    ])].sort((a, b) => a.localeCompare(b));
    const students = ids.length ? await db.student.findMany({
      where: { id: { in: ids } },
      select: { id: true, applicationNo: true, rollNumber: true, fullName: true, currentClass: true, hsscGroup: true, schoolName: true, gender: true },
    }) : [];
    const studentById = new Map(students.map(student => [student.id, student]));
    const resultsByStudent = new Map<string, any[]>();
    for (const row of resultRows) resultsByStudent.set(row.studentId, [...(resultsByStudent.get(row.studentId) ?? []), row]);
    const rostersByStudent = new Map<string, any[]>();
    for (const roster of rosterRows) rostersByStudent.set(roster.studentId, [...(rostersByStudent.get(roster.studentId) ?? []), roster]);
    const assignmentByStudent = new Map(assignments.map(assignment => [assignment.studentId, assignment]));
    const fixedByStudent = new Map(fixedPlacements.map(placement => [placement.studentId, placement]));
    const finalMarks = await loadFinalWrittenMarks(db, ids, resultRows);

    const candidates: CampaignCandidate[] = ids.flatMap(studentId => {
      const student = studentById.get(studentId);
      if (!student) return [];
      const records = resultsByStudent.get(studentId) ?? [];
      const resolution = finalMarks.get(studentId)!;
      const rosterList = rostersByStudent.get(studentId) ?? [];
      const sourceRecord = resolution.result
        ? records.find(record => record.resultReference === resolution.result?.reference)
        : undefined;
      const roster = rosterList.find(item => item.sessionId === sourceRecord?.attendanceSessionId)
        ?? rosterList.find(item => records.some(record => record.attendanceSessionId === item.sessionId))
        ?? rosterList[0]
        ?? null;
      const assignment = assignmentByStudent.get(studentId) ?? null;
      const result = resolution.result;
      const assignmentNeedsReview = Boolean(assignment && (
        resolution.eligibility.status !== 'QUALIFIED'
        || !result
        || assignment.approvedResultReference !== result.reference
        || assignment.resultRevision !== result.revision
        || assignment.approvedMarksSnapshot !== result.marks
      ));
      return [{ student, roster, source: result, eligibility: resolution.eligibility, assignment,
        fixedPlacement: fixedByStudent.get(studentId) ?? null, assignmentNeedsReview }];
    });

    const qualifiedCount = candidates.filter(item => item.eligibility.status === 'QUALIFIED').length;
    const notQualifiedCount = candidates.filter(item => item.eligibility.status === 'NOT_QUALIFIED').length;
    const pendingCount = candidates.filter(item => item.eligibility.status === 'PENDING_VERIFICATION').length;
    const withheldCount = candidates.filter(item => item.eligibility.status === 'EXCLUDED_PENDING_REVIEW' && item.eligibility.reason === 'WITHHELD').length;
    const duplicateCount = candidates.filter(item => item.eligibility.status === 'EXCLUDED_PENDING_REVIEW'
      && item.eligibility.reason !== 'WITHHELD').length;
    const missingResultCount = pendingCount + withheldCount + duplicateCount;
    const reviewRequiredCount = candidates.filter(item => item.assignmentNeedsReview).length;
    const examsAtApprovedScale = exams.length > 0 && exams.every(exam => exam.publicationStatus === 'PUBLISHED'
      && Boolean(exam.publishedAt && exam.publishedById) && Number(exam.maximumMarks) === 100);
    const usesOfficialResults = candidates.some(item => item.source?.sourceType === 'OFFICIAL_RESULT');
    const verifiedStudentListCount = candidates.filter(item => item.source?.isFinal
      && item.source.sourceType !== 'OFFICIAL_RESULT'
      && (item.eligibility.status === 'QUALIFIED' || item.eligibility.status === 'NOT_QUALIFIED')).length;
    const campaignDataComplete = (!usesOfficialResults || examsAtApprovedScale) && candidates.length > 0
      && candidates.every(item => item.eligibility.status === 'QUALIFIED' || item.eligibility.status === 'NOT_QUALIFIED');
    const examFingerprint = exams.map(exam => ({
      id: exam.id, reference: exam.reference, revision: exam.revision,
      publicationStatus: exam.publicationStatus, maximumMarks: String(exam.maximumMarks),
      publishedAt: exam.publishedAt?.toISOString?.() ?? null, publishedById: exam.publishedById,
    }));
    const candidateFingerprint = candidates.map(item => ({
      studentId: item.student.id, eligibility: item.eligibility.status,
      resultReference: item.source?.reference ?? null, resultRevision: item.source?.revision ?? null,
      marks: item.source?.marks ?? null,
    }));
    const resultFingerprints = resultRows.map(row => JSON.stringify({
      id: row.id, resultReference: row.resultReference, resultRevision: row.resultRevision,
      obtainedMarks: row.obtainedMarks?.toString() ?? null, maximumMarks: row.maximumMarks.toString(),
      identityStatus: row.identityStatus, scoringStatus: row.scoringStatus,
      verificationStatus: row.verificationStatus, publicationStatus: row.publicationStatus,
      verifiedAt: row.verifiedAt?.toISOString?.() ?? null, verifiedById: row.verifiedById,
      publishedAt: row.publishedAt?.toISOString?.() ?? null, publishedById: row.publishedById,
      attendanceSessionId: row.attendanceSessionId, examRevision: row.examination.revision,
      latestCorrection: row.corrections?.[0] ? {
        previousRevision: row.corrections[0].previousRevision, newRevision: row.corrections[0].newRevision,
        id: row.corrections[0].id,
      } : null,
      updatedAt: row.updatedAt?.toISOString?.() ?? null,
    })).sort((a, b) => a.localeCompare(b));
    const approvalSnapshotHash = createHash('sha256').update(JSON.stringify({
      campaignReference: SESSION_V_CAMPAIGN_REF, exams: examFingerprint,
      candidateFingerprint, resultFingerprints,
    })).digest('hex');
    const resultApprovalCurrent = Boolean(campaignDataComplete && resultApproval
      && resultApproval.snapshotHash === approvalSnapshotHash
      && resultApproval.candidateCount === candidates.length
      && resultApproval.officialResultCount === resultRows.length);
    let sourceStatus = verifiedStudentListCount ? 'PARTIALLY_VERIFIED' : 'PENDING_VERIFICATION';
    let sourceMessage = `${qualifiedCount + notQualifiedCount} of ${candidates.length} campaign candidates have current final verified written marks. ${missingResultCount} remain pending or excluded for review. Already verified manual and OMR marks need no additional official-result or Gazette approval; assessment entry for the fixed roster remains available.`;
    if (sessionRef !== SESSION_V_CAMPAIGN_REF) {
      sourceStatus = 'LEGACY_HALL_SCOPE';
      sourceMessage = 'This stored round is scoped to an individual exam hall. Create the Session V campaign round to combine all original examination halls.';
    } else if (!candidates.length) {
      sourceStatus = 'NO_SESSION_V_CANDIDATES';
      sourceMessage = 'No Session V candidate roster, manual mark, OMR mark or fixed placement records were found.';
    } else if (campaignDataComplete && !usesOfficialResults) {
      sourceStatus = 'VERIFIED';
      sourceMessage = `All ${candidates.length} Session V candidates have current final verified written marks from the Student list. Corrected effective scores are used and passing marks are fixed at 60/100. No further official-result or Gazette approval is required.`;
    } else if (!verifiedStudentListCount && !exams.length && usesOfficialResults) {
      sourceStatus = 'NO_SESSION_V_EXAMINATION';
      sourceMessage = 'No official 2026-V examination record is available. A Super Admin must register and publish the Session V examination and approve its final Gazette results.';
    } else if (usesOfficialResults && !examsAtApprovedScale) {
      sourceStatus = 'SESSION_V_EXAMINATION_NOT_PUBLISHED';
      sourceMessage = 'Every Session V examination must be published at 100 marks by a Super Admin before candidate eligibility can be confirmed.';
    } else if (campaignDataComplete && resultApprovalCurrent) {
      sourceStatus = 'VERIFIED';
      sourceMessage = `Current final written marks for all ${candidates.length} Session V candidates are verified; official-result fallback sources match the Super Admin Gazette evidence approval. Passing marks are fixed at 60/100.`;
    } else if (campaignDataComplete && resultApproval) {
      sourceStatus = 'PENDING_GAZETTE_APPROVAL';
      sourceMessage = 'Official results or the campaign roster changed after Gazette evidence approval. A Super Admin must reconcile the final Gazette and record a new evidence approval.';
    } else if (campaignDataComplete) {
      sourceStatus = 'PENDING_GAZETTE_APPROVAL';
      sourceMessage = 'A Super Admin must confirm the complete verified Session V result set against the final approved Gazette and record its evidence reference and SHA-256.';
    }

    return {
      candidates, exams, resultFingerprints,
      assignments, fixedPlacements, officialResultCount: resultRows.length, campaignDataComplete,
      approvalSnapshotHash, resultApprovalCurrent, resultApproval,
      sourceStatus, sourceMessage, qualifiedCount, notQualifiedCount, pendingCount,
      withheldCount, duplicateCount, missingResultCount, reviewRequiredCount,
    };
  }

  async createRound(input: CreateRoundInput, actor: Actor) {
    return this.transaction(async tx => {
      if (input.sessionRef !== SESSION_V_CAMPAIGN_REF || input.eligibilityThreshold !== SESSION_V_PASS_MARKS || input.maximumMarks !== 100) {
        throw fail(400, 'Session V interviews use campaign 2026-V and a fixed 60/100 passing threshold.');
      }
      if (await tx.interviewRound.findUnique({ where: { sessionRef: SESSION_V_CAMPAIGN_REF }, select: { id: true } })) {
        throw fail(409, 'A Session V campaign interview round already exists.');
      }
      const round = await tx.interviewRound.create({
        data: {
          sessionRef: SESSION_V_CAMPAIGN_REF, title: input.title, eligibilityThreshold: SESSION_V_PASS_MARKS,
          maximumMarks: 100, status: InterviewRoundStatus.SETUP, createdById: actor.id,
        },
      });
      await this.audit(tx, { roundId: round.id, actorId: actor.id, action: InterviewAuditAction.ROUND_CREATED,
        details: { sessionRef: round.sessionRef, title: round.title } });
      return round;
    });
  }

  async getOverview(roundId: string) {
    const round = await this.db.interviewRound.findUnique({ where: { id: roundId } });
    if (!round) throw fail(404, 'Interview round not found.');
    const [campaign, halls, fixedSchedule] = await Promise.all([
      this.loadCampaignSnapshot(this.db, round.sessionRef, roundId),
      this.db.interviewHall.findMany({
        where: { roundId, status: InterviewHallStatus.ACTIVE },
        select: { capacity: true, _count: { select: { assignments: true } } },
      }),
      this.db.interviewFixedSchedule.findUnique({
        where: { roundId }, select: { id: true, _count: { select: { placements: true } } },
      }),
    ]);
    const assignments = campaign.assignments;
    const capacity = halls.reduce((sum, hall) => sum + hall.capacity, 0);
    const occupied = halls.reduce((sum, hall) => sum + hall._count.assignments, 0);
    const assignedIds = new Set([...assignments, ...campaign.fixedPlacements].map(item => item.studentId));
    const unassignedQualified = campaign.candidates.filter(item => item.eligibility.status === 'QUALIFIED' && !assignedIds.has(item.student.id)).length;
    return {
      round, totalQualifiedCandidates: campaign.qualifiedCount, notQualifiedCandidates: campaign.notQualifiedCount,
      campaignCandidateCount: campaign.candidates.length, allocatedCandidates: assignedIds.size,
      fixedScheduleImported: Boolean(fixedSchedule),
      fixedScheduledCandidates: fixedSchedule?._count.placements ?? 0,
      unassignedCandidates: unassignedQualified,
      pendingVerificationCandidates: campaign.missingResultCount,
      lockedCandidates: new Set([...assignments.filter(item => item.isLocked), ...campaign.fixedPlacements].map(item => item.studentId)).size,
      reviewRequiredAssignments: campaign.reviewRequiredCount,
      activeHallCount: halls.length, totalCapacity: capacity,
      remainingSeats: Math.max(0, capacity - occupied),
      completionPercent: campaign.qualifiedCount ? Math.round(((campaign.qualifiedCount - unassignedQualified) / campaign.qualifiedCount) * 100) : 0,
      eligibilitySourceStatus: campaign.sourceStatus, sourceMessage: campaign.sourceMessage,
      campaignDataComplete: campaign.campaignDataComplete,
      resultApprovalCurrent: campaign.resultApprovalCurrent,
      resultApproval: campaign.resultApproval ? {
        evidenceReference: campaign.resultApproval.evidenceReference,
        evidenceSha256: campaign.resultApproval.evidenceSha256,
        approvedAt: campaign.resultApproval.approvedAt,
        candidateCount: campaign.resultApproval.candidateCount,
        officialResultCount: campaign.resultApproval.officialResultCount,
      } : null,
    };
  }

  async approveResults(roundId: string, input: { evidenceReference: string; evidenceSha256: string; reason: string }, actor: Actor) {
    if (actor.role !== 'SUPER_ADMIN') throw fail(403, 'Only a Super Admin can approve the final Gazette evidence for interview eligibility.');
    return this.transaction(async tx => {
      const round = await this.lockRound(tx, roundId);
      if (round.status === InterviewRoundStatus.FINALIZED) throw fail(409, 'A finalized interview round cannot receive a new result approval.');
      if (round.sessionRef !== SESSION_V_CAMPAIGN_REF || round.eligibilityThreshold !== SESSION_V_PASS_MARKS || round.maximumMarks !== 100) {
        throw fail(409, 'Gazette evidence approval is available only for the Session V campaign at the fixed 60/100 threshold.');
      }
      await this.lockCampaignResults(tx, round.sessionRef);
      const campaign = await this.loadCampaignSnapshot(tx, round.sessionRef, roundId);
      if (!campaign.campaignDataComplete) {
        throw fail(409, 'Complete the verified and published official result set before approving Gazette evidence.');
      }
      const approval = await tx.interviewResultApproval.create({
        data: {
          roundId, campaignReference: SESSION_V_CAMPAIGN_REF,
          snapshotHash: campaign.approvalSnapshotHash,
          candidateCount: campaign.candidates.length,
          officialResultCount: campaign.officialResultCount,
          evidenceReference: input.evidenceReference.trim(),
          evidenceSha256: input.evidenceSha256.trim().toLowerCase(),
          reason: input.reason.trim(), approvedById: actor.id,
        },
      });
      await this.audit(tx, {
        roundId, actorId: actor.id, action: InterviewAuditAction.RESULTS_APPROVED, reason: input.reason,
        details: {
          campaignReference: SESSION_V_CAMPAIGN_REF, snapshotHash: campaign.approvalSnapshotHash,
          candidateCount: campaign.candidates.length, officialResultCount: campaign.officialResultCount,
          evidenceReference: input.evidenceReference.trim(), evidenceSha256: input.evidenceSha256.trim().toLowerCase(),
        },
      });
      await tx.interviewRound.update({ where: { id: roundId }, data: { revision: { increment: 1 } } });
      return approval;
    });
  }

  async listCandidates(roundId: string, query: CandidateQuery) {
    const round = await this.db.interviewRound.findUnique({ where: { id: roundId } });
    if (!round) throw fail(404, 'Interview round not found.');
    const campaign = await this.loadCampaignSnapshot(this.db, round.sessionRef, roundId);
    const search = query.search?.trim().toLowerCase() ?? '';
    const rows = campaign.candidates.filter(item => {
      const student = item.student;
      const assignment = item.assignment;
      const isAssigned = Boolean(assignment || item.fixedPlacement);
      const className = item.roster?.currentClassSnapshot || student.currentClass || '';
      const haystack = [student.fullName, student.applicationNo, student.rollNumber, item.roster?.fullNameSnapshot, item.roster?.rollNumberSnapshot]
        .filter(Boolean).join(' ').toLowerCase();
      if (search && !haystack.includes(search)) return false;
      if (query.className && className.toLowerCase() !== query.className.toLowerCase()
        && (student.hsscGroup ?? '').toLowerCase() !== query.className.toLowerCase()) return false;
      if (query.gender && student.gender !== query.gender) return false;
      if (query.schoolName && !(student.schoolName ?? '').toLowerCase().includes(query.schoolName.toLowerCase())) return false;
      if (query.hallId && assignment?.hallId !== query.hallId) return false;
      if (query.assignment === 'assigned' && !isAssigned) return false;
      if (query.assignment === 'unassigned' && isAssigned) return false;
      if (query.eligibility === 'qualified' && item.eligibility.status !== 'QUALIFIED') return false;
      if (query.eligibility === 'unqualified' && item.eligibility.status !== 'NOT_QUALIFIED') return false;
      if (query.eligibility === 'pending' && item.eligibility.status !== 'PENDING_VERIFICATION') return false;
      if (query.eligibility === 'excluded' && item.eligibility.status !== 'EXCLUDED_PENDING_REVIEW') return false;
      const marks = item.source?.marks;
      if (query.minimumMarks !== undefined && (marks === undefined || marks < query.minimumMarks)) return false;
      if (query.maximumMarks !== undefined && (marks === undefined || marks > query.maximumMarks)) return false;
      return true;
    }).sort((a, b) => {
      const left = (a.roster?.rollNumberSnapshot || a.student.rollNumber || '').toLowerCase();
      const right = (b.roster?.rollNumberSnapshot || b.student.rollNumber || '').toLowerCase();
      return left.localeCompare(right) || a.student.id.localeCompare(b.student.id);
    });
    const total = rows.length;
    const students = rows.slice((query.page - 1) * query.limit, query.page * query.limit);
    return {
      sessionRef: round.sessionRef, verificationStatus: campaign.sourceStatus,
      eligibilitySourceStatus: campaign.sourceStatus,
      results: students.map(item => {
        const { student, roster, assignment, eligibility, source } = item;
        return {
          id: student.id, applicationNo: roster?.applicationNoSnapshot || student.applicationNo,
          rollNumber: roster?.rollNumberSnapshot || student.rollNumber,
          studentName: roster?.fullNameSnapshot || student.fullName,
          className: roster?.currentClassSnapshot || student.currentClass, groupName: student.hsscGroup,
          schoolName: student.schoolName, gender: student.gender,
          finalApprovedMarks: eligibility.status === 'QUALIFIED' || eligibility.status === 'NOT_QUALIFIED' ? source?.marks ?? null : null,
          resultVerificationStatus: eligibility.status,
          interviewHall: assignment ? { id: assignment.hallId, name: assignment.hall.name, roomNumber: assignment.hall.roomNumber } : null,
          assignmentStatus: item.fixedPlacement ? 'FIXED' : assignment ? assignment.allocationType : 'UNASSIGNED',
          isLocked: Boolean(item.fixedPlacement) || (assignment?.isLocked ?? false), assignmentId: assignment?.id ?? null,
          fixedPlacement: item.fixedPlacement,
          writtenSourceType: source?.sourceType ?? null,
          assignmentNeedsReview: item.assignmentNeedsReview, sourceRevision: source?.revision ?? null,
        };
      }),
      pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
    };
  }

  async listHalls(roundId: string) {
    if (!await this.db.interviewRound.findUnique({ where: { id: roundId }, select: { id: true } })) {
      throw fail(404, 'Interview round not found.');
    }
    const halls = await this.db.interviewHall.findMany({
      where: { roundId },
      include: { _count: { select: { assignments: true } }, assignments: { where: { isLocked: true }, select: { id: true } } },
      orderBy: [{ interviewDate: 'asc' }, { name: 'asc' }, { roomNumber: 'asc' }],
    });
    return halls.map(({ assignments, _count, ...hall }) => ({
      ...hall, assignedCount: _count.assignments, lockedCount: assignments.length,
      availableCapacity: Math.max(0, hall.capacity - _count.assignments),
    }));
  }

  private async lockVenueSchedule(tx: Prisma.TransactionClient) {
    await tx.$queryRawUnsafe("SELECT pg_advisory_xact_lock(hashtextextended('AZM_INTERVIEW_HALL_SCHEDULE', 0))::text AS lock_result");
  }
  private async assertNoScheduleConflict(tx: Prisma.TransactionClient, candidate: HallFields, excludeHallId?: string) {
    if (candidate.status !== InterviewHallStatus.ACTIVE) return;
    const where: Prisma.InterviewHallWhereInput = {
      status: InterviewHallStatus.ACTIVE,
      roomNumber: { equals: candidate.roomNumber, mode: 'insensitive' },
      interviewDate: candidate.interviewDate,
      ...(excludeHallId ? { id: { not: excludeHallId } } : {}),
      ...(candidate.venue ? { venue: { equals: candidate.venue, mode: 'insensitive' } } : { venue: null }),
    };
    const existing = await tx.interviewHall.findMany({ where, select: { scheduleStartAt: true, scheduleEndAt: true } });
    if (existing.some(hall => isOverlapping(candidate.scheduleStartAt, candidate.scheduleEndAt, hall.scheduleStartAt, hall.scheduleEndAt))) {
      throw fail(409, 'This room is already booked at the same venue during an overlapping interview schedule.');
    }
  }

  async createHall(roundId: string, input: CreateHallInput, actor: Actor) {
    return this.transaction(async tx => {
      const round = await this.lockRound(tx, roundId);
      assertRoundEditable(round, actor);
      await this.lockVenueSchedule(tx);
      const fields = hallFields(input);
      if (Boolean(fields.scheduleStartAt) !== Boolean(fields.scheduleEndAt)) throw fail(400, 'Interview start and end times must be supplied together.');
      if (fields.scheduleStartAt && fields.scheduleEndAt && fields.scheduleEndAt <= fields.scheduleStartAt) throw fail(400, 'Interview end time must be later than the start time.');
      await this.assertNoScheduleConflict(tx, fields);
      const hall = await tx.interviewHall.create({ data: { roundId, ...toHallInput(fields) } });
      await tx.interviewRound.update({ where: { id: roundId }, data: { revision: { increment: 1 } } });
      await this.audit(tx, {
        roundId, hallId: hall.id, actorId: actor.id, action: InterviewAuditAction.HALL_CREATED,
        details: { name: hall.name, roomNumber: hall.roomNumber, capacity: hall.capacity },
      });
      return hall;
    });
  }

  async updateHall(hallId: string, input: UpdateHallInput, actor: Actor) {
    const initial = await this.db.interviewHall.findUnique({ where: { id: hallId }, select: { roundId: true } });
    if (!initial) throw fail(404, 'Interview hall not found.');
    return this.transaction(async tx => {
      const round = await this.lockRound(tx, initial.roundId);
      assertRoundEditable(round, actor);
      await this.lockVenueSchedule(tx);
      const current = await tx.interviewHall.findUnique({ where: { id: hallId } });
      if (!current) throw fail(404, 'Interview hall not found.');
      const fields = hallFields(input, current);
      if (Boolean(fields.scheduleStartAt) !== Boolean(fields.scheduleEndAt)) throw fail(400, 'Interview start and end times must be supplied together.');
      if (fields.scheduleStartAt && fields.scheduleEndAt && fields.scheduleEndAt <= fields.scheduleStartAt) throw fail(400, 'Interview end time must be later than the start time.');
      const assigned = await tx.interviewAssignment.count({ where: { hallId } });
      if (fields.capacity < assigned) throw fail(409, 'Capacity cannot be reduced below the hall’s current assigned student count.');
      await this.assertNoScheduleConflict(tx, fields, hallId);
      const updated = await tx.interviewHall.update({ where: { id: hallId }, data: toHallInput(fields) });
      await tx.interviewRound.update({ where: { id: initial.roundId }, data: { revision: { increment: 1 } } });
      await this.audit(tx, {
        roundId: initial.roundId, hallId, actorId: actor.id,
        action: fields.status === InterviewHallStatus.INACTIVE && current.status !== fields.status
          ? InterviewAuditAction.HALL_DEACTIVATED : InterviewAuditAction.HALL_UPDATED,
        details: {
          before: { name: current.name, roomNumber: current.roomNumber, capacity: current.capacity, status: current.status },
          after: { name: updated.name, roomNumber: updated.roomNumber, capacity: updated.capacity, status: updated.status },
        },
      });
      return updated;
    });
  }

  private async getVerifiedStudent(tx: Db, round: { id: string; sessionRef: string; eligibilityThreshold: number; maximumMarks: number }, studentId: string) {
    if (round.eligibilityThreshold !== SESSION_V_PASS_MARKS || round.maximumMarks !== 100) {
      throw fail(409, 'Session V eligibility is fixed at 60/100. Recreate this as a campaign-level round.');
    }
    const campaign = await this.loadCampaignSnapshot(tx, round.sessionRef, round.id);
    if (campaign.sourceStatus !== 'VERIFIED') throw fail(409, campaign.sourceMessage, 'OFFICIAL_RESULTS_INCOMPLETE');
    const candidate = campaign.candidates.find(item => item.student.id === studentId);
    if (!candidate) throw fail(404, 'Student is not in the Session V campaign population.');
    if (candidate.eligibility.status !== 'QUALIFIED' || !candidate.source) {
      throw fail(409, 'Student cannot be assigned unless current final verified written marks are at least 60/100.');
    }
    return {
      student: {
        id: candidate.student.id,
        currentClass: candidate.roster?.currentClassSnapshot || candidate.student.currentClass,
        hsscGroup: candidate.student.hsscGroup,
        rollNumber: candidate.roster?.rollNumberSnapshot || candidate.student.rollNumber,
      },
      eligibility: candidate.eligibility,
    };
  }

  private async nextQueueNumber(tx: Prisma.TransactionClient, hallId: string) {
    const latest = await tx.interviewAssignment.aggregate({ where: { hallId }, _max: { queueNumber: true } });
    return (latest._max.queueNumber ?? 0) + 1;
  }

  async createAssignments(roundId: string, input: CreateAssignmentsInput, actor: Actor) {
    if (new Set(input.studentIds).size !== input.studentIds.length) throw fail(400, 'A student can only appear once in a bulk assignment request.');
    return this.transaction(async tx => {
      const round = await this.lockRound(tx, roundId);
      assertRoundEditable(round, actor);
      if (await tx.interviewFixedSchedule.findUnique({ where: { roundId }, select: { id: true } })) {
        throw fail(409, 'This round has a final locked panel schedule. Manual allocation is disabled.');
      }
      await this.lockCampaignResults(tx, round.sessionRef);
      const hall = await tx.interviewHall.findFirst({ where: { id: input.hallId, roundId, status: InterviewHallStatus.ACTIVE } });
      if (!hall) throw fail(404, 'Active interview hall not found in this round.');
      const existing = await tx.interviewAssignment.findMany({
        where: { roundId, studentId: { in: input.studentIds } }, select: { studentId: true },
      });
      if (existing.length) throw fail(409, 'One or more selected students are already assigned in this interview round.');
      if (round.eligibilityThreshold !== SESSION_V_PASS_MARKS || round.maximumMarks !== 100) {
        throw fail(409, 'Session V eligibility is fixed at 60/100. Recreate this as a campaign-level round.');
      }
      const campaign = await this.loadCampaignSnapshot(tx, round.sessionRef, roundId);
      if (campaign.sourceStatus !== 'VERIFIED') throw fail(409, campaign.sourceMessage, 'OFFICIAL_RESULTS_INCOMPLETE');
      const verified: Array<{ student: any; eligibility: InterviewEligibility }> = [];
      for (const studentId of input.studentIds) {
        const candidate = campaign.candidates.find(item => item.student.id === studentId);
        if (!candidate) throw fail(404, 'Student is not in the Session V campaign population.');
        if (candidate.eligibility.status !== 'QUALIFIED' || !candidate.source) {
          throw fail(409, 'Student cannot be assigned unless current final verified written marks are at least 60/100.');
        }
        verified.push({
          student: {
            id: candidate.student.id, currentClass: candidate.roster?.currentClassSnapshot || candidate.student.currentClass,
            hsscGroup: candidate.student.hsscGroup, rollNumber: candidate.roster?.rollNumberSnapshot || candidate.student.rollNumber,
          },
          eligibility: candidate.eligibility,
        });
      }
      for (const row of verified) assertClassAllowed(row.student.currentClass, row.student.hsscGroup, hall.allowedClasses);
      const occupancy = await tx.interviewAssignment.count({ where: { hallId: hall.id } });
      if (occupancy + verified.length > hall.capacity) throw fail(409, 'The selected interview hall does not have enough available capacity.');
      const assignments = [];
      for (const row of verified) {
        if (row.eligibility.status !== 'QUALIFIED') throw fail(409, 'Student eligibility could not be confirmed.');
        const eligibility = row.eligibility;
        const assignment = await tx.interviewAssignment.create({
          data: {
            roundId, studentId: row.student.id, hallId: hall.id,
            approvedResultReference: eligibility.sourceReference, resultRevision: eligibility.sourceRevision,
            approvedMarksSnapshot: eligibility.approvedMarks, allocationType: InterviewAllocationType.MANUAL,
            queueNumber: await this.nextQueueNumber(tx, hall.id), isLocked: input.isLocked,
            lockedAt: input.isLocked ? new Date() : null, lockedById: input.isLocked ? actor.id : null,
            assignedById: actor.id, reason: input.reason ?? null,
          },
        });
        assignments.push(assignment);
        await this.audit(tx, {
          roundId, hallId: hall.id, assignmentId: assignment.id, studentId: row.student.id,
          actorId: actor.id, action: InterviewAuditAction.ASSIGNED_MANUAL, reason: input.reason,
          details: { allocationType: InterviewAllocationType.MANUAL, isLocked: input.isLocked, approvedMarksSnapshot: eligibility.approvedMarks },
        });
        if (input.isLocked) await this.audit(tx, {
          roundId, hallId: hall.id, assignmentId: assignment.id, studentId: row.student.id,
          actorId: actor.id, action: InterviewAuditAction.LOCKED, reason: input.reason,
        });
      }
      await tx.interviewRound.update({ where: { id: roundId }, data: { revision: { increment: 1 } } });
      return assignments;
    });
  }

  async moveAssignment(assignmentId: string, input: UpdateAssignmentInput, actor: Actor) {
    const initial = await this.db.interviewAssignment.findUnique({ where: { id: assignmentId }, select: { roundId: true } });
    if (!initial) throw fail(404, 'Interview assignment not found.');
    return this.transaction(async tx => {
      const round = await this.lockRound(tx, initial.roundId);
      assertRoundEditable(round, actor, input.override, input.reason);
      await this.lockCampaignResults(tx, round.sessionRef);
      const assignment = await tx.interviewAssignment.findUnique({ where: { id: assignmentId }, include: { hall: true } });
      if (!assignment) throw fail(404, 'Interview assignment not found.');
      if (assignment.isLocked) throw fail(409, 'Unlock this assignment explicitly before moving the student.');
      const target = await tx.interviewHall.findFirst({ where: { id: input.hallId, roundId: round.id, status: InterviewHallStatus.ACTIVE } });
      if (!target) throw fail(404, 'Active target interview hall not found.');
      const { student, eligibility } = await this.getVerifiedStudent(tx, round, assignment.studentId);
      assertClassAllowed(student.currentClass, student.hsscGroup, target.allowedClasses);
      if (target.id === assignment.hallId) return assignment;
      const occupancy = await tx.interviewAssignment.count({ where: { hallId: target.id } });
      if (occupancy >= target.capacity) throw fail(409, 'The target interview hall is at capacity.');
      if (eligibility.status !== 'QUALIFIED') throw fail(409, 'Student eligibility could not be confirmed.');
      const queueNumber = await this.nextQueueNumber(tx, target.id);
      const updated = await tx.interviewAssignment.update({
        where: { id: assignmentId },
        data: {
          hallId: target.id, queueNumber, approvedResultReference: eligibility.sourceReference,
          resultRevision: eligibility.sourceRevision, approvedMarksSnapshot: eligibility.approvedMarks,
          reason: input.reason ?? assignment.reason,
        },
      });
      await this.audit(tx, {
        roundId: round.id, hallId: target.id, assignmentId, studentId: assignment.studentId,
        actorId: actor.id, action: InterviewAuditAction.REASSIGNED, reason: input.reason,
        details: { previousHallId: assignment.hallId, hallId: target.id, previousQueueNumber: assignment.queueNumber, queueNumber },
      });
      await tx.interviewRound.update({ where: { id: round.id }, data: { revision: { increment: 1 } } });
      return updated;
    });
  }

  async lockAssignment(assignmentId: string, input: LockAssignmentInput, actor: Actor) {
    const initial = await this.db.interviewAssignment.findUnique({ where: { id: assignmentId }, select: { roundId: true } });
    if (!initial) throw fail(404, 'Interview assignment not found.');
    return this.transaction(async tx => {
      const round = await this.lockRound(tx, initial.roundId);
      assertRoundEditable(round, actor, input.override, input.reason);
      await this.lockCampaignResults(tx, round.sessionRef);
      const assignment = await tx.interviewAssignment.findUnique({ where: { id: assignmentId } });
      if (!assignment) throw fail(404, 'Interview assignment not found.');
      if (assignment.isLocked) return assignment;
      await this.getVerifiedStudent(tx, round, assignment.studentId);
      const updated = await tx.interviewAssignment.update({
        where: { id: assignmentId }, data: { isLocked: true, lockedAt: new Date(), lockedById: actor.id },
      });
      await this.audit(tx, {
        roundId: round.id, hallId: assignment.hallId, assignmentId, studentId: assignment.studentId,
        actorId: actor.id, action: InterviewAuditAction.LOCKED, reason: input.reason,
      });
      await tx.interviewRound.update({ where: { id: round.id }, data: { revision: { increment: 1 } } });
      return updated;
    });
  }

  async unlockAssignment(assignmentId: string, input: UnlockAssignmentInput, actor: Actor) {
    const initial = await this.db.interviewAssignment.findUnique({ where: { id: assignmentId }, select: { roundId: true } });
    if (!initial) throw fail(404, 'Interview assignment not found.');
    return this.transaction(async tx => {
      const round = await this.lockRound(tx, initial.roundId);
      assertRoundEditable(round, actor, input.override, input.reason);
      const assignment = await tx.interviewAssignment.findUnique({ where: { id: assignmentId } });
      if (!assignment) throw fail(404, 'Interview assignment not found.');
      if (!assignment.isLocked) throw fail(409, 'This assignment is already unlocked.');
      const updated = await tx.interviewAssignment.update({
        where: { id: assignmentId }, data: { isLocked: false, lockedAt: null, lockedById: null, reason: input.reason },
      });
      await this.audit(tx, {
        roundId: round.id, hallId: assignment.hallId, assignmentId, studentId: assignment.studentId,
        actorId: actor.id, action: InterviewAuditAction.UNLOCKED, reason: input.reason,
        details: { override: input.override },
      });
      await tx.interviewRound.update({ where: { id: round.id }, data: { revision: { increment: 1 } } });
      return updated;
    });
  }

  async removeAssignment(assignmentId: string, input: RemoveAssignmentInput, actor: Actor) {
    const initial = await this.db.interviewAssignment.findUnique({ where: { id: assignmentId }, select: { roundId: true } });
    if (!initial) throw fail(404, 'Interview assignment not found.');
    return this.transaction(async tx => {
      const round = await this.lockRound(tx, initial.roundId);
      assertRoundEditable(round, actor, input.override, input.reason);
      const assignment = await tx.interviewAssignment.findUnique({ where: { id: assignmentId } });
      if (!assignment) throw fail(404, 'Interview assignment not found.');
      if (assignment.isLocked) throw fail(409, 'Unlock this assignment explicitly before removing it.');
      await this.audit(tx, {
        roundId: round.id, hallId: assignment.hallId, assignmentId, studentId: assignment.studentId,
        actorId: actor.id, action: InterviewAuditAction.UNASSIGNED, reason: input.reason,
        details: { assignmentId, queueNumber: assignment.queueNumber },
      });
      await tx.interviewAssignment.delete({ where: { id: assignmentId } });
      await tx.interviewRound.update({ where: { id: round.id }, data: { revision: { increment: 1 } } });
      return { removed: true, studentId: assignment.studentId };
    });
  }

  private async lockCampaignResults(tx: Prisma.TransactionClient, sessionRef: string) {
    if (sessionRef !== SESSION_V_CAMPAIGN_REF) throw fail(409, 'This round is not scoped to the Session V campaign.');
    const exams = await tx.examination.findMany({
      where: { sessionReference: SESSION_V_CAMPAIGN_REF }, select: { id: true }, orderBy: { id: 'asc' },
    });
    if (exams.length) {
      await tx.$queryRawUnsafe<Array<{ id: string }>>(
        'SELECT "id" FROM "Examination" WHERE "id" = ANY($1::text[]) ORDER BY "id" FOR UPDATE',
        exams.map(exam => exam.id),
      );
    }
    const rows = await tx.examinationResult.findMany({
      where: { examination: { sessionReference: SESSION_V_CAMPAIGN_REF } }, select: { id: true }, orderBy: { id: 'asc' },
    });
    if (!rows.length) return;
    await tx.$queryRawUnsafe<Array<{ id: string }>>(
      'SELECT "id" FROM "ExaminationResult" WHERE "id" = ANY($1::text[]) ORDER BY "id" FOR UPDATE',
      rows.map(row => row.id),
    );
  }

  private async buildPreview(db: Db, roundId: string, strategy: AllocationStrategy) {
    const round = await db.interviewRound.findUnique({ where: { id: roundId } });
    if (!round) throw fail(404, 'Interview round not found.');
    if (await db.interviewFixedSchedule.findUnique({ where: { roundId }, select: { id: true } })) {
      throw fail(409, 'This round has an approved fixed panel timetable. Automatic sorting is permanently disabled.');
    }
    if (round.status === InterviewRoundStatus.FINALIZED) throw fail(409, 'A finalized interview round cannot be allocated.');
    if (round.status === InterviewRoundStatus.PUBLISHED) throw fail(409, 'Published interview allocations cannot be changed.');
    if (round.eligibilityThreshold !== SESSION_V_PASS_MARKS || round.maximumMarks !== 100) {
      throw fail(409, 'Session V eligibility is fixed at 60/100. Recreate this as a campaign-level round.');
    }
    const [campaign, halls] = await Promise.all([
      this.loadCampaignSnapshot(db, round.sessionRef, roundId),
      db.interviewHall.findMany({
        where: { roundId }, orderBy: [{ interviewDate: 'asc' }, { name: 'asc' }, { roomNumber: 'asc' }, { id: 'asc' }],
      }),
    ]);
    if (campaign.sourceStatus !== 'VERIFIED') throw fail(409, campaign.sourceMessage, 'OFFICIAL_RESULTS_INCOMPLETE');
    const assignments = campaign.assignments.map(item => ({ studentId: item.studentId, hallId: item.hallId, isLocked: item.isLocked, queueNumber: item.queueNumber }));
    const assignedIds = new Set(assignments.map(item => item.studentId));
    const eligible = campaign.candidates.filter(item => item.eligibility.status === 'QUALIFIED' && !assignedIds.has(item.student.id));
    const candidates: AllocationCandidate[] = eligible.map(item => ({
      studentId: item.student.id,
      rollNumber: item.roster?.rollNumberSnapshot || item.student.rollNumber,
      className: item.roster?.currentClassSnapshot || item.student.currentClass,
      groupName: item.student.hsscGroup,
    }));
    const allocationHalls: AllocationHall[] = halls.map(hall => {
      const occupants = assignments.filter(item => item.hallId === hall.id);
      return {
        id: hall.id, name: hall.name, roomNumber: hall.roomNumber,
        interviewDate: hall.interviewDate?.toISOString().slice(0, 10) ?? null,
        capacity: hall.capacity, occupancy: occupants.length,
        lockedCount: occupants.filter(item => item.isLocked).length,
        lastQueueNumber: Math.max(0, ...occupants.map(item => item.queueNumber ?? 0)),
        allowedClasses: hall.allowedClasses, active: hall.status === InterviewHallStatus.ACTIVE,
      };
    });
    const plan = buildAllocationPlan(candidates, allocationHalls, strategy);
    const hash = createHash('sha256').update(JSON.stringify({
      roundId, revision: round.revision, strategy,
      campaignReference: round.sessionRef,
      examinations: campaign.exams.map(exam => ({ id: exam.id, reference: exam.reference, revision: exam.revision, status: exam.publicationStatus, maximumMarks: String(exam.maximumMarks) })),
      candidates: campaign.candidates.map(item => ({
        id: item.student.id, resultStatus: item.eligibility.status,
        resultReference: item.source?.reference ?? null, resultRevision: item.source?.revision ?? null,
        marks: item.source?.marks ?? null, currentAttemptId: item.source ? item.source.reference : null,
        rollNumber: item.roster?.rollNumberSnapshot || item.student.rollNumber,
        className: item.roster?.currentClassSnapshot || item.student.currentClass, groupName: item.student.hsscGroup,
      })),
      officialResultRevisions: campaign.resultFingerprints,
      assignments, halls: halls.map(hall => ({
        id: hall.id, capacity: hall.capacity, allowedClasses: hall.allowedClasses, status: hall.status,
        interviewDate: hall.interviewDate?.toISOString() ?? null,
      })),
      plan: plan.assignments,
    })).digest('hex');
    return {
      roundId, revision: round.revision, strategy,
      totalQualifiedCandidates: campaign.qualifiedCount,
      alreadyAssignedCandidates: assignments.length, lockedCandidates: assignments.filter(item => item.isLocked).length,
      pendingVerificationCandidates: campaign.missingResultCount, availableHallCapacity: plan.availableHallCapacity,
      toAllocateCount: plan.assignments.length, assignments: plan.assignments,
      unallocatedStudentIds: plan.unallocatedIds, hallProjection: plan.hallProjection, planHash: hash,
      eligibilitySourceStatus: campaign.sourceStatus,
    };
  }

  async previewAutoAllocation(roundId: string, strategy: AllocationStrategy) {
    return this.buildPreview(this.db, roundId, strategy);
  }

  async commitAutoAllocation(roundId: string, input: AutoAllocateCommitInput, actor: Actor) {
    return this.transaction(async tx => {
      const existing = await tx.interviewAllocationAudit.findUnique({
        where: { roundId_idempotencyKey: { roundId, idempotencyKey: input.idempotencyKey } },
      });
      if (existing) {
        const prior = existing.details as any;
        if (existing.action !== InterviewAuditAction.AUTO_ALLOCATION_COMMITTED || prior?.planHash !== input.planHash) {
          throw fail(409, 'This idempotency key was already used for a different allocation commit.');
        }
        return { ...(prior?.result ?? {}), idempotentReplay: true };
      }
      const round = await this.lockRound(tx, roundId);
      await this.lockCampaignResults(tx, round.sessionRef);
      if (round.revision !== input.expectedRevision) throw fail(409, 'The allocation preview is stale. Refresh the preview before committing.');
      if (round.status === InterviewRoundStatus.PUBLISHED || round.status === InterviewRoundStatus.FINALIZED) {
        throw fail(409, 'This interview round no longer accepts automatic allocation.');
      }
      const preview = await this.buildPreview(tx, roundId, input.strategy);
      if (preview.planHash !== input.planHash) throw fail(409, 'Candidate, hall, or assignment data changed after preview. Refresh before committing.');
      if (preview.unallocatedStudentIds.length && !input.allowPartial) {
        throw fail(409, 'Some qualified students do not fit. Confirm partial allocation explicitly to continue.');
      }
      const campaign = await this.loadCampaignSnapshot(tx, round.sessionRef, roundId);
      const candidatesById = new Map(campaign.candidates.map(item => [item.student.id, item]));
      const created = [];
      for (const row of preview.assignments) {
        const candidate = candidatesById.get(row.studentId);
        if (!candidate || candidate.eligibility.status !== 'QUALIFIED' || !candidate.source) {
          throw fail(409, 'A candidate result changed after preview. Refresh before committing.');
        }
        const eligible = candidate.eligibility;
        const assignment = await tx.interviewAssignment.create({
          data: {
            roundId, studentId: row.studentId, hallId: row.hallId,
            approvedResultReference: eligible.sourceReference, resultRevision: eligible.sourceRevision,
            approvedMarksSnapshot: eligible.approvedMarks, allocationType: InterviewAllocationType.AUTO,
            queueNumber: row.queueNumber, isLocked: false, assignedById: actor.id,
          },
        });
        created.push(assignment);
        await this.audit(tx, {
          roundId, hallId: row.hallId, assignmentId: assignment.id, studentId: row.studentId,
          actorId: actor.id, action: InterviewAuditAction.ASSIGNED_AUTO,
          details: { allocationType: InterviewAllocationType.AUTO, approvedMarksSnapshot: eligible.approvedMarks },
        });
      }
      if (created.length) await tx.interviewRound.update({ where: { id: roundId }, data: { revision: { increment: 1 } } });
      const result = {
        createdCount: created.length, unallocatedCount: preview.unallocatedStudentIds.length,
        unallocatedStudentIds: preview.unallocatedStudentIds, revision: round.revision + (created.length ? 1 : 0),
      };
      await this.audit(tx, {
        roundId, actorId: actor.id, action: InterviewAuditAction.AUTO_ALLOCATION_COMMITTED,
        idempotencyKey: input.idempotencyKey, details: { planHash: input.planHash, result },
      });
      return { ...result, idempotentReplay: false };
    });
  }

  async publishRound(roundId: string, actor: Actor) {
    return this.transaction(async tx => {
      const round = await this.lockRound(tx, roundId);
      if (round.status === InterviewRoundStatus.PUBLISHED) return round;
      if (round.status === InterviewRoundStatus.FINALIZED) throw fail(409, 'This interview round is already finalized.');
      if (round.eligibilityThreshold !== SESSION_V_PASS_MARKS || round.maximumMarks !== 100) {
        throw fail(409, 'Session V eligibility is fixed at 60/100. Recreate this as a campaign-level round.');
      }
      await this.lockCampaignResults(tx, round.sessionRef);
      const campaign = await this.loadCampaignSnapshot(tx, round.sessionRef, roundId);
      if (campaign.sourceStatus !== 'VERIFIED') throw fail(409, campaign.sourceMessage, 'OFFICIAL_RESULTS_INCOMPLETE');
      if (campaign.reviewRequiredCount) throw fail(409, 'Review assignments whose official result revision or eligibility changed before publishing.');
      const assignments = campaign.assignments;
      const assignedIds = new Set(assignments.map(item => item.studentId));
      if (campaign.candidates.some(item => item.eligibility.status === 'QUALIFIED' && !assignedIds.has(item.student.id))) {
        throw fail(409, 'Assign every qualified candidate before publishing this interview round.');
      }
      const now = new Date();
      const unlocked = assignments.filter(item => !item.isLocked);
      for (const assignment of unlocked) {
        await tx.interviewAssignment.update({
          where: { id: assignment.id }, data: { isLocked: true, lockedAt: now, lockedById: actor.id },
        });
        await this.audit(tx, {
          roundId, hallId: assignment.hallId, assignmentId: assignment.id, studentId: assignment.studentId,
          actorId: actor.id, action: InterviewAuditAction.LOCKED, reason: 'Locked when interview allocations were published.',
        });
      }
      const published = await tx.interviewRound.update({
        where: { id: roundId },
        data: { status: InterviewRoundStatus.PUBLISHED, publishedAt: now, publishedById: actor.id, revision: { increment: 1 } },
      });
      await this.audit(tx, {
        roundId, actorId: actor.id, action: InterviewAuditAction.ROUND_PUBLISHED,
        details: { assignmentCount: assignments.length, lockedAtPublication: unlocked.length, campaignReference: round.sessionRef },
      });
      return published;
    });
  }

  async finalizeRound(roundId: string, reason: string, actor: Actor) {
    if (actor.role !== 'SUPER_ADMIN') throw fail(403, 'Only a Super Admin can finalize an interview round.');
    if (reason.trim().length < 3) throw fail(400, 'A reason is required to finalize an interview round.');
    return this.transaction(async tx => {
      const round = await this.lockRound(tx, roundId);
      if (round.status !== InterviewRoundStatus.PUBLISHED) throw fail(409, 'Only a published interview round can be finalized.');
      await this.lockCampaignResults(tx, round.sessionRef);
      const campaign = await this.loadCampaignSnapshot(tx, round.sessionRef, roundId);
      if (campaign.sourceStatus !== 'VERIFIED' || campaign.reviewRequiredCount) {
        throw fail(409, 'Finalization is blocked while official results or assignment reviews are outstanding.');
      }
      const finalized = await tx.interviewRound.update({
        where: { id: roundId }, data: { status: InterviewRoundStatus.FINALIZED, revision: { increment: 1 } },
      });
      await this.audit(tx, { roundId, actorId: actor.id, action: InterviewAuditAction.ROUND_FINALIZED, reason });
      return finalized;
    });
  }

  async listAudit(roundId: string, page = 1, limit = 50) {
    if (!await this.db.interviewRound.findUnique({ where: { id: roundId }, select: { id: true } })) throw fail(404, 'Interview round not found.');
    const [rows, total] = await Promise.all([
      this.db.interviewAllocationAudit.findMany({
        where: { roundId }, include: { actor: { select: { id: true, name: true, role: true } } },
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * limit, take: limit,
      }),
      this.db.interviewAllocationAudit.count({ where: { roundId } }),
    ]);
    return { rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }
}
export const interviewsService = new InterviewsService();
