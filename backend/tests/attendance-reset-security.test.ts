import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHmac, randomUUID } from 'node:crypto';
import { Client } from 'pg';
import express from 'express';

async function run() {
  assert.notEqual(process.env.NODE_ENV, 'production');
  const source = new URL(process.env.ATTENDANCE_TEST_DATABASE_URL || '');
  assert(['localhost', '127.0.0.1', '[::1]'].includes(source.hostname), 'Dedicated local PostgreSQL only');
  source.pathname = '/postgres'; source.searchParams.delete('schema');
  const admin = new Client({ connectionString: source.toString() }); await admin.connect();
  const name = 'attendance_security_' + randomUUID().replace(/-/g, '');
  let sql: Client | undefined, db: any, shared: any, server: any, passed = 0;
  const check = async (label: string, work: () => any) => { await work(); passed++; console.log('PASS: ' + label); };
  try {
    await admin.query(`CREATE DATABASE "${name}"`); source.pathname = '/' + name;
    sql = new Client({ connectionString: source.toString() }); await sql.connect();
    const migrations = path.resolve(__dirname, '../prisma/migrations');
    for (const folder of fs.readdirSync(migrations).sort()) {
      const file = path.join(migrations, folder, 'migration.sql');
      if (fs.existsSync(file)) await sql.query(fs.readFileSync(file, 'utf8'));
    }
    process.env.DATABASE_URL = source.toString(); process.env.DIRECT_URL = source.toString(); process.env.NODE_ENV = 'test';
    const { PrismaClient } = await import('@prisma/client'); db = new PrismaClient();
    const { AttendanceService } = await import('../src/modules/attendance/attendance.service');
    const { AttendanceResetService } = await import('../src/modules/attendance/attendanceReset.service');
    const { env } = await import('../src/config/env');
    const { signAccessToken, signRefreshToken } = await import('../src/lib/jwt');
    const attendance = new AttendanceService(db), reset = new AttendanceResetService(db);
    for (const [id, role] of [['sa', 'SUPER_ADMIN'], ['other', 'SUPER_ADMIN'], ['admin', 'ADMIN']])
      await db.user.create({ data: { id, role, name: id, email: id + '@test.invalid', passwordHash: 'fixture' } });
    const hall = await db.examHall.create({ data: { id: 'security', name: 'Security fixture', roomNumber: 'security', targetClass: 'Class 9th', examDate: '2026-10-10', reportingTime: '08:00' } });
    await db.student.create({ data: { id: 's', qrToken: 'security-fixture', applicationNo: 'SECURITY', fullName: 'Synthetic candidate', fatherName: 'Fixture', gender: 'MALE', dateOfBirth: new Date('2008-01-01'), cnicOrBForm: 'security', address: 'Fixture', district: 'Fixture', province: 'Fixture', parentMobile: 'fixture', currentClass: 'Class 9th', schoolName: 'Fixture', boardOrUniversity: 'Fixture', scholarshipCategory: 'GENERAL_MERIT', emergencyContact: 'fixture', emergencyRelation: 'Fixture', assignedHallId: hall.id } });
    let session = (await attendance.openSession(hall.id, 'admin')).session;
    const scope = () => ({ mode: 'HALL' as const, businessDate: '2026-10-10', sessionIds: [session.id] });
    const confirm = (challenge: string) => ({ challenge, reason: 'Independent security fixture', confirmationText: 'RESET ATTENDANCE' as const });
    const rejects = (work: () => any, status: number) => assert.rejects(work, (error: any) => error.statusCode === status);
    const p = await reset.preview(scope(), 'sa');
    await check('challenge bound to actor, exact contents and signature', async () => {
      await rejects(() => reset.confirm(confirm(p.challenge), 'other', randomUUID()), 403);
      const [body, signature] = p.challenge.split('.');
      const changed = JSON.parse(Buffer.from(body, 'base64url').toString()); changed.scope.sessionIds = ['nonexistent'];
      await rejects(() => reset.confirm(confirm(Buffer.from(JSON.stringify(changed)).toString('base64url') + '.' + signature), 'sa', randomUUID()), 400);
      await rejects(() => reset.confirm(confirm(p.challenge + '.extra'), 'sa', randomUUID()), 400);
    });
    await check('reset HMAC rejects signatures made directly with the access-token key', async () => {
      const body = p.challenge.split('.')[0];
      const signature = createHmac('sha256', env.JWT_ACCESS_SECRET).update(body).digest('base64url');
      await rejects(() => reset.confirm(confirm(body + '.' + signature), 'sa', randomUUID()), 400);
    });
    const key = randomUUID(), result: any = await reset.confirm(confirm(p.challenge), 'sa', key);
    session = await db.attendanceSession.findUnique({ where: { id: result.attempts[0].newSessionId } });
    await check('database rejects audit deletion, archived edits, deletions and late marks', async () => {
      const archived = result.attempts[0].previousSessionId;
      await assert.rejects(() => sql!.query('DELETE FROM "AttendanceResetOperation" WHERE id=$1', [result.resetReference]), /immutable/);
      await assert.rejects(() => sql!.query('UPDATE "AttendanceSession" SET "hallNameSnapshot"=$1 WHERE id=$2', ['Tampered', archived]), /immutable/);
      await assert.rejects(() => sql!.query('DELETE FROM "AttendanceSession" WHERE id=$1', [archived]), /immutable/);
      await assert.rejects(() => sql!.query('UPDATE "AttendanceSessionCandidate" SET "fullNameSnapshot"=$1 WHERE "sessionId"=$2', ['Tampered', archived]), /immutable/);
      await assert.rejects(() => db.attendance.create({ data: { sessionId: archived, studentId: 's', date: new Date('2026-10-10'), status: 'PRESENT', method: 'MANUAL', markedByUserId: 'sa' } }), /current OPEN attempt/);
      assert.equal(await db.attendanceResetOperation.count(), 1);
      assert.equal(await db.attendance.count({ where: { sessionId: archived } }), 0);
    });
    await check('exact idempotent replay succeeds after challenge expiry without new writes', async () => {
      const expired = new AttendanceResetService(db, () => new Date(Date.now() + 3600000));
      const before = await db.attendanceResetOperation.count();
      assert.deepEqual(await expired.confirm(confirm(p.challenge), 'sa', key), result);
      assert.equal(await db.attendanceResetOperation.count(), before);
      await rejects(() => expired.confirm({ ...confirm(p.challenge), reason: 'Changed payload' }, 'sa', key), 409);
      await rejects(() => expired.confirm(confirm(p.challenge), 'sa', randomUUID()), 410);
    });
    await check('idempotent responses require fresh active Super Admin authorization', async () => {
      await db.user.update({ where: { id: 'sa' }, data: { role: 'ADMIN' } });
      await rejects(() => reset.confirm(confirm(p.challenge), 'sa', key), 403);
      await db.user.update({ where: { id: 'sa' }, data: { role: 'SUPER_ADMIN', status: 'INACTIVE' } });
      await rejects(() => reset.confirm(confirm(p.challenge), 'sa', key), 403);
      await db.user.update({ where: { id: 'sa' }, data: { status: 'ACTIVE', tokenVersion: 1 } });
      await rejects(() => reset.confirm(confirm(p.challenge), 'sa', key, 0), 401);
    });
    await check('concurrent different idempotency keys cannot replay one nonce', async () => {
      const preview = await reset.preview(scope(), 'sa'), before = await db.attendanceResetOperation.count();
      const outcomes = await Promise.allSettled([reset.confirm(confirm(preview.challenge), 'sa', randomUUID()), reset.confirm(confirm(preview.challenge), 'sa', randomUUID())]);
      assert.equal(outcomes.filter(row => row.status === 'fulfilled').length, 1);
      const denied = outcomes.find(row => row.status === 'rejected') as PromiseRejectedResult; assert.equal(denied.reason.statusCode, 409);
      assert.equal(await db.attendanceResetOperation.count(), before + 1);
      session = await db.attendanceSession.findFirst({ where: { examHallId: hall.id, isCurrent: true } });
    });
    await check('close racing reset commits only one operation and preserves evidence', async () => {
      const oldId = session.id, preview = await reset.preview(scope(), 'sa');
      const outcomes = await Promise.allSettled([reset.confirm(confirm(preview.challenge), 'sa', randomUUID()), attendance.closeSession(oldId, true, 'admin')]);
      assert.equal(outcomes.filter(row => row.status === 'fulfilled').length, 1);
      const denied = outcomes.find(row => row.status === 'rejected') as PromiseRejectedResult; assert.equal(denied.reason.statusCode, 409);
      const old = await db.attendanceSession.findUnique({ where: { id: oldId } });
      assert.equal(old.isCurrent, outcomes[1].status === 'fulfilled');
      assert.equal(await db.attendance.count({ where: { sessionId: oldId } }), outcomes[1].status === 'fulfilled' ? 1 : 0);
      assert.equal(await db.attendanceSession.count({ where: { examHallId: hall.id, isCurrent: true } }), 1);
    });
    await check('finalized current sessions reject metadata changes and deletion', async () => {
      const active = await db.attendanceSession.findFirst({ where: { examHallId: hall.id, isCurrent: true } });
      if (active.status === 'OPEN') await attendance.closeSession(active.id, true, 'admin');
      const before = await db.attendanceSession.findUnique({ where: { id: active.id } });
      await assert.rejects(() => sql!.query('UPDATE "AttendanceSession" SET "hallNameSnapshot"=$1 WHERE id=$2', ['Tampered finalized Hall', active.id]), /immutable/);
      await assert.rejects(() => sql!.query('DELETE FROM "AttendanceSession" WHERE id=$1', [active.id]), /immutable/);
      await assert.rejects(() => sql!.query('UPDATE "AttendanceSession" SET "businessDate"=$1 WHERE id=$2', ['2026-10-11', active.id]), /immutable/);
      for (const change of [
        `status='OPEN'`, `"closedAt"=NULL`, `"closedByUserId"='sa'`,
        `"openedByUserId"='other'`, `"openedAt"="openedAt" + interval '1 day'`,
        `"attemptNumber"="attemptNumber"+1`, `"roomNumberSnapshot"='tampered'`,
        `"testCenterNameSnapshot"='tampered'`, `"examDateSnapshot"='2026-10-11'`,
        `"reportingTimeSnapshot"='10:00'`, `"createdAt"="createdAt" + interval '1 day'`,
        `"updatedAt"="updatedAt" + interval '1 day'`,
      ]) {
        await assert.rejects(() => sql!.query(`UPDATE "AttendanceSession" SET "isCurrent"=false,"archivedAt"=now(),${change} WHERE id=$1`, [active.id]), /immutable/);
      }
      assert.deepEqual(await db.attendanceSession.findUnique({ where: { id: active.id } }), before);
    });
    await check('a finalized attempt cannot be archived directly without an atomic reset audit', async () => {
      session = await db.attendanceSession.findFirst({ where: { examHallId: hall.id, isCurrent: true } });
      const before = await db.attendanceSession.findUnique({ where: { id: session.id } });
      await assert.rejects(() => sql!.query('UPDATE "AttendanceSession" SET "isCurrent"=false,"archivedAt"=now() WHERE id=$1', [session.id]), /reset|audit|archive/i);
      assert.deepEqual(await db.attendanceSession.findUnique({ where: { id: session.id } }), before);
    });
    const assertFrozenEvidence = async (id: string) => {
      await assert.rejects(() => sql!.query('UPDATE "Attendance" SET status=\'PRESENT\' WHERE "sessionId"=$1', [id]), /immutable/);
      await assert.rejects(() => sql!.query('UPDATE "Attendance" SET "markedByUserId"=\'sa\' WHERE "sessionId"=$1', [id]), /immutable/);
      await assert.rejects(() => sql!.query('DELETE FROM "Attendance" WHERE "sessionId"=$1', [id]), /immutable/);
      await assert.rejects(() => sql!.query('UPDATE "AttendanceSessionCandidate" SET "fullNameSnapshot"=\'tampered\' WHERE "sessionId"=$1', [id]), /immutable/);
      await assert.rejects(() => sql!.query('DELETE FROM "AttendanceSessionCandidate" WHERE "sessionId"=$1', [id]), /immutable/);
      await rejects(() => attendance.mark(id, { studentId: 's', status: 'PRESENT' }, 'admin'), 409);
      await rejects(() => attendance.closeSession(id, true, 'admin'), 409);
    };
    await check('CLOSED reset retains absent evidence and closure fields, starts OPEN at zero and rejects old IDs', async () => {
      const oldId = session.id;
      const before = await db.attendanceSession.findUnique({ where: { id: oldId } });
      const marks = await db.attendance.findMany({ where: { sessionId: oldId }, orderBy: { id: 'asc' } });
      const roster = await db.attendanceSessionCandidate.findMany({ where: { sessionId: oldId }, orderBy: { studentId: 'asc' } });
      assert.equal(before.status, 'CLOSED'); assert.equal(marks.length, 1); assert.equal(marks[0].status, 'ABSENT');
      await assertFrozenEvidence(oldId);
      const preview = await reset.preview(scope(), 'sa'); assert.equal(preview.halls[0].status, 'CLOSED'); assert.equal(preview.totals.absentCount, 1);
      await rejects(() => reset.preview(scope(), 'admin'), 403);
      const operation: any = await reset.confirm(confirm(preview.challenge), 'sa', randomUUID());
      const archived = await db.attendanceSession.findUnique({ where: { id: oldId } });
      const { isCurrent: _current, archivedAt: _archived, ...evidence } = archived;
      const { isCurrent: _oldCurrent, archivedAt: _oldArchived, ...previous } = before;
      assert.deepEqual(evidence, previous); assert.equal(archived.isCurrent, false); assert(archived.archivedAt);
      assert.deepEqual(await db.attendance.findMany({ where: { sessionId: oldId }, orderBy: { id: 'asc' } }), marks);
      assert.deepEqual(await db.attendanceSessionCandidate.findMany({ where: { sessionId: oldId }, orderBy: { studentId: 'asc' } }), roster);
      session = await db.attendanceSession.findUnique({ where: { id: operation.attempts[0].newSessionId } });
      assert.equal(session.status, 'OPEN'); assert.equal(session.isCurrent, true); assert.equal(session.attemptNumber, before.attemptNumber + 1);
      assert.equal(await db.attendance.count({ where: { sessionId: session.id } }), 0);
      assert.deepEqual((await db.attendanceSessionCandidate.findMany({ where: { sessionId: session.id }, orderBy: { studentId: 'asc' } })).map(({ id, sessionId, createdAt, ...row }: any) => row), roster.map(({ id, sessionId, createdAt, ...row }: any) => row));
      assert.equal((await db.student.findUnique({ where: { id: 's' } })).qrToken, 'security-fixture');
      await assertFrozenEvidence(oldId);
      await assert.rejects(() => sql!.query('UPDATE "AttendanceSession" SET "isCurrent"=true,"archivedAt"=NULL WHERE id=$1', [oldId]), /immutable/);
    });
    await check('repeated CLOSED resets preserve every finalized attempt and exactly one current generation', async () => {
      const previousId = session.id;
      await attendance.closeSession(previousId, true, 'admin');
      const before = await db.attendanceSession.findUnique({ where: { id: previousId } });
      const marks = await db.attendance.findMany({ where: { sessionId: previousId } });
      const preview = await reset.preview(scope(), 'sa'), operation: any = await reset.confirm(confirm(preview.challenge), 'sa', randomUUID());
      session = await db.attendanceSession.findUnique({ where: { id: operation.attempts[0].newSessionId } });
      assert.equal(session.attemptNumber, before.attemptNumber + 1); assert.equal(session.status, 'OPEN');
      assert.equal(await db.attendance.count({ where: { sessionId: session.id } }), 0);
      assert.deepEqual(await db.attendance.findMany({ where: { sessionId: previousId } }), marks);
      const old = await db.attendanceSession.findUnique({ where: { id: previousId } });
      assert.equal(old.status, 'CLOSED'); assert.equal(old.closedAt.toISOString(), before.closedAt.toISOString()); assert.equal(old.closedByUserId, before.closedByUserId);
      assert.equal(await db.attendanceSession.count({ where: { examHallId: hall.id, isCurrent: true } }), 1);
      await assertFrozenEvidence(previousId);
    });
    await check('close-first serialization invalidates OPEN preview and a fresh CLOSED reset retains all automatic absences', async () => {
      const oldId = session.id, preview = await reset.preview(scope(), 'sa'), auditCount = await db.attendanceResetOperation.count();
      await attendance.closeSession(oldId, true, 'admin');
      await rejects(() => reset.confirm(confirm(preview.challenge), 'sa', randomUUID()), 409);
      assert.equal(await db.attendanceResetOperation.count(), auditCount);
      const marks = await db.attendance.findMany({ where: { sessionId: oldId } });
      assert.equal(marks.length, 1); assert.equal(marks[0].status, 'ABSENT');
      const fresh = await reset.preview(scope(), 'sa'), result: any = await reset.confirm(confirm(fresh.challenge), 'sa', randomUUID());
      assert.deepEqual(await db.attendance.findMany({ where: { sessionId: oldId } }), marks);
      session = await db.attendanceSession.findUnique({ where: { id: result.attempts[0].newSessionId } });
      await rejects(() => attendance.closeSession(oldId, true, 'admin'), 409);
      assert.equal(await db.attendance.count({ where: { sessionId: session.id } }), 0);
    });
    await check('database rejects forged archival with invalid actor, scope, snapshot, roster or nonzero replacement', async () => {
      await attendance.closeSession(session.id, true, 'admin');
      const before = await db.attendanceSession.findUnique({ where: { id: session.id } });
      const roster = await db.attendanceSessionCandidate.findMany({ where: { sessionId: before.id } });
      const auditCount = await db.attendanceResetOperation.count();
      for (const variant of ['actor', 'scope', 'snapshot', 'roster', 'marked']) {
        const outcome = await db.$transaction(async (tx: any) => {
          const actorId = variant === 'actor' ? 'admin' : 'sa';
          await tx.attendanceSession.update({ where: { id: before.id }, data: { isCurrent: false, archivedAt: new Date(), updatedAt: before.updatedAt } });
          const replacement = await tx.attendanceSession.create({ data: {
            examHallId: before.examHallId, businessDate: before.businessDate, attemptNumber: before.attemptNumber + 1, openedByUserId: actorId,
            hallNameSnapshot: variant === 'snapshot' ? 'Forged replacement Hall' : before.hallNameSnapshot,
            roomNumberSnapshot: before.roomNumberSnapshot, testCenterNameSnapshot: before.testCenterNameSnapshot,
            examDateSnapshot: before.examDateSnapshot, reportingTimeSnapshot: before.reportingTimeSnapshot,
          } });
          if (variant !== 'roster') await tx.attendanceSessionCandidate.createMany({ data: roster.map(({ id, sessionId, createdAt, ...row }: any) => ({ ...row, sessionId: replacement.id })) });
          if (variant === 'marked') await tx.attendance.create({ data: { sessionId: replacement.id, studentId: 's', date: before.businessDate, status: 'PRESENT', method: 'MANUAL', markedByUserId: actorId } });
          await tx.attendanceResetOperation.create({ data: {
            id: randomUUID(), actorId, actorName: actorId, idempotencyKey: randomUUID(), challengeNonce: randomUUID(), requestHash: 'Synthetic forged request',
            reason: 'Synthetic invalid archive', mode: 'HALL', businessDate: before.businessDate, affectedCandidates: roster.length,
            scope: { mode: 'HALL', businessDate: '2026-10-10', sessionIds: [variant === 'scope' ? 'unrelated' : before.id] },
            result: { status: 'COMPLETED', attempts: [{ previousSessionId: before.id, newSessionId: replacement.id }] },
          } });
          // Force the deferred integrity check before Prisma reports a result.
          await tx.$executeRawUnsafe('SET CONSTRAINTS "AttendanceSession_closed_reset_coherence" IMMEDIATE');
          return 'COMMITTED';
        }).catch((error: any) => { assert.match(error.message, /reset audit and exact replacement roster/); return 'REJECTED'; });
        assert.deepEqual(await db.attendanceSession.findUnique({ where: { id: before.id } }), before);
        assert.equal(await db.attendanceSession.count({ where: { examHallId: hall.id, isCurrent: true } }), 1);
        assert.equal(await db.attendanceResetOperation.count(), auditCount);
        assert.notEqual(outcome, 'COMMITTED', `Forged ${variant} archive must roll back`);
      }
    });
    await check('service surfaces coherence failure before returning success and rolls back all reset writes', async () => {
      const before = await db.attendanceSession.findUnique({ where: { id: session.id } });
      const marks = await db.attendance.findMany({ where: { sessionId: session.id }, orderBy: { id: 'asc' } });
      const roster = await db.attendanceSessionCandidate.findMany({ where: { sessionId: session.id }, orderBy: { studentId: 'asc' } });
      const audits = await db.attendanceResetOperation.findMany({ orderBy: { id: 'asc' } });
      const count = await db.attendanceSession.count();
      const corrupted = new Proxy(db, { get(target, property) {
        if (property !== '$transaction') return Reflect.get(target, property);
        return (work: any, options: any) => target.$transaction((tx: any) => work(new Proxy(tx, { get(transaction, name) {
          if (name !== 'attendanceResetOperation') return Reflect.get(transaction, name);
          return new Proxy(transaction.attendanceResetOperation, { get(model, method) {
            if (method !== 'create') return Reflect.get(model, method);
            return (args: any) => model.create({ ...args, data: { ...args.data, scope: { ...args.data.scope, sessionIds: ['unrelated'] } } });
          } });
        } })), options);
      } });
      const preview = await reset.preview(scope(), 'sa');
      await assert.rejects(() => new AttendanceResetService(corrupted).confirm(confirm(preview.challenge), 'sa', randomUUID()), /reset audit and exact replacement roster/);
      assert.deepEqual(await db.attendanceSession.findUnique({ where: { id: session.id } }), before);
      assert.deepEqual(await db.attendance.findMany({ where: { sessionId: session.id }, orderBy: { id: 'asc' } }), marks);
      assert.deepEqual(await db.attendanceSessionCandidate.findMany({ where: { sessionId: session.id }, orderBy: { studentId: 'asc' } }), roster);
      assert.deepEqual(await db.attendanceResetOperation.findMany({ orderBy: { id: 'asc' } }), audits);
      assert.equal(await db.attendanceSession.count(), count);
    });
    const { default: router } = await import('../src/modules/attendance/attendance.routes');
    const { errorHandler } = await import('../src/middleware/error.middleware');
    shared = (await import('../src/lib/prisma')).prisma;
    const app = express(); app.use(express.json()); app.use('/attendance', router); app.use(errorHandler);
    server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
    const endpoint = `http://127.0.0.1:${server.address().port}/attendance/reset/history`;
    const request = (token: string) => fetch(endpoint, { headers: { Authorization: 'Bearer ' + token } });
    const access = (id: string, version: number, role = 'SUPER_ADMIN') => signAccessToken({ userId: id, email: id + '@test.invalid', name: id, role, tokenVersion: version });
    await check('challenge and refresh token cannot serve as reset bearer credentials', async () => {
      assert.equal((await request(p.challenge)).status, 401);
      assert.equal((await request(signRefreshToken({ userId: 'sa', tokenVersion: 1 }))).status, 401);
      assert.equal((await request(access('sa', 0))).status, 401);
      assert.equal((await request(access('admin', 0))).status, 403);
      assert.equal((await request(access('sa', 1))).status, 200);
    });
    await check('deleted actors and demoted accounts fail backend authorization', async () => {
      assert.equal((await request(access('missing', 0))).status, 401);
      await db.user.update({ where: { id: 'other' }, data: { role: 'ADMIN' } });
      assert.equal((await request(access('other', 0))).status, 403);
    });
    console.log(`Attendance reset security: ${passed} passed, 0 failed`);
  } finally {
    if (server) await new Promise<void>(resolve => server.close(resolve));
    await db?.$disconnect(); await shared?.$disconnect(); await sql?.end();
    await admin.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1', [name]);
    await admin.query(`DROP DATABASE IF EXISTS "${name}"`); await admin.end();
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
