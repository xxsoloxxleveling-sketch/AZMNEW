import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { qrService } from './qr.service';
import { hallDate } from '../exam-halls/examHalls.service';
import { MarkAttendanceInput, ScanAttendanceInput, SessionQueryInput, RosterQueryInput } from './attendance.schema';
import { AppError } from '../../middleware/error.middleware';

function fail(statusCode: number, message: string): never {
  const error: AppError = new Error(message); error.statusCode = statusCode; throw error;
}
export function karachiBusinessDate(now = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const value = (type: string) => parts.find(part => part.type === type)!.value;
  return new Date(`${value('year')}-${value('month')}-${value('day')}T00:00:00.000Z`);
}
const rosterSelect = {
  studentId: true, fullNameSnapshot: true, rollNumberSnapshot: true,
  applicationNoSnapshot: true, currentClassSnapshot: true, seatNoSnapshot: true,
  attendance: { select: { status: true, method: true, createdAt: true } },
} satisfies Prisma.AttendanceSessionCandidateSelect;
function metrics(expectedCount: number, marks: {status: string; method?: string}[]) {
  const presentCount = marks.filter(mark => mark.status === 'PRESENT').length;
  const lateCount = marks.filter(mark => mark.status === 'LATE').length;
  const absentCount = marks.filter(mark => mark.status === 'ABSENT').length;
  return { expectedCount, markedCount: marks.length, presentCount, lateCount, absentCount,
    unmarkedCount: expectedCount - marks.length, manualCount: marks.filter(mark => mark.method === 'MANUAL').length, qrCount: marks.filter(mark => mark.method === 'QR_SCAN').length, completionPercentage: expectedCount > 0 ? Math.round(marks.length / expectedCount * 1000) / 10 : 0,
    attendancePercentage: expectedCount > 0 ? Math.round((presentCount + lateCount) / expectedCount * 1000) / 10 : null };
}
function rosterRow(row: any) {
  const { attendance, ...snapshot } = row;
  return { ...snapshot, status: attendance?.status ?? 'NOT_MARKED', method: attendance?.method ?? null, markedAt: attendance?.createdAt ?? null };
}

export class AttendanceService {
  constructor(private readonly db: PrismaClient = prisma) {}
  private async transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        const result = await this.db.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 15000 });
        if (result === undefined) fail(503, 'Examination attendance database is unavailable.');
        return result;
      } catch (error: any) {
        if (error.code === 'P2002') fail(409, 'This Hall/date session or candidate attendance already exists.');
        const serializationConflict = error.code === 'P2034' || (error.code === 'P2010' && ['40001', '40P01'].includes(error.meta?.code));
        if (!serializationConflict) throw error;
        if (attempt >= 3) fail(409, 'Concurrent examination attendance operation conflicted. Please retry.');
        await new Promise(resolve => setTimeout(resolve, 20 * (attempt + 1)));
      }
    }
  }
  private operator(userId: string) {
    if (!userId?.trim()) fail(401, 'Authenticated attendance operator is required.');
  }
  private async lockSession(tx: Prisma.TransactionClient, sessionId: string) {
    if (!sessionId?.trim()) fail(400, 'Examination attendance session is required.');
    const locked = await tx.$queryRaw<{id: string}[]>`SELECT id FROM "AttendanceSession" WHERE id = ${sessionId} FOR UPDATE`;
    if (!locked.length) fail(404, 'Examination attendance session not found.');
    const session = await tx.attendanceSession.findUniqueOrThrow({ where: { id: sessionId } });
    if (!session.isCurrent) fail(409, 'This attendance attempt has been archived. Refresh the current Hall session.');
    if (session.status !== 'OPEN') fail(409, 'This examination attendance session is CLOSED.');
    return session;
  }
  private async detail(tx: Prisma.TransactionClient, sessionId: string) {
    const session = await tx.attendanceSession.findUnique({ where: { id: sessionId } });
    if (!session) fail(404, 'Examination attendance session not found.');
    const rows = await tx.attendanceSessionCandidate.findMany({ where: { sessionId }, select: rosterSelect, orderBy: [{ seatNoSnapshot: 'asc' }, { studentId: 'asc' }] });
    return { session, stats: metrics(rows.length, rows.flatMap(row => row.attendance ? [row.attendance] : [])), roster: rows.map(rosterRow) };
  }
  async openSession(examHallId: string, userId: string) {
    this.operator(userId);
    if (!examHallId?.trim()) fail(400, 'Examination Hall is required.');
    return this.transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "ExamHall" WHERE id = ${examHallId} FOR UPDATE`;
      const hall = await tx.examHall.findUnique({ where: { id: examHallId }, include: { testCenter: { select: { name: true } } } });
      if (!hall) fail(404, 'Examination Hall not found.');
      const businessDate = hallDate(hall.examDate);
      if (!businessDate) fail(409, 'Configure a valid examination date on this Hall before opening attendance.');
      if (await tx.attendanceSession.findFirst({ where: { examHallId, businessDate, isCurrent: true } })) fail(409, 'An examination attendance session already exists for this Hall and business date.');
      // Snapshot every explicit assignment, independently of class and legacy mirrors.
      const candidates = await tx.student.findMany({ where: { assignedHallId: examHallId, status: 'ACTIVE' }, select: { id: true, fullName: true, rollNumber: true, applicationNo: true, currentClass: true, seatNo: true }, orderBy: { id: 'asc' } });
      if (!candidates.length) fail(409, 'No explicitly assigned candidates are available for this examination Hall. Complete Hall allocation before opening attendance.');
      const session = await tx.attendanceSession.create({ data: {
        examHallId, businessDate, openedByUserId: userId, hallNameSnapshot: hall.name,
        roomNumberSnapshot: hall.roomNumber, testCenterNameSnapshot: hall.testCenter?.name ?? null,
        examDateSnapshot: hall.examDate, reportingTimeSnapshot: hall.reportingTime,
      } });
      await tx.attendanceSessionCandidate.createMany({ data: candidates.map(candidate => ({ sessionId: session.id, studentId: candidate.id, fullNameSnapshot: candidate.fullName, rollNumberSnapshot: candidate.rollNumber, applicationNoSnapshot: candidate.applicationNo, currentClassSnapshot: candidate.currentClass, seatNoSnapshot: candidate.seatNo })) });
      return this.detail(tx, session.id);
    });
  }
  async mark(sessionId: string, input: MarkAttendanceInput, userId: string, returnQrDuplicate = false) {
    this.operator(userId);
    return this.transaction(async tx => {
      const session = await this.lockSession(tx, sessionId);
      let roster;
      let method: 'MANUAL' | 'QR_SCAN' = 'MANUAL';
      if (input.qrToken) {
        if (!qrService.verifySignedQrToken(input.qrToken)) fail(400, 'Invalid or forged QR token signature.');
        if (input.status && input.status !== 'PRESENT') fail(400, 'QR marking only permits PRESENT.');
        const candidate = await tx.student.findUnique({ where: { qrToken: input.qrToken }, select: { id: true } });
        if (!candidate) fail(404, 'Candidate QR token was not found.');
        roster = await tx.attendanceSessionCandidate.findUnique({ where: { sessionId_studentId: { sessionId, studentId: candidate.id } } });
        method = 'QR_SCAN';
      } else if (input.studentId) {
        roster = await tx.attendanceSessionCandidate.findUnique({ where: { sessionId_studentId: { sessionId, studentId: input.studentId } } });
      } else if (input.rollNumber) {
        roster = await tx.attendanceSessionCandidate.findFirst({ where: { sessionId, rollNumberSnapshot: input.rollNumber } });
      } else fail(400, 'Candidate identifier is required.');
      if (!roster) fail(409, 'Candidate does not belong to this frozen Hall session roster. No attendance was marked.');
      const student = await tx.student.findUnique({ where: { id: roster.studentId }, select: { id: true, status: true } });
      if (!student || student.status !== 'ACTIVE') fail(409, 'Only ACTIVE candidates may be marked in this examination session.');
      const existing = await tx.attendance.findUnique({ where: { sessionId_studentId: { sessionId, studentId: student.id } } });
      if (existing) {
        if (!returnQrDuplicate || method !== 'QR_SCAN') fail(409, 'Attendance is already marked for this candidate in this session.');
        return { attendance: existing, student: { id: student.id, fullName: roster.fullNameSnapshot, rollNumber: roster.rollNumberSnapshot, currentClass: roster.currentClassSnapshot, status: student.status }, alreadyMarked: true, message: 'Attendance is already marked for this candidate in this session.' };
      }
      const attendance = await tx.attendance.create({ data: { sessionId, studentId: student.id, date: session.businessDate, status: input.status ?? 'PRESENT', method, markedByUserId: userId } });
      return { attendance, student: { id: student.id, fullName: roster.fullNameSnapshot, rollNumber: roster.rollNumberSnapshot, currentClass: roster.currentClassSnapshot, status: student.status }, message: 'Examination attendance marked successfully.' };
    });
  }
  async scanOrMarkAttendance(input: ScanAttendanceInput, userId: string) {
    return this.mark(input.sessionId, input, userId, !!input.qrToken);
  }
  async closeSession(sessionId: string, markRemainingAbsent: boolean, userId: string) {
    this.operator(userId);
    return this.transaction(async tx => {
      const session = await this.lockSession(tx, sessionId);
      if (markRemainingAbsent) {
        const unmarked = await tx.attendanceSessionCandidate.findMany({ where: { sessionId, attendance: null }, select: { studentId: true } });
        if (unmarked.length) await tx.attendance.createMany({ data: unmarked.map(candidate => ({ sessionId, studentId: candidate.studentId, date: session.businessDate, status: 'ABSENT', method: 'MANUAL', markedByUserId: userId })) });
      }
      await tx.attendanceSession.update({ where: { id: sessionId }, data: { status: 'CLOSED', closedAt: new Date(), closedByUserId: userId } });
      return this.detail(tx, sessionId);
    });
  }
  async getSession(sessionId: string) { return this.transaction(tx => this.detail(tx, sessionId)); }
  async listSessions(query: SessionQueryInput) {
    return this.transaction(async tx => {
      const where = { ...(query.includeHistory ? {} : { isCurrent: true }), ...(query.examHallId ? { examHallId: query.examHallId } : {}), ...(query.businessDate ? { businessDate: hallDate(query.businessDate)! } : {}), ...(query.status ? { status: query.status } : {}) };
      const total = await tx.attendanceSession.count({ where });
      const sessions = await tx.attendanceSession.findMany({ where, orderBy: [{ businessDate: 'desc' }, { isCurrent: 'desc' }, { attemptNumber: 'desc' }, { id: 'asc' }], skip: (query.page - 1) * query.limit, take: query.limit, include: { _count: { select: { candidates: true } }, attendance: { select: { status: true, method: true } } } });
      return { sessions: sessions.map(({ _count, attendance, ...session }) => ({ ...session, stats: metrics(_count.candidates, attendance) })), pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
    });
  }
  async getCandidates(sessionId: string, query: RosterQueryInput) {
    return this.transaction(async tx => {
      if (!await tx.attendanceSession.findUnique({ where: { id: sessionId }, select: { id: true } })) fail(404, 'Examination attendance session not found.');
      const search = query.search ? { contains: query.search, mode: 'insensitive' as const } : undefined;
      const where: Prisma.AttendanceSessionCandidateWhereInput = { sessionId, ...(search ? { OR: [{ fullNameSnapshot: search }, { rollNumberSnapshot: search }, { applicationNoSnapshot: search }, { seatNoSnapshot: search }] } : {}) };
      const total = await tx.attendanceSessionCandidate.count({ where });
      const rows = await tx.attendanceSessionCandidate.findMany({ where, select: rosterSelect, orderBy: { studentId: 'asc' }, skip: (query.page - 1) * query.limit, take: query.limit });
      return { candidates: rows.map(rosterRow), pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
    });
  }
  async getTodayAttendance(now = new Date()) {
    return this.transaction(async tx => {
      const businessDate = karachiBusinessDate(now);
      const sessions = await tx.attendanceSession.findMany({ where: { businessDate, isCurrent: true }, select: { _count: { select: { candidates: true } }, attendance: { select: { status: true, method: true } } } });
      return { date: businessDate.toISOString().slice(0, 10), sessionCount: sessions.length, ...metrics(sessions.reduce((total, session) => total + session._count.candidates, 0), sessions.flatMap(session => session.attendance)) };
    });
  }
  async getStudentAttendanceHistory(studentId: string, query: RosterQueryInput = { page: 1, limit: 25 }) {
    return this.transaction(async tx => {
      const student = await tx.student.findUnique({ where: { id: studentId }, select: { id: true, fullName: true, rollNumber: true, currentClass: true } });
      if (!student) fail(404, 'Candidate not found.');
      const memberships = await tx.attendanceSessionCandidate.findMany({ where: { studentId }, select: { ...rosterSelect, session: true }, orderBy: { session: { businessDate: 'desc' } } });
      const legacy = await tx.attendance.findMany({ where: { studentId, sessionId: null }, select: { id: true, date: true, status: true, method: true, createdAt: true }, orderBy: { date: 'desc' }, skip: (query.page - 1) * query.limit, take: query.limit });
      return { student, stats: metrics(memberships.length, memberships.flatMap(row => row.attendance ? [row.attendance] : [])), history: memberships.slice((query.page - 1) * query.limit, query.page * query.limit).map(({ session, ...row }) => ({ session, ...rosterRow(row) })), pagination: { page: query.page, limit: query.limit, total: memberships.length, totalPages: Math.ceil(memberships.length / query.limit) }, legacyHistory: legacy.map(record => ({ ...record, label: 'Legacy attendance record' })) };
    });
  }
}
export const attendanceService = new AttendanceService();
