import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

function readOfficialResultsMigration() {
  const migrationsRoot = path.resolve(process.cwd(), 'prisma/migrations');
  const dir = readdirSync(migrationsRoot).find((name) => name.endsWith('_official_examination_results_and_dmc'));
  assert.ok(dir, 'official results migration must exist');
  return readFileSync(path.join(migrationsRoot, dir, 'migration.sql'), 'utf8');
}

test('official result migration is additive and never backfills from legacy student scores', () => {
  const migration = readOfficialResultsMigration();
  assert.match(migration, /CREATE TABLE "Examination"/);
  assert.match(migration, /CREATE TABLE "ExaminationResult"/);
  assert.doesNotMatch(migration, /\bUPDATE\s+"Student"/i);
  assert.doesNotMatch(migration, /INSERT\s+INTO\s+"ExaminationResult"\s+SELECT/i);
  assert.doesNotMatch(migration, /testScore|overallRank/i);
  assert.doesNotMatch(migration, /\bCREATE\s+ROLE\b|\bALTER\s+ROLE\b/i);
});

test('immutable correction and issued-document history rejects update, delete, and truncate', () => {
  const migration = readOfficialResultsMigration();
  for (const table of [
    'ResultCorrectionAudit',
    'ExaminationAudit',
    'ExaminationPublicationAudit',
    'ExaminationPaperKeyRevision',
    'DmcIssuance',
    'DmcIssuanceEvent',
  ]) {
    const escaped = table.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(
      migration,
      new RegExp(`CREATE TRIGGER "${escaped}_[^"]+"[\\s\\S]{0,180}BEFORE UPDATE OR DELETE OR TRUNCATE ON "${escaped}"`, 'i'),
      `${table} must reject direct mutation and truncate`
    );
  }
});

test('new result tables have row-level security and restricted runtime grants', () => {
  const migration = readOfficialResultsMigration();
  const tables = [
    'Examination', 'ExaminationResult', 'ResultQuestionResponse', 'ResultCorrectionAudit',
    'ExaminationAudit', 'ExaminationPublicationAudit', 'ExaminationPaperKeyRevision',
    'DmcIssuancePreparation', 'DmcIssuance', 'DmcIssuanceEvent',
  ];
  for (const table of tables) {
    assert.match(migration, new RegExp(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`));
    assert.match(migration, new RegExp(`CREATE POLICY azm_results_[a-z_]+ ON "${table}"`));
  }
  assert.match(migration, /IF EXISTS \(SELECT 1 FROM pg_roles WHERE rolname = 'azm_app_dml'\)/);
  assert.match(migration, /GRANT SELECT, INSERT ON "ResultCorrectionAudit"/);
  assert.match(migration, /GRANT SELECT, INSERT ON[\s\S]*?"DmcIssuance"/);
  assert.doesNotMatch(migration, /GRANT[\s\S]{0,100}TRUNCATE/i);
});

test('official result DTO does not expose legacy score fields, answer-key contents, or raw scans', () => {
  const dtoPath = path.resolve(process.cwd(), 'src/modules/results/official-results.dto.ts');
  const source = readFileSync(dtoPath, 'utf8');
  const start = source.indexOf('export interface OfficialResultSummary');
  const end = source.indexOf('\n}', start);
  assert.ok(start >= 0 && end > start, 'official result summary DTO must exist');
  const summary = source.slice(start, end);
  assert.doesNotMatch(summary, /testScore|overallRank|cnicOrBForm|answerKey(?!Revision)|rawScan|scanImage/i);

  const detailStart = source.indexOf('export interface OfficialResultDetail');
  const detailEnd = source.indexOf('\n}', detailStart);
  assert.ok(detailStart >= 0 && detailEnd > detailStart, 'official result detail DTO must exist');
  const detail = source.slice(detailStart, detailEnd);
  assert.doesNotMatch(detail, /answerKey(?!Revision)|rawScan|scanImage|imageBuffer/i);

  const servicePath = path.resolve(process.cwd(), 'src/modules/results/official-results.service.ts');
  const service = readFileSync(servicePath, 'utf8');
  assert.doesNotMatch(service, /testScore|overallRank/i, 'legacy aggregates must not feed official result mapping');
  const summaryStart = service.indexOf('function toSummary(');
  const summaryEnd = service.indexOf('\nfunction toDetail(', summaryStart);
  assert.ok(summaryStart >= 0 && summaryEnd > summaryStart, 'official summary mapper must exist');
  const summaryMapper = service.slice(summaryStart, summaryEnd);
  assert.match(summaryMapper, /paperVersions/);
  assert.doesNotMatch(summaryMapper, /answerKeyRevision|answerKeyContents|correctAnswers/i);
});

test('official result reads require admin authentication and every mutation requires SUPER_ADMIN', () => {
  const routePath = path.resolve(process.cwd(), 'src/modules/results/results.routes.ts');
  const source = readFileSync(routePath, 'utf8');
  const adminMount = source.indexOf("router.use('/admin', adminRouter)");
  const adminGuard = source.indexOf('adminRouter.use(');
  assert.ok(adminGuard >= 0 && adminMount > adminGuard, 'admin router must be mounted behind its middleware');
  assert.match(source.slice(adminGuard, adminMount), /authenticate[\s\S]*authorizeRoles\(Role\.SUPER_ADMIN, Role\.ADMIN\)/);

  const mutations = source.split(/\r?\n/).filter((line) => /adminRouter\.(?:post|put|patch|delete)\(/i.test(line));
  assert.ok(mutations.length > 0, 'official mutation routes should be present before role checks are evaluated');
  for (const route of mutations) {
    assert.match(route, /authorizeRoles\(Role\.SUPER_ADMIN\)/, `mutation must be Super Admin only: ${route.trim()}`);
  }
  assert.doesNotMatch(source, /^\s*router\.(?:post|put|patch|delete)\(/im, 'no result mutation may be mounted outside the guarded admin router');
  assert.match(source, /adminRouter\.get\('\/students\/:studentId'/, 'student-history lookup must stay inside the guarded admin router');
});

test('public result lookup is closed and public DMC verification is identity- and marks-free', async () => {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'postgresql://synthetic:synthetic@127.0.0.1:1/results_test';
  process.env.JWT_ACCESS_SECRET = 'synthetic-results-test-access-secret';
  process.env.JWT_REFRESH_SECRET = 'synthetic-results-test-refresh-secret';
  process.env.QR_SECRET = 'synthetic-results-test-qr-secret';

  const routePath = path.resolve(process.cwd(), 'src/modules/results/results.routes.ts');
  const routeSource = readFileSync(routePath, 'utf8');
  assert.match(routeSource, /router\.get\('\/search', resultsController\.publicResultsUnavailable\)/);
  assert.match(routeSource, /router\.get\('\/merit-list', resultsController\.publicResultsUnavailable\)/);
  assert.match(routeSource, /router\.get\('\/verification\/:reference', resultsController\.verifyOfficialDmc\)/);

  const { OfficialResultsService } = await import('../src/modules/results/official-results.service');
  let hasAttemptSnapshot = true;
  let eventType = 'ISSUED';
  const service = new OfficialResultsService({
    dmcIssuance: {
      findUnique: async () => ({
        resultRevision: 3,
        snapshot: hasAttemptSnapshot ? { attemptAssociation: { sessionId: 'synthetic-attempt' } } : {},
        result: {
          resultRevision: 3,
          attendanceSessionId: 'synthetic-attempt',
          publicationStatus: 'PUBLISHED',
          verificationStatus: 'VERIFIED',
          student: { id: 'synthetic-student', fullName: 'Synthetic Candidate', rollNumber: 'SYN-01' },
          obtainedMarks: '99',
          examination: { title: 'Synthetic Examination', examDate: new Date('2026-11-13T00:00:00Z'), publicationStatus: 'PUBLISHED' },
        },
        events: [{ eventType }],
      }),
    },
  } as any);
  const publicVerification = await service.verifyDmc('synthetic-reference');
  assert.deepEqual(publicVerification, {
    valid: true,
    status: 'ISSUED',
    examinationTitle: 'Synthetic Examination',
    examinationDate: '2026-11-13',
  });
  assert.doesNotMatch(JSON.stringify(publicVerification), /Synthetic Candidate|SYN-01|obtainedMarks|studentId/i);
  hasAttemptSnapshot = false;
  assert.deepEqual(await service.verifyDmc('synthetic-reference'), {
    valid: false, status: 'INVALID', examinationTitle: null, examinationDate: null,
  });
  for (const terminal of ['SUPERSEDED', 'REVOKED']) {
    eventType = terminal;
    assert.deepEqual(await service.verifyDmc('synthetic-reference'), {
      valid: false, status: terminal, examinationTitle: null, examinationDate: null,
    });
  }
});
