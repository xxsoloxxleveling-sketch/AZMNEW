import { Prisma, PrismaClient } from '@prisma/client';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { hallDate } from '../exam-halls/examHalls.service';
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => !!hallDate(v));
export const controlScopeSchema = z.object({
    action: z.enum(['RESET', 'DELETE', 'FREEZE', 'UNFREEZE', 'MAP_RESULTS']), testCenterId: z.string().min(1), businessDate: date,
    sessionIds: z.array(z.string().min(1)).max(50).default([]), entireLineage: z.boolean().default(false),
    clearAllocations: z.boolean().default(false), unfreeze: z.boolean().default(false), replace: z.boolean().default(true),
    resultStudentIds: z.array(z.string().min(1)).max(100).default([]), ownershipEvidence: z.string().max(1000).default(''),
    moveStudentId: z.string().min(1).optional(), destinationHallId: z.string().min(1).optional(),
}).strict();
export const controlConfirmSchema = z.object({ challenge: z.string().min(1).max(64000), reason: z.string().trim().min(10).max(1000), confirmationText: z.string().max(300) }).strict();
export type ControlScope = z.infer<typeof controlScopeSchema>;
export function controlError(statusCode: number, message: string): never { throw Object.assign(new Error(message), { statusCode }); }
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function key() { const value = process.env.EXAM_CONTROL_SIGNING_KEY; if (!value || value.length < 64)
    controlError(503, 'Exam Session Control signing capability has not been provisioned.'); return value; }
function sign(value: string) { return createHmac('sha256', key()).update(value).digest('hex'); }
export async function examLock(tx: Prisma.TransactionClient) { await tx.$queryRaw `SELECT 1 FROM pg_advisory_xact_lock(73921,19)`; }
export class ExamControlService {
    constructor(private db: PrismaClient = prisma) { }
    async transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
        for (let attempt = 0;; attempt++)
            try {
                return await this.db.$transaction(async (tx) => { await examLock(tx); return work(tx); }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20000, maxWait: 5000 });
            }
            catch (error: any) {
                if (error.code === 'P2034' || (error.code === 'P2010' && ['40001', '40P01'].includes(error.meta?.code))) {
                    if (attempt < 3)
                        continue;
                    controlError(409, 'Concurrent exam operation conflicted; refresh and retry.');
                }
                if (error.code === 'P2010' && ['23514', 'P0001', '23505'].includes(error.meta?.code))
                    controlError(409, String(error.meta?.message || 'Examination scope changed; review again.'));
                if (error.code === 'P2010' && error.meta?.code === '42501')
                    controlError(403, 'Exam control authorization or database capability rejected.');
                throw error;
            }
    }
    async actor(tx: Prisma.TransactionClient, id: string, version: number, superOnly = true) {
        const users = await tx.$queryRaw<any[]> `SELECT id,name,role,status,"tokenVersion" FROM "User" WHERE id=${id} FOR SHARE`;
        const user = users[0];
        if (!user || user.status !== 'ACTIVE' || (superOnly ? user.role !== 'SUPER_ADMIN' : !['ADMIN', 'SUPER_ADMIN'].includes(user.role)))
            controlError(403, 'Active authorized examination administrator required.');
        if (user.tokenVersion !== version)
            controlError(401, 'Authorization expired; sign in again.');
        return user;
    }
    async state(tx: Prisma.TransactionClient, centerId: string, businessDate: string) {
        const center = await tx.testCenter.findUnique({ where: { id: centerId } });
        if (!center)
            controlError(404, 'Test center not found.');
        const halls = await tx.examHall.findMany({ where: { testCenterId: centerId }, orderBy: { id: 'asc' } });
        const hallIds = halls.map(h => h.id);
        const sessions = await tx.attendanceSession.findMany({ where: { examHallId: { in: hallIds }, businessDate: hallDate(businessDate)! }, orderBy: [{ examHallId: 'asc' }, { attemptNumber: 'asc' }], include: { candidates: { orderBy: { studentId: 'asc' } }, attendance: { orderBy: { studentId: 'asc' } } } });
        const ids = [...new Set(sessions.flatMap(s => s.candidates.map(c => c.studentId)))];
        // Owned results remain part of the deletion impact even after a candidate
        // leaves this center or no longer appears in an attempt's live roster.
        const allocations = await tx.student.findMany({ where: { OR: [{ assignedHallId: { in: hallIds } }, { id: { in: ids } }, { resultSessionId: { in: sessions.map(s => s.id) } }] }, orderBy: { id: 'asc' }, select: { id: true, fullName: true, status: true, assignedHallId: true, assignedHall: true, assignedRoom: true, seatNo: true, testScore: true, overallRank: true, resultSessionId: true, updatedAt: true, officeUse: true } });
        const controls = await tx.$queryRaw<any[]> `SELECT * FROM "ExamPlacementControl" WHERE "testCenterId"=${centerId} AND "businessDate"=${hallDate(businessDate)!}::date`;
        return { center, halls, sessions, allocations, placement: controls[0] ?? { testCenterId: centerId, businessDate, frozen: false, revision: 0, changedBy: null, changedAt: null, reason: null } };
    }
    async current(centerId: string, businessDate: string) {
        if (!hallDate(businessDate) || !/^\d{4}-\d{2}-\d{2}$/.test(businessDate))
            controlError(400, 'Valid examination business date required.');
        return this.transaction(async (tx) => {
            const state = await this.state(tx, centerId, businessDate);
            return { businessDate, testCenter: { id: state.center.id, name: state.center.name }, placement: state.placement,
                legacyResults: state.allocations.filter(a => a.resultSessionId === null && (a.testScore !== null || a.overallRank !== null)).map(a => ({ id: a.id, fullName: a.fullName, score: a.testScore, rank: a.overallRank, sessionIds: state.sessions.filter(s => s.candidates.some(c => c.studentId === a.id)).map(s => s.id) })),
                movableStudents: state.allocations.filter(a => a.assignedHallId).map(a => ({ id: a.id, fullName: a.fullName, assignedHallId: a.assignedHallId })),
                halls: state.halls.map(h => {
                    const attempts = state.sessions.filter(s => s.examHallId === h.id);
                    const current = attempts.find(s => s.isCurrent);
                    return {
                        id: h.id, name: h.name, roomNumber: h.roomNumber, examDate: h.examDate, configuredForDate: hallDate(h.examDate)?.toISOString().slice(0, 10) === businessDate,
                        assignedCount: state.allocations.filter(a => a.assignedHallId === h.id && a.status === 'ACTIVE').length,
                        current: current ? this.summary(current) : null, attempts: attempts.map(s => this.summary(s)),
                        canPrepare: !current && hallDate(h.examDate)?.toISOString().slice(0, 10) === businessDate
                    };
                }) };
        });
    }
    summary(s: any) {
        const counts = { present: 0, late: 0, absent: 0 };
        for (const mark of s.attendance)
            counts[mark.status.toLowerCase() as keyof typeof counts]++;
        return { id: s.id, examHallId: s.examHallId, attemptNumber: s.attemptNumber, isCurrent: s.isCurrent, status: s.status, revision: s.revision, openedAt: s.openedAt, closedAt: s.closedAt, expected: s.candidates.length, marked: s.attendance.length, ...counts };
    }
    private async impact(tx: Prisma.TransactionClient, input: ControlScope) {
        const state = await this.state(tx, input.testCenterId, input.businessDate);
        let selected = state.sessions.filter(s => input.sessionIds.includes(s.id));
        if (new Set(input.sessionIds).size !== input.sessionIds.length || selected.length !== input.sessionIds.length)
            controlError(409, 'Selected attempts do not match this center/exam.');
        if (input.entireLineage) {
            if (input.action !== 'DELETE')
                controlError(400, 'Entire lineage is available for deletion only.');
            const halls = new Set(selected.map(s => s.examHallId));
            selected = state.sessions.filter(s => halls.has(s.examHallId));
        }
        if (['RESET', 'DELETE'].includes(input.action) && (!selected.length || selected.length > 50))
            controlError(400, 'Select between 1 and 50 attempts.');
        if (input.action === 'RESET' && selected.some(s => !s.isCurrent || s.status === 'CANCELLED'))
            controlError(409, 'Reset requires a current PRE_OPEN, OPEN or CLOSED attempt.');
        if (['FREEZE', 'UNFREEZE'].includes(input.action) && (input.sessionIds.length || input.entireLineage || input.clearAllocations || input.unfreeze))
            controlError(400, 'Freeze controls apply only to the selected center/exam.');
        if (input.action === 'MAP_RESULTS') {
            if (selected.length !== 1 || !input.resultStudentIds.length || input.ownershipEvidence.trim().length < 10 || input.clearAllocations || input.unfreeze || input.entireLineage)
                controlError(400, 'Select one stored roster attempt, result candidates, and a source evidence reference of at least 10 characters.');
            if (input.resultStudentIds.some(id => !selected[0].candidates.some(c => c.studentId === id) || !state.allocations.some(a => a.id === id && a.resultSessionId === null && (a.testScore !== null || a.overallRank !== null))))
                controlError(409, 'Mapping requires explicitly selected unowned roster results.');
        }
        else if (input.resultStudentIds.length || input.ownershipEvidence)
            controlError(400, 'Result mapping must be reviewed as a separate action.');
        const hallIds = new Set(selected.map(s => s.examHallId));
        const retainedCurrent = state.sessions.filter(s => s.isCurrent && hallIds.has(s.examHallId) && !selected.some(a => a.id === s.id));
        if (['RESET', 'DELETE'].includes(input.action) && retainedCurrent.length && (input.replace || input.clearAllocations))
            controlError(409, 'A current attempt is retained. Historical-only deletion must disable replacement and allocation clearing, or include the current attempt in a new preview.');
        if (input.clearAllocations && state.placement.frozen && !input.unfreeze)
            controlError(409, 'Choose the explicit combined Unfreeze action before clearing frozen allocations.');
        if (input.action === 'RESET' && !input.replace)
            controlError(400, 'Reset always creates a PRE_OPEN replacement.');
        if (['RESET', 'DELETE'].includes(input.action) && input.replace && selected.some(s => !state.halls.some(h => h.id === s.examHallId && h.testCenterId === input.testCenterId && hallDate(h.examDate)?.toISOString().slice(0, 10) === input.businessDate)))
            controlError(409, 'A replacement requires each Hall to remain configured for the reviewed center and examination date. Delete historical attempts without replacement, or review the current Hall configuration first.');
        const affectedIds = new Set(selected.flatMap(s => s.candidates.map(c => c.studentId)));
        const currentAllocationHallIds = new Set(selected.filter(s => s.isCurrent && state.halls.some(h => h.id === s.examHallId && hallDate(h.examDate)?.toISOString().slice(0, 10) === input.businessDate)).map(s => s.examHallId));
        const legacy = state.allocations.filter(a => (affectedIds.has(a.id) || currentAllocationHallIds.has(a.assignedHallId ?? '')) && a.resultSessionId === null && (a.testScore !== null || a.overallRank !== null));
        if (legacy.length && ['RESET', 'DELETE'].includes(input.action))
            controlError(409, `${legacy.length} candidate result(s) have unresolved examination ownership. Full deletion is blocked until a separately reviewed result mapping establishes their scope.`);
        const allocations = state.allocations.filter(a => hallIds.has(a.assignedHallId ?? '') && state.halls.some(h => h.id === a.assignedHallId && hallDate(h.examDate)?.toISOString().slice(0, 10) === input.businessDate));
        const scope = { ...input, sessionIds: selected.map(s => s.id).sort() };
        let move: any = null;
        if (input.moveStudentId || input.destinationHallId) {
            if (input.action !== 'RESET' || !input.moveStudentId || !input.destinationHallId || input.clearAllocations)
                controlError(400, 'A reset-and-move requires one candidate, a destination, and retained allocations.');
            if (state.placement.frozen && !input.unfreeze)
                controlError(409, 'Choose the explicit combined Unfreeze action before moving a candidate from the frozen source center/exam.');
            const student = state.allocations.find(a => a.id === input.moveStudentId);
            if (!student || student.status !== 'ACTIVE' || !hallIds.has(student.assignedHallId ?? ''))
                controlError(409, 'Select the current allocated candidate and every affected source attempt.');
            const destination = await tx.examHall.findUnique({ where: { id: input.destinationHallId }, include: { testCenter: true } });
            if (!destination || !destination.testCenterId || hallDate(destination.examDate)?.toISOString().slice(0, 10) !== input.businessDate)
                controlError(409, 'Destination must be a configured Hall in the same examination date.');
            if (destination.id === student.assignedHallId)
                controlError(400, 'Choose a different destination Hall.');
            const destState = await this.state(tx, destination.testCenterId, input.businessDate);
            if (destState.placement.frozen && (destination.testCenterId !== input.testCenterId || !input.unfreeze))
                controlError(409, 'Explicitly unfreeze the destination center/exam before this move.');
            if (destState.sessions.some(s => s.examHallId === destination.id && s.isCurrent && s.status !== 'PRE_OPEN' && !selected.some(a => a.id === s.id)))
                controlError(409, 'Destination has a live/finalized attempt. Include it in this same-center reset, or prepare/reset it separately before the cross-center move.');
            if (state.sessions.some(s => s.isCurrent && s.candidates.some(c => c.studentId === student.id) && !selected.some(a => a.id === s.id)))
                controlError(409, 'Include every current source membership in the reviewed reset.');
            const occupants = destState.allocations.filter(a => a.assignedHallId === destination.id);
            if (occupants.length >= destination.capacity)
                controlError(409, 'Destination Hall capacity is full.');
            move = { studentId: student.id, studentName: student.fullName, sourceHallId: student.assignedHallId, destinationHallId: destination.id, destinationHallName: destination.name, destinationCenterName: destination.testCenter?.name, destinationFingerprint: hash(destState) };
        }
        const phrase = `${input.action} ${state.center.code} ${input.businessDate}${input.unfreeze ? ' AND UNFREEZE CENTER' : ''}`;
        const selectedIds = new Set(scope.sessionIds);
        const impact = { scope, phrase, move, attempts: selected.map(s => this.summary(s)), totals: { marks: selected.reduce((n, s) => n + s.attendance.length, 0), rosterEntries: selected.reduce((n, s) => n + s.candidates.length, 0), qr: selected.reduce((n, s) => n + s.attendance.filter(a => a.method === 'QR_SCAN').length, 0), manual: selected.reduce((n, s) => n + s.attendance.filter(a => a.method === 'MANUAL').length, 0), linkedResults: state.allocations.filter(a => a.resultSessionId && selectedIds.has(a.resultSessionId)).length, allocationsToClear: input.clearAllocations ? allocations.length : 0 }, placementAfter: input.action === 'FREEZE' ? 'FROZEN' : input.action === 'UNFREEZE' || input.unfreeze ? 'EDITABLE' : state.placement.frozen ? 'FROZEN' : 'EDITABLE', unfreezeScope: input.unfreeze ? { centerId: input.testCenterId, businessDate: input.businessDate, hallCount: state.halls.length } : null, centerName: state.center.name };
        // Bind the exact expanded action and displayed impact, not just the raw
        // center snapshot, so confirmation cannot silently change its counts.
        return { ...impact, fingerprint: hash({ state, impact }) };
    }
    async preview(raw: unknown, actorId: string, version: number) {
        const input = controlScopeSchema.parse(raw);
        return this.transaction(async (tx) => {
            await this.actor(tx, actorId, version);
            const impact = await this.impact(tx, input);
            const payload = JSON.stringify({ actorId, version, nonce: randomUUID(), expiresAt: new Date(Date.now() + 5 * 60000).toISOString(), ...impact });
            return { ...impact, expiresAt: JSON.parse(payload).expiresAt, challenge: Buffer.from(payload).toString('base64url') + '.' + sign(payload) };
        });
    }
    decode(challenge: string) { try {
        const [encoded, signature, ...extra] = challenge.split('.');
        const payload = Buffer.from(encoded, 'base64url').toString();
        const expected = sign(payload);
        if (extra.length || !signature || signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected)))
            throw Error();
        return JSON.parse(payload);
    }
    catch {
        controlError(400, 'Invalid impact review; request a new preview.');
    } }
    async confirm(raw: unknown, actorId: string, version: number, idempotencyKey: string) {
        const input = controlConfirmSchema.parse(raw);
        if (!z.string().uuid().safeParse(idempotencyKey).success)
            controlError(400, 'A UUID Idempotency-Key is required.');
        const p = this.decode(input.challenge);
        if (p.actorId !== actorId || p.version !== version)
            controlError(403, 'Impact review belongs to a different authorization session.');
        if (input.confirmationText !== p.phrase)
            controlError(400, 'Typed confirmation does not match the reviewed scope.');
        const requestHash = hash({ input, actorId });
        return this.transaction(async (tx) => {
            await this.actor(tx, actorId, version);
            const prior = await tx.$queryRaw<any[]> `SELECT * FROM "ExamControlOperation" WHERE "actorId"=${actorId} AND "idempotencyKey"=${idempotencyKey}`;
            if (prior[0]) {
                if (prior[0].requestHash !== requestHash)
                    controlError(409, 'Idempotency key already belongs to a different request.');
                return prior[0].result;
            }
            if (Date.parse(p.expiresAt) < Date.now())
                controlError(410, 'Impact review expired; preview again.');
            const impact = await this.impact(tx, controlScopeSchema.parse(p.scope));
            if (impact.fingerprint !== p.fingerprint)
                controlError(409, 'Examination data changed. Review the updated impact before confirming.');
            const payload = JSON.stringify({ ...impact.scope, scope: { ...impact.scope, attempts: impact.attempts, totals: impact.totals, placementAfter: impact.placementAfter, move: impact.move }, actorId, tokenVersion: version, idempotencyKey, requestHash, reason: input.reason, nonce: p.nonce, expiresAt: p.expiresAt, operationId: randomUUID() });
            const rows = await tx.$queryRaw<any[]> `SELECT public.azm_execute_exam_control(${payload},${sign(payload)}) AS result`;
            return rows[0].result;
        });
    }
    async operation(actorId: string, version: number, keyValue: string, challenge?: string) {
        const reviewed = challenge === undefined ? undefined : this.decode(challenge);
        if (reviewed && reviewed.actorId !== actorId)
            controlError(403, 'Impact review belongs to a different account.');
        const expiresAt = reviewed ? Date.parse(reviewed.expiresAt) : undefined;
        if (reviewed && !Number.isFinite(expiresAt))
            controlError(400, 'Invalid impact review expiry.');
        return this.db.$transaction(async (tx) => {
            // At Serializable, the SELECT that waits for this lock fixes the
            // snapshot before an in-flight confirmation commits. ReadCommitted
            // gives the following receipt query a fresh committed snapshot.
            await examLock(tx);
            await this.actor(tx, actorId, version);
            const rows = await tx.$queryRaw<any[]> `SELECT result FROM "ExamControlOperation" WHERE "actorId"=${actorId} AND "idempotencyKey"=${keyValue}`;
            if (rows[0])
                return rows[0].result;
            // Check wall-clock expiry only after obtaining the shared writer
            // lock and reading a fresh receipt. An earlier confirmation has
            // finished; a delayed one must recheck this same expiry and fail.
            if (reviewed && expiresAt! < Date.now())
                return { status: 'EXPIRED', terminal: true, challengeNonce: reviewed.nonce, expiresAt: reviewed.expiresAt };
            // Absence is not a terminal rejection: the original HTTP request
            // may not have reached the database yet. Retain and retry its key.
            return { status: 'NOT_FOUND', terminal: false };
        }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 20000, maxWait: 5000 });
    }
    async history(actorId: string, version: number, centerId: string, businessDate: string, page = 1) {
        return this.transaction(async (tx) => {
            await this.actor(tx, actorId, version);
            return tx.$queryRaw<any[]> `SELECT * FROM (
    SELECT id,"actorName",action,reason,scope,result,"completedAt" FROM "ExamControlOperation" WHERE scope->>'testCenterId'=${centerId} AND scope->>'businessDate'=${businessDate}
    UNION ALL SELECT id,"actorName",action,reason,jsonb_build_object('testCenterId',"testCenterId",'businessDate',to_char("businessDate",'YYYY-MM-DD'),'sessionIds',jsonb_build_array("sessionId")),jsonb_build_object('status','COMPLETED','deletedMarks',0,'deletedRosterEntries',0,'replacements','[]'::jsonb),"occurredAt" FROM "ExamLifecycleEvent" WHERE "testCenterId"=${centerId} AND "businessDate"=${hallDate(businessDate)!}::date
   ) entries ORDER BY "completedAt" DESC,id DESC LIMIT 25 OFFSET ${(page - 1) * 25}`;
        });
    }
    async prepare(hallId: string, actorId: string, version: number) {
        return this.transaction(async (tx) => {
            await this.actor(tx, actorId, version, false);
            const hall = await tx.examHall.findUnique({ where: { id: hallId }, include: { testCenter: true } });
            if (!hall)
                controlError(404, 'Hall not found.');
            const businessDate = hallDate(hall.examDate);
            if (!businessDate || !hall.testCenterId)
                controlError(409, 'Configure a valid center and exam date first.');
            if (await tx.attendanceSession.findFirst({ where: { examHallId: hallId, businessDate, isCurrent: true } }))
                controlError(409, 'A current session already exists.');
            const seq = await tx.$queryRaw<{
                generation: number;
            }[]> `SELECT generation FROM "ExamAttemptSequence" WHERE "examHallId"=${hallId} AND "businessDate"=${businessDate}::date`;
            return tx.attendanceSession.create({ data: { examHallId: hallId, businessDate, attemptNumber: (seq[0]?.generation ?? 0) + 1, status: 'PRE_OPEN', preparedByUserId: actorId, hallNameSnapshot: hall.name, roomNumberSnapshot: hall.roomNumber, testCenterNameSnapshot: hall.testCenter?.name, examDateSnapshot: hall.examDate, reportingTimeSnapshot: hall.reportingTime } });
        });
    }
}
export const examControlService = new ExamControlService();
