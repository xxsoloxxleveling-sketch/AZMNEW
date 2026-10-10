import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { Client } from 'pg';

const baseline = '9fef4f57f948be833d6113d8052d5b92cadb6a7a';
const root = path.resolve(__dirname, '../..');
const backend = path.join(root, 'backend');
const migrationName = '20261007130000_exam_attendance_sessions';
const migrationPath = path.join(backend, 'prisma', 'migrations', migrationName);

async function run() {
  assert.notEqual(process.env.NODE_ENV, 'production', 'production environment is prohibited');
  const source = new URL(process.env.ATTENDANCE_TEST_DATABASE_URL || '');
  assert(['localhost', '127.0.0.1', '[::1]'].includes(source.hostname), 'only localhost PostgreSQL is permitted');
  const id = randomUUID().replace(/-/g, '');
  const names = [`attendance13c_clean_${id}`, `attendance13c_upgrade_${id}`];
  const admin = new Client({ connectionString: source.toString() });
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'azm-attendance13c-'));
  let passed = 0;
  let sharedPrisma: any;
  const check = async (label: string, fn: () => unknown | Promise<unknown>) => { await fn(); passed++; console.log(`PASS: ${label}`); };
  await admin.connect();
  try {
    for (const name of names) await admin.query(`CREATE DATABASE "${name}"`);
    const cli = path.join(backend, 'node_modules', 'prisma', 'build', 'index.js');
    const migrationRoot = path.join(fixture, 'prisma', 'migrations');
    fs.mkdirSync(migrationRoot, { recursive: true });
    const oldMigrationNames = execFileSync('git', ['ls-tree', '--name-only', baseline + ':backend/prisma/migrations'], { cwd: root, encoding: 'utf8' }).trim().split(/\r?\n/).filter(n => n && n !== '.gitkeep');
    for (const name of oldMigrationNames) {
      if (name === 'migration_lock.toml') fs.copyFileSync(path.join(backend, 'prisma', 'migrations', name), path.join(migrationRoot, name));
      else {
        const sql = execFileSync('git', ['show', `${baseline}:backend/prisma/migrations/${name}/migration.sql`], { cwd: root, encoding: 'utf8' });
        fs.mkdirSync(path.join(migrationRoot, name), { recursive: true });
        fs.writeFileSync(path.join(migrationRoot, name, 'migration.sql'), sql);
      }
    }
    const baseSchema = execFileSync('git', ['show', `${baseline}:backend/prisma/schema.prisma`], { cwd: root, encoding: 'utf8' });
    const schemaPath = path.join(fixture, 'prisma', 'schema.prisma');
    fs.writeFileSync(schemaPath, baseSchema);
    const currentSchema = fs.readFileSync(path.join(backend, 'prisma', 'schema.prisma'), 'utf8');
    const extendedSchema = currentSchema;
    const envFor = (dbName: string) => {
      const url = new URL(source); url.pathname = `/${dbName}`; url.searchParams.delete('schema');
      return { ...process.env, DATABASE_URL: url.toString(), DIRECT_URL: url.toString(), NODE_ENV: 'test' };
    };
    const cleanEnv = envFor(names[0]);
    execFileSync(process.execPath, [cli, 'migrate', 'deploy', '--schema', path.join(backend, 'prisma', 'schema.prisma')], { cwd: backend, env: cleanEnv, stdio: 'pipe' });
    await check('clean schema deploy applies the complete migration chain', async () => {
      const db = new Client({ connectionString: cleanEnv.DATABASE_URL }); await db.connect();
      try { const applied = await db.query('SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL'); assert((applied.rows as any[]).some(r => r.migration_name === migrationName)); assert.equal((await db.query('SELECT to_regclass(\'"AttendanceSession"\') AS t')).rows[0].t, '"AttendanceSession"'); }
      finally { await db.end(); }
    });

    fs.writeFileSync(schemaPath, baseSchema);
    const upgradeEnv = envFor(names[1]);
    execFileSync(process.execPath, [cli, 'migrate', 'deploy', '--schema', schemaPath], { cwd: backend, env: upgradeEnv, stdio: 'pipe' });
    const db = new Client({ connectionString: upgradeEnv.DATABASE_URL }); await db.connect();
    try {
      await check('upgrade database begins at production schema and legacy migration history', async () => {
        const state = await db.query('SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL');
        assert.equal(state.rows.length, oldMigrationNames.filter(n => n !== 'migration_lock.toml').length);
        assert.equal((await db.query('SELECT to_regclass(\'"AttendanceSession"\') AS t')).rows[0].t, null);
      });
      await db.query(`INSERT INTO "Student" (id,"applicationNo","qrToken","fullName","fatherName",gender,"dateOfBirth","cnicOrBForm",address,district,province,"parentMobile","currentClass","schoolName","boardOrUniversity","scholarshipCategory","emergencyContact","emergencyRelation","createdAt","updatedAt") VALUES ('legacy13c','APP-LEGACY13C','QR-LEGACY13C','Legacy Candidate','Parent','MALE','2008-01-01','CNIC-LEGACY13C','Address','District','Province','Phone','Class 9th','School','Board','GENERAL_MERIT','Emergency','Parent','2026-01-01','2026-01-01')`);
      await db.query(`INSERT INTO "Attendance" (id,"studentId",date,status,"markedByUserId",method,"createdAt") VALUES ('legacy-mark-13c','legacy13c','2026-01-02','PRESENT','legacy-operator','MANUAL','2026-01-02 08:00:00')`);
      const oldRow = (await db.query('SELECT id,"studentId",date,status,"markedByUserId",method,"createdAt" FROM "Attendance" WHERE id=$1', ['legacy-mark-13c'])).rows[0];
      fs.writeFileSync(schemaPath, extendedSchema);
      fs.cpSync(migrationPath, path.join(migrationRoot, migrationName), { recursive: true });
      fs.cpSync(path.join(backend, 'prisma/migrations/20261010120000_attendance_reset_attempts'), path.join(migrationRoot, '20261010120000_attendance_reset_attempts'), { recursive: true });
      execFileSync(process.execPath, [cli, 'migrate', 'deploy', '--schema', schemaPath], { cwd: backend, env: upgradeEnv, stdio: 'pipe' });
      await check('upgrade preserves legacy Attendance unchanged with nullable sessionId and no synthetic sessions', async () => {
        const after = (await db.query('SELECT id,"studentId",date,status,"markedByUserId",method,"createdAt","sessionId" FROM "Attendance" WHERE id=$1', ['legacy-mark-13c'])).rows[0];
        assert.equal(after.sessionId, null); delete after.sessionId; assert.deepEqual(after, oldRow);
        assert.equal(Number((await db.query('SELECT count(*)::int AS n FROM "Attendance"')).rows[0].n), 1);
        assert.equal(Number((await db.query('SELECT count(*)::int AS n FROM "AttendanceSession"')).rows[0].n), 0);
      });
      await check('session, frozen-roster, attendance indexes and foreign keys exist', async () => {
        const indexes = await db.query("SELECT indexname FROM pg_indexes WHERE schemaname='public'");
        const names = new Set(indexes.rows.map((r: any) => r.indexname));
        for (const n of ['Attendance_sessionId_studentId_key','Attendance_studentId_idx','AttendanceSession_examHallId_businessDate_attemptNumber_key','AttendanceSession_current_hall_date_key','AttendanceSession_businessDate_idx','AttendanceSession_status_idx','AttendanceSessionCandidate_sessionId_studentId_key','AttendanceSessionCandidate_studentId_idx']) assert(names.has(n), n);
        const constraints = await db.query("SELECT conname FROM pg_constraint WHERE conrelid IN ('\"AttendanceSession\"'::regclass,'\"AttendanceSessionCandidate\"'::regclass,'\"Attendance\"'::regclass)");
        const foreignKeys = new Set(constraints.rows.map((r: any) => r.conname));
        for (const n of ['AttendanceSession_examHallId_fkey','AttendanceSessionCandidate_sessionId_fkey','AttendanceSessionCandidate_studentId_fkey','Attendance_sessionId_fkey','Attendance_sessionId_studentId_fkey']) assert(foreignKeys.has(n), n);
      });
      await check('legacy student/date row remains readable and new session links reject invalid references', async () => {
        const old = await db.query('SELECT a."studentId", a.date::text, a.status, a."sessionId", s."fullName" FROM "Attendance" a JOIN "Student" s ON s.id=a."studentId" WHERE a.id=$1', ['legacy-mark-13c']);
        assert.equal(old.rows[0].studentId, 'legacy13c'); assert.equal(old.rows[0].date.slice(0, 10), '2026-01-02'); assert.equal(old.rows[0].status, 'PRESENT'); assert.equal(old.rows[0].sessionId, null); assert.equal(old.rows[0].fullName, 'Legacy Candidate');
        await assert.rejects(() => db.query(`INSERT INTO "Attendance" (id,"sessionId","studentId",date,status,"markedByUserId",method,"createdAt") VALUES ('bad-ref','missing','legacy13c','2026-01-02','PRESENT','x','MANUAL',now())`), (error: any) => error.code === '23503');
      });
      await check('partial unique session/student key permits multiple null legacy rows but forbids duplicate session marks', async () => {
        await db.query(`INSERT INTO "Attendance" (id,"studentId",date,status,"markedByUserId",method,"createdAt") VALUES ('legacy-mark-13c-2','legacy13c','2026-01-03','LATE','legacy-operator','MANUAL',now())`);
        await db.query(`INSERT INTO "ExamHall" (id,name,"roomNumber","targetClass",capacity,"reportingTime","examDate","createdAt","updatedAt") VALUES ('hall13c','Test Hall','Room 1','Class 9th',10,'08:00','2026-11-15',now(),now())`);
        await db.query(`INSERT INTO "AttendanceSession" (id,"examHallId","businessDate","openedByUserId","hallNameSnapshot","roomNumberSnapshot","examDateSnapshot","reportingTimeSnapshot") VALUES ('session13c','hall13c','2026-11-15','operator','Test Hall','Room 1','2026-11-15','08:00')`);
        await db.query(`INSERT INTO "AttendanceSessionCandidate" (id,"sessionId","studentId","fullNameSnapshot","applicationNoSnapshot","currentClassSnapshot") VALUES ('candidate13c','session13c','legacy13c','Legacy Candidate','APP-LEGACY13C','Class 9th')`);
        await db.query(`INSERT INTO "Attendance" (id,"sessionId","studentId",date,status,"markedByUserId",method,"createdAt") VALUES ('session-mark13c','session13c','legacy13c','2026-11-15','PRESENT','operator','MANUAL',now())`);
        await assert.rejects(() => db.query(`INSERT INTO "Attendance" (id,"sessionId","studentId",date,status,"markedByUserId",method,"createdAt") VALUES ('session-mark13c-dup','session13c','legacy13c','2026-11-15','LATE','operator','MANUAL',now())`), (error: any) => error.code === '23505');
      });
      process.env.DATABASE_URL = upgradeEnv.DATABASE_URL;
      process.env.DIRECT_URL = upgradeEnv.DIRECT_URL;
      const { PrismaClient } = await import('@prisma/client');
      const { AttendanceService } = await import('../src/modules/attendance/attendance.service');
      const { ExamHallsService } = await import('../src/modules/exam-halls/examHalls.service');
      const prisma = new PrismaClient();
      try {
        const attendance = new AttendanceService(prisma);
        const halls = new ExamHallsService(prisma);
        const center = await prisma.testCenter.create({ data: { name: '13C Fixture Center', code: 'FIX13C', address: '', district: '', province: '' } });
        const hall = async (id: string, examDate: string) => prisma.examHall.create({ data: { id, name: id, roomNumber: 'Room ' + id, targetClass: 'Class 9th', capacity: 20, examDate, reportingTime: '08:00', testCenterId: center.id } });
        const student = (id: string, className: string, assignedHallId?: string, assignedHall?: string) => prisma.student.create({ data: { id, applicationNo: 'APP-' + id, qrToken: 'QR-' + id, fullName: 'Candidate ' + id, fatherName: 'Fixture', gender: 'MALE', dateOfBirth: new Date('2008-01-01'), cnicOrBForm: 'CNIC-' + id, address: 'Fixture', district: 'Fixture', province: 'Fixture', parentMobile: 'Fixture', currentClass: className, schoolName: 'Fixture', boardOrUniversity: 'Fixture', scholarshipCategory: 'GENERAL_MERIT', emergencyContact: 'Fixture', emergencyRelation: 'Fixture', assignedHallId, assignedHall, seatNo: 'Seat-' + id } });
        await hall('scope-a', '2026-11-15'); await hall('scope-b', '2026-11-15'); await hall('scope-empty', '2026-11-15');
        await student('scope-a1', 'Class 9th', 'scope-a'); await student('scope-a2', 'Class 11th', 'scope-a');
        await student('scope-b1', 'Class 9th', 'scope-b'); await student('scope-legacy', 'Class 9th', undefined, 'scope-a');
        const scoped = await attendance.openSession('scope-a', 'operator');
        await check('Hall assignment alone defines roster across classes; other Hall and legacy text candidates are excluded', () => {
          assert.equal(scoped.stats.expectedCount, 2);
          assert.deepEqual(scoped.roster.map((r: any) => r.studentId).sort(), ['scope-a1', 'scope-a2']);
          assert(scoped.roster.some((r: any) => r.currentClassSnapshot === 'Class 11th'));
        });
        await assert.rejects(() => attendance.openSession('scope-empty', 'operator'), (e: any) => e.statusCode === 409);
        await check('empty Hall cannot create a zero-candidate session', async () => assert.equal(await prisma.attendanceSession.count({ where: { examHallId: 'scope-empty' } }), 0));

        await hall('history-a', '2026-11-16'); await hall('history-b', '2026-11-17'); await hall('history-c', '2026-11-18');
        await student('history13c', 'Class 9th', 'history-a');
        const first = await attendance.openSession('history-a', 'operator'); await attendance.mark(first.session.id, { studentId: 'history13c', status: 'PRESENT' }, 'operator'); await attendance.closeSession(first.session.id, false, 'operator');
        await prisma.student.update({ where: { id: 'history13c' }, data: { assignedHallId: 'history-b' } });
        const second = await attendance.openSession('history-b', 'operator'); await attendance.mark(second.session.id, { studentId: 'history13c', status: 'LATE' }, 'operator'); await attendance.closeSession(second.session.id, false, 'operator');
        await prisma.student.update({ where: { id: 'history13c' }, data: { assignedHallId: 'history-c' } });
        const third = await attendance.openSession('history-c', 'operator'); await attendance.closeSession(third.session.id, false, 'operator');
        await prisma.attendance.create({ data: { studentId: 'history13c', date: new Date('2026-01-01'), status: 'PRESENT', method: 'MANUAL', markedByUserId: 'legacy-operator' } });
        await check('student history denominator includes PRESENT, LATE, and NOT_MARKED expected sessions', async () => {
          const history = await attendance.getStudentAttendanceHistory('history13c');
          assert.equal(history.stats.expectedCount, 3); assert.equal(history.stats.presentCount, 1); assert.equal(history.stats.lateCount, 1); assert.equal(history.history.filter((r: any) => r.status === 'NOT_MARKED').length, 1); assert.equal(history.stats.attendancePercentage, 66.7);
          assert.equal(history.legacyHistory.length, 1); assert.equal(history.legacyHistory[0].label, 'Legacy attendance record');
        });

        const { DashboardService } = await import('../src/modules/dashboard/dashboard.service');
      ({ prisma: sharedPrisma } = await import('../src/lib/prisma'));
        const { karachiBusinessDate } = await import('../src/modules/attendance/attendance.service');
        const dashboard = new DashboardService();
        const today = karachiBusinessDate(new Date()).toISOString().slice(0, 10);
        await check('dashboard reports no session with null percentage when today has no attendance sessions', async () => {
          const overview = await dashboard.getOverview();
          assert.equal(overview.attendanceToday.sessionCount, 0); assert.equal(overview.attendanceToday.expectedCount, 0); assert.equal(overview.attendanceToday.attendancePercentage, null);
        });
        await hall('today-empty13c', today);
        const emptyToday = await prisma.attendanceSession.create({ data: { examHallId: 'today-empty13c', businessDate: new Date(`${today}T00:00:00.000Z`), openedByUserId: 'operator', hallNameSnapshot: 'Exceptional empty session', roomNumberSnapshot: 'Room', examDateSnapshot: today, reportingTimeSnapshot: '08:00' } });
        await check('dashboard keeps percentage null for exceptional zero-expected session', async () => {
          const overview = await dashboard.getOverview(); assert.equal(overview.attendanceToday.sessionCount, 1); assert.equal(overview.attendanceToday.expectedCount, 0); assert.equal(overview.attendanceToday.attendancePercentage, null);
        });
        await hall('today-assigned13c', today); await student('today-candidate-a', 'Class 9th', 'today-assigned13c'); await student('today-candidate-b', 'Class 10th', 'today-assigned13c');
        const todaySession = await attendance.openSession('today-assigned13c', 'operator'); await attendance.mark(todaySession.session.id, { studentId: 'today-candidate-a', status: 'PRESENT' }, 'operator');
        await check('dashboard denominator follows today Hall roster rather than the global active-student count', async () => {
          const overview = await dashboard.getOverview(); assert.equal(overview.attendanceToday.sessionCount, 2); assert.equal(overview.attendanceToday.expectedCount, 2); assert.equal(overview.attendanceToday.markedCount, 1); assert.equal(overview.attendanceToday.attendancePercentage, 50);
          assert((await prisma.student.count({ where: { status: 'ACTIVE' } })) > 2);
        });
        await prisma.attendanceSession.delete({ where: { id: emptyToday.id } });

        await hall('race13c', '2026-11-19'); await student('race13c-student', 'Class 9th', 'race13c');
        const raceSession = await attendance.openSession('race13c', 'operator');
        const race = await Promise.allSettled([attendance.mark(raceSession.session.id, { studentId: 'race13c-student', status: 'PRESENT' }, 'operator'), attendance.closeSession(raceSession.session.id, false, 'closer')]);
        const markResult = race[0]; const closeResult = race[1];
        await check('mark-versus-close race ends consistently: mark rejected 409 or committed before close exactly once', async () => {
          assert.equal(closeResult.status, 'fulfilled');
          const final = await attendance.getSession(raceSession.session.id);
          assert.equal(final.session.status, 'CLOSED');
          const rows = await prisma.attendance.findMany({ where: { sessionId: raceSession.session.id, studentId: 'race13c-student' } });
          assert(rows.length === 0 || rows.length === 1);
          if (markResult.status === 'rejected') assert.equal((markResult.reason as any).statusCode, 409);
          else { assert.equal(rows.length, 1); assert.equal(final.roster[0].status, 'PRESENT'); }
          assert.equal(rows.length, final.stats.markedCount);
          console.log(`Observed mark/close race: ${markResult.status === 'rejected' ? `mark rejected ${((markResult as PromiseRejectedResult).reason as any).statusCode}` : 'mark committed before close'}; session CLOSED.`);
        });
      } finally { await prisma.$disconnect(); await sharedPrisma.$disconnect(); }
    } finally { await db.end(); }
    console.log(`Examination Attendance 13C data acceptance: ${passed} PASS, 0 FAIL.`);
  } finally {
    for (const name of names) {
      await admin.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()', [name]);
      await admin.query(`DROP DATABASE IF EXISTS "${name}"`);
    }
    await admin.end();
    assert.equal(path.dirname(path.resolve(fixture)), path.resolve(os.tmpdir()));
    assert(path.basename(fixture).startsWith('azm-attendance13c-'));
    fs.rmSync(fixture, { recursive: true, force: true });
    console.log('Only UUID-named disposable local databases and temporary fixtures were cleaned up.');
  }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
