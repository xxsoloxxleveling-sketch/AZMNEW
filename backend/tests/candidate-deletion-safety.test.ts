import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { Client } from 'pg';
import express from 'express';

// A random disposable database, never the configured application database.
async function run() {
  if (process.env.NODE_ENV === 'production') throw new Error('Production tests prohibited.');
  const source = new URL(process.env.ATTENDANCE_TEST_DATABASE_URL || '');
  assert(['localhost', '127.0.0.1', '[::1]'].includes(source.hostname), 'Only localhost PostgreSQL is permitted.');
  assert.equal(source.pathname, '/postgres', 'Use the local postgres administrative database.');
  const name = 'candidate_deletion_' + randomUUID().replace(/-/g, '');
  const url = new URL(source); url.pathname = '/' + name; url.searchParams.delete('schema');
  const admin = new Client({ connectionString: source.toString(), connectionTimeoutMillis: 5000 });
  await admin.connect();
  let db: any, server: any, created = false, passed = 0;
  try {
    await admin.query('CREATE DATABASE "' + name + '"'); created = true;
    Object.assign(process.env, { DATABASE_URL: url.toString(), DIRECT_URL: url.toString(), NODE_ENV: 'test',
      JWT_ACCESS_SECRET: 'candidate-fixture-access-only', JWT_REFRESH_SECRET: 'candidate-fixture-refresh-only', QR_SECRET: 'candidate-fixture-qr-only' });
    const backend = path.resolve(__dirname, '..');
    execFileSync(process.execPath, [path.join(backend, 'node_modules/prisma/build/index.js'), 'migrate', 'deploy'], { cwd: backend, env: process.env, stdio: 'pipe', windowsHide: true, timeout: 60000 });
    db = (await import('../src/lib/prisma')).prisma;
    const { studentsService: students } = await import('../src/modules/students/students.service');
    const { examHallsService: halls } = await import('../src/modules/exam-halls/examHalls.service');
    const { AttendanceService } = await import('../src/modules/attendance/attendance.service');
    const attendance = new AttendanceService(db);
    const { default: router } = await import('../src/modules/students/students.routes');
    const { errorHandler } = await import('../src/middleware/error.middleware');
    const { signAccessToken } = await import('../src/lib/jwt');
    const check = async (label: string, work: () => unknown | Promise<unknown>) => { await work(); passed++; console.log('PASS: ' + label); };
    const create = (id: string) => db.student.create({ data: { id, applicationNo: 'APP-' + id, qrToken: 'fixture-' + id,
      fullName: 'Synthetic candidate', fatherName: 'Private parent', gender: 'MALE', dateOfBirth: new Date('2008-01-01'),
      cnicOrBForm: 'private-' + id, address: 'Private address', district: 'Fixture', province: 'Fixture', parentMobile: 'Private phone',
      currentClass: 'Class 9th', schoolName: 'Fixture', boardOrUniversity: 'Fixture', scholarshipCategory: 'GENERAL_MERIT', emergencyContact: 'Private phone', emergencyRelation: 'Parent' } });
    const blocked = (id: string) => assert.rejects(() => students.deleteStudent(id), (error: any) => error.statusCode === 409 && error.code === 'CANDIDATE_DELETION_PROTECTED');
    for (const role of ['SUPER_ADMIN', 'ADMIN', 'TEACHER', 'ACCOUNTANT']) await db.user.create({ data: { id: role, name: 'Fixture', email: role + '@test.invalid', passwordHash: 'fixture-only', role } });
    const app = express(); app.use(express.json()); app.use('/api/students', router); app.use(errorHandler);
    server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
    const base = 'http://127.0.0.1:' + server.address().port + '/api/students';
    const request = async (route: string, role: string | null = 'SUPER_ADMIN', method = 'GET') => {
      const response = await fetch(base + route, { method, headers: role ? { Authorization: 'Bearer ' + signAccessToken({ userId: role, role, email: role + '@test.invalid', name: 'Fixture', tokenVersion: 0 }) } : {} });
      return { status: response.status, body: await response.json() as any };
    };
    await create('empty');
    await check('candidate with no protected history can be permanently deleted', async () => {
      assert.equal((await students.getDeletionProtection('empty')).canPermanentlyDelete, true);
      await students.deleteStudent('empty'); assert.equal(await db.student.count({ where: { id: 'empty' } }), 0);
    });
    await check('missing candidate returns 404', async () => assert.equal((await request('/missing/deletion-protection')).status, 404));
    await create('roster');
    const hall = await db.examHall.create({ data: { name: 'Synthetic Hall', roomNumber: '1', targetClass: 'Class 9th', capacity: 20, examDate: '2026-11-15', reportingTime: '08:00' } });
    await halls.batchAssign(hall.id, { studentIds: ['roster'] });
    const opened = await attendance.openSession(hall.id, 'SUPER_ADMIN');
    await check('reproduces original direct deletion restriction with frozen roster FK', async () => {
      await assert.rejects(() => db.student.delete({ where: { id: 'roster' } }), (error: any) => {
        const constraint = 'AttendanceSessionCandidate_studentId_fkey';
        return (error.code === 'P2003' && String(error.meta?.field_name).includes(constraint))
          || (error.name === 'PrismaClientUnknownRequestError' && error.message.includes('23001') && error.message.includes(constraint));
      });
    });
    await check('roster-only deletion blocked with precise summary and no marks lost', async () => {
      const result = await request('/roster', 'SUPER_ADMIN', 'DELETE'); assert.equal(result.status, 409);
      assert(result.body.error.message.includes('Hall attendance session')); assert.equal(result.body.error.details.counts.frozenRosters, 1);
      assert.equal(await db.attendance.count(), 0); assert.equal(await db.attendanceSessionCandidate.count(), 1);
    });
    await attendance.mark(opened.session.id, { studentId: 'roster', status: 'PRESENT' }, 'SUPER_ADMIN');
    await check('marked candidate cannot cascade-delete attendance', async () => { await blocked('roster'); assert.equal(await db.attendance.count(), 1); });
    await create('legacy-mark');
    await db.attendance.create({ data: { studentId: 'legacy-mark', date: new Date('2026-01-01'), status: 'LATE', method: 'MANUAL', markedByUserId: 'SUPER_ADMIN' } });
    await check('legacy attendance without frozen roster remains protected', async () => { await blocked('legacy-mark'); assert.equal((await students.getDeletionProtection('legacy-mark')).counts.attendance, 1); });
    await create('fees');
    const fee = await db.feeRecord.create({ data: { studentId: 'fees', month: '2026-10', amountDue: 100, amountPaid: 100, status: 'PAID', challanNumber: 'fixture-challan', dueDate: new Date('2026-10-01') } });
    const ledger = await db.transaction.create({ data: { type: 'FEE_INCOME', amount: 100, description: 'Synthetic fee', relatedFeeId: fee.id } });
    await check('financial history and original ledger association preserved', async () => { await blocked('fees'); assert.equal((await db.transaction.findUnique({ where: { id: ledger.id } })).relatedFeeId, fee.id); assert.equal((await students.getDeletionProtection('fees')).counts.financialTransactions, 1); });
    await create('audit');
    await db.studentDocumentAudit.create({ data: { documentId: 'historical-doc', studentId: 'audit', actorId: 'SUPER_ADMIN', actorName: 'Fixture', action: 'VERIFIED' } });
    await check('append-only document audit with no FK still protects candidate', async () => { await blocked('audit'); assert.equal(await db.studentDocumentAudit.count(), 1); });
    await create('document');
    await db.studentDocument.create({ data: { studentId: 'document', documentType: 'dmc', bucket: 'fixture', objectPath: 'fixture/document.pdf', mimeType: 'application/pdf' } });
    await check('stored document cannot silently cascade-delete', async () => { await blocked('document'); assert.equal(await db.studentDocument.count(), 1); });
    await create('academic'); await db.academicRecord.create({ data: { studentId: 'academic', examLevel: 'SSC' } });
    await check('academic history protected', () => blocked('academic'));
    await create('office-review');
    await db.officeUseRecord.create({ data: { studentId: 'office-review', officeRemarks: 'Synthetic review notes', authorizedBy: 'Fixture reviewer' } });
    await check('office remarks and authorizer without final status remain protected', async () => {
      await blocked('office-review'); assert.equal((await students.getDeletionProtection('office-review')).counts.officeHistory, 1);
      assert.equal((await db.officeUseRecord.findUnique({ where: { studentId: 'office-review' } })).officeRemarks, 'Synthetic review notes');
    });
    await create('checklist');
    await db.documentChecklist.create({ data: { studentId: 'checklist', bformCnicCopy: true } });
    await check('legacy document checklist entries without attachment URLs remain protected', async () => {
      await blocked('checklist'); assert.equal((await students.getDeletionProtection('checklist')).counts.documentChecklist, 1);
      assert.equal((await db.documentChecklist.findUnique({ where: { studentId: 'checklist' } })).bformCnicCopy, true);
    });
    await create('empty-review');
    await db.officeUseRecord.create({ data: { studentId: 'empty-review' } });
    await db.documentChecklist.create({ data: { studentId: 'empty-review' } });
    await check('empty automatic office and checklist rows do not block clean registration deletion', async () => {
      await students.deleteStudent('empty-review'); assert.equal(await db.student.count({ where: { id: 'empty-review' } }), 0);
    });
    const before = await db.student.findUnique({ where: { id: 'roster' } });
    const frozenBefore = await db.attendanceSessionCandidate.findMany(); const marksBefore = await db.attendance.findMany();
    await check('deactivate reuses existing update and preserves identity, Hall and history', async () => {
      await students.updateStudent('roster', { status: 'INACTIVE' });
      const after = await db.student.findUnique({ where: { id: 'roster' } });
      for (const key of ['qrToken', 'rollNumber', 'cnicOrBForm', 'assignedHallId', 'seatNo', 'applicationNo']) assert.equal(after[key], before[key]);
      assert.equal(after.status, 'INACTIVE'); assert.deepEqual(await db.attendanceSessionCandidate.findMany(), frozenBefore); assert.deepEqual(await db.attendance.findMany(), marksBefore);
      assert.equal((await students.getDeletionProtection('roster')).canDeactivate, false);
    });
    await check('inactive candidate rejected from a new Hall allocation', async () => {
      const other = await db.examHall.create({ data: { name: 'Other Hall', roomNumber: '2', targetClass: 'Class 9th', capacity: 20 } });
      await assert.rejects(() => halls.batchAssign(other.id, { studentIds: ['roster'] }), (error: any) => error.statusCode === 409);
      assert.equal((await halls.getExamHallById(hall.id)).assignedCount, 1);
    });
    await check('only existing authorized admin roles can view protection or delete', async () => {
      for (const role of [null, 'TEACHER', 'ACCOUNTANT']) {
        assert.equal((await request('/roster/deletion-protection', role)).status, role ? 403 : 401);
        assert.equal((await request('/roster', role, 'DELETE')).status, role ? 403 : 401);
      }
      for (const role of ['ADMIN', 'SUPER_ADMIN']) assert.equal((await request('/roster/deletion-protection', role)).status, 200);
    });
    await check('dependency API exposes counts without CNIC, document paths or internal constraint names', async () => {
      const body = JSON.stringify((await request('/roster/deletion-protection')).body);
      for (const value of ['private-roster', 'Private parent', 'fixture/document.pdf', '_fkey']) assert(!body.includes(value));
    });
    await check('concurrent FK conflict returns safe 409, not generic database failure', async () => {
      const original = db.$transaction;
      db.$transaction = async () => { throw Object.assign(new Error('Synthetic concurrent reference'), { code: 'P2003' }); };
      try { await blocked('roster'); } finally { db.$transaction = original; }
    });
    console.log(`Candidate deletion safety: ${passed} PASS, 0 FAIL (disposable local PostgreSQL).`);
  } finally {
    if (server) await new Promise<void>(resolve => server.close(() => resolve()));
    if (db) await db.$disconnect();
    if (created) await admin.query('DROP DATABASE "' + name + '" WITH (FORCE)');
    await admin.end();
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
