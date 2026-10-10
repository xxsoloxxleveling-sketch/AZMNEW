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
      assert.deepEqual(await db.attendanceSession.findUnique({ where: { id: active.id } }), before);
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
