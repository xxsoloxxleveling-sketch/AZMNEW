import { createHash, randomUUID } from 'node:crypto';
import { Prisma, PrismaClient, InterviewPanelRevision } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { loadFinalWrittenMarks, FinalWrittenMarkResolution } from './finalWrittenMarks';
import {
  AssessmentDto, AssessmentInput, AssessmentRosterQuery, INTERVIEW_ASSESSMENT_POLICY,
  PanelDto, PanelInput, PanelMember, WrittenMarkDto, assessmentPanelSchema, assessmentSaveSchema,
} from './assessment.schema';
import {
  assessmentCompletionIssues, calculateAssessmentTotals, exactMeritNumerator, rankWithinClasses, sameWrittenRevision,
} from './assessment.calculation';

type Db = PrismaClient | Prisma.TransactionClient;
type Actor = { id: string; role: string; name?: string };
type AssessmentRow = Prisma.InterviewAssessmentRevisionGetPayload<{ include: { panelRevision: true } }>;
const studentSelect = { id: true, rollNumber: true, fullName: true, currentClass: true } as const;
type Placement = Prisma.InterviewFixedPlacementGetPayload<{ include: { student: { select: typeof studentSelect } } }>;
const fail = (statusCode: number, message: string, code = 'INTERVIEW_ASSESSMENT_CONFLICT') =>
  Object.assign(new Error(message), { statusCode, code });

function requireAdmin(actor: Actor) {
  if (!['ADMIN', 'SUPER_ADMIN'].includes(actor.role)) throw fail(403, 'Only an administrator may manage interview assessments.');
}
function panelDto(panel: InterviewPanelRevision): PanelDto {
  return { id: panel.id, panel: panel.panel, revision: panel.revision, members: panel.members as unknown as PanelMember[] };
}
export function writtenMarkDto(resolution?: FinalWrittenMarkResolution): WrittenMarkDto {
  const result = resolution?.result;
  return {
    marks: result?.marks ?? null, maximumMarks: result?.maximumMarks ?? 100,
    isFinal: Boolean(result?.isFinal), sourceType: result?.sourceType ?? null,
    reference: result?.reference ?? null, revision: result?.revision ?? null,
    status: resolution?.eligibility.status ?? 'PENDING_VERIFICATION',
  };
}
function rowInput(row: AssessmentRow): AssessmentInput {
  return {
    expectedRevision: row.revision, panelRevision: row.panelRevision.revision,
    idempotencyKey: row.idempotencyKey ?? 'historical-record',
    attendance: row.attendance as AssessmentInput['attendance'], scores: row.scores as unknown as AssessmentInput['scores'],
    extracurricular: row.extracurricular === null ? null : Number(row.extracurricular),
    extracurricularEvidence: row.extracurricularEvidence, extracurricularReviewed: row.extracurricularReviewed,
    academic: row.academic === null ? null : Number(row.academic), academicEvidence: row.academicEvidence,
    academicReviewed: row.academicReviewed, notes: row.notes, reason: row.reason,
  };
}
function assessmentDto(row: AssessmentRow, currentPanel?: InterviewPanelRevision,
  currentWritten?: WrittenMarkDto, currentClass?: string): AssessmentDto {
  const input = rowInput(row), written = row.writtenSnapshot as unknown as WrittenMarkDto;
  const issues = assessmentCompletionIssues(input, written);
  if (currentPanel && currentPanel.id !== row.panelRevisionId) issues.push('Panel membership changed. Review the current three members and submit a correction.');
  if (currentWritten && !sameWrittenRevision(written, currentWritten)) issues.push('The final written mark or its verification revision changed. Review and resubmit.');
  if (currentClass !== undefined && currentClass !== row.classSnapshot) issues.push('The candidate class changed. Review and resubmit before merit ranking.');
  return {
    id: row.id, revision: row.revision, status: row.status as AssessmentDto['status'], attendance: input.attendance,
    panelRevision: row.panelRevision.revision, members: panelDto(row.panelRevision).members,
    scores: input.scores, extracurricular: input.extracurricular, extracurricularEvidence: input.extracurricularEvidence,
    extracurricularReviewed: input.extracurricularReviewed, academic: input.academic,
    academicEvidence: input.academicEvidence, academicReviewed: input.academicReviewed,
    notes: row.notes, reason: row.reason, actorName: row.actorName, createdAt: row.createdAt.toISOString(),
    written, policyVersion: row.policyVersion, totals: calculateAssessmentTotals(input, written), issues,
  };
}

export class InterviewAssessmentService {
  constructor(private readonly db: PrismaClient = prisma, private readonly writtenLoader = loadFinalWrittenMarks) {}

  private async transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>, readOnly = false): Promise<T> {
    try {
      return await this.db.$transaction(work, {
        isolationLevel: readOnly ? Prisma.TransactionIsolationLevel.RepeatableRead : Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 10000, timeout: 20000,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2034', 'P2002'].includes(error.code)) {
        throw fail(409, 'This assessment changed while saving. Reload its current revision before retrying.');
      }
      throw error;
    }
  }

  private async round(db: Db, roundId: string, lock = false) {
    if (lock) await db.$queryRaw(Prisma.sql`SELECT "id" FROM "InterviewRound" WHERE "id"=${roundId} FOR UPDATE`);
    const round = await db.interviewRound.findUnique({ where: { id: roundId } });
    if (!round) throw fail(404, 'Interview round not found.');
    if (round.sessionRef !== '2026-V') throw fail(409, 'This assessment policy applies to Session V 2026 only.');
    return round;
  }

  private async latestPanels(db: Db, roundId: string) {
    return db.interviewPanelRevision.findMany({
      where: { roundId }, distinct: ['panel'], orderBy: [{ panel: 'asc' }, { revision: 'desc' }],
    });
  }

  private async context(db: Db, roundId: string) {
    await this.round(db, roundId);
    const [schedule, panels, assessments] = await Promise.all([
      db.interviewFixedSchedule.findUnique({ where: { roundId }, include: {
        placements: { include: { student: { select: studentSelect } }, orderBy: [{ panel: 'asc' }, { batch: 'asc' }, { sequence: 'asc' }] },
      } }),
      this.latestPanels(db, roundId),
      db.interviewAssessmentRevision.findMany({
        where: { roundId }, distinct: ['placementId'], orderBy: [{ placementId: 'asc' }, { revision: 'desc' }], include: { panelRevision: true },
      }),
    ]);
    const placements = schedule?.placements ?? [];
    const written = await this.writtenLoader(db, placements.map(row => row.studentId));
    return {
      placements, panels, panelByNumber: new Map(panels.map(panel => [panel.panel, panel])),
      assessmentByPlacement: new Map(assessments.map(row => [row.placementId, row])), written,
    };
  }

  private rosterRow(placement: Placement, context: Awaited<ReturnType<InterviewAssessmentService['context']>>) {
    const written = writtenMarkDto(context.written.get(placement.studentId));
    const assessment = context.assessmentByPlacement.get(placement.id);
    return {
      placementId: placement.id, studentId: placement.studentId, rollNumber: placement.student.rollNumber,
      studentName: placement.student.fullName, className: placement.student.currentClass,
      panel: placement.panel, batch: placement.batch, sequence: placement.sequence, slotTime: placement.slotTime,
      printedMarks: placement.printedMarks, written,
      assessment: assessment ? assessmentDto(assessment, context.panelByNumber.get(placement.panel), written, placement.student.currentClass) : null,
    };
  }

  async panels(roundId: string) {
    await this.round(this.db, roundId);
    return (await this.latestPanels(this.db, roundId)).map(panelDto);
  }

  async savePanel(roundId: string, panel: number, rawInput: PanelInput, actor: Actor) {
    requireAdmin(actor);
    if (!Number.isInteger(panel) || panel < 1 || panel > 6) throw fail(400, 'Choose an existing panel from 1 to 6.');
    const input = assessmentPanelSchema.parse(rawInput);
    return this.transaction(async tx => {
      await this.round(tx, roundId, true);
      const placement = await tx.interviewFixedPlacement.findFirst({ where: { panel, schedule: { roundId } }, select: { id: true } });
      if (!placement) throw fail(409, 'Import the approved fixed timetable before configuring this panel.');
      const current = await tx.interviewPanelRevision.findFirst({ where: { roundId, panel }, orderBy: { revision: 'desc' } });
      if ((current?.revision ?? 0) !== input.expectedRevision) throw fail(409, 'Panel membership changed. Reload before saving.');
      const submitted = await tx.interviewAssessmentRevision.findFirst({
        where: { roundId, panelRevision: { panel }, status: 'SUBMITTED' }, select: { id: true },
      });
      if (submitted && actor.role !== 'SUPER_ADMIN') throw fail(403, 'Only a Super Admin may change a panel after assessments were submitted.');
      const members = input.members.map((member, index) => ({ id: randomUUID(), name: member.name.replace(/\s+/g, ' '), position: index + 1 }));
      const saved = await tx.interviewPanelRevision.create({ data: {
        roundId, panel, revision: input.expectedRevision + 1, members,
        reason: input.reason, actorId: actor.id, actorName: actor.name ?? actor.id,
      } });
      return panelDto(saved);
    });
  }

  async roster(roundId: string, query: AssessmentRosterQuery) {
    return this.transaction(async tx => {
      const context = await this.context(tx, roundId);
      const search = query.search?.toLocaleLowerCase('en');
      const rows = context.placements.filter(row => (!query.panel || row.panel === query.panel)
        && (!query.batch || row.batch === query.batch) && (!query.className || row.student.currentClass === query.className)
        && (!search || [row.student.fullName, row.student.rollNumber ?? ''].some(value => value.toLocaleLowerCase('en').includes(search))));
      return {
        roundId, policyVersion: INTERVIEW_ASSESSMENT_POLICY, panels: context.panels.map(panelDto),
        panelOptions: [...new Set(context.placements.map(row => row.panel))].sort((a, b) => a - b),
        batchOptions: [...new Set(context.placements.map(row => row.batch))].sort((a, b) => a - b),
        classOptions: [...new Set(context.placements.map(row => row.student.currentClass))].sort(),
        rows: rows.slice((query.page - 1) * query.limit, query.page * query.limit).map(row => this.rosterRow(row, context)),
        pagination: { page: query.page, limit: query.limit, total: rows.length, totalPages: Math.ceil(rows.length / query.limit) },
      };
    }, true);
  }

  async candidate(roundId: string, placementId: string) {
    return this.transaction(async tx => {
      const context = await this.context(tx, roundId);
      const placement = context.placements.find(row => row.id === placementId);
      if (!placement) throw fail(404, 'Candidate is not in this round\'s fixed timetable.');
      const panel = context.panelByNumber.get(placement.panel);
      const submitted = await tx.interviewAssessmentRevision.findFirst({
        where: { placementId, status: 'SUBMITTED' }, select: { id: true },
      });
      return { ...this.rosterRow(placement, context), panelConfiguration: panel ? panelDto(panel) : null,
        hasSubmittedAssessment: Boolean(submitted) };
    }, true);
  }

  async history(roundId: string, placementId: string) {
    await this.round(this.db, roundId);
    const placement = await this.db.interviewFixedPlacement.findFirst({ where: { id: placementId, schedule: { roundId } }, select: { id: true } });
    if (!placement) throw fail(404, 'Candidate is not in this round\'s fixed timetable.');
    const history = await this.db.interviewAssessmentRevision.findMany({ where: { roundId, placementId }, orderBy: { revision: 'desc' }, include: { panelRevision: true }, take: 100 });
    return history.map(row => assessmentDto(row));
  }

  async save(roundId: string, placementId: string, rawInput: AssessmentInput, actor: Actor, submit = false) {
    requireAdmin(actor);
    const input = assessmentSaveSchema.parse(rawInput);
    const status = submit ? 'SUBMITTED' : 'DRAFT';
    const requestHash = createHash('sha256').update(JSON.stringify({ roundId, placementId, status, actorId: actor.id, input })).digest('hex');
    return this.transaction(async tx => {
      await this.round(tx, roundId, true);
      const replay = await tx.interviewAssessmentRevision.findUnique({
        where: { roundId_idempotencyKey: { roundId, idempotencyKey: input.idempotencyKey } }, include: { panelRevision: true },
      });
      if (replay) {
        if (replay.requestHash !== requestHash || replay.actorId !== actor.id) throw fail(409, 'This save key was already used for a different request.');
        return assessmentDto(replay);
      }
      const placement = await tx.interviewFixedPlacement.findFirst({
        where: { id: placementId, schedule: { roundId } }, include: { student: { select: studentSelect } },
      });
      if (!placement) throw fail(404, 'Candidate is not in this round\'s fixed timetable.');
      const [current, panel, submitted] = await Promise.all([
        tx.interviewAssessmentRevision.findFirst({ where: { placementId }, orderBy: { revision: 'desc' }, include: { panelRevision: true } }),
        tx.interviewPanelRevision.findFirst({ where: { roundId, panel: placement.panel }, orderBy: { revision: 'desc' } }),
        tx.interviewAssessmentRevision.findFirst({ where: { placementId, status: 'SUBMITTED' }, select: { id: true } }),
      ]);
      if ((current?.revision ?? 0) !== input.expectedRevision) throw fail(409, 'Another administrator saved a newer assessment. Reload before saving.');
      if (!panel || panel.revision !== input.panelRevision) throw fail(409, 'Configure or reload the current three panel members before entering marks.');
      const members = panelDto(panel).members;
      if (input.scores.some(card => !members.some(member => member.id === card.memberId))) throw fail(409, 'Scorecard members do not match the current panel. Reload and review each mark.');
      if (submitted) {
        if (actor.role !== 'SUPER_ADMIN') throw fail(403, 'Only a Super Admin may correct a previously submitted assessment.');
        if (input.reason.length < 3) throw fail(400, 'Record a reason for correcting the submitted assessment.');
      }
      const written = writtenMarkDto((await this.writtenLoader(tx, [placement.studentId])).get(placement.studentId));
      const issues = assessmentCompletionIssues(input, written);
      if (submit && issues.length) throw Object.assign(fail(400, 'Complete the assessment before submitting.', 'INTERVIEW_ASSESSMENT_INCOMPLETE'), { details: { issues } });
      const saved = await tx.interviewAssessmentRevision.create({ data: {
        roundId, placementId, panelRevisionId: panel.id, revision: input.expectedRevision + 1, status,
        attendance: input.attendance, scores: input.scores,
        extracurricular: input.extracurricular, extracurricularEvidence: input.extracurricularEvidence,
        extracurricularReviewed: input.extracurricularReviewed,
        academic: input.academic, academicEvidence: input.academicEvidence, academicReviewed: input.academicReviewed,
        notes: input.notes, reason: input.reason, classSnapshot: placement.student.currentClass,
        writtenSnapshot: written, policyVersion: INTERVIEW_ASSESSMENT_POLICY,
        actorId: actor.id, actorName: actor.name ?? actor.id,
        idempotencyKey: input.idempotencyKey, requestHash,
      }, include: { panelRevision: true } });
      return assessmentDto(saved);
    });
  }

  async merit(roundId: string, className?: string) {
    return this.transaction(async tx => {
      const context = await this.context(tx, roundId);
      const classOptions = [...new Set(context.placements.map(row => row.student.currentClass))].sort();
      const rows = context.placements.filter(row => !className || row.student.currentClass === className).map(placement => {
        const row = this.rosterRow(placement, context), record = context.assessmentByPlacement.get(placement.id);
        const issues = [...(row.assessment?.issues ?? ['No assessment has been saved.'])];
        let status: 'READY' | 'INCOMPLETE' | 'ABSENT' | 'SOURCE_CHANGED' = 'INCOMPLETE';
        if (record && row.assessment) {
          const changed = record.panelRevisionId !== context.panelByNumber.get(placement.panel)?.id
            || record.classSnapshot !== placement.student.currentClass
            || !sameWrittenRevision(row.assessment.written, row.written);
          if (record.attendance === 'ABSENT') status = 'ABSENT';
          else if (record.status === 'SUBMITTED' && changed) status = 'SOURCE_CHANGED';
          else if (record.status === 'SUBMITTED' && !issues.length) status = 'READY';
          else if (record.status !== 'SUBMITTED') issues.push('Assessment is a draft; submit it before merit ranking.');
        }
        const totals = row.assessment?.totals ?? calculateAssessmentTotals({ attendance: 'UNKNOWN', scores: [], extracurricular: null, academic: null }, row.written);
        return {
          placementId: row.placementId, studentId: row.studentId, rollNumber: row.rollNumber,
          studentName: row.studentName, className: row.className, panel: row.panel, batch: row.batch,
          rank: null as number | null, status, assessmentStatus: record?.status ?? 'NOT_STARTED',
          written: row.written, issues, totals,
          numerator: status === 'READY' && record ? exactMeritNumerator(rowInput(record), row.written) : null,
        };
      });
      const ranked = rankWithinClasses(rows.filter(row => row.numerator !== null).map(row => ({ row, numerator: row.numerator! })));
      const rankByPlacement = new Map(ranked.map(row => [row.placementId, row.rank]));
      const result = rows.map(({ numerator: _numerator, ...row }) => ({ ...row, rank: rankByPlacement.get(row.placementId) ?? null }))
        .sort((a, b) => a.className.localeCompare(b.className) || (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER)
          || a.studentName.localeCompare(b.studentName) || a.placementId.localeCompare(b.placementId));
      return {
        provisional: true, publicationEnabled: false, policyVersion: INTERVIEW_ASSESSMENT_POLICY,
        rankMethod: 'SHARED_COMPETITION_WITHIN_CLASS', classOptions, rows: result,
        summary: { total: result.length, ready: result.filter(row => row.status === 'READY').length,
          incomplete: result.filter(row => row.status === 'INCOMPLETE' || row.status === 'SOURCE_CHANGED').length,
          absent: result.filter(row => row.status === 'ABSENT').length },
      };
    }, true);
  }
}

export const interviewAssessmentService = new InterviewAssessmentService();
