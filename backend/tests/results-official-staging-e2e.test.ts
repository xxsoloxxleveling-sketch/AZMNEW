import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
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
  const capabilityOwner = 'azm_results_cap_' + randomUUID().replaceAll('-', '');
  const signingKey='synthetic-signing-key-'+randomUUID()+randomUUID();
  process.env.EXAM_CONTROL_SIGNING_KEY=signingKey;
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
    await target.query("SELECT set_config('azm.control_owner_role',$1,false)",[capabilityOwner]);
    await target.query(fs.readFileSync(path.resolve('ops/postgres/exam-control-capability.sql'),'utf8'));
    await target.query('INSERT INTO azm_control_private.signing_key(secret) VALUES($1)',[signingKey]);
    await target.query(`GRANT CONNECT ON DATABASE "${database}" TO "${runtimeRole}"`);
    await target.query(`GRANT USAGE ON SCHEMA public TO "${runtimeRole}"`);
    await target.query(`GRANT SELECT ON "User", "Student", "ExamHall", "AttendanceSession", "AttendanceSessionCandidate" TO "${runtimeRole}"; GRANT UPDATE ("tokenVersion") ON "User" TO "${runtimeRole}"`);
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
    await db.testCenter.create({data:{id:'synthetic-center',name:'Synthetic',code:'SYNTH-CENTER',address:'Synthetic',district:'Synthetic',testDate:'2026-11-15'}});
    await db.examHall.create({data:{id:'synthetic-hall',name:'Synthetic',roomNumber:'1',targetClass:'Class 9',examDate:'2026-11-15',testCenterId:'synthetic-center'}});
    await db.student.create({ data: { id: 'synthetic-student', applicationNo: 'SYNTH-APP', qrToken: 'synthetic-qr', fullName: 'Synthetic Candidate', fatherName: 'Synthetic', gender: 'MALE', dateOfBirth: new Date('2008-01-01'), cnicOrBForm: 'SYNTH-CNIC', address: 'Synthetic', district: 'Synthetic', province: 'Synthetic', parentMobile: '0', currentClass: 'Class 9', schoolName: 'Synthetic', boardOrUniversity: 'Synthetic', scholarshipCategory: 'GENERAL_MERIT', emergencyContact: '0', emergencyRelation: 'Synthetic',assignedHallId:'synthetic-hall',seatNo:'Seat #01' } });
    const {ExamControlService}=await import('../src/modules/attendance/examControl.service');
    const {AttendanceService}=await import('../src/modules/attendance/attendance.service');
    const control=new ExamControlService(db), attendance=new AttendanceService(db);
    const prepared=await control.prepare('synthetic-hall','SUPER_ADMIN',0);
    const attempt=(await attendance.openSession('synthetic-hall','SUPER_ADMIN',{sessionId:prepared.id,revision:prepared.revision})).session;
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
    assert.equal(draft.attempt,null);
    assert.equal((await call('GET','/admin/students/synthetic-student/attempts','ADMIN')).status,403);
    const choices=await call('GET','/admin/students/synthetic-student/attempts','SUPER_ADMIN'); assert.equal(choices.status,200); assert.equal(choices.data.data[0].id,attempt.id);
    assert.equal((await call('POST',`/admin/${draft.id}/attempt-binding`,'ADMIN',{sessionId:attempt.id,evidence:'Synthetic roster and examination sheet',confirmed:true})).status,403);
    assert.equal((await call('POST',`/admin/${draft.id}/attempt-binding`,'SUPER_ADMIN',{sessionId:'wrong-attempt',evidence:'Synthetic roster and examination sheet',confirmed:true})).status,409);
    assert.equal((await call('POST',`/admin/${draft.id}/attempt-binding`,'SUPER_ADMIN',{sessionId:attempt.id,evidence:'Synthetic roster and examination sheet',confirmed:true})).status,200);
    const bound=await call('GET',`/admin/${draft.id}`,'ADMIN'); assert.equal(bound.data.data.attempt.id,attempt.id); assert.equal(bound.data.data.attempt.state,'CURRENT');
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
    const snapshot=(await target.query('SELECT snapshot FROM "DmcIssuance" WHERE id=$1',[issuance.data.data.id])).rows[0].snapshot;
    assert.equal(snapshot.attemptAssociation.sessionId,attempt.id);

    // Synthetic legacy documents are immutable stand-ins: never import production records.
    async function makeLegacyIssuance(label: string) {
      const id = randomUUID();
      const verificationReference = 'synthetic-legacy-' + randomUUID();
      const legacySnapshot = { ...snapshot };
      delete legacySnapshot.attemptAssociation;
      const count = await target!.query('SELECT COALESCE(MAX("issueNumber"),0)+1 AS n FROM "DmcIssuance" WHERE "resultId"=$1', [draft.id]);
      await target!.query(
        'INSERT INTO "DmcIssuance" ("id","resultId","documentType","resultRevision","issueNumber","certificateNumber","verificationReference","snapshot","idempotencyKey","issuedById","issuedByName") VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11)',
        [id, draft.id, 'OFFICIAL', result.resultRevision, count.rows[0].n, 'AZM-DMC-SYNTH-LEGACY-' + label, verificationReference, JSON.stringify(legacySnapshot), randomUUID(), 'SUPER_ADMIN', 'Synthetic Reviewer'],
      );
      await target!.query(
        'INSERT INTO "DmcIssuanceEvent" ("id","issuanceId","eventType","actorId","actorName") VALUES ($1,$2,$3,$4,$5)',
        [randomUUID(), id, 'ISSUED', 'SUPER_ADMIN', 'Synthetic Reviewer'],
      );
      return { id, verificationReference, snapshot: legacySnapshot };
    }
    const originalLegacy = await makeLegacyIssuance('ONE');
    const replacePreparation = await call('POST', '/admin/' + draft.id + '/dmc/official/prepare', 'SUPER_ADMIN', { expectedRevision: result.resultRevision });
    assert.equal(replacePreparation.status, 201);
    // Normal issuance must not bypass the reviewed legacy supersession path.
    const bypass = await call('POST', '/admin/' + draft.id + '/dmc/official/issue', 'SUPER_ADMIN', {
      preparationId: replacePreparation.data.data.preparationId,
      expectedRevision: result.resultRevision,
      idempotencyKey: randomUUID(),
    });
    assert.equal(bypass.status, 409);
    const replacementInput = {
      preparationId: replacePreparation.data.data.preparationId,
      expectedRevision: result.resultRevision,
      idempotencyKey: randomUUID(),
      attemptSessionId: attempt.id,
      evidence: 'Synthetic signed hall roster plus examination attendance sheet checked by reviewer',
      reason: 'Synthetic legacy certificate needed a confirmed attempt association',
      confirmed: true,
    };
    const replaceRoute = '/admin/' + draft.id + '/dmc/official/' + originalLegacy.id + '/replace';
    assert.equal((await call('POST', replaceRoute, 'ADMIN', replacementInput)).status, 403);
    assert.equal((await call('POST', replaceRoute, 'SUPER_ADMIN', { ...replacementInput, evidence: 'short' })).status, 400);
    assert.equal((await call('POST', replaceRoute, 'SUPER_ADMIN', { ...replacementInput, attemptSessionId: 'incorrect-attempt' })).status, 409);
    const replaced = await call('POST', replaceRoute, 'SUPER_ADMIN', replacementInput);
    assert.equal(replaced.status, 201, JSON.stringify(replaced.data));
    assert.equal(replaced.data.data.originalIssuanceId, originalLegacy.id);
    assert.equal((await call('POST', replaceRoute, 'SUPER_ADMIN', replacementInput)).data.data.id, replaced.data.data.id, 'idempotent replacement returns same certificate');
    const oldPublic = await call('GET', '/verification/' + originalLegacy.verificationReference);
    assert.deepEqual(oldPublic.data.data, { valid: false, status: 'SUPERSEDED', examinationTitle: null, examinationDate: null });
    const replacementDb = await target.query('SELECT "replacementIssuanceId",evidence,reason FROM "DmcReplacement" WHERE "originalIssuanceId"=$1', [originalLegacy.id]);
    assert.equal(replacementDb.rowCount, 1);
    assert.equal(replacementDb.rows[0].replacementIssuanceId, replaced.data.data.id);
    const unchangedLegacySnapshot = (await target.query('SELECT snapshot FROM "DmcIssuance" WHERE id=$1', [originalLegacy.id])).rows[0].snapshot;
    assert.deepEqual(unchangedLegacySnapshot, originalLegacy.snapshot, 'historical snapshot must not be mutated');
    const oldEvents = await target.query('SELECT "eventType" FROM "DmcIssuanceEvent" WHERE "issuanceId"=$1 ORDER BY "occurredAt"', [originalLegacy.id]);
    assert.deepEqual(oldEvents.rows.map(row => row.eventType).sort(), ['ISSUED', 'SUPERSEDED']);
    assert.equal((await call('GET', '/admin/' + draft.id + '/dmc/official/' + replaced.data.data.id, 'ADMIN')).status, 200);
    assert.equal((await call('POST', replaceRoute, 'SUPER_ADMIN', { ...replacementInput, idempotencyKey: randomUUID() })).status, 409);
    await assert.rejects(runtime.query('UPDATE "DmcReplacement" SET reason=$1 WHERE "originalIssuanceId"=$2', ['corrupted history', originalLegacy.id]));
    await assert.rejects(runtime.query('DELETE FROM "DmcReplacement" WHERE "originalIssuanceId"=$1', [originalLegacy.id]));

    const raceLegacy = await makeLegacyIssuance('RACE');
    const racePrep1 = await call('POST', '/admin/' + draft.id + '/dmc/official/prepare', 'SUPER_ADMIN', { expectedRevision: result.resultRevision });
    const racePrep2 = await call('POST', '/admin/' + draft.id + '/dmc/official/prepare', 'SUPER_ADMIN', { expectedRevision: result.resultRevision });
    assert.equal(racePrep1.status, 201); assert.equal(racePrep2.status, 201);
    const raceRoute = '/admin/' + draft.id + '/dmc/official/' + raceLegacy.id + '/replace';
    const raceResults = await Promise.all([
      call('POST', raceRoute, 'SUPER_ADMIN', { ...replacementInput, preparationId: racePrep1.data.data.preparationId, idempotencyKey: randomUUID() }),
      call('POST', raceRoute, 'SUPER_ADMIN', { ...replacementInput, preparationId: racePrep2.data.data.preparationId, idempotencyKey: randomUUID() }),
    ]);
    assert.deepEqual(raceResults.map(x => x.status).sort(), [201, 409], 'exactly one concurrent replacement may succeed');
    assert.equal((await target.query('SELECT 1 FROM "DmcReplacement" WHERE "originalIssuanceId"=$1', [raceLegacy.id])).rowCount, 1);

    const rollbackLegacy = await makeLegacyIssuance('ROLLBACK');
    await assert.rejects(
      runtime.query(
        'INSERT INTO "DmcReplacement" ("originalIssuanceId","replacementIssuanceId","actorId","actorName",evidence,reason) VALUES ($1,$2,$3,$4,$5,$6)',
        [rollbackLegacy.id, issuance.data.data.id, 'SUPER_ADMIN', 'Synthetic Reviewer',
         'Fabricated evidence for a forged relationship', 'Fabricated forced relation that must be denied'],
      ),
      /Invalid or incomplete DMC replacement evidence/,
    );
    const rollbackPreparation = await call('POST', '/admin/' + draft.id + '/dmc/official/prepare', 'SUPER_ADMIN', { expectedRevision: result.resultRevision });
    assert.equal(rollbackPreparation.status, 201);
    const beforeFailedReplacement = (await target.query('SELECT COUNT(*)::int AS n FROM "DmcIssuance" WHERE "resultId"=$1', [draft.id])).rows[0].n;
    await target.query('CREATE FUNCTION public.synthetic_replacement_reject() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION \'synthetic injected failure\'; END $$');
    await target.query('CREATE TRIGGER synthetic_replacement_reject BEFORE INSERT ON "DmcReplacement" FOR EACH ROW EXECUTE FUNCTION public.synthetic_replacement_reject()');
    const injectedFailure = await call('POST', '/admin/' + draft.id + '/dmc/official/' + rollbackLegacy.id + '/replace', 'SUPER_ADMIN', {
      ...replacementInput, preparationId: rollbackPreparation.data.data.preparationId, idempotencyKey: randomUUID(),
    });
    assert.notEqual(injectedFailure.status, 201, 'forced failure must abort the entire transaction');
    assert.equal((await target.query('SELECT COUNT(*)::int AS n FROM "DmcIssuance" WHERE "resultId"=$1', [draft.id])).rows[0].n, beforeFailedReplacement);
    assert.equal((await target.query('SELECT 1 FROM "DmcReplacement" WHERE "originalIssuanceId"=$1', [rollbackLegacy.id])).rowCount, 0);
    assert.deepEqual((await target.query('SELECT "eventType" FROM "DmcIssuanceEvent" WHERE "issuanceId"=$1', [rollbackLegacy.id])).rows.map(x => x.eventType), ['ISSUED']);
    await target.query('DROP TRIGGER synthetic_replacement_reject ON "DmcReplacement"');
    await target.query('DROP FUNCTION public.synthetic_replacement_reject()');
    console.log('PASS synthetic legacy DMC atomic replacement, duplicate prevention, concurrency, rollback and preserved history');

    const resetScope={action:'RESET',testCenterId:'synthetic-center',businessDate:'2026-11-15',sessionIds:[attempt.id],entireLineage:false,clearAllocations:false,unfreeze:false,replace:true};
    const review=await control.preview(resetScope,'SUPER_ADMIN',0);
    await control.confirm({challenge:review.challenge,reason:'Synthetic preserve official result history',confirmationText:review.phrase},'SUPER_ADMIN',0,randomUUID());
    const historical=await call('GET',`/admin/${draft.id}`,'ADMIN'); assert.equal(historical.data.data.attempt.state,'HISTORICAL');
    assert.equal((await call('POST', `/admin/${draft.id}/corrections`, 'SUPER_ADMIN', { expectedRevision: result.resultRevision, source: 'STUDENT_PROFILE', reason: 'Synthetic historical edit denied', changes: { administrativeRemarks: 'must not be saved' } })).status, 409);
    await assert.rejects(runtime.query('UPDATE "ExaminationResult" SET "administrativeRemarks"=$1 WHERE id=$2',['must not be saved',draft.id]), /Historical official results are immutable/);
    await assert.rejects(runtime.query('UPDATE "ResultQuestionResponse" SET "reviewedAnswer"=$1 WHERE "resultId"=$2',['B',draft.id]), /Historical official responses are immutable/);
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
    await admin.query(`DROP ROLE IF EXISTS "${capabilityOwner}"`);
    if (roleCreated) await admin.query(`DROP ROLE "${runtimeRole}"`);
    if (groupCreated) await admin.query('DROP ROLE azm_app_dml');
    await admin.end();
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
