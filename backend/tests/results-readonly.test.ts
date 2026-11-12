import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { adminResultsPageQuerySchema } from '../src/modules/results/results.schema';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://synthetic:synthetic@127.0.0.1:1/results_test';
process.env.JWT_ACCESS_SECRET = 'synthetic-results-test-access-secret';
process.env.JWT_REFRESH_SECRET = 'synthetic-results-test-refresh-secret';
process.env.QR_SECRET = 'synthetic-results-test-qr-secret';

test('admin result routes require authentication and the existing administrator roles', () => {
  const routePath = fileURLToPath(new URL('../src/modules/results/results.routes.ts', import.meta.url));
  const source = readFileSync(path.resolve(routePath), 'utf8');
  assert.match(source, /adminRouter\.use\(authenticate, authorizeRoles\(Role\.SUPER_ADMIN, Role\.ADMIN\)\)/);
  assert.match(source, /adminRouter\.get\('\/sessions/);
  assert.match(source, /adminRouter\.get\('\/sessions\/:sessionId\/results/);
});

test('admin result filters are bounded and reject inverted or incompatible ranges', () => {
  assert.equal(adminResultsPageQuerySchema.parse({ page: '2', limit: '50', minimumScore: '10', maximumScore: '90' }).page, 2);
  assert.equal(adminResultsPageQuerySchema.safeParse({ limit: '101' }).success, false);
  assert.equal(adminResultsPageQuerySchema.safeParse({ minimumScore: '80', maximumScore: '20' }).success, false);
  assert.equal(adminResultsPageQuerySchema.safeParse({ scoreAvailability: 'without-score', minimumScore: '1' }).success, false);
});

test('admin results expose only session-linked roster fields and retain unverified/null states', async () => {
  const calls: Record<string, any> = {};
  const db = {
    attendanceSession: {
      findUnique: async () => ({ id: 'session-1' }),
    },
    student: {
      findMany: async (args: any) => {
        if (args.distinct?.includes('currentClass')) return [{ currentClass: 'Class 10' }];
        calls.page = args;
        return [{ id: 'student-1', rollNumber: '000123', fullName: 'Synthetic Candidate', currentClass: 'Class 10', testScore: 72, overallRank: 4 }];
      },
      count: async (args: any) => { calls.count = args; return 23; },
    },
  };
  const { ResultsService } = await import('../src/modules/results/results.service');
  const service = new ResultsService(db as any);
  const result = await service.listAdminSessionResults('session-1', adminResultsPageQuerySchema.parse({
    page: '2', limit: '10', search: 'Synthetic', className: 'Class 10', minimumScore: '50', maximumScore: '90', sortBy: 'legacyScore', sortOrder: 'desc',
  }));

  assert.deepEqual(result.classOptions, ['Class 10']);
  assert.equal(result.verificationStatus, 'UNVERIFIED');
  assert.equal(result.publicationEnabled, false);
  assert.equal(result.results[0].rollNumber, '000123');
  assert.equal(result.results[0].legacyScore, 72);
  assert.equal(result.results[0].maximumMarks, null);
  assert.equal(result.results[0].percentage, null);
  assert.equal(result.results[0].questionCounts, null);
  assert.equal(result.results[0].status, 'LEGACY_UNVERIFIED');
  assert.equal('cnicOrBForm' in result.results[0], false);
  assert.equal(calls.page.skip, 10);
  assert.equal(calls.page.take, 10);
  assert.equal(calls.page.where.resultSessionId, 'session-1');
  assert.equal(calls.count.resultSessionId, 'session-1');
});

test('unknown result sessions fail closed before student data is queried', async () => {
  let studentQueries = 0;
  const db = {
    attendanceSession: { findUnique: async () => null },
    student: { findMany: async () => { studentQueries++; return []; }, count: async () => { studentQueries++; return 0; } },
  };
  const { ResultsService } = await import('../src/modules/results/results.service');
  const service = new ResultsService(db as any);
  await assert.rejects(() => service.listAdminSessionResults('missing', adminResultsPageQuerySchema.parse({})), (error: any) => error.statusCode === 404);
  assert.equal(studentQueries, 0);
});

test('result session choices only include IDs referenced by legacy results and report roster/score counts', async () => {
  const db = {
    student: {
      findMany: async (args: any) => args.distinct?.includes('resultSessionId') ? [{ resultSessionId: 'session-1' }] : [],
      groupBy: async () => [{ resultSessionId: 'session-1', _count: { _all: 2, testScore: 1 } }],
    },
    attendanceSession: {
      findMany: async () => [{ id: 'session-1', businessDate: new Date('2026-11-13T00:00:00Z'), examDateSnapshot: 'Nov 13, 2026', hallNameSnapshot: 'Hall A', roomNumberSnapshot: 'R1', testCenterNameSnapshot: null, status: 'CLOSED', attemptNumber: 1, isCurrent: true, _count: { candidates: 8 } }],
    },
  };
  const { ResultsService } = await import('../src/modules/results/results.service');
  const service = new ResultsService(db as any);
  const rows = await service.listAdminResultSessions();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].recordCount, 2);
  assert.equal(rows[0].legacyScoreCount, 1);
  assert.equal(rows[0].rosterCount, 8);
});
