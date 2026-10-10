import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';

// End-to-end service workflows with real PostgreSQL, isolated synthetic candidates.
async function run() {
  assert.notEqual(process.env.NODE_ENV, 'production');
  const source = new URL(process.env.ATTENDANCE_TEST_DATABASE_URL || '');
  assert(['localhost', '127.0.0.1', '[::1]'].includes(source.hostname));
  source.pathname = '/postgres'; source.search = '';
  const admin = new Client({ connectionString: source.toString() }); await admin.connect();
  const name = 'attendance_acceptance_' + randomUUID().replace(/-/g, '');
  let sql: Client | undefined, db: any, passed = 0;
  const check = async (label: string, work: () => Promise<void>) => { await work(); passed++; console.log('PASS: ' + label); };
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
    const { qrService } = await import('../src/modules/attendance/qr.service');
    const attendance = new AttendanceService(db), reset = new AttendanceResetService(db);
    for (const role of ['SUPER_ADMIN', 'ADMIN', 'TEACHER']) await db.user.create({ data: { id: role, name: role, email: role + '@test.invalid', passwordHash: 'fixture', role } });
    for (const id of ['center', 'other-center']) await db.testCenter.create({ data: { id, name: id, code: id, address: 'Fixture', district: 'Fixture' } });
    const dates: Record<string, string> = { a: '2026-10-10', b: '2026-10-10', c: '2026-10-10', outside: '2026-10-10', tomorrow: '2026-10-11' };
    for (const hall of Object.keys(dates)) {
      await db.examHall.create({ data: { id: hall, name: 'Synthetic Hall ' + hall, roomNumber: hall, targetClass: 'Class 9th', examDate: dates[hall], reportingTime: '08:00', testCenterId: hall === 'outside' ? 'other-center' : 'center' } });
      for (let index = 0; index < (hall === 'a' ? 22 : 3); index++) {
        const id = hall + '-' + index;
        await db.student.create({ data: { id, applicationNo: 'APP-' + id, qrToken: qrService.generateSignedQrToken(id), fullName: 'Synthetic ' + id, fatherName: 'Fixture', gender: 'MALE', dateOfBirth: new Date('2008-01-01'), cnicOrBForm: id, address: 'Fixture', district: 'Fixture', province: 'Fixture', parentMobile: 'fixture', currentClass: 'Class 9th', schoolName: 'Fixture', boardOrUniversity: 'Fixture', scholarshipCategory: 'GENERAL_MERIT', emergencyContact: 'fixture', emergencyRelation: 'Fixture', assignedHallId: hall } });
      }
    }
    const current: Record<string, any> = {};
    for (const hall of Object.keys(dates)) current[hall] = (await attendance.openSession(hall, 'ADMIN')).session;
    const candidatesBefore = await db.student.findMany({ orderBy: { id: 'asc' } });
    const evidence = async (id: string) => ({ session: await db.attendanceSession.findUnique({ where: { id } }), marks: await db.attendance.findMany({ where: { sessionId: id }, orderBy: { id: 'asc' } }), roster: await db.attendanceSessionCandidate.findMany({ where: { sessionId: id }, orderBy: { studentId: 'asc' } }) });
    const preserve = async (before: any, nextId: string) => {
      const after = await evidence(before.session.id), next = await attendance.getSession(nextId);
      const strip = ({ isCurrent, archivedAt, ...row }: any) => row;
      assert.deepEqual(strip(after.session), strip(before.session)); assert.equal(after.session.isCurrent, false); assert(after.session.archivedAt);
      assert.deepEqual(after.marks, before.marks); assert.deepEqual(after.roster, before.roster);
      assert.equal(next.session.status, 'OPEN'); assert.equal(next.session.attemptNumber, before.session.attemptNumber + 1); assert.equal(next.stats.markedCount, 0); assert.equal(next.stats.completionPercentage, 0);
      const roster = (rows: any[]) => rows.map(({ id, sessionId, createdAt, ...row }) => row);
      assert.deepEqual(roster((await evidence(nextId)).roster), roster(before.roster));
    };
    const perform = async (halls: string[], mode: 'HALL' | 'SELECTED' | 'CURRENT' = 'HALL') => {
      const scope = { mode, businessDate: '2026-10-10', sessionIds: halls.map(hall => current[hall].id), testCenterId: 'center' };
      const preview = await reset.preview(scope, 'SUPER_ADMIN');
      const result: any = await reset.confirm({ challenge: preview.challenge, reason: 'Independent synthetic operator acceptance', confirmationText: 'RESET ATTENDANCE' }, 'SUPER_ADMIN', randomUUID());
      for (const row of result.attempts) current[row.examHallId] = await db.attendanceSession.findUnique({ where: { id: row.newSessionId } });
      return { preview, result };
    };
    await check('Scenario 1: OPEN Hall with twenty manual/QR marks preserves all evidence and restarts zero', async () => {
      for (let i = 0; i < 20; i++) {
        const id = 'a-' + i, candidate = candidatesBefore.find((row: any) => row.id === id);
        await attendance.mark(current.a.id, i % 2 ? { qrToken: candidate.qrToken, status: 'PRESENT' } : { studentId: id, status: 'PRESENT' }, 'TEACHER');
      }
      const before = await evidence(current.a.id); assert.equal(before.marks.length, 20);
      const { preview, result } = await perform(['a']); assert.equal(preview.totals.manualCount, 10); assert.equal(preview.totals.qrCount, 10);
      await preserve(before, result.attempts[0].newSessionId); assert.equal((await attendance.getSession(before.session.id)).stats.markedCount, 20);
    });
    await check('Scenarios 2 and 3: CLOSED Hall preserves closure actor/time and two automatic ABSENT records', async () => {
      await attendance.mark(current.b.id, { studentId: 'b-0', status: 'PRESENT' }, 'TEACHER');
      await attendance.closeSession(current.b.id, true, 'ADMIN');
      const before = await evidence(current.b.id); assert.equal(before.session.status, 'CLOSED'); assert.equal(before.marks.filter((row: any) => row.status === 'ABSENT').length, 2);
      const { preview, result } = await perform(['b']); assert.equal(preview.halls[0].status, 'CLOSED'); assert.equal(preview.totals.absentCount, 2);
      await preserve(before, result.attempts[0].newSessionId);
    });
    await check('Scenario 4: three selected mixed OPEN/CLOSED Halls reset atomically with intact rosters', async () => {
      await attendance.closeSession(current.b.id, true, 'ADMIN'); await attendance.closeSession(current.c.id, true, 'ADMIN');
      const before = await Promise.all(['a', 'b', 'c'].map(hall => evidence(current[hall].id)));
      const { preview, result } = await perform(['a', 'b', 'c'], 'SELECTED');
      assert.equal(preview.halls.filter((hall: any) => hall.status === 'CLOSED').length, 2); assert.equal(preview.halls.filter((hall: any) => hall.status === 'OPEN').length, 1); assert.equal(result.attempts.length, 3);
      for (const old of before) await preserve(old, result.attempts.find((row: any) => row.previousSessionId === old.session.id).newSessionId);
    });
    await check('Scenario 5: complete CURRENT rejects subsets and preserves other center/date byte-for-byte', async () => {
      await attendance.closeSession(current.c.id, true, 'ADMIN');
      const outside = await Promise.all(['outside', 'tomorrow'].map(hall => evidence(current[hall].id)));
      await assert.rejects(() => reset.preview({ mode: 'CURRENT', businessDate: '2026-10-10', testCenterId: 'center', sessionIds: [current.a.id] }, 'SUPER_ADMIN'), (error: any) => error.statusCode === 409);
      const { result } = await perform(['a', 'b', 'c'], 'CURRENT'); assert.equal(result.attempts.length, 3);
      for (const before of outside) assert.deepEqual(await evidence(before.session.id), before);
    });
    await check('Scenario 6: repeated close/reset retains earlier attempts and monotonic generation', async () => {
      const previous = current.b; await attendance.mark(previous.id, { studentId: 'b-0', status: 'LATE' }, 'TEACHER'); await attendance.closeSession(previous.id, true, 'ADMIN');
      const before = await evidence(previous.id), historyBefore = await db.attendanceSession.findMany({ where: { examHallId: 'b', isCurrent: false }, orderBy: { attemptNumber: 'asc' } });
      const { result } = await perform(['b']); await preserve(before, result.attempts[0].newSessionId);
      assert.deepEqual(await db.attendanceSession.findMany({ where: { id: { in: historyBefore.map((row: any) => row.id) } }, orderBy: { attemptNumber: 'asc' } }), historyBefore);
      assert.equal(await db.attendanceSession.count({ where: { examHallId: 'b', isCurrent: true } }), 1);
    });
    await check('Scenario 7: original signed QR works after CLOSED reset, duplicate scan returns same mark, old/wrong Hall reject', async () => {
      const token = candidatesBefore.find((row: any) => row.id === 'b-0').qrToken;
      const old = await db.attendanceSession.findFirst({ where: { examHallId: 'b', isCurrent: false }, orderBy: { attemptNumber: 'desc' } });
      const first = await attendance.scanOrMarkAttendance({ sessionId: current.b.id, qrToken: token }, 'TEACHER');
      assert.equal(first.student.id, 'b-0'); assert.equal(first.attendance.method, 'QR_SCAN');
      const duplicate: any = await attendance.scanOrMarkAttendance({ sessionId: current.b.id, qrToken: token }, 'TEACHER');
      assert.equal(duplicate.alreadyMarked, true); assert.equal(duplicate.attendance.id, first.attendance.id);
      await assert.rejects(() => attendance.scanOrMarkAttendance({ sessionId: old.id, qrToken: token }, 'TEACHER'), (error: any) => error.statusCode === 409);
      await assert.rejects(() => attendance.scanOrMarkAttendance({ sessionId: current.a.id, qrToken: token }, 'TEACHER'), (error: any) => error.statusCode === 409);
      await attendance.mark(current.b.id, { studentId: 'b-1', status: 'LATE' }, 'TEACHER');
      assert.equal(await db.attendance.count({ where: { sessionId: current.b.id } }), 2);
    });
    await check('Signed QR scan racing a reset cannot write to the archived or replacement attempt silently', async () => {
      const oldId = current.c.id, token = candidatesBefore.find((row: any) => row.id === 'c-0').qrToken;
      const preview = await reset.preview({ mode: 'HALL', businessDate: '2026-10-10', sessionIds: [oldId] }, 'SUPER_ADMIN');
      const results = await Promise.allSettled([
        reset.confirm({ challenge: preview.challenge, reason: 'Independent QR concurrency acceptance', confirmationText: 'RESET ATTENDANCE' }, 'SUPER_ADMIN', randomUUID()),
        attendance.scanOrMarkAttendance({ sessionId: oldId, qrToken: token }, 'TEACHER'),
      ]);
      assert.equal(results.filter(row => row.status === 'fulfilled').length, 1);
      const rejected = results.find(row => row.status === 'rejected') as PromiseRejectedResult;
      assert.equal(rejected.reason.statusCode, 409);
      const active = await db.attendanceSession.findFirst({ where: { examHallId: 'c', isCurrent: true } });
      if (results[0].status === 'fulfilled') {
        assert.notEqual(active.id, oldId); assert.equal(await db.attendance.count({ where: { sessionId: oldId } }), 0);
        assert.equal(await db.attendance.count({ where: { sessionId: active.id } }), 0);
      } else {
        assert.equal(active.id, oldId); const marks = await db.attendance.findMany({ where: { sessionId: oldId } });
        assert.equal(marks.length, 1); assert.equal(marks[0].studentId, 'c-0'); assert.equal(marks[0].method, 'QR_SCAN');
      }
    });
    await check('All workflows preserve every candidate field and original signed token', async () => { assert.deepEqual(await db.student.findMany({ orderBy: { id: 'asc' } }), candidatesBefore); });
    console.log(`Attendance reset acceptance: ${passed} passed, 0 failed`);
  } finally {
    await db?.$disconnect(); await sql?.end();
    await admin.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1', [name]);
    await admin.query(`DROP DATABASE IF EXISTS "${name}"`); await admin.end();
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
