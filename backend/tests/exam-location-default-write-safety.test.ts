import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { Client } from 'pg';

// Real disposable localhost PostgreSQL only; no migration or application DB reset.
async function run() {
  assert.notEqual(process.env.NODE_ENV, 'production');
  const source = new URL(process.env.EXAM_LOCATION_TEST_DATABASE_URL || '');
  assert(['localhost', '127.0.0.1', '[::1]'].includes(source.hostname));
  const backend = path.resolve(__dirname, '..');
  const name = 'exam_location_13d11b_' + randomUUID().replace(/-/g, '');
  const url = new URL(source); url.pathname = '/' + name; url.search = '';
  const admin = new Client({ connectionString: source.toString() });
  await admin.connect();
  let db: any;
  let created = false;
  try {
    await admin.query('CREATE DATABASE "' + name + '"'); created = true;
    const env = { ...process.env, DATABASE_URL: url.toString(), DIRECT_URL: url.toString(), NODE_ENV: 'test' };
    // No remote storage credentials or external storage calls in fixture runs.
    for (const key of Object.keys(env)) if (key.startsWith('R2_') || key.startsWith('SUPABASE_')) (env as any)[key] = '';
    Object.assign(process.env, env);
    const ddl = execFileSync(process.execPath, [path.join(backend, 'node_modules/prisma/build/index.js'),
      'migrate', 'diff', '--from-empty', '--to-schema-datamodel', path.join(backend, 'prisma/schema.prisma'), '--script'],
      { cwd: backend, env, encoding: 'utf8' });
    const fixture = new Client({ connectionString: url.toString() });
    await fixture.connect();
    try { await fixture.query(ddl); } finally { await fixture.end(); }
    db = (await import('../src/lib/prisma')).prisma;
    const { studentsService: students } = await import('../src/modules/students/students.service');
    const { supabaseStorage } = await import('../src/lib/supabaseStorage');
    const uploads: any[][] = [];
    const originalUpload = supabaseStorage.uploadFile;
    (supabaseStorage as any).uploadFile = async (...args: any[]) => { uploads.push(args); return { error: null }; };
    const input = (suffix: string) => ({
      fullName: 'Local Safety Fixture ' + suffix, fatherName: 'Fixture Guardian', gender: 'MALE' as const,
      dateOfBirth: '2008-01-10', cnicOrBForm: '13504-1234567-' + suffix,
      address: 'Fixture Address', district: 'Mansehra', province: 'Khyber Pakhtunkhwa',
      parentMobile: '0300-1112233', currentClass: 'Class 10th (SSC-II)', schoolName: 'Fixture School',
      boardOrUniversity: 'BISE Abbottabad', scholarshipCategory: 'GENERAL_MERIT' as const,
      emergencyContact: '0300-1112233', emergencyRelation: 'Father',
    });
    try {
      const registered = await students.createStudent(input('1'));
      const row = await db.student.findUniqueOrThrow({ where: { id: registered.id },
        include: { officeUse: true, documents: true, feeRecords: true } });
      assert(row.officeUse);
      for (const field of ['testCentre', 'testDate', 'testReportingTime', 'testRollNo', 'eligibility', 'finalStatus'])
        assert.equal(row.officeUse[field], null, 'registration ' + field);
      assert.equal(row.rollNumber, null);
      assert(row.qrToken.startsWith('PENDING-FEE-'));
      assert(row.documents);
      assert.equal(row.feeRecords.length, 1);
      assert.equal(Number(row.feeRecords[0].amountDue), 300);
      assert.equal(row.feeRecords[0].status, 'UNPAID');
      console.log('PASS 1: registration persists Student, checklist, fee and null OfficeUse location');

      const controller = fs.readFileSync(path.join(backend, 'src/modules/students/students.controller.ts'), 'utf8');
      for (const method of ['register', 'adminRegister', 'create']) {
        const section = controller.split('async ' + method + '(')[1]?.split('\n  async ')[0];
        assert(section?.includes('studentsService.createStudent('), method + ' shares service');
        assert(!/testCentre|testDate|testReportingTime/.test(section!));
      }
      const serviceSource = fs.readFileSync(path.join(backend, 'src/modules/students/students.service.ts'), 'utf8');
      for (const method of ['createStudent', 'issueRollNumbers']) {
        const section = serviceSource.split('async ' + method + '(')[1]?.split('\n  async ')[0];
        assert(!section?.includes('Main Campus Examination Center, Mansehra'));
        assert(!section?.includes("'09:00 AM'"));
      }
      console.log('PASS 2: all three creation controllers share the safe service; automatic constants absent');

      const missing = await students.createStudent(input('2'));
      await db.officeUseRecord.delete({ where: { studentId: missing.id } });
      await students.approvePayment(missing.id);
      assert.equal((await db.student.findUniqueOrThrow({ where: { id: missing.id } })).rollNumber, null);
      const explicit = await students.createStudent(input('3'));
      const location = { testCentre: 'Explicit Fixture Center', testDate: new Date('2026-11-15T00:00:00Z'),
        testReportingTime: '08:15 AM' };
      await db.officeUseRecord.update({ where: { studentId: explicit.id }, data: location });
      await students.approvePayment(explicit.id);
      assert.equal((await db.student.findUniqueOrThrow({ where: { id: explicit.id } })).rollNumber, null);
      console.log('PASS 3: payment approval remains decoupled from issuance');

      const result = await students.issueRollNumbers();
      assert.equal(result.count, 2);
      for (const id of [missing.id, explicit.id]) {
        const issued = await db.student.findUniqueOrThrow({ where: { id }, include: { officeUse: true } });
        assert(issued.rollNumber.startsWith('AZMVS-'));
        assert.equal(issued.officeUse.testRollNo, issued.rollNumber);
        assert(issued.qrToken && !issued.qrToken.startsWith('PENDING-FEE-'));
        assert(issued.qrImageUrl.startsWith('data:image/png;base64,'));
      }
      const absent = await db.officeUseRecord.findUniqueOrThrow({ where: { studentId: missing.id } });
      for (const field of ['testCentre', 'testDate', 'testReportingTime', 'eligibility', 'finalStatus'])
        assert.equal(absent[field], null, 'issuance create ' + field);
      assert.equal(uploads.length, 2);
      console.log('PASS 4: batch issuance creates null-location OfficeUse and real signed QR images');

      const preserved = await db.officeUseRecord.findUniqueOrThrow({ where: { studentId: explicit.id } });
      assert.equal(preserved.testCentre, location.testCentre);
      assert.equal(preserved.testDate.toISOString(), location.testDate.toISOString());
      assert.equal(preserved.testReportingTime, location.testReportingTime);
      console.log('PASS 5: issuance preserves existing explicit location');
    } finally { supabaseStorage.uploadFile = originalUpload; }

    if (process.argv.includes('--regressions')) {
      // Restore an empty fixture DB for legacy aggregate tests; only this generated DB is affected.
      await db.student.deleteMany();
      const seed = await students.createStudent(input('4'));
      await db.student.update({ where: { id: seed.id }, data: { applicationNo: 'APP-2026-0001' } });
      const suites = ['integrity-verification.test.ts', 'roll-number-decoupling.test.ts',
        'roll-slip-placement-safety.test.ts', 'roll-slip-placement-safety-print.test.ts',
        'roll-slip-placement-safety-ui.test.ts', 'omr-placement-safety.test.ts',
        'public-slip-cnic-search.test.ts', 'exam-halls-integrity.test.ts', 'user-management.test.ts'];
      for (const suite of suites) {
        await new Promise<void>((resolve, reject) => {
          const child = spawn(process.execPath, [path.join(backend, 'node_modules/tsx/dist/cli.mjs'),
            path.join(backend, 'tests', suite)], { cwd: backend,
            env: { ...env, HALL_TEST_DATABASE_URL: url.toString() }, stdio: 'inherit', windowsHide: true });
          child.on('error', reject);
          child.on('exit', code => code === 0 ? resolve() : reject(new Error(suite + ' exited ' + code)));
        });
      }
      console.log('PASS: nine unchanged regression suites');
    }
  } finally {
    if (db) await db.$disconnect();
    if (created) {
      await admin.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()', [name]);
      await admin.query('DROP DATABASE "' + name + '"');
    }
    await admin.end();
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
