import { createHash } from 'node:crypto';
import { InterviewAuditAction, InterviewRoundStatus, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import {
  decodeScheduleCsvBase64, FINAL_SCHEDULE_DATE, FINAL_SCHEDULE_ROWS,
  FixedPlacementRow, InvalidFixedSchedule, validateFixedSchedule,
} from './fixedSchedule';

type Actor = { id: string; role: string };
type Database = Prisma.TransactionClient | typeof prisma;
export type FixedScheduleRequest = { csvBase64: string; pdfSha256: string };
export type FixedScheduleCommitRequest = FixedScheduleRequest & {
  expectedRevision: number; planHash: string; confirmed: true;
};

function error(statusCode: number, message: string, code = 'FIXED_SCHEDULE_CONFLICT') {
  return Object.assign(new Error(message), { statusCode, code });
}

function requireSuperAdmin(actor: Actor) {
  if (actor.role !== 'SUPER_ADMIN') throw error(403, 'Only a Super Admin may import the approved final schedule.');
}
function checkRound(round: { sessionRef: string; status: InterviewRoundStatus }) {
  if (round.sessionRef !== '2026-V') throw error(409, 'Only the Session V campaign may use the approved 2026 timetable.');
  if (round.status === InterviewRoundStatus.PUBLISHED || round.status === InterviewRoundStatus.FINALIZED) {
    throw error(409, 'Published and finalized interview rounds cannot be imported into.');
  }
}

class FixedScheduleService {
  async get(roundId: string) {
    const round = await prisma.interviewRound.findUnique({ where: { id: roundId }, select: { id: true } });
    if (!round) throw error(404, 'Interview round not found.');
    const schedule = await prisma.interviewFixedSchedule.findUnique({
      where: { roundId },
      include: {
        placements: {
          include: { student: { select: { id: true, rollNumber: true, fullName: true, currentClass: true } } },
          orderBy: [{ panel: 'asc' }, { batch: 'asc' }, { sequence: 'asc' }],
        },
      },
    });
    if (!schedule) return { imported: false, placements: [], panels: [] };
    const panels = Array.from({ length: 6 }, (_, i) => ({
      panel: i + 1,
      batches: [1, 2].map(batch => ({
        batch,
        count: schedule.placements.filter(row => row.panel === i + 1 && row.batch === batch).length,
        start: batch === 1 ? '09:00 AM' : '11:30 AM',
        end: batch === 1 ? '11:30 AM' : '02:00 PM',
      })),
    }));
    return {
      imported: true, importedAt: schedule.importedAt, pdfSha256: schedule.pdfSha256,
      csvSha256: schedule.csvSha256, interviewDate: schedule.interviewDate,
      lockedCount: schedule.placements.length, panels,
      placements: schedule.placements.map(({ student, ...row }) => ({
        panel: row.panel, batch: row.batch, sequence: row.sequence, slotTime: row.slotTime,
        printedMarks: row.printedMarks, studentId: student.id,
        rollNumber: student.rollNumber, studentName: student.fullName,
        currentClass: student.currentClass, isLocked: true,
      })),
    };
  }

  private async prepare(db: Database, roundId: string, input: FixedScheduleRequest) {
    const round = await db.interviewRound.findUnique({ where: { id: roundId } });
    if (!round) throw error(404, 'Interview round not found.');
    checkRound(round);

    let document: ReturnType<typeof validateFixedSchedule>;
    try {
      document = validateFixedSchedule(decodeScheduleCsvBase64(input.csvBase64), input.pdfSha256);
    } catch (cause) {
      if (cause instanceof InvalidFixedSchedule) throw error(400, cause.message, 'INVALID_FINAL_SCHEDULE');
      throw cause;
    }
    const prior = await db.interviewFixedSchedule.findUnique({
      where: { roundId }, select: { id: true, csvSha256: true, pdfSha256: true },
    });
    if (prior && (prior.csvSha256 !== document.csvSha256 || prior.pdfSha256 !== document.pdfSha256)) {
      throw error(409, 'A different final schedule is already committed. An audited amendment is required.');
    }
    const rollNumbers = document.rows.map(row => row.rollNumber);
    const students = await db.student.findMany({
      where: { rollNumber: { in: rollNumbers } },
      select: { id: true, rollNumber: true, fullName: true },
    });
    const byRoll = new Map(students.map(student => [student.rollNumber, student]));
    const missing = rollNumbers.filter(roll => !byRoll.has(roll));
    // Treat official verified/published results as discrepancy checks only.
    // This administrative timetable is NOT a substitute for the official Gazette.
    const officialRows = students.length ? await db.examinationResult.findMany({
      where: { studentId: { in: students.map(s => s.id) }, examination: { sessionReference: '2026-V' } },
      select: {
        studentId: true, obtainedMarks: true, verificationStatus: true,
        publicationStatus: true, examination: { select: { publicationStatus: true } },
      },
    }) : [];
    const approved = new Map<string, number[]>();
    for (const item of officialRows) {
      if (item.verificationStatus === 'VERIFIED' && item.publicationStatus === 'PUBLISHED' &&
          item.examination.publicationStatus === 'PUBLISHED') {
        approved.set(item.studentId, [...(approved.get(item.studentId) ?? []), Number(item.obtainedMarks)]);
      }
    }
    const conflicts = document.rows.flatMap(row => {
      const student = byRoll.get(row.rollNumber);
      if (!student) return [];
      const scores = approved.get(student.id) ?? [];
      return scores.length > 1 || (scores.length === 1 && scores[0] !== row.printedMarks)
        ? [{ rollNumber: row.rollNumber, reason: scores.length > 1 ? 'MULTIPLE_APPROVED_RESULTS' : 'MARKS_MISMATCH' }] : [];
    });
    const occupied = await db.interviewAssignment.count({ where: { roundId } });
    const planHash = createHash('sha256').update(JSON.stringify({
      roundId, revision: round.revision, csvSha256: document.csvSha256,
      pdfSha256: document.pdfSha256,
      matched: document.rows.map(row => [row.rollNumber, byRoll.get(row.rollNumber)?.id ?? null]),
      conflicts, occupied, imported: Boolean(prior),
    })).digest('hex');
    return {
      round, document, prior, byRoll, missing, conflicts, occupied, planHash,
      matchedCount: document.rows.length - missing.length,
      canCommit: missing.length === 0 && conflicts.length === 0 && occupied === 0,
    };
  }

  async preview(roundId: string, input: FixedScheduleRequest, actor: Actor) {
    requireSuperAdmin(actor);
    const plan = await this.prepare(prisma, roundId, input);
    return {
      roundId, expectedRevision: plan.round.revision, planHash: plan.planHash,
      csvSha256: plan.document.csvSha256, pdfSha256: plan.document.pdfSha256,
      candidateCount: FINAL_SCHEDULE_ROWS, matchedCount: plan.matchedCount,
      batches: plan.document.batches, missingRollNumbers: plan.missing,
      resultConflicts: plan.conflicts, existingAssignments: plan.occupied,
      alreadyImported: Boolean(plan.prior), canCommit: plan.canCommit,
      sourceType: 'APPROVED_ADMINISTRATIVE_PLACEMENT_NOT_OFFICIAL_MARKS',
      // Avoid transmitting names/PII as part of the preview report.
    };
  }

  async commit(roundId: string, input: FixedScheduleCommitRequest, actor: Actor) {
    requireSuperAdmin(actor);
    if (input.confirmed !== true) throw error(400, 'Explicit Super Admin confirmation is required.');
    return prisma.$transaction(async tx => {
      const locked = await tx.$queryRawUnsafe<Array<{ id: string }>>(
        'SELECT "id" FROM "InterviewRound" WHERE "id"=$1 FOR UPDATE', roundId,
      );
      if (locked.length !== 1) throw error(404, 'Interview round not found.');
      const plan = await this.prepare(tx, roundId, input);
      // The identical approved file is a no-op even after the round revision increments.
      if (plan.prior && plan.prior.csvSha256 === plan.document.csvSha256 &&
          plan.prior.pdfSha256 === plan.document.pdfSha256) {
        return { imported: false, idempotentReplay: true, count: FINAL_SCHEDULE_ROWS };
      }
      if (plan.round.revision !== input.expectedRevision || plan.planHash !== input.planHash) {
        throw error(409, 'The import preview is stale. Refresh and review the schedule again.');
      }
      if (!plan.canCommit) throw error(409, 'Not all 349 candidates match safely. Resolve the preview conflicts before importing.');

      const schedule = await tx.interviewFixedSchedule.create({
        data: {
          roundId, csvSha256: plan.document.csvSha256, pdfSha256: plan.document.pdfSha256,
          interviewDate: new Date(FINAL_SCHEDULE_DATE + 'T00:00:00.000Z'), importedById: actor.id,
        },
      });
      await tx.interviewFixedPlacement.createMany({
        data: plan.document.rows.map((row: FixedPlacementRow) => ({
          scheduleId: schedule.id, studentId: plan.byRoll.get(row.rollNumber)!.id,
          panel: row.panel, batch: row.batch, sequence: row.sequence,
          slotTime: row.slotTime, printedMarks: row.printedMarks,
        })),
      });
      await tx.interviewAllocationAudit.create({
        data: {
          roundId, actorId: actor.id, action: InterviewAuditAction.FIXED_SCHEDULE_IMPORTED,
          reason: 'Imported final approved 22 November 2026 panel and batch schedule.',
          details: {
            pdfSha256: plan.document.pdfSha256, csvSha256: plan.document.csvSha256,
            placementCount: FINAL_SCHEDULE_ROWS, panelCount: 6, batchCount: 12,
            evidenceType: 'ADMIN_APPROVED_TIMETABLE_NOT_OFFICIAL_RESULTS',
          },
        },
      });
      await tx.interviewRound.update({ where: { id: roundId }, data: { revision: { increment: 1 } } });
      return { imported: true, idempotentReplay: false, count: FINAL_SCHEDULE_ROWS };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10000, timeout: 20000 });
  }
}
export const fixedScheduleService = new FixedScheduleService();
