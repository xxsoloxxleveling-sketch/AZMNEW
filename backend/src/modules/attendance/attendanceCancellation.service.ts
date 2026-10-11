import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { env } from '../../config/env';
import { cancelPreviewSchema, cancelConfirmSchema, type CancelConfirmInput } from './attendance.schema';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const secret = createHmac('sha256', env.JWT_ACCESS_SECRET).update('azm:attendance-cancellation:challenge:v1').digest();
const sign = (body: string) => createHmac('sha256', secret).update(body).digest('base64url');
function fail(statusCode: number, message: string): never { throw Object.assign(new Error(message), { statusCode }); }

type Challenge = {
  purpose: 'attendance-cancellation-v1';
  actorId: string;
  tokenVersion: number;
  sessionId: string;
  purgeAttendance: boolean;
  nonce: string;
  expires: number;
  fingerprint: string;
};

export class AttendanceCancellationService {
  constructor(private readonly db: PrismaClient = prisma, private readonly now = () => new Date()) {}

  private async transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        const result = await this.db.$transaction(work, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 15000,
        });
        if (result === undefined) fail(503, 'Cancellation database transaction did not complete.');
        return result;
      } catch (error: any) {
        const retry = error.code === 'P2034' || error.code === 'P2002' ||
          (error.code === 'P2010' && ['40001', '40P01'].includes(error.meta?.code));
        if (!retry) throw error;
        if (attempt >= 3) fail(409, 'Attendance changed during cancellation. Refresh preview and retry.');
      }
    }
  }

  private async actor(tx: Prisma.TransactionClient, actorId: string, expectedTokenVersion?: number) {
    const rows = await tx.$queryRawUnsafe<{id: string; name: string; role: string; status: string; tokenVersion: number}[]>(
      'SELECT id,name,role,status,"tokenVersion" FROM "User" WHERE id=$1 FOR SHARE', actorId,
    );
    const actor = rows[0];
    if (!actor) fail(401, 'An authenticated account is required.');
    if (actor.role !== 'SUPER_ADMIN' || actor.status !== 'ACTIVE') fail(403, 'Only an active Super Admin may cancel examination attendance.');
    if (expectedTokenVersion !== undefined && expectedTokenVersion !== actor.tokenVersion)
      fail(401, 'Your authorization session has expired. Please sign in again.');
    return actor;
  }

  private async snapshot(tx: Prisma.TransactionClient, sessionId: string, purgeAttendance: boolean) {
    const session = await tx.attendanceSession.findUnique({
      where: { id: sessionId },
      include: {
        candidates: { orderBy: { studentId: 'asc' } },
        attendance: { orderBy: { id: 'asc' } },
        examHall: { select: { testCenterId: true } },
      },
    });
    if (!session) fail(404, 'The selected examination session was not found.');
    if (!session.isCurrent || !['OPEN', 'CLOSED'].includes(session.status))
      fail(409, 'Only a current OPEN or CLOSED session may be cancelled. Archived attempts are immutable.');
    const ids = session.candidates.map(member => member.studentId);
    const [students, fees, documentCount, documentAuditCount] = await Promise.all([
      tx.student.findMany({
        where: { id: { in: ids } },
        select: { id: true, status: true, testScore: true, overallRank: true },
        orderBy: { id: 'asc' },
      }),
      tx.feeRecord.findMany({ where: { studentId: { in: ids } }, select: { id: true }, orderBy: { id: 'asc' } }),
      tx.studentDocument.count({ where: { studentId: { in: ids } } }),
      tx.studentDocumentAudit.count({ where: { studentId: { in: ids } } }),
    ]);
    const feeTransactionCount = await tx.transaction.count({ where: { relatedFeeId: { in: fees.map(fee => fee.id) } } });
    const scoredOrRankedCandidates = students.filter(student => student.testScore !== null || student.overallRank !== null).length;
    const marks = session.attendance;
    const impact = {
      expectedCount: session.candidates.length,
      markedCount: marks.length,
      presentCount: marks.filter(row => row.status === 'PRESENT').length,
      lateCount: marks.filter(row => row.status === 'LATE').length,
      absentCount: marks.filter(row => row.status === 'ABSENT').length,
      qrCount: marks.filter(row => row.method === 'QR_SCAN').length,
      manualCount: marks.filter(row => row.method === 'MANUAL').length,
      scoredOrRankedCandidates,
      feeReferences: fees.length,
      feeTransactions: feeTransactionCount,
      documentReferences: documentCount,
      documentAuditReferences: documentAuditCount,
      externalOmrOrResults: 'UNKNOWN' as const,
    };
    const blockers = purgeAttendance && scoredOrRankedCandidates
      ? ['One or more candidates have recorded results/ranks. Attendance purging is prohibited until the dependencies are resolved.']
      : [];
    return {
      session, impact, blockers,
      fingerprint: hash({ session, students, feeIds: fees.map(fee => fee.id), feeTransactionCount, documentCount, documentAuditCount }),
    };
  }

  private parse(challenge: string): Challenge {
    try {
      const parts = challenge.split('.');
      if (parts.length !== 2 || !parts[0] || !parts[1]) throw new Error('Invalid challenge');
      const expected = Buffer.from(sign(parts[0]));
      const received = Buffer.from(parts[1]);
      if (expected.length !== received.length || !timingSafeEqual(expected, received)) throw new Error('Signature invalid');
      const parsed = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')) as Challenge;
      if (parsed.purpose !== 'attendance-cancellation-v1' || !uuid.test(parsed.nonce) ||
        !parsed.actorId || !parsed.sessionId || typeof parsed.purgeAttendance !== 'boolean' ||
        !Number.isFinite(parsed.expires) || !/^[0-9a-f]{64}$/.test(parsed.fingerprint)) throw new Error('Malformed challenge');
      return parsed;
    } catch { fail(400, 'Invalid attendance cancellation challenge.'); }
  }

  async preview(sessionId: string, input: unknown, actorId: string, tokenVersion?: number) {
    const parsed = cancelPreviewSchema.parse(input);
    if (!sessionId?.trim()) fail(400, 'Select one examination session.');
    return this.transaction(async tx => {
      const actor = await this.actor(tx, actorId, tokenVersion);
      const snapshot = await this.snapshot(tx, sessionId, parsed.purgeAttendance);
      const expires = this.now().getTime() + 5 * 60 * 1000;
      const challenge: Challenge = {
        purpose: 'attendance-cancellation-v1', actorId, tokenVersion: actor.tokenVersion,
        sessionId, purgeAttendance: parsed.purgeAttendance, nonce: randomUUID(), expires,
        fingerprint: snapshot.fingerprint,
      };
      const body = Buffer.from(JSON.stringify(challenge)).toString('base64url');
      const session = snapshot.session;
      return {
        challenge: body + '.' + sign(body),
        expiresAt: new Date(expires).toISOString(),
        purgeAttendance: parsed.purgeAttendance,
        session: {
          id: session.id, examHallId: session.examHallId,
          hallName: session.hallNameSnapshot, roomNumber: session.roomNumberSnapshot,
          examDate: session.examDateSnapshot,
          businessDate: session.businessDate.toISOString().slice(0, 10),
          attemptNumber: session.attemptNumber, status: session.status,
        },
        impact: snapshot.impact, blockers: snapshot.blockers,
      };
    });
  }

  private result(operation: {
    id: string; sessionId: string; previousStatus: string; cancelledAt: Date; purgeAttendance: boolean;
    deletedCount: number; retainedCount: number; expectedCount: number;
  }) {
    return {
      cancellationReference: operation.id, sessionId: operation.sessionId,
      previousStatus: operation.previousStatus, status: 'CANCELLED' as const,
      cancelledAt: operation.cancelledAt.toISOString(), purgeAttendance: operation.purgeAttendance,
      deletedCount: operation.deletedCount, retainedCount: operation.retainedCount,
      expectedCount: operation.expectedCount,
    };
  }

  async confirm(sessionId: string, rawInput: unknown, actorId: string, idempotencyKey: string, tokenVersion?: number) {
    const input: CancelConfirmInput = cancelConfirmSchema.parse(rawInput);
    if (!uuid.test(idempotencyKey || '')) fail(400, 'A unique UUID Idempotency-Key is required.');
    const requestHash = hash({ sessionId, input });
    return this.transaction(async tx => {
      const actor = await this.actor(tx, actorId, tokenVersion);
      const prior = await tx.attendanceSessionCancellation.findUnique({
        where: { actorId_idempotencyKey: { actorId, idempotencyKey } },
      });
      if (prior) {
        if (prior.requestHash !== requestHash || prior.sessionId !== sessionId)
          fail(409, 'This idempotency key was used for a different cancellation.');
        return this.result(prior);
      }
      const challenge = this.parse(input.challenge);
      if (challenge.actorId !== actorId || challenge.tokenVersion !== actor.tokenVersion ||
          challenge.sessionId !== sessionId)
        fail(403, 'This confirmation belongs to another session or authentication context.');
      if (challenge.expires <= this.now().getTime())
        fail(410, 'Cancellation preview expired. Review the session again.');
      if (await tx.attendanceSessionCancellation.findUnique({ where: { challengeNonce: challenge.nonce } }))
        fail(409, 'Cancellation confirmation has already been used.');
      const phrase = challenge.purgeAttendance ? 'CANCEL SESSION AND DELETE ATTENDANCE' : 'CANCEL SESSION';
      if (input.confirmationText !== phrase) fail(400, 'Type ' + phrase + ' to confirm this operation.');
      if (challenge.purgeAttendance &&
        (!input.retentionApproved || !input.externalDispositionAttested ||
         !input.irreversibleDeletionAcknowledged || !input.approvalReference?.trim()))
        fail(400, 'An explicit retention approval, external-record disposition and permanent-deletion acknowledgement are required.');

      const current = await tx.attendanceSession.findUnique({ where: { id: sessionId }, select: { examHallId: true } });
      if (!current) fail(404, 'Examination session not found.');
      await tx.$queryRawUnsafe('SELECT id FROM "ExamHall" WHERE id=$1 FOR UPDATE', current.examHallId);
      await tx.$queryRawUnsafe('SELECT id FROM "AttendanceSession" WHERE id=$1 FOR UPDATE', sessionId);
      const snapshot = await this.snapshot(tx, sessionId, challenge.purgeAttendance);
      if (snapshot.fingerprint !== challenge.fingerprint)
        fail(409, 'Attendance or dependencies changed after preview. Review a fresh preview.');
      if (snapshot.blockers.length) fail(409, snapshot.blockers.join(' '));
      if (challenge.purgeAttendance && snapshot.session.status === 'CLOSED' && !input.closedEvidenceApproved)
        fail(400, 'Deletion of CLOSED session evidence requires separate explicit acknowledgement.');

      const id = randomUUID();
      const cancelledAt = this.now();
      const markedCount = snapshot.impact.markedCount;
      await tx.attendanceSessionCancellation.create({
        data: {
          id, sessionId, actorId, actorName: actor.name, idempotencyKey,
          challengeNonce: challenge.nonce, requestHash,
          snapshotFingerprint: snapshot.fingerprint, reason: input.reason,
          approvalReference: challenge.purgeAttendance ? input.approvalReference!.trim() : null,
          retentionApproved: challenge.purgeAttendance ? true : false,
          externalDispositionAttested: challenge.purgeAttendance ? true : false,
          closedEvidenceApproved: challenge.purgeAttendance && snapshot.session.status === 'CLOSED' ? true : false,
          previousStatus: snapshot.session.status, businessDate: snapshot.session.businessDate,
          purgeAttendance: challenge.purgeAttendance,
          markedCount, deletedCount: challenge.purgeAttendance ? markedCount : 0,
          retainedCount: challenge.purgeAttendance ? 0 : markedCount,
          expectedCount: snapshot.impact.expectedCount, cancelledAt,
        },
      });
      // All interpolated data is passed as a PostgreSQL bind parameter.
      await tx.$queryRawUnsafe('SELECT set_config(\'azm.cancel_audit_id\', $1, true)', id);
      if (challenge.purgeAttendance) {
        const deleted = await tx.attendance.deleteMany({ where: { sessionId } });
        if (deleted.count !== markedCount)
          fail(409, 'Cancellation purge count changed; no deletion was committed.');
      }
      await tx.attendanceSession.update({
        where: { id: sessionId },
        data: {
          status: 'CANCELLED', isCurrent: false, archivedAt: cancelledAt,
          cancelledAt, cancelledByUserId: actorId, updatedAt: snapshot.session.updatedAt,
        },
      });
      await tx.$executeRawUnsafe('SET CONSTRAINTS "AttendanceSession_closed_reset_coherence", "AttendanceSessionCancellation_coherence" IMMEDIATE');
      return this.result({
        id, sessionId, previousStatus: snapshot.session.status, cancelledAt,
        purgeAttendance: challenge.purgeAttendance,
        deletedCount: challenge.purgeAttendance ? markedCount : 0,
        retainedCount: challenge.purgeAttendance ? 0 : markedCount,
        expectedCount: snapshot.impact.expectedCount,
      });
    });
  }

  async history(actorId: string, page: number, limit: number, tokenVersion?: number) {
    return this.transaction(async tx => {
      await this.actor(tx, actorId, tokenVersion);
      const total = await tx.attendanceSessionCancellation.count();
      const rows = await tx.attendanceSessionCancellation.findMany({
        orderBy: [{ cancelledAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * limit, take: limit,
        select: {
          id: true, sessionId: true, actorName: true, reason: true, approvalReference: true,
          previousStatus: true, businessDate: true, purgeAttendance: true,
          markedCount: true, deletedCount: true, retainedCount: true, expectedCount: true, cancelledAt: true,
        },
      });
      return {
        operations: rows.map(row => ({
          ...row, businessDate: row.businessDate.toISOString().slice(0, 10),
          cancelledAt: row.cancelledAt.toISOString(),
        })),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      };
    });
  }
}
export const attendanceCancellationService = new AttendanceCancellationService();
