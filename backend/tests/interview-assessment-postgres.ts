import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import type { PrismaClient, ScholarshipCategory } from '@prisma/client';
import type { AssessmentInput, PanelDto } from '../src/modules/interviews/assessment.schema';

/** Real PostgreSQL 17 integration, deliberately separate from unit fixtures.
 * Run only against an explicitly supplied local disposable test server.
 */
async function run() {
  assert.equal(process.env.NODE_ENV, 'test', 'NODE_ENV=test is required');
  assert(process.env.INTERVIEW_TEST_DATABASE_URL, 'An explicit INTERVIEW_TEST_DATABASE_URL is required');
  const rootUrl = new URL(process.env.INTERVIEW_TEST_DATABASE_URL);
  assert(['postgres:', 'postgresql:'].includes(rootUrl.protocol), 'PostgreSQL URL required');
  assert(['localhost', '127.0.0.1', '[::1]'].includes(rootUrl.hostname), 'Only a synthetic localhost database is permitted');
  assert(!rootUrl.searchParams.has('host'), 'Socket/host overrides are not permitted');
  rootUrl.pathname = '/postgres';
  const suffix = randomUUID().replaceAll('-', '');
  const database = `interview_assessment_${suffix}`;
  const runtimeRole = `interview_runtime_${suffix}`;
  const runtimePassword = randomUUID().replaceAll('-', '');
  const quote = (identifier: string) => '"' + identifier.replaceAll('"', '""') + '"';
  const owner = new Client({ connectionString: rootUrl.toString() });
  await owner.connect();
  let admin: Client | undefined;
  let runtimeSql: Client | undefined;
  let ownerDb: PrismaClient | undefined;
  let runtime: PrismaClient | undefined;
  let shared: PrismaClient | undefined;
  let databaseCreated = false;
  let roleCreated = false;
  let passed = 0;
  const check = async (label: string, work: () => Promise<void>) => {
    await work();
    passed += 1;
    console.log(`PASS ${label}`);
  };
  const rejectsStatus = (work: () => Promise<unknown>, status: number) => assert.rejects(work,
    (error: any) => error?.statusCode === status,
    `Expected an application HTTP ${status} rejection`);
  const rejectsSql = (client: Client, sql: string, code: string, message?: RegExp) => assert.rejects(
    () => client.query(sql), (error: any) => error?.code === code && (!message || message.test(error.message)),
  );

  try {
    const version = Number((await owner.query('SHOW server_version_num')).rows[0].server_version_num);
    assert(version >= 170000 && version < 180000, 'This harness requires PostgreSQL 17');
    await owner.query(`CREATE DATABASE ${quote(database)}`);
    databaseCreated = true;
    const ownerUrl = new URL(rootUrl);
    ownerUrl.pathname = `/${database}`;
    admin = new Client({ connectionString: ownerUrl.toString() });
    await admin.connect();
    await check('PostgreSQL 17 applies the complete migration chain to a new database', async () => {
      const migrations = path.resolve(__dirname, '../prisma/migrations');
      for (const folder of fs.readdirSync(migrations).sort()) {
        const file = path.join(migrations, folder, 'migration.sql');
        if (fs.existsSync(file)) await admin!.query(fs.readFileSync(file, 'utf8'));
      }
      const tables = await admin!.query(`SELECT to_regclass('public."InterviewPanelRevision"') AS panel,
        to_regclass('public."InterviewAssessmentRevision"') AS assessment,
        to_regclass('public."InterviewMeritAwardRevision"') AS merit_award`);
      assert(tables.rows[0].panel && tables.rows[0].assessment && tables.rows[0].merit_award);
    });

    await owner.query(`CREATE ROLE ${quote(runtimeRole)} LOGIN NOINHERIT NOSUPERUSER NOCREATEDB
      NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD '${runtimePassword}'`);
    roleCreated = true;
    await admin.query(`REVOKE CREATE ON SCHEMA public FROM PUBLIC;
      GRANT USAGE ON SCHEMA public TO ${quote(runtimeRole)};
      GRANT SELECT ON ALL TABLES IN SCHEMA public TO ${quote(runtimeRole)};
      GRANT UPDATE ON public."InterviewRound" TO ${quote(runtimeRole)};
      GRANT INSERT ON public."InterviewPanelRevision", public."InterviewAssessmentRevision", public."InterviewMeritAwardRevision" TO ${quote(runtimeRole)};`);
    // Only SELECT policies are added for the existing read sources. These are
    // disposable fixture policies, not changes to the production grant scripts.
    const readSources = [
      'User', 'Student', 'ManualExamMark', 'ManualExamMarkVerificationAudit', 'ManualExamMarkCorrectionAudit',
      'OmrProvisionalMark', 'OmrProvisionalMarkCorrectionAudit', 'OmrMarkVerificationAudit',
      'Examination', 'ExaminationResult', 'ExaminationPaperKeyRevision', 'ResultCorrectionAudit',
      'AttendanceSession', 'OfficialResultAttemptBinding', 'InterviewRound', 'InterviewFixedSchedule', 'InterviewFixedPlacement',
    ];
    for (const table of readSources) {
      const sourceSecurity: { rows: { relrowsecurity: boolean }[] } = await admin.query(`SELECT c.relrowsecurity FROM pg_class c
        JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=$1`, [table]);
      assert.equal(sourceSecurity.rows.length, 1, `Required source table ${table} exists`);
      if (sourceSecurity.rows[0].relrowsecurity) await admin.query(`CREATE POLICY synthetic_interview_read ON public.${quote(table)}
        FOR SELECT TO ${quote(runtimeRole)} USING (true)`);
    }

    const runtimeUrl = new URL(ownerUrl);
    runtimeUrl.username = runtimeRole;
    runtimeUrl.password = runtimePassword;
    process.env.DATABASE_URL = runtimeUrl.toString();
    process.env.DIRECT_URL = runtimeUrl.toString();
    const { PrismaClient: ClientClass } = await import('@prisma/client');
    ownerDb = new ClientClass({ datasources: { db: { url: ownerUrl.toString() } } });
    runtime = new ClientClass({ datasources: { db: { url: runtimeUrl.toString() } } });
    runtimeSql = new Client({ connectionString: runtimeUrl.toString() });
    await runtimeSql.connect();
    const { InterviewAssessmentService } = await import('../src/modules/interviews/assessment.service');
    const { assertInterviewAssessmentRuntime } = await import('../src/security/dbRuntimeSafety');
    shared = (await import('../src/lib/prisma')).prisma;
    const service = new InterviewAssessmentService(runtime);
    const superAdmin = { id: 'synthetic-super-admin', role: 'SUPER_ADMIN', name: 'Synthetic Super Admin' };
    const adminActor = { id: 'synthetic-admin', role: 'ADMIN', name: 'Synthetic Admin' };
    const roundId = 'synthetic-interview-round';
    const candidateId = 'synthetic-candidate';
    const placementId = 'synthetic-placement';

    for (const actor of [superAdmin, adminActor]) await ownerDb.user.create({ data: {
      id: actor.id, name: actor.name, email: `${actor.id}@test.invalid`, passwordHash: 'synthetic-not-a-login',
      role: actor.role as 'SUPER_ADMIN' | 'ADMIN', status: 'ACTIVE',
    } });
    const seedCandidate = async (id: string, marks: number, sequence: number, currentClass = 'Class 10',
      scholarshipCategory: ScholarshipCategory = 'GENERAL_MERIT') => {
      await ownerDb!.student.create({ data: {
        id, applicationNo: `APP-${id}`, rollNumber: `ROLL-${id}`, qrToken: `synthetic-qr-${id}`,
        fullName: `Synthetic ${id}`, fatherName: 'Synthetic Parent', gender: 'FEMALE',
        dateOfBirth: new Date('2008-01-01T00:00:00.000Z'), cnicOrBForm: `synthetic-identity-${id}`,
        address: 'Synthetic Address', district: 'Synthetic District', province: 'Synthetic Province',
        parentMobile: 'synthetic-contact', currentClass, schoolName: 'Synthetic School',
        boardOrUniversity: 'Synthetic Board', scholarshipCategory,
        emergencyContact: 'synthetic-emergency', emergencyRelation: 'Synthetic Guardian',
      } });
      await admin!.query(`SELECT * FROM public.azm_record_manual_exam_mark(
        $1::text,$2::integer,$3::text,$4::text,true,true,$5::text)`, [
        id, marks, `SYNTHETIC-REGISTER-${sequence}`, 'Synthetic signed examination register and student identity independently reviewed.', superAdmin.id,
      ]);
      await admin!.query(`SELECT * FROM public.azm_verify_manual_exam_mark(
        $1::text,$2::integer,$3::text,$4::text,true,true,true,$5::text)`, [
        id, marks, `SYNTHETIC-VERIFICATION-${sequence}`, 'Synthetic original written mark, identity and attendance evidence independently verified.', superAdmin.id,
      ]);
    };
    for (const [id, marks, sequence] of [
      [candidateId, 80, 1], ['synthetic-incomplete', 64, 2], ['synthetic-below-threshold', 31, 3],
    ] as const) await seedCandidate(id, marks, sequence);
    await ownerDb.interviewRound.create({ data: {
      id: roundId, sessionRef: '2026-V', title: 'Synthetic finalized allocation timetable',
      status: 'FINALIZED', eligibilityThreshold: 60, maximumMarks: 100, createdById: superAdmin.id,
    } });
    await ownerDb.interviewFixedSchedule.create({ data: {
      id: 'synthetic-fixed-schedule', roundId, csvSha256: 'a'.repeat(64), pdfSha256: 'b'.repeat(64),
      interviewDate: new Date('2026-11-22T00:00:00.000Z'), importedById: superAdmin.id,
      placements: { create: [
        { id: placementId, studentId: candidateId, panel: 1, batch: 1, sequence: 1, slotTime: '09:00', printedMarks: 80 },
        { id: 'synthetic-placement-incomplete', studentId: 'synthetic-incomplete', panel: 1, batch: 1, sequence: 2, slotTime: '09:05', printedMarks: 64 },
        // Fixed printed marks are historical, never the current written source.
        { id: 'synthetic-placement-below', studentId: 'synthetic-below-threshold', panel: 1, batch: 1, sequence: 3, slotTime: '09:10', printedMarks: 60 },
      ] },
    } });
    const fixedBefore = await ownerDb.interviewFixedPlacement.findMany({ orderBy: { id: 'asc' } });
    const sourceSnapshot = async () => ({
      marks: await ownerDb!.manualExamMark.findMany({ orderBy: { studentId: 'asc' } }),
      corrections: await ownerDb!.manualExamMarkCorrectionAudit.findMany({ orderBy: { id: 'asc' } }),
      verifications: await ownerDb!.manualExamMarkVerificationAudit.findMany({ orderBy: { id: 'asc' } }),
      students: await ownerDb!.student.findMany({ select: { id: true, testScore: true, overallRank: true, scholarshipCategory: true }, orderBy: { id: 'asc' } }),
    });
    const marksBefore = await sourceSnapshot();

    await check('restricted runtime passes the assessment startup guard and has no source-write rights', async () => {
      await assertInterviewAssessmentRuntime(runtime!);
      const privileges = await runtimeSql!.query(`SELECT
        has_table_privilege(current_user,'public."Student"','UPDATE,INSERT,DELETE,TRUNCATE,TRIGGER') AS student_write,
        has_table_privilege(current_user,'public."ManualExamMark"','UPDATE,INSERT,DELETE,TRUNCATE,TRIGGER') AS mark_write,
        has_schema_privilege(current_user,'public','CREATE') AS schema_create`);
      assert.deepEqual(privileges.rows[0], { student_write: false, mark_write: false, schema_create: false });
      for (const table of ['InterviewPanelRevision', 'InterviewAssessmentRevision', 'InterviewMeritAwardRevision']) {
        await rejectsSql(runtimeSql!, `UPDATE public.${quote(table)} SET "actorName"='synthetic forbidden update'`, '42501');
        await rejectsSql(runtimeSql!, `DELETE FROM public.${quote(table)}`, '42501');
        await rejectsSql(runtimeSql!, `TRUNCATE public.${quote(table)} CASCADE`, '42501');
        await rejectsSql(runtimeSql!, `CREATE TRIGGER synthetic_forbidden_trigger BEFORE INSERT ON public.${quote(table)}
          FOR EACH ROW EXECUTE FUNCTION public.azm_validate_interview_assessment_insert()`, '42501');
      }
    });

    let panel: PanelDto;
    let submitted: Awaited<ReturnType<typeof service.save>>;
    let submitRequest: AssessmentInput;
    const scoreInput = (membership: PanelDto, revision: number, key: string): AssessmentInput => ({
      expectedRevision: revision, panelRevision: membership.revision, idempotencyKey: key, attendance: 'PRESENT',
      scores: membership.members.map((member, index) => ({ memberId: member.id, interview: [16, 17, 18][index], personality: [4, 4.5, 5][index] })),
      extracurricular: 8.25, extracurricularEvidence: 'SYNTHETIC-ACTIVITY-EVIDENCE', extracurricularReviewed: true,
      academic: 4, academicEvidence: 'SYNTHETIC-ACADEMIC-EVIDENCE', academicReviewed: true,
      notes: 'Synthetic integration assessment.', reason: '',
    });
    await check('final verified manual marks are readable without an official result or Gazette approval', async () => {
      const roster = await service.roster(roundId, { page: 1, limit: 25 });
      assert.equal(roster.pagination.total, 3);
      const main = roster.rows.find(row => row.studentId === candidateId)!;
      assert.equal(main.written.marks, 80);
      assert.equal(main.written.isFinal, true);
      assert.equal(main.written.sourceType, 'VERIFIED_MANUAL');
      assert.equal(main.written.status, 'QUALIFIED');
      const below = roster.rows.find(row => row.studentId === 'synthetic-below-threshold')!;
      assert.equal(below.printedMarks, 60);
      assert.equal(below.written.marks, 31);
      assert.equal(below.written.status, 'NOT_QUALIFIED');
      assert.equal(await ownerDb!.examinationResult.count(), 0);
      assert.equal(await ownerDb!.interviewResultApproval.count(), 0);
    });

    await check('a finalized allocation timetable accepts draft and submitted scoring with an exact 81.75 total', async () => {
      panel = await service.savePanel(roundId, 1, {
        expectedRevision: 0, members: [{ name: 'Synthetic Member One' }, { name: 'Synthetic Member Two' }, { name: 'Synthetic Member Three' }],
        reason: 'Synthetic approved three-member panel.',
      }, adminActor);
      const draft = await service.save(roundId, placementId, scoreInput(panel, 0, 'synthetic-draft-0001'), adminActor);
      assert.equal(draft.status, 'DRAFT');
      assert.equal(draft.revision, 1);
      assert.equal(draft.totals.total, 81.75);
      const beforeSubmission = (await service.merit(roundId)).rows.find(row => row.placementId === placementId)!;
      assert.equal(beforeSubmission.rank, null);
      assert.equal(beforeSubmission.overallRank, null);
      assert.equal(beforeSubmission.status, 'INCOMPLETE');
      submitRequest = scoreInput(panel, 1, 'synthetic-submit-0002');
      submitted = await service.save(roundId, placementId, submitRequest, adminActor, true);
      assert.equal(submitted.status, 'SUBMITTED');
      assert.equal(submitted.revision, 2);
      assert.deepEqual(submitted.totals, { written: 48, interview: 17, extracurricular: 8.25, personality: 4.5, academic: 4, total: 81.75 });
      const merit = await service.merit(roundId);
      assert.equal(merit.publicationEnabled, false);
      assert.equal(merit.rows.find(row => row.placementId === placementId)?.rank, 1);
      assert.equal(merit.rows.find(row => row.placementId === placementId)?.overallRank, 1);
      assert.equal(merit.overallRankedCandidates, 1);
      assert.equal((await runtime!.interviewRound.findUniqueOrThrow({ where: { id: roundId } })).status, 'FINALIZED');
    });

    await check('identical requests replay, conflicting keys and stale revisions reject with 409', async () => {
      assert.deepEqual(await service.save(roundId, placementId, submitRequest!, adminActor, true), submitted!);
      await rejectsStatus(() => service.save(roundId, placementId, { ...submitRequest!, notes: 'Different request payload.' }, adminActor, true), 409);
      await rejectsStatus(() => service.save(roundId, placementId, scoreInput(panel!, 0, 'synthetic-stale-0003'), adminActor), 409);
      assert.equal(await runtime!.interviewAssessmentRevision.count({ where: { placementId } }), 2);
    });

    await check('incomplete scores and below-threshold final written marks cannot be submitted', async () => {
      const incomplete = scoreInput(panel!, 0, 'synthetic-incomplete-0001');
      incomplete.scores[1].interview = null;
      await rejectsStatus(() => service.save(roundId, 'synthetic-placement-incomplete', incomplete, adminActor, true), 400);
      await rejectsStatus(() => service.save(roundId, 'synthetic-placement-below', scoreInput(panel!, 0, 'synthetic-below-0001'), adminActor, true), 400);
      assert.equal(await runtime!.interviewAssessmentRevision.count({ where: { placementId: { not: placementId } } }), 0);
    });

    await check('concurrent stale drafts persist one revision and reject the other writer', async () => {
      const outcomes = await Promise.allSettled([
        service.save(roundId, 'synthetic-placement-incomplete', scoreInput(panel!, 0, 'synthetic-concurrent-one'), adminActor),
        service.save(roundId, 'synthetic-placement-incomplete', scoreInput(panel!, 0, 'synthetic-concurrent-two'), adminActor),
      ]);
      assert.equal(outcomes.filter(result => result.status === 'fulfilled').length, 1);
      const rejected = outcomes.find(result => result.status === 'rejected');
      assert(rejected?.status === 'rejected' && rejected.reason?.statusCode === 409);
      assert.equal(await runtime!.interviewAssessmentRevision.count({ where: { placementId: 'synthetic-placement-incomplete' } }), 1);
    });

    await check('submitted-score corrections require Super Admin plus reason and append history', async () => {
      const correction = { ...scoreInput(panel!, 2, 'synthetic-correction-0003'), extracurricular: 8.5,
        reason: 'Synthetic signed activity evidence rechecked.' };
      await rejectsStatus(() => service.save(roundId, placementId, correction, adminActor, true), 403);
      await rejectsStatus(() => service.save(roundId, placementId, { ...correction, reason: '' }, superAdmin, true), 400);
      const corrected = await service.save(roundId, placementId, correction, superAdmin, true);
      assert.equal(corrected.revision, 3);
      assert.equal(corrected.totals.total, 82);
      const history = await service.history(roundId, placementId);
      assert.deepEqual(history.map(row => row.revision), [3, 2, 1]);
      assert.equal(history[1].totals.total, 81.75);
      assert.deepEqual(await sourceSnapshot(), marksBefore);
      assert.deepEqual(await ownerDb!.interviewFixedPlacement.findMany({ orderBy: { id: 'asc' } }), fixedBefore);
    });

    await check('owner-level UPDATE, DELETE and TRUNCATE also reject append-only history mutation', async () => {
      for (const table of ['InterviewPanelRevision', 'InterviewAssessmentRevision']) {
        await rejectsSql(admin!, `UPDATE public.${quote(table)} SET "reason"='synthetic forbidden update'`, '23514', /append-only/);
        await rejectsSql(admin!, `DELETE FROM public.${quote(table)}`, '23514', /append-only/);
      }
      await rejectsSql(admin!, 'TRUNCATE public."InterviewPanelRevision", public."InterviewAssessmentRevision"', '23514', /append-only/);
      assert.equal((await service.history(roundId, placementId)).length, 3);
    });

    await check('a canonical written-mark correction invalidates the old seal and excludes stale merit', async () => {
      await admin!.query(`SELECT * FROM public.azm_correct_manual_exam_mark(
        $1::text,80::integer,85::integer,NULL::bigint,$2::text,$3::text,true,true,$4::text)`, [
        candidateId, 'SYNTHETIC-WRITTEN-CORRECTION', 'Synthetic approved written-total correction against the signed source register.', superAdmin.id,
      ]);
      const pending = await service.candidate(roundId, placementId);
      assert.equal(pending.written.marks, 85);
      assert.equal(pending.written.isFinal, false);
      assert.equal((await service.merit(roundId)).rows.find(row => row.placementId === placementId)?.status, 'SOURCE_CHANGED');
      await admin!.query(`SELECT * FROM public.azm_verify_manual_exam_mark(
        $1::text,85::integer,$2::text,$3::text,true,true,true,$4::text)`, [
        candidateId, 'SYNTHETIC-CORRECTED-VERIFICATION', 'Synthetic corrected written total and exact correction revision independently verified.', superAdmin.id,
      ]);
      const current = await service.candidate(roundId, placementId);
      assert.equal(current.written.isFinal, true);
      assert.notEqual(current.written.revision, submitted!.written.revision);
      const row = (await service.merit(roundId)).rows.find(item => item.placementId === placementId)!;
      assert.equal(row.status, 'SOURCE_CHANGED');
      assert.equal(row.rank, null);
      assert.equal(row.overallRank, null);
      assert.equal((await ownerDb!.manualExamMark.findUniqueOrThrow({
        where: { sessionReference_studentId: { sessionReference: '2026-V', studentId: candidateId } },
      })).obtainedMarks, 80);
    });
    const correctedMarksBefore = await sourceSnapshot();
    await check('reviewed resubmission uses the newly verified score without changing source records', async () => {
      const reviewed = await service.save(roundId, placementId, {
        ...scoreInput(panel!, 3, 'synthetic-source-review-0004'), extracurricular: 8.5,
        reason: 'Synthetic current verified written correction reviewed.',
      }, superAdmin, true);
      assert.equal(reviewed.written.marks, 85);
      assert.equal(reviewed.revision, 4);
      assert.equal(reviewed.totals.total, 85);
      assert.equal((await service.merit(roundId)).rows.find(row => row.placementId === placementId)?.status, 'READY');
    });

    await check('panel changes require Super Admin, exclude earlier scores, and require reviewed new-member scorecards', async () => {
      const replacement = {
        expectedRevision: panel!.revision,
        members: [{ name: 'Synthetic Member One' }, { name: 'Synthetic Replacement' }, { name: 'Synthetic Member Three' }],
        reason: 'Synthetic approved panel member replacement.',
      };
      await rejectsStatus(() => service.savePanel(roundId, 1, replacement, adminActor), 403);
      const nextPanel = await service.savePanel(roundId, 1, replacement, superAdmin);
      assert.equal(nextPanel.revision, 2);
      const candidate = await service.candidate(roundId, placementId);
      assert(candidate.assessment?.issues.some(issue => /Panel membership changed/.test(issue)));
      const changed = (await service.merit(roundId)).rows.find(row => row.placementId === placementId)!;
      assert.equal(changed.status, 'SOURCE_CHANGED');
      assert.equal(changed.rank, null);
      assert.equal(changed.overallRank, null);
      await rejectsStatus(() => service.save(roundId, placementId, {
        ...scoreInput(panel!, 4, 'synthetic-old-panel-0005'), reason: 'Synthetic stale membership rejection.',
      }, superAdmin, true), 409);
      const reviewed = await service.save(roundId, placementId, {
        ...scoreInput(nextPanel, 4, 'synthetic-new-panel-0005'), extracurricular: 8.5,
        reason: 'Synthetic current panel signed scorecards reviewed.',
      }, superAdmin, true);
      assert.equal(reviewed.revision, 5);
      assert.equal((await service.merit(roundId)).rows.find(row => row.placementId === placementId)?.status, 'READY');
    });

    await check('assessment operations preserve fixed placements and all written-mark evidence', async () => {
      assert.deepEqual(await sourceSnapshot(), correctedMarksBefore);
      assert.deepEqual(await ownerDb!.interviewFixedPlacement.findMany({ orderBy: { id: 'asc' } }), fixedBefore);
      assert.equal(await ownerDb!.examinationResult.count(), 0);
      assert.equal(await ownerDb!.interviewResultApproval.count(), 0);
      assert.equal(await runtime!.interviewPanelRevision.count(), 2);
      assert.equal((await service.history(roundId, placementId)).length, 5);
      await assertInterviewAssessmentRuntime(runtime!);
    });

    await check('overall merit compares exact scores across classes before filters and performs no writes', async () => {
      const classes = ['Class 6', 'Class 7', 'Class 8', 'Class 6', 'Class 10', 'Class 10', 'Class 10'];
      for (let index = 0; index < classes.length; index += 1) {
        await seedCandidate(`synthetic-overall-${index + 1}`, 80, index + 10, classes[index],
          index === 0 ? 'FINANCIALLY_NEEDY' : 'GENERAL_MERIT');
      }
      // A session has exactly one round. Extend its synthetic timetable on a
      // separate panel so the earlier candidate and reviewed panel stay valid.
      await ownerDb!.interviewFixedPlacement.createMany({
        data: classes.map((_className, index) => ({
          id: `synthetic-overall-placement-${index + 1}`, studentId: `synthetic-overall-${index + 1}`,
          scheduleId: 'synthetic-fixed-schedule', panel: 2, batch: 1,
          sequence: index + 1, slotTime: `10:${String(index * 5).padStart(2, '0')}`, printedMarks: 80,
        })),
      });
      const combinedPanel = await service.savePanel(roundId, 2, {
        expectedRevision: 0,
        members: [{ name: 'Synthetic Overall One' }, { name: 'Synthetic Overall Two' }, { name: 'Synthetic Overall Three' }],
        reason: 'Synthetic overall merit comparison panel.',
      }, adminActor);
      for (let index = 1; index <= 6; index += 1) {
        const input = scoreInput(combinedPanel, 0, `synthetic-overall-submit-${index}`);
        if (index <= 2) input.scores[0].interview = 16.01;
        if (index === 4) input.academic = 3;
        if (index === 6) input.attendance = 'ABSENT';
        await service.save(roundId, `synthetic-overall-placement-${index}`, input, adminActor, index !== 5);
      }
      const assessmentBefore = await ownerDb!.interviewAssessmentRevision.findMany({ orderBy: { id: 'asc' } });
      const panelsBefore = await ownerDb!.interviewPanelRevision.findMany({ orderBy: { id: 'asc' } });
      const placementsBefore = await ownerDb!.interviewFixedPlacement.findMany({ orderBy: { id: 'asc' } });
      const writtenBefore = await sourceSnapshot();
      const merit = await service.merit(roundId);
      const byId = new Map(merit.rows.map(row => [row.placementId, row]));
      assert.deepEqual([1, 2].map(index => {
        const row = byId.get(`synthetic-overall-placement-${index}`)!;
        return [row.fatherName, row.institute, row.scholarshipCategory];
      }), [['Synthetic Parent', 'Synthetic School', 'FINANCIALLY_NEEDY'],
        ['Synthetic Parent', 'Synthetic School', 'GENERAL_MERIT']]);
      assert.equal(merit.rankMethod, 'SHARED_COMPETITION_WITHIN_CLASS');
      assert.equal(merit.overallRankMethod, 'SHARED_COMPETITION_ALL_CLASSES');
      assert.equal(byId.get(placementId)!.totals.total, 85);
      assert.equal(byId.get(placementId)!.overallRank, 1);
      assert.equal(merit.overallRankedCandidates, 5);
      assert.deepEqual(merit.summary, { total: 10, ready: 5, incomplete: 4, absent: 1 });
      assert.deepEqual([1, 2, 3, 4].map(index => {
        const row = byId.get(`synthetic-overall-placement-${index}`)!;
        return [row.rank, row.overallRank];
      }), [[1, 2], [1, 2], [1, 4], [2, 5]]);
      assert.equal(byId.get('synthetic-overall-placement-1')!.totals.total,
        byId.get('synthetic-overall-placement-3')!.totals.total);
      assert.ok(merit.rows.filter(row => row.status !== 'READY').every(row => row.rank === null && row.overallRank === null));
      const filtered = await service.merit(roundId, 'Class 8');
      assert.equal(filtered.overallRankedCandidates, 5);
      assert.deepEqual(filtered.rows.map(row => [row.rank, row.overallRank]), [[1, 4]]);
      assert.deepEqual(filtered.summary, { total: 1, ready: 1, incomplete: 0, absent: 0 });
      assert.deepEqual(await ownerDb!.interviewAssessmentRevision.findMany({ orderBy: { id: 'asc' } }), assessmentBefore);
      assert.deepEqual(await ownerDb!.interviewPanelRevision.findMany({ orderBy: { id: 'asc' } }), panelsBefore);
      assert.deepEqual(await ownerDb!.interviewFixedPlacement.findMany({ orderBy: { id: 'asc' } }), placementsBefore);
      assert.deepEqual(await sourceSnapshot(), writtenBefore);
    });

    const meritWithoutAwards = async () => {
      const merit = await service.merit(roundId);
      return { ...merit, rows: merit.rows.map(({ meritAward: _award, ...row }) => row) };
    };
    const meritBeforeAwards = await meritWithoutAwards();
    const sourcesBeforeAwards = await sourceSnapshot();
    const assessmentsBeforeAwards = await ownerDb.interviewAssessmentRevision.findMany({ orderBy: { id: 'asc' } });
    const placementsBeforeAwards = await ownerDb.interviewFixedPlacement.findMany({ orderBy: { id: 'asc' } });
    const awardRequest = { expectedRevision: 0, idempotencyKey: 'synthetic-award-save-0001', awardCode: 'LAPTOP' as const };
    let savedAward: Awaited<ReturnType<typeof service.saveMeritAward>>;
    await check('manual awards start unassigned and persist across fresh service reads without changing merit', async () => {
      const initial = await service.merit(roundId);
      assert.equal(initial.manualAwardsEnabled, true);
      assert(initial.rows.every(row => row.meritAward.revision === 0 && row.meritAward.awardCode === null));
      assert.equal(await runtime!.interviewMeritAwardRevision.count(), 0, 'Reading merit cannot assign awards');
      savedAward = await service.saveMeritAward(roundId, placementId, awardRequest, superAdmin);
      assert.equal(savedAward.revision, 1);
      assert.equal(savedAward.awardCode, 'LAPTOP');
      assert.equal(savedAward.actorName, superAdmin.name);
      assert(savedAward.id && savedAward.createdAt && Number.isFinite(Date.parse(savedAward.createdAt)));
      const fresh = new InterviewAssessmentService(runtime!);
      const stored = (await fresh.merit(roundId, 'Class 10')).rows.find(row => row.placementId === placementId)!;
      assert.deepEqual(stored.meritAward, savedAward);
      assert.deepEqual(await meritWithoutAwards(), meritBeforeAwards);
    });

    await check('manual award retries are idempotent and conflicting keys or revisions reject with 409', async () => {
      assert.deepEqual(await service.saveMeritAward(roundId, placementId, awardRequest, superAdmin), savedAward!);
      await rejectsStatus(() => service.saveMeritAward(roundId, placementId,
        { ...awardRequest, awardCode: 'UMRAH_TICKET' }, superAdmin), 409);
      await rejectsStatus(() => service.saveMeritAward(roundId, placementId,
        { expectedRevision: 0, idempotencyKey: 'synthetic-award-stale-0002', awardCode: 'CASH_PRIZE_3000' }, superAdmin), 409);
      assert.equal(await runtime!.interviewMeritAwardRevision.count({ where: { placementId } }), 1);
      const cleared = await service.saveMeritAward(roundId, placementId,
        { expectedRevision: 1, idempotencyKey: 'synthetic-award-clear-0002', awardCode: null }, superAdmin);
      assert.equal(cleared.revision, 2);
      assert.equal(cleared.awardCode, null);
      const history = await service.meritAwardHistory(roundId, placementId);
      assert.deepEqual(history.map(row => [row.revision, row.awardCode]), [[2, null], [1, 'LAPTOP']]);
    });

    await check('concurrent manual award saves append one revision and reject the stale writer', async () => {
      const outcomes = await Promise.allSettled([
        service.saveMeritAward(roundId, placementId,
          { expectedRevision: 2, idempotencyKey: 'synthetic-award-race-one', awardCode: 'FULL_YEAR_SCHOLARSHIP' }, superAdmin),
        service.saveMeritAward(roundId, placementId,
          { expectedRevision: 2, idempotencyKey: 'synthetic-award-race-two', awardCode: 'EDUCATIONAL_VOUCHER' }, superAdmin),
      ]);
      assert.equal(outcomes.filter(result => result.status === 'fulfilled').length, 1);
      const rejected = outcomes.find(result => result.status === 'rejected');
      assert(rejected?.status === 'rejected' && rejected.reason?.statusCode === 409);
      const winner = outcomes.find(result => result.status === 'fulfilled');
      assert(winner?.status === 'fulfilled');
      const stored = (await service.merit(roundId)).rows.find(row => row.placementId === placementId)!.meritAward;
      assert.deepEqual(stored, winner.value);
      assert.equal(stored.revision, 3);
      assert.equal(await runtime!.interviewMeritAwardRevision.count({ where: { placementId } }), 3);
    });

    await check('only Super Admins may save or clear awards, regardless of registration category', async () => {
      const otherPlacement = 'synthetic-overall-placement-1';
      const request = { expectedRevision: 0, idempotencyKey: 'synthetic-award-non-general', awardCode: 'LAPTOP' as const };
      await rejectsStatus(() => service.saveMeritAward(roundId, otherPlacement, request, adminActor), 403);
      assert.equal(await runtime!.interviewMeritAwardRevision.count({ where: { placementId: otherPlacement } }), 0);
      const awarded = await service.saveMeritAward(roundId, otherPlacement, request, superAdmin);
      assert.equal(awarded.awardCode, 'LAPTOP');
      assert.equal((await service.merit(roundId)).rows.find(row => row.placementId === otherPlacement)!.meritAward.awardCode, 'LAPTOP');
      await rejectsStatus(() => service.saveMeritAward(roundId, otherPlacement,
        { expectedRevision: 1, idempotencyKey: 'synthetic-award-admin-clear', awardCode: null }, adminActor), 403);
      await ownerDb!.student.update({ where: { id: candidateId }, data: { scholarshipCategory: 'ORPHAN' } });
      try {
        const changed = await service.saveMeritAward(roundId, placementId,
          { expectedRevision: 3, idempotencyKey: 'synthetic-award-changed-category', awardCode: 'CASH_PRIZE_5000' }, superAdmin);
        assert.equal(changed.awardCode, 'CASH_PRIZE_5000');
        const cleared = await service.saveMeritAward(roundId, placementId,
          { expectedRevision: 4, idempotencyKey: 'synthetic-award-clear-changed', awardCode: null }, superAdmin);
        assert.equal(cleared.revision, 5);
        assert.equal(cleared.awardCode, null);
      } finally {
        await ownerDb!.student.update({ where: { id: candidateId }, data: { scholarshipCategory: 'GENERAL_MERIT' } });
      }
    });

    await check('manual award history is append-only and awards leave ranks, marks, categories and placements unchanged', async () => {
      await rejectsSql(admin!, 'UPDATE public."InterviewMeritAwardRevision" SET "actorName"=\'synthetic forbidden update\'', '23514', /append-only/);
      await rejectsSql(admin!, 'DELETE FROM public."InterviewMeritAwardRevision"', '23514', /append-only/);
      await rejectsSql(admin!, 'TRUNCATE public."InterviewMeritAwardRevision"', '23514', /append-only/);
      assert.equal((await service.meritAwardHistory(roundId, placementId)).length, 5);
      assert.deepEqual(await meritWithoutAwards(), meritBeforeAwards);
      assert.deepEqual(await sourceSnapshot(), sourcesBeforeAwards);
      assert.deepEqual(await ownerDb!.interviewAssessmentRevision.findMany({ orderBy: { id: 'asc' } }), assessmentsBeforeAwards);
      assert.deepEqual(await ownerDb!.interviewFixedPlacement.findMany({ orderBy: { id: 'asc' } }), placementsBeforeAwards);
      assert.equal(await ownerDb!.examinationResult.count(), 0);
      assert.equal(await ownerDb!.interviewResultApproval.count(), 0);
      await assertInterviewAssessmentRuntime(runtime!);
    });
    console.log(`PASS ${passed} real PostgreSQL 17 interview assessment integration checks`);
  } finally {
    await runtime?.$disconnect();
    await ownerDb?.$disconnect();
    await shared?.$disconnect();
    await runtimeSql?.end();
    await admin?.end();
    try {
      if (databaseCreated) await owner.query(`DROP DATABASE ${quote(database)} WITH (FORCE)`);
      if (roleCreated) await owner.query(`DROP ROLE ${quote(runtimeRole)}`);
    } finally {
      await owner.end();
    }
  }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
