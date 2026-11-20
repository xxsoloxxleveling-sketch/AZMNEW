import { createHash } from 'node:crypto';
import {
  InterviewAllocationType, InterviewAuditAction, InterviewHallStatus,
  InterviewRoundStatus, Prisma, PrismaClient,
} from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error.middleware';
import { assessInterviewEligibility, ApprovedResultSource, getAuthoritativeApprovedResult, InterviewEligibility } from './eligibility';

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

  async createRound(input: CreateRoundInput, actor: Actor) {
    return this.transaction(async tx => {
      const session = await tx.attendanceSession.findUnique({ where: { id: input.sessionRef }, select: { id: true } });
      if (!session) throw fail(404, 'Examination session not found in Results.');
      const round = await tx.interviewRound.create({
        data: {
          sessionRef: input.sessionRef, title: input.title, eligibilityThreshold: input.eligibilityThreshold,
          maximumMarks: 100, status: InterviewRoundStatus.OPEN, createdById: actor.id,
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
    const [rosterCount, assignments, halls] = await Promise.all([
      this.db.student.count({ where: { resultSessionId: round.sessionRef, status: 'ACTIVE' } }),
      this.db.interviewAssignment.findMany({ where: { roundId }, select: { isLocked: true } }),
      this.db.interviewHall.findMany({
        where: { roundId, status: InterviewHallStatus.ACTIVE },
        select: { capacity: true, _count: { select: { assignments: true } } },
      }),
    ]);
    const capacity = halls.reduce((sum, hall) => sum + hall.capacity, 0);
    const occupied = halls.reduce((sum, hall) => sum + hall._count.assignments, 0);
    const qualified = 0;
    return {
      round, totalQualifiedCandidates: qualified, allocatedCandidates: assignments.length,
      unassignedCandidates: Math.max(0, qualified - assignments.length),
      pendingVerificationCandidates: rosterCount,
      lockedCandidates: assignments.filter(item => item.isLocked).length,
      activeHallCount: halls.length, totalCapacity: capacity,
      remainingSeats: Math.max(0, capacity - occupied),
      completionPercent: qualified ? Math.round((assignments.length / qualified) * 100) : 0,
      eligibilitySourceStatus: 'UNVERIFIED_SOURCE_UNAVAILABLE',
    };
  }

  async listCandidates(roundId: string, query: CandidateQuery) {
    const round = await this.db.interviewRound.findUnique({ where: { id: roundId } });
    if (!round) throw fail(404, 'Interview round not found.');
    const search = query.search?.trim();
    const where: Prisma.StudentWhereInput = {
      resultSessionId: round.sessionRef, status: 'ACTIVE',
      ...(query.className ? { currentClass: query.className } : {}),
      ...(query.gender ? { gender: query.gender } : {}),
      ...(query.schoolName ? { schoolName: { contains: query.schoolName, mode: 'insensitive' } } : {}),

      ...(search ? { OR: [
        { fullName: { contains: search, mode: 'insensitive' } },
        { applicationNo: { contains: search, mode: 'insensitive' } },
        { rollNumber: { contains: search, mode: 'insensitive' } },
      ] } : {}),
      ...((query.hallId || query.assignment === 'assigned' || query.assignment === 'unassigned') ? {
        AND: [
          ...(query.hallId ? [{ interviewAssignments: { some: { roundId, hallId: query.hallId } } }] : []),
          ...(query.assignment === 'assigned' ? [{ interviewAssignments: { some: { roundId } } }] : []),
          ...(query.assignment === 'unassigned' ? [{ interviewAssignments: { none: { roundId } } }] : []),
        ],
      } : {}),

    };
    if (query.eligibility === 'qualified' || query.eligibility === 'excluded' || query.minimumMarks !== undefined || query.maximumMarks !== undefined) {
      return {
        sessionRef: round.sessionRef, verificationStatus: 'UNVERIFIED', results: [],
        pagination: { page: query.page, limit: query.limit, total: 0, totalPages: 0 },
      };
    }
    const [students, total] = await Promise.all([
      this.db.student.findMany({
        where,
        select: {
          id: true, applicationNo: true, rollNumber: true, fullName: true, currentClass: true,
          hsscGroup: true, schoolName: true, gender: true,
          interviewAssignments: {
            where: { roundId },
            select: {
              id: true, hallId: true, isLocked: true, allocationType: true,
              hall: { select: { name: true, roomNumber: true } },
            }, take: 1,
          },
        },
        orderBy: [{ rollNumber: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }],
        skip: (query.page - 1) * query.limit, take: query.limit,
      }),
      this.db.student.count({ where }),
    ]);
    return {
      sessionRef: round.sessionRef, verificationStatus: 'UNVERIFIED',
      results: students.map(student => {
        const assignment = student.interviewAssignments[0];
        const eligibility = evaluateInterviewResult(getAuthoritativeApprovedResult(student), round.eligibilityThreshold, round.maximumMarks);
        return {
          id: student.id, applicationNo: student.applicationNo, rollNumber: student.rollNumber,
          studentName: student.fullName, className: student.currentClass, groupName: student.hsscGroup,
          schoolName: student.schoolName, gender: student.gender, finalApprovedMarks: null,
          resultVerificationStatus: eligibility.status,
          interviewHall: assignment ? { id: assignment.hallId, name: assignment.hall.name, roomNumber: assignment.hall.roomNumber } : null,
          assignmentStatus: assignment ? assignment.allocationType : 'UNASSIGNED',
          isLocked: assignment?.isLocked ?? false, assignmentId: assignment?.id ?? null,
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
    await tx.$queryRawUnsafe("SELECT pg_advisory_xact_lock(hashtextextended('AZM_INTERVIEW_HALL_SCHEDULE', 0))");
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

  private async getVerifiedStudent(tx: Db, round: { sessionRef: string; eligibilityThreshold: number; maximumMarks: number }, studentId: string) {
    const student = await tx.student.findFirst({
      where: { id: studentId, resultSessionId: round.sessionRef, status: 'ACTIVE' },
      select: { id: true, currentClass: true, hsscGroup: true, rollNumber: true },
    });
    if (!student) throw fail(404, 'Active student not found in this interview round’s examination session.');
    const eligibility = evaluateInterviewResult(getAuthoritativeApprovedResult(student), round.eligibilityThreshold, round.maximumMarks);
    if (eligibility.status !== 'QUALIFIED') {
      throw fail(409, 'Student cannot be assigned until a verified final result on a 100-mark scale confirms qualification.');
    }
    return { student, eligibility };
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
      const hall = await tx.interviewHall.findFirst({ where: { id: input.hallId, roundId, status: InterviewHallStatus.ACTIVE } });
      if (!hall) throw fail(404, 'Active interview hall not found in this round.');
      const existing = await tx.interviewAssignment.findMany({
        where: { roundId, studentId: { in: input.studentIds } }, select: { studentId: true },
      });
      if (existing.length) throw fail(409, 'One or more selected students are already assigned in this interview round.');
      const verified: Array<{ student: any; eligibility: InterviewEligibility }> = [];
      for (const studentId of input.studentIds) verified.push(await this.getVerifiedStudent(tx, round, studentId));
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
      const assignment = await tx.interviewAssignment.findUnique({ where: { id: assignmentId } });
      if (!assignment) throw fail(404, 'Interview assignment not found.');
      if (assignment.isLocked) return assignment;
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

  private async buildPreview(db: Db, roundId: string, strategy: AllocationStrategy) {
    const round = await db.interviewRound.findUnique({ where: { id: roundId } });
    if (!round) throw fail(404, 'Interview round not found.');
    if (round.status === InterviewRoundStatus.FINALIZED) throw fail(409, 'A finalized interview round cannot be allocated.');
    if (round.status === InterviewRoundStatus.PUBLISHED) throw fail(409, 'Published interview allocations cannot be changed.');
    const [students, halls, assignments] = await Promise.all([
      db.student.findMany({
        where: { resultSessionId: round.sessionRef, status: 'ACTIVE' },
        select: { id: true, rollNumber: true, currentClass: true, hsscGroup: true },
        orderBy: [{ rollNumber: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }],
      }),
      db.interviewHall.findMany({
        where: { roundId }, orderBy: [{ interviewDate: 'asc' }, { name: 'asc' }, { roomNumber: 'asc' }, { id: 'asc' }],
      }),
      db.interviewAssignment.findMany({
        where: { roundId }, select: { studentId: true, hallId: true, isLocked: true, queueNumber: true },
        orderBy: [{ hallId: 'asc' }, { studentId: 'asc' }],
      }),
    ]);
    const assignedIds = new Set(assignments.map(item => item.studentId));
    const statuses = students.map(student => ({
      student,
      result: evaluateInterviewResult(getAuthoritativeApprovedResult(student), round.eligibilityThreshold, round.maximumMarks),
    }));
    const pendingCount = statuses.filter(item => item.result.status === 'PENDING_VERIFICATION').length;
    const eligible = statuses.filter(item => item.result.status === 'QUALIFIED' && !assignedIds.has(item.student.id));
    const candidates: AllocationCandidate[] = eligible.map(({ student }) => ({
      studentId: student.id, rollNumber: student.rollNumber, className: student.currentClass, groupName: student.hsscGroup,
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
      students: students.map(student => ({ id: student.id, rollNumber: student.rollNumber, currentClass: student.currentClass, hsscGroup: student.hsscGroup })),
      assignments, halls: halls.map(hall => ({
        id: hall.id, capacity: hall.capacity, allowedClasses: hall.allowedClasses, status: hall.status,
        interviewDate: hall.interviewDate?.toISOString() ?? null,
      })),
      plan: plan.assignments,
    })).digest('hex');
    return {
      roundId, revision: round.revision, strategy,
      totalQualifiedCandidates: eligible.length + assignments.length,
      alreadyAssignedCandidates: assignments.length, lockedCandidates: assignments.filter(item => item.isLocked).length,
      pendingVerificationCandidates: pendingCount, availableHallCapacity: plan.availableHallCapacity,
      toAllocateCount: plan.assignments.length, assignments: plan.assignments,
      unallocatedStudentIds: plan.unallocatedIds, hallProjection: plan.hallProjection, planHash: hash,
      eligibilitySourceStatus: 'UNVERIFIED_SOURCE_UNAVAILABLE',
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
      if (round.revision !== input.expectedRevision) throw fail(409, 'The allocation preview is stale. Refresh the preview before committing.');
      if (round.status === InterviewRoundStatus.PUBLISHED || round.status === InterviewRoundStatus.FINALIZED) {
        throw fail(409, 'This interview round no longer accepts automatic allocation.');
      }
      const preview = await this.buildPreview(tx, roundId, input.strategy);
      if (preview.planHash !== input.planHash) throw fail(409, 'Candidate, hall, or assignment data changed after preview. Refresh before committing.');
      if (preview.unallocatedStudentIds.length && !input.allowPartial) {
        throw fail(409, 'Some qualified students do not fit. Confirm partial allocation explicitly to continue.');
      }
      const created = [];
      for (const row of preview.assignments) {
        const detail = await this.getVerifiedStudent(tx, round, row.studentId);
        if (detail.eligibility.status !== 'QUALIFIED') throw fail(409, 'A candidate result changed after preview. Refresh before committing.');
        const eligible = detail.eligibility;
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
      const students = await tx.student.findMany({
        where: { resultSessionId: round.sessionRef, status: 'ACTIVE' },
        select: { id: true, currentClass: true, hsscGroup: true, rollNumber: true },
      });
      const pending = students.filter(student => evaluateInterviewResult(
        getAuthoritativeApprovedResult(student), round.eligibilityThreshold, round.maximumMarks,
      ).status === 'PENDING_VERIFICATION');
      if (pending.length) throw fail(409, 'This round cannot be published while the examination results remain unverified.');
      const assignments = await tx.interviewAssignment.findMany({ where: { roundId }, select: { studentId: true } });
      const assignedIds = new Set(assignments.map(item => item.studentId));
      if (students.some(student => {
        const status = evaluateInterviewResult(getAuthoritativeApprovedResult(student), round.eligibilityThreshold, round.maximumMarks).status;
        return status === 'QUALIFIED' && !assignedIds.has(student.id);
      })) throw fail(409, 'Assign every qualified candidate before publishing this interview round.');
      const now = new Date();
      const unlocked = await tx.interviewAssignment.findMany({
        where: { roundId, isLocked: false }, select: { id: true, studentId: true, hallId: true },
      });
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
        details: { assignmentCount: assignments.length, lockedAtPublication: unlocked.length },
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
