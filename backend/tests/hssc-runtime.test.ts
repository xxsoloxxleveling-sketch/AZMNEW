import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { hsscFixture } from './hssc-fixture';

async function runCase(name: string) {
  const fixture = await hsscFixture({ groupBeforeMigration: name === 'group-first', alternateGroup: name === 'alternate' });
  let db: any;
  try {
    Object.assign(process.env, { NODE_ENV: 'test', DATABASE_URL: fixture.url, DIRECT_URL: fixture.url, EXAM_CONTROL_SIGNING_KEY: fixture.signingKey });
    db = (await import('../src/lib/prisma')).prisma;
    const { assertRestrictedRuntimeDatabase } = await import('../src/security/dbRuntimeSafety');
    const { studentsService } = await import('../src/modules/students/students.service');
    const guard = () => assertRestrictedRuntimeDatabase(db, { databaseUrl: fixture.url, directUrl: fixture.url });
    fixture.provision(); fixture.provision(); await guard();
    const student = await db.student.create({ data: { id: 'audit-fixture', applicationNo: 'SYNTHETIC-AUDIT', qrToken: 'synthetic-audit', fullName: 'Synthetic Candidate', fatherName: 'Synthetic Guardian', gender: 'MALE', dateOfBirth: new Date('2008-01-01'), cnicOrBForm: 'SYNTHETIC-AUDIT', address: 'Synthetic', district: 'Synthetic', province: 'Synthetic', parentMobile: '03001234567', currentClass: 'First Year', schoolName: 'Synthetic', boardOrUniversity: 'Synthetic', scholarshipCategory: 'GENERAL_MERIT', emergencyContact: '03001234567', emergencyRelation: 'Guardian' } });
    const actor = { userId: 'synthetic-admin', name: 'Synthetic Staff', role: 'ADMIN' };
    await studentsService.updateStudent(student.id, { hsscGroup: 'ICS', correctionBasis: 'Synthetic current admission evidence', expectedUpdatedAt: student.updatedAt.toISOString() }, actor);
    const evidence = await db.studentStudyGroupCorrection.findMany(); assert.equal(evidence.length, 1); assert.equal(evidence[0].newGroup, 'ICS');
    await assert.rejects(() => db.student.delete({ where: { id: student.id } }), /foreign key|P2003/i);
    for (const statement of ['UPDATE "StudentStudyGroupCorrection" SET basis=\'tampered\'', 'DELETE FROM "StudentStudyGroupCorrection"', 'TRUNCATE "StudentStudyGroupCorrection"']) {
      await assert.rejects(() => db.$executeRawUnsafe(statement), /permission denied/);
    }
    await fixture.sql.query(`ALTER TABLE "StudentStudyGroupCorrection" ADD CONSTRAINT synthetic_failure CHECK (basis <> 'Synthetic rollback evidence') NOT VALID`);
    const before = await db.student.findUnique({ where: { id: student.id } });
    await assert.rejects(() => studentsService.updateStudent(student.id, { hsscGroup: 'FA', correctionBasis: 'Synthetic rollback evidence', expectedUpdatedAt: before.updatedAt.toISOString() }, actor));
    assert.deepEqual(await db.student.findUnique({ where: { id: student.id } }), before);
    assert.equal(await db.studentStudyGroupCorrection.count(), 1);
    await fixture.sql.query('ALTER TABLE "StudentStudyGroupCorrection" DROP CONSTRAINT synthetic_failure');
    for (const [breakage, repair] of [
      [`REVOKE INSERT ON "StudentStudyGroupCorrection" FROM "${fixture.group}"`, ''],
      ['DROP POLICY azm_backend_study_group_audit ON "StudentStudyGroupCorrection"', ''],
      ['ALTER TABLE "StudentStudyGroupCorrection" DISABLE ROW LEVEL SECURITY', 'ALTER TABLE "StudentStudyGroupCorrection" ENABLE ROW LEVEL SECURITY'],
      ['ALTER TABLE "StudentStudyGroupCorrection" DISABLE TRIGGER "StudentStudyGroupCorrection_immutable"', 'ALTER TABLE "StudentStudyGroupCorrection" ENABLE TRIGGER "StudentStudyGroupCorrection_immutable"'],
      [`GRANT UPDATE ON "StudentStudyGroupCorrection" TO "${fixture.group}"`, ''],
    ]) {
      await fixture.sql.query(breakage); await assert.rejects(guard, /study group|triggers/);
      if (repair) await fixture.sql.query(repair);
      fixture.provision(); await guard();
    }
    console.log(`PASS ${name}: configured RLS, repeated provisioning, restricted correction/evidence, denied mutations, atomic rollback and startup guard rejection`);
  } finally { await db?.$disconnect(); await fixture.close(); }
}
async function run() {
  const name = process.argv.find(v => v.startsWith('--case='))?.slice(7);
  if (name) return runCase(name);
  for (const scenario of ['group-first', 'migration-first', 'alternate']) {
    const result = spawnSync(process.execPath, [path.resolve(__dirname, '../node_modules/tsx/dist/cli.mjs'), __filename, '--case=' + scenario], { env: { ...process.env, NODE_ENV: 'test' }, encoding: 'utf8', windowsHide: true, timeout: 180000 });
    process.stdout.write(result.stdout); process.stderr.write(result.stderr); assert.equal(result.status, 0, scenario + ' failed');
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
