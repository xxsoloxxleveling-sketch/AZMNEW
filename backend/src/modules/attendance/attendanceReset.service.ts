import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { env } from '../../config/env';
import { hallDate } from '../exam-halls/examHalls.service';
import { ResetScopeInput, ResetConfirmInput, resetScopeSchema, resetConfirmSchema } from './attendance.schema';

function fail(statusCode: number, message: string): never { throw Object.assign(new Error(message), { statusCode }); }
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const key = createHmac('sha256', env.JWT_ACCESS_SECRET).update('azm:attendance-reset:challenge:v1').digest();
const sign = (body: string) => createHmac('sha256', key).update(body).digest('base64url');
type Challenge = { purpose: string; actorId: string; tokenVersion: number; nonce: string; expires: number; scope: ResetScopeInput; fingerprint: string };
export class AttendanceResetService {
  constructor(private readonly db: PrismaClient = prisma, private readonly now = () => new Date()) {}
  private async transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        const value = await this.db.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 15000 });
        if (value === undefined) fail(503, 'Attendance reset database is unavailable.');
        return value;
      } catch (error: any) {
        const retry = error.code === 'P2034' || error.code === 'P2002' || (error.code === 'P2010' && ['40001', '40P01'].includes(error.meta?.code));
        if (!retry) throw error;
        if (attempt >= 3) fail(409, 'Concurrent attendance operation conflicted. Refresh the preview and retry.');
      }
    }
  }
  private async actor(tx: Prisma.TransactionClient, actorId: string, expectedTokenVersion?: number) {
    const rows = await tx.$queryRaw<{id: string; name: string; role: string; status: string; tokenVersion: number}[]>`SELECT id, name, role, status, "tokenVersion" FROM "User" WHERE id = ${actorId} FOR SHARE`;
    const actor = rows[0];
    if (!actor) fail(401, 'Authenticated account is required.');
    if (actor.role !== 'SUPER_ADMIN' || actor.status !== 'ACTIVE') fail(403, 'Only an active Super Admin may reset attendance.');
    if (expectedTokenVersion !== undefined && actor.tokenVersion !== expectedTokenVersion) fail(401, 'Authorization session was invalidated. Log in again.');
    return actor;
  }
  private async snapshot(tx: Prisma.TransactionClient, scope: ResetScopeInput) {
    const sessions = await tx.attendanceSession.findMany({ where: { id: { in: scope.sessionIds } }, orderBy: { id: 'asc' }, include: { candidates: { orderBy: { studentId: 'asc' } }, attendance: { orderBy: { id: 'asc' } }, examHall: { select: { testCenterId: true } } } });
    if (sessions.length !== scope.sessionIds.length) fail(404, 'One or more selected attendance sessions were not found.');
    for (const session of sessions) {
      if (!session.isCurrent || !['OPEN', 'CLOSED'].includes(session.status)) fail(409, 'Only current OPEN or CLOSED attendance attempts can be reset. Archived history is protected.');
      if (session.businessDate.toISOString().slice(0, 10) !== scope.businessDate) fail(400, 'Every selected Hall must belong to the selected examination date.');
      if (scope.testCenterId && session.examHall.testCenterId !== scope.testCenterId) fail(400, 'A selected Hall does not belong to the selected examination center.');
    }
    if (scope.mode === 'EXAM_DATE' || scope.mode === 'CURRENT') {
      const included = await tx.attendanceSession.findMany({ where: { businessDate: hallDate(scope.businessDate)!, isCurrent: true, status: { in: ['OPEN', 'CLOSED'] }, ...(scope.testCenterId ? { examHall: { testCenterId: scope.testCenterId } } : {}) }, select: { id: true } });
      if (included.length !== sessions.length || included.some(row => !scope.sessionIds.includes(row.id))) fail(409, 'Select every current OPEN and CLOSED Hall in this examination date and center scope.');
    }
    const halls = sessions.map(session => ({ sessionId: session.id, examHallId: session.examHallId, hallName: session.hallNameSnapshot, roomNumber: session.roomNumberSnapshot, testCenterName: session.testCenterNameSnapshot, businessDate: scope.businessDate, attemptNumber: session.attemptNumber, status: session.status, expectedCount: session.candidates.length, presentCount: session.attendance.filter(row => row.status === 'PRESENT').length, lateCount: session.attendance.filter(row => row.status === 'LATE').length, absentCount: session.attendance.filter(row => row.status === 'ABSENT').length, manualCount: session.attendance.filter(row => row.method === 'MANUAL').length, qrCount: session.attendance.filter(row => row.method === 'QR_SCAN').length, markedCount: session.attendance.length, completionPercentage: session.candidates.length ? Math.round(session.attendance.length / session.candidates.length * 1000) / 10 : 0, lastMarkAt: session.attendance.reduce<string | null>((latest, row) => !latest || row.createdAt.toISOString() > latest ? row.createdAt.toISOString() : latest, null), staffActivity: 'UNKNOWN' as const }));
    const totals = { expectedCount: 0, presentCount: 0, lateCount: 0, absentCount: 0, manualCount: 0, qrCount: 0, markedCount: 0, completionPercentage: 0 };
    for (const hall of halls) for (const field of ['expectedCount','presentCount','lateCount','absentCount','manualCount','qrCount','markedCount'] as const) totals[field] += hall[field];
    totals.completionPercentage = totals.expectedCount ? Math.round(totals.markedCount / totals.expectedCount * 1000) / 10 : 0;
    return { sessions, halls, totals, fingerprint: hash(sessions) };
  }
  async preview(input: ResetScopeInput, actorId: string, expectedTokenVersion?: number) {
    const parsed = resetScopeSchema.parse(input);
    const scope = { ...parsed, sessionIds: [...parsed.sessionIds].sort() };
    return this.transaction(async tx => {
      const actor = await this.actor(tx, actorId, expectedTokenVersion);
      const snapshot = await this.snapshot(tx, scope);
      const expires = this.now().getTime() + 5 * 60 * 1000;
      const payload: Challenge = { purpose: 'attendance-reset-v1', actorId, tokenVersion: actor.tokenVersion, nonce: randomUUID(), expires, scope, fingerprint: snapshot.fingerprint };
      const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
      return { challenge: body + '.' + sign(body), expiresAt: new Date(expires).toISOString(), scope, halls: snapshot.halls, totals: snapshot.totals };
    });
  }
  private decode(challenge: string): Challenge {
    try {
      const [body, signature, extra] = challenge.split('.');
      const expected = Buffer.from(sign(body)), actual = Buffer.from(signature ?? '');
      if (extra || expected.length !== actual.length || !timingSafeEqual(expected, actual)) fail(400, 'Invalid reset confirmation challenge.');
      const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as Challenge;
      if (payload.purpose !== 'attendance-reset-v1' || !Number.isFinite(payload.expires) || !payload.nonce || !payload.actorId) fail(400, 'Invalid reset confirmation challenge.');
      payload.scope = resetScopeSchema.parse(payload.scope);
      return payload;
    } catch { fail(400, 'Invalid reset confirmation challenge.'); }
  }
  async confirm(input: ResetConfirmInput, actorId: string, idempotencyKey: string, expectedTokenVersion?: number) {
    input = resetConfirmSchema.parse(input);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey || '')) fail(400, 'A unique UUID Idempotency-Key is required.');
    const requestHash = hash(input);
    return this.transaction(async tx => {
      const actor = await this.actor(tx, actorId, expectedTokenVersion);
      const prior = await tx.attendanceResetOperation.findUnique({ where: { actorId_idempotencyKey: { actorId, idempotencyKey } } });
      if (prior) { if (prior.requestHash !== requestHash) fail(409, 'This idempotency key was already used for a different reset request.'); return prior.result; }
      const challenge = this.decode(input.challenge);
      if (challenge.actorId !== actorId || challenge.tokenVersion !== actor.tokenVersion) fail(403, 'Reset confirmation belongs to a different or expired authorization session.');
      if (challenge.expires <= this.now().getTime()) fail(410, 'Reset preview expired. Create a fresh preview.');
      if (await tx.attendanceResetOperation.findUnique({ where: { challengeNonce: challenge.nonce } })) fail(409, 'This reset confirmation has already been used.');
      const initial = await tx.attendanceSession.findMany({ where: { id: { in: challenge.scope.sessionIds } }, select: { examHallId: true } });
      for (const hallId of [...new Set(initial.map(row => row.examHallId))].sort()) await tx.$queryRaw`SELECT id FROM "ExamHall" WHERE id = ${hallId} FOR UPDATE`;
      for (const sessionId of [...challenge.scope.sessionIds].sort()) await tx.$queryRaw`SELECT id FROM "AttendanceSession" WHERE id = ${sessionId} FOR UPDATE`;
      const snapshot = await this.snapshot(tx, challenge.scope);
      if (snapshot.fingerprint !== challenge.fingerprint) fail(409, 'Attendance changed after this preview. Review a fresh preview before resetting.');
      const resetReference = randomUUID(), completedAt = this.now().toISOString();
      const attempts = [];
      for (const old of snapshot.sessions) {
        await tx.attendanceSession.update({ where: { id: old.id }, data: { isCurrent: false, archivedAt: this.now(), updatedAt: old.updatedAt } });
        const next = await tx.attendanceSession.create({ data: { examHallId: old.examHallId, businessDate: old.businessDate, attemptNumber: old.attemptNumber + 1, openedByUserId: actorId, hallNameSnapshot: old.hallNameSnapshot, roomNumberSnapshot: old.roomNumberSnapshot, testCenterNameSnapshot: old.testCenterNameSnapshot, examDateSnapshot: old.examDateSnapshot, reportingTimeSnapshot: old.reportingTimeSnapshot } });
        if (old.candidates.length) await tx.attendanceSessionCandidate.createMany({ data: old.candidates.map(({id, createdAt, sessionId, ...candidate}) => ({ ...candidate, sessionId: next.id })) });
        attempts.push({ previousSessionId: old.id, newSessionId: next.id, attemptNumber: next.attemptNumber, examHallId: old.examHallId, hallName: old.hallNameSnapshot, expectedCount: old.candidates.length });
      }
      const result = { resetReference, completedAt, attempts, affectedCandidates: snapshot.totals.expectedCount, status: 'COMPLETED' };
      await tx.attendanceResetOperation.create({ data: { id: resetReference, actorId, actorName: actor.name, idempotencyKey, challengeNonce: challenge.nonce, requestHash, reason: input.reason, mode: challenge.scope.mode, businessDate: hallDate(challenge.scope.businessDate)!, affectedCandidates: snapshot.totals.expectedCount, scope: challenge.scope as unknown as Prisma.InputJsonValue, result, completedAt: new Date(completedAt) } });
      // Surface deferred archival validation before returning a success through Prisma.
      await tx.$executeRaw`SET CONSTRAINTS "AttendanceSession_closed_reset_coherence", "AttendanceResetOperation_insert_validation" IMMEDIATE`;
      return result;
    });
  }
  async history(actorId: string, query: {page: number; limit: number}, expectedTokenVersion?: number) {
    return this.transaction(async tx => {
      await this.actor(tx, actorId, expectedTokenVersion);
      const total = await tx.attendanceResetOperation.count();
      const operations = await tx.attendanceResetOperation.findMany({ orderBy: [{completedAt:'desc'},{id:'asc'}], skip: (query.page - 1) * query.limit, take: query.limit, select: { id: true, actorName: true, reason: true, mode: true, businessDate: true, affectedCandidates: true, scope: true, result: true, completedAt: true } });
      return { operations, pagination: { ...query, total, totalPages: Math.ceil(total / query.limit) } };
    });
  }
}
export const attendanceResetService = new AttendanceResetService();
