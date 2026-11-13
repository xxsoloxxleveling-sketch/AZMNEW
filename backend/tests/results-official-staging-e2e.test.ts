import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { Client } from 'pg';

// This fixture creates and drops only its own uniquely named database on the
// explicitly selected loopback-only synthetic Docker instance.
async function run() {
  assert.equal(process.env.NODE_ENV, 'test');
  const source = new URL(process.env.ATTENDANCE_TEST_DATABASE_URL || '');
  assert.equal(source.hostname, '127.0.0.1');
  assert.equal(source.port, '55432');
  assert.equal(source.pathname, '/postgres');
  const database = 'azm_results_e2e_' + randomUUID().replaceAll('-', '');
  const runtimeRole = 'azm_results_runtime_' + randomUUID().replaceAll('-', '');
  const runtimePassword = randomUUID().replaceAll('-', '') + randomUUID().replaceAll('-', '');
  assert.match(database, /^azm_results_e2e_[a-f0-9]{32}$/);
  const admin = new Client({ connectionString: source.toString() });
  let db: any; let shared: any; let server: any; let created = false; let roleCreated = false; let groupCreated = false; let target: Client | undefined; let runtime: Client | undefined;
  try {
    await admin.connect();
    if (!(await admin.query("SELECT 1 FROM pg_roles WHERE rolname='azm_app_dml'")).rowCount) {
      await admin.query('CREATE ROLE azm_app_dml NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS'); groupCreated = true;
    }
    await admin.query(`CREATE DATABASE "${database}"`); created = true;
    source.pathname = '/' + database;
    const ownerUrl = source.toString();
    process.env.DATABASE_URL = ownerUrl; process.env.DIRECT_URL = ownerUrl;
    execFileSync(process.execPath, [path.resolve('node_modules/prisma/build/index.js'), 'migrate', 'deploy', '--schema', path.resolve('prisma/schema.prisma')], { env: process.env, stdio: 'pipe' });
    await admin.query(`CREATE ROLE "${runtimeRole}" LOGIN PASSWORD '${runtimePassword}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`); roleCreated = true;
    await admin.query(`GRANT azm_app_dml TO "${runtimeRole}"`);
    target = new Client({ connectionString: ownerUrl }); await target.connect();
    await target.query(`GRANT CONNECT ON DATABASE "${database}" TO "${runtimeRole}"`);
    await target.query(`GRANT USAGE ON SCHEMA public TO "${runtimeRole}"`);
    await target.query(`GRANT SELECT ON "User", "Student", "ExamHall" TO "${runtimeRole}"`);
    const runtimeUrl = new URL(ownerUrl); runtimeUrl.username = runtimeRole; runtimeUrl.password = runtimePassword;
    runtime = new Client({ connectionString: runtimeUrl.toString() }); await runtime.connect();
    const privileges = await runtime.query("SELECT current_user, rolsuper, rolbypassrls, has_schema_privilege(current_user,'public','CREATE') AS can_create, has_table_privilege(current_user,'public.\"_prisma_migrations\"','INSERT') AS can_write_ledger, has_table_privilege(current_user,'public.\"ResultCorrectionAudit\"','UPDATE') AS can_update_audit, has_table_privilege(current_user,'public.\"ResultCorrectionAudit\"','DELETE') AS can_delete_audit, has_table_privilege(current_user,'public.\"ResultCorrectionAudit\"','TRUNCATE') AS can_truncate_audit FROM pg_roles WHERE rolname=current_user");
    assert.equal(privileges.rows[0].current_user, runtimeRole);
    for (const key of ['rolsuper', 'rolbypassrls', 'can_create', 'can_write_ledger', 'can_update_audit', 'can_delete_audit', 'can_truncate_audit']) assert.equal(privileges.rows[0][key], false, key);
    process.env.DATABASE_URL = runtimeUrl.toString(); process.env.DIRECT_URL = runtimeUrl.toString();
    const { PrismaClient } = await import('@prisma/client');
    db = new PrismaClient({ datasources: { db: { url: ownerUrl } } });
    const express = (await import('express')).default;
    const { signAccessToken } = await import('../src/lib/jwt');
    const { prisma } = await import('../src/lib/prisma'); shared = prisma;
    const router = (await import('../src/modules/results/results.routes')).default;
    const { errorHandler } = await import('../src/middleware/error.middleware');
    for (const role of ['SUPER_ADMIN', 'ADMIN', 'TEACHER'] as const) await db.user.create({ data: { id: role, name: role, email: role.toLowerCase() + '@example.invalid', role, passwordHash: 'synthetic-only' } });
    await db.student.create({ data: { id: 'synthetic-student', applicationNo: 'SYNTH-APP', qrToken: 'synthetic-qr', fullName: 'Synthetic Candidate', fatherName: 'Synthetic', gender: 'MALE', dateOfBirth: new Date('2008-01-01'), cnicOrBForm: 'SYNTH-CNIC', address: 'Synthetic', district: 'Synthetic', province: 'Synthetic', parentMobile: '0', currentClass: 'Class 9', schoolName: 'Synthetic', boardOrUniversity: 'Synthetic', scholarshipCategory: 'GENERAL_MERIT', emergencyContact: '0', emergencyRelation: 'Synthetic' } });
    const app = express(); app.use(express.json()); app.use('/api/results', router); app.use(errorHandler);
    server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/api/results`;
    const tokens: Record<string, string> = {};
    for (const role of ['SUPER_ADMIN', 'ADMIN', 'TEACHER']) tokens[role] = signAccessToken({ userId: role, name: role, email: role.toLowerCase() + '@example.invalid', role, tokenVersion: 0 });
    async function call(method: string, route: string, role?: string, body?: any) {
      const response = await fetch(base + route, { method, headers: { ...(role ? { Authorization: 'Bearer ' + tokens[role] } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
      const kind = response.headers.get('content-type') || '';
      return { status: response.status, headers: response.headers, data: kind.includes('application/json') ? await response.json() as any : Buffer.from(await response.arrayBuffer()) };
    }
    const examInput = { reference: 'SYNTH-EXAM', title: 'Synthetic examination', sessionReference: 'SYNTH-SESSION', classGroup: 'Class 9', maximumMarks: '100', questionCount: 100, paperKeyRevisions: [{ paperVersion: 'A', answerKeyRevision: 'synthetic-key-revision' }], scoringPolicy: { correctMarks: '1', wrongMarks: '0', blankMarks: '0', multipleMarks: '0', revision: 'synthetic-policy' } };
    assert.equal((await call('POST', '/admin/examinations', 'ADMIN', examInput)).status, 403);
    assert.equal((await call('GET', '/admin/examinations', 'TEACHER')).status, 403);
    assert.equal((await call('GET', '/admin/examinations')).status, 401);
    assert.equal((await call('GET', '/search?query=SYNTH-APP')).status, 404);
    const examResponse = await call('POST', '/admin/examinations', 'SUPER_ADMIN', examInput); assert.equal(examResponse.status, 201); const exam = examResponse.data.data;
    assert.equal((await call('POST', `/admin/examinations/${exam.id}/results`, 'SUPER_ADMIN', { studentId: 'synthetic-student', resultReference: 'SYNTH-BAD', paperVersion: 'B' })).status, 400);
    const draftResponse = await call('POST', `/admin/examinations/${exam.id}/results`, 'SUPER_ADMIN', { studentId: 'synthetic-student', resultReference: 'SYNTH-RESULT', paperVersion: 'A' });
    assert.equal(draftResponse.status, 201); const draft = draftResponse.data.data; assert.equal(draft.publicationStatus, 'UNPUBLISHED');
    assert.notEqual((await call('GET', `/admin/${draft.id}/dmc/electronic`, 'ADMIN')).status, 200);
    const pubExam = await call('POST', `/admin/examinations/${exam.id}/publication`, 'SUPER_ADMIN', { expectedRevision: exam.revision, action: 'PUBLISH', reason: 'Synthetic staging verification' }); assert.equal(pubExam.status, 200);
    const changes = { identityStatus: 'VERIFIED', scoringStatus: 'VERIFIED', verificationStatus: 'VERIFIED', publicationStatus: 'PUBLISHED', responses: Array.from({ length: 100 }, (_, index) => ({ questionNumber: index + 1, reviewedAnswer: 'A', classification: 'CORRECT' })) };
    assert.equal((await call('POST', `/admin/${draft.id}/corrections`, 'ADMIN', { expectedRevision: draft.resultRevision, source: 'STUDENT_PROFILE', reason: 'Synthetic unauthorized correction', changes })).status, 403);
    const corrected = await call('POST', `/admin/${draft.id}/corrections`, 'SUPER_ADMIN', { expectedRevision: draft.resultRevision, source: 'STUDENT_PROFILE', reason: 'Synthetic verified correction', changes });
    assert.equal(corrected.status, 200); const result = corrected.data.data; assert.equal(result.publicationStatus, 'PUBLISHED'); assert.equal(result.obtainedMarks, '100');
    assert.equal((await call('POST', `/admin/${draft.id}/corrections`, 'SUPER_ADMIN', { expectedRevision: draft.resultRevision, source: 'STUDENT_PROFILE', reason: 'Synthetic stale correction', changes: { administrativeRemarks: 'stale' } })).status, 409);
    const history = await call('GET', `/admin/students/synthetic-student`, 'ADMIN'); assert.equal(history.status, 200); assert.match(history.headers.get('cache-control') || '', /no-store/); assert(!JSON.stringify(history.data).includes('synthetic-key-revision'));
    const electronic = await call('GET', `/admin/${draft.id}/dmc/electronic`, 'ADMIN'); assert.equal(electronic.status, 200); assert.equal((electronic.data as Buffer).subarray(0, 4).toString(), '%PDF');
    const prep = await call('POST', `/admin/${draft.id}/dmc/official/prepare`, 'SUPER_ADMIN', { expectedRevision: result.resultRevision }); assert.equal(prep.status, 201);
    const issuance = await call('POST', `/admin/${draft.id}/dmc/official/issue`, 'SUPER_ADMIN', { preparationId: prep.data.data.preparationId, expectedRevision: result.resultRevision, idempotencyKey: randomUUID() }); assert.equal(issuance.status, 201);
    assert.equal((await call('GET', `/admin/${draft.id}/dmc/official/${issuance.data.data.id}`, 'ADMIN')).status, 200);
    assert.equal((await call('POST', `/admin/${draft.id}/dmc/official/${issuance.data.data.id}/revoke`, 'SUPER_ADMIN', { reason: 'Synthetic revocation test' })).status, 200);
    assert.equal((await call('GET', `/admin/${draft.id}/dmc/official/${issuance.data.data.id}`, 'ADMIN')).status, 404);
    await assert.rejects(db.$executeRawUnsafe('UPDATE "ResultCorrectionAudit" SET reason = $1', 'synthetic alteration'));
    await assert.rejects(runtime.query('UPDATE "ResultCorrectionAudit" SET reason = $1', ['synthetic alteration']));
    console.log('PASS restricted-runtime synthetic Results API authorization, draft, publication, revision, audit and DMC lifecycle');
  } finally {
    if (server) await new Promise<void>(resolve => server.close(() => resolve()));
    await shared?.$disconnect(); await db?.$disconnect(); await runtime?.end(); await target?.end();
    if (created) await admin.query(`DROP DATABASE "${database}"`);
    if (roleCreated) await admin.query(`DROP ROLE "${runtimeRole}"`);
    if (groupCreated) await admin.query('DROP ROLE azm_app_dml');
    await admin.end();
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
