import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { Prisma } from '@prisma/client';
import { loadFinalWrittenMarks, resolveFinalWrittenMark } from '../src/modules/interviews/finalWrittenMarks';
import { findPublishedManualExamMarks } from '../src/modules/students/manualExamMarks';
import { findPublishedProvisionalMarks } from '../src/modules/students/provisionalOmrMarks';

const at = '2026-11-21T09:00:00.000Z';
let pg: PGlite;
const db: any = {
  $queryRaw: async (query: Prisma.Sql) => (await pg.query(query.text, query.values)).rows,
  examinationResult: { findMany: async () => [] },
};

before(async () => {
  pg = new PGlite();
  await pg.exec(`
    CREATE TABLE "Student" (
      id TEXT PRIMARY KEY, status TEXT, "testScore" INTEGER, "rollNumber" TEXT,
      "applicationNo" TEXT, "fullName" TEXT, "fatherName" TEXT, "currentClass" TEXT
    );
    CREATE TABLE "ExaminationResult" ("studentId" TEXT);
    CREATE TABLE "OmrProvisionalMark" (
      "studentId" TEXT, "sessionReference" TEXT, "obtainedMarks" INTEGER,
      "correctedMarks" INTEGER, "maximumMarks" INTEGER, "publishedAt" TIMESTAMPTZ,
      "scanSha256" TEXT, "reviewCategory" TEXT, "identityStatus" TEXT,
      "paperVersionStatus" TEXT, "printedClassDisagrees" BOOLEAN, "manualReviewRequired" BOOLEAN,
      "rollNumberSnapshot" TEXT, "applicationNoSnapshot" TEXT
    );
    CREATE TABLE "OmrProvisionalMarkCorrectionAudit" (
      id TEXT, "sessionReference" TEXT, "studentId" TEXT, "occurredAt" TIMESTAMPTZ
    );
    CREATE TABLE "OmrMarkVerificationAudit" (
      id BIGINT, "studentId" TEXT, "sessionReference" TEXT, "verifiedMarks" INTEGER,
      "maximumMarks" INTEGER, "scanSha256" TEXT, "latestCorrectionId" TEXT,
      "rollNumberSnapshot" TEXT, "applicationNoSnapshot" TEXT, "fullNameSnapshot" TEXT,
      "fatherNameSnapshot" TEXT, "currentClassSnapshot" TEXT, "verifiedAt" TIMESTAMPTZ
    );
    CREATE TABLE "ManualExamMark" (
      "studentId" TEXT, "sessionReference" TEXT, "obtainedMarks" INTEGER,
      "maximumMarks" INTEGER, "rollNumberSnapshot" TEXT, "applicationNoSnapshot" TEXT,
      "publishedAt" TIMESTAMPTZ, "recordedAt" TIMESTAMPTZ
    );
    CREATE TABLE "ManualExamMarkCorrectionAudit" (
      id BIGINT, "studentId" TEXT, "sessionReference" TEXT, "newEffectiveMarks" INTEGER,
      "occurredAt" TIMESTAMPTZ
    );
    CREATE TABLE "ManualExamMarkVerificationAudit" (
      id BIGINT, "studentId" TEXT, "sessionReference" TEXT, "verifiedMarks" INTEGER,
      "maximumMarks" INTEGER, "latestCorrectionId" BIGINT, "recordedAtSnapshot" TIMESTAMPTZ,
      "rollNumberSnapshot" TEXT, "applicationNoSnapshot" TEXT, "fullNameSnapshot" TEXT,
      "fatherNameSnapshot" TEXT, "currentClassSnapshot" TEXT, "verifiedAt" TIMESTAMPTZ
    );
  `);
});

after(async () => { await pg.close(); });
beforeEach(async () => {
  await pg.exec(`TRUNCATE "Student", "ExaminationResult", "OmrProvisionalMark",
    "OmrProvisionalMarkCorrectionAudit", "OmrMarkVerificationAudit", "ManualExamMark",
    "ManualExamMarkCorrectionAudit", "ManualExamMarkVerificationAudit";`);
});

async function student(id: string) {
  await pg.query(`INSERT INTO "Student" VALUES ($1,'ACTIVE',NULL,$2,$3,'Synthetic Candidate','Synthetic Parent','Class 10')`,
    [id, `ROLL-${id}`, `APP-${id}`]);
}

async function manual(id: string, marks: number, verified = true) {
  await student(id);
  await pg.query(`INSERT INTO "ManualExamMark" VALUES ($1,'2026-V',$2,100,$3,$4,$5,$5)`,
    [id, marks, `ROLL-${id}`, `APP-${id}`, at]);
  if (verified) await verifyManual(id, marks, 1, null);
}

async function verifyManual(id: string, marks: number, verification: number, correction: number | null) {
  await pg.query(`INSERT INTO "ManualExamMarkVerificationAudit" VALUES
    ($1,$2,'2026-V',$3,100,$4,$5,$6,$7,'Synthetic Candidate','Synthetic Parent','Class 10',$5)`,
  [verification, id, marks, correction, at, `ROLL-${id}`, `APP-${id}`]);
}

async function omr(id: string, marks: number) {
  await student(id);
  await pg.query(`INSERT INTO "OmrProvisionalMark" VALUES
    ($1,'2026-V',$2,NULL,100,$3,$4,'APPROVED','VERIFIED','VERIFIED',FALSE,FALSE,$5,$6)`,
  [id, marks, at, `scan-${id}`, `ROLL-${id}`, `APP-${id}`]);
  await verifyOmr(id, marks, 1, null);
}

async function verifyOmr(id: string, marks: number, verification: number, correction: string | null) {
  await pg.query(`INSERT INTO "OmrMarkVerificationAudit" VALUES
    ($1,$2,'2026-V',$3,100,$4,$5,$6,$7,'Synthetic Candidate','Synthetic Parent','Class 10',$8)`,
  [verification, id, marks, `scan-${id}`, correction, `ROLL-${id}`, `APP-${id}`, at]);
}

describe('Canonical final written marks for interviews', () => {
  it('accepts verified 64 and 85, keeps verified 31 unqualified, and does not promote missing or unverified marks', async () => {
    await manual('manual-pass', 64);
    await omr('omr-pass', 85);
    await manual('manual-fail', 31);
    await manual('manual-pending', 99, false);
    const resolved = await loadFinalWrittenMarks(db, ['manual-pass', 'omr-pass', 'manual-fail', 'manual-pending', 'missing']);
    assert.equal(resolved.get('manual-pass')?.eligibility.status, 'QUALIFIED');
    assert.equal(resolved.get('omr-pass')?.eligibility.status, 'QUALIFIED');
    assert.equal(resolved.get('manual-fail')?.eligibility.status, 'NOT_QUALIFIED');
    assert.equal(resolved.get('manual-fail')?.result?.marks, 31);
    assert.equal(resolved.get('manual-pending')?.eligibility.status, 'PENDING_VERIFICATION');
    assert.equal(resolved.get('manual-pending')?.result?.isFinal, false);
    assert.equal(resolved.get('missing')?.result, null);
    assert.equal(resolved.get('missing')?.eligibility.status, 'PENDING_VERIFICATION');
    assert.equal((await pg.query('SELECT * FROM "ExaminationResult"')).rows.length, 0);
  });

  it('uses the exact manual Student-list seal and latest correction, with new source revisions', async () => {
    await manual('candidate', 64);
    const initial = (await loadFinalWrittenMarks(db, ['candidate'])).get('candidate')!;
    const display = (await findPublishedManualExamMarks(['candidate'], db)).get('candidate')!;
    assert.equal(initial.result?.marks, display.obtainedMarks);
    assert.equal(initial.result?.isFinal, display.verified);
    await pg.query(`INSERT INTO "ManualExamMarkCorrectionAudit" VALUES (2,'candidate','2026-V',85,$1)`, [at]);
    const changed = (await loadFinalWrittenMarks(db, ['candidate'])).get('candidate')!;
    assert.equal(changed.result?.marks, 85);
    assert.equal(changed.result?.isFinal, false);
    assert.equal(changed.eligibility.status, 'PENDING_VERIFICATION');
    assert.notEqual(changed.result?.revision, initial.result?.revision);
    await verifyManual('candidate', 85, 2, 2);
    const verified = (await loadFinalWrittenMarks(db, ['candidate'])).get('candidate')!;
    assert.equal(verified.result?.marks, 85);
    assert.equal(verified.eligibility.status, 'QUALIFIED');
    assert.notEqual(verified.result?.revision, changed.result?.revision);
    await pg.query(`UPDATE "Student" SET "fullName"='Changed Identity' WHERE id='candidate'`);
    assert.equal((await loadFinalWrittenMarks(db, ['candidate'])).get('candidate')?.result?.isFinal, false);
  });

  it('uses corrected OMR values and invalidates stale seals until the exact revision is verified', async () => {
    await omr('candidate', 85);
    const initial = (await loadFinalWrittenMarks(db, ['candidate'])).get('candidate')!;
    const display = (await findPublishedProvisionalMarks(['candidate'], db)).get('candidate')!;
    assert.equal(initial.result?.marks, display.obtainedMarks);
    assert.equal(initial.result?.isFinal, display.verified);
    await pg.exec(`UPDATE "OmrProvisionalMark" SET "correctedMarks"=31 WHERE "studentId"='candidate'`);
    await pg.query(`INSERT INTO "OmrProvisionalMarkCorrectionAudit" VALUES ('correction-2','2026-V','candidate',$1)`, [at]);
    assert.equal((await loadFinalWrittenMarks(db, ['candidate'])).get('candidate')?.eligibility.status, 'PENDING_VERIFICATION');
    await verifyOmr('candidate', 31, 2, 'correction-2');
    const corrected = (await loadFinalWrittenMarks(db, ['candidate'])).get('candidate')!;
    assert.equal(corrected.eligibility.status, 'NOT_QUALIFIED');
    assert.equal(corrected.result?.marks, 31);
    assert.notEqual(corrected.result?.revision, initial.result?.revision);
    await pg.exec(`UPDATE "Student" SET status='INACTIVE' WHERE id='candidate'`);
    assert.equal((await loadFinalWrittenMarks(db, ['candidate'])).get('candidate')?.result?.isFinal, false);
  });

  it('keeps conflicts and withheld official sources visible instead of silently overriding them', async () => {
    await omr('candidate', 85);
    const source = (await findPublishedProvisionalMarks(['candidate'], db)).get('candidate')!;
    const official: any = {
      id: 'official', studentId: 'candidate', resultReference: 'official-reference', resultRevision: 1,
      obtainedMarks: 64, maximumMarks: 100, identityStatus: 'VERIFIED', scoringStatus: 'VERIFIED',
      verificationStatus: 'VERIFIED', publicationStatus: 'PUBLISHED', uncertainCount: 0,
      verifiedAt: new Date(at), verifiedById: 'reviewer', publishedAt: new Date(at), publishedById: 'reviewer',
      paperVersion: 'A', attendanceSessionId: 'attempt',
      attendanceSession: { id: 'attempt', isCurrent: true, status: 'CLOSED' },
      attemptBinding: { sessionId: 'attempt', studentId: 'candidate' },
      examination: { sessionReference: '2026-V', publicationStatus: 'PUBLISHED', maximumMarks: 100,
        publishedAt: new Date(at), publishedById: 'reviewer', revision: 1, paperKeyRevisions: [{ paperVersion: 'A' }] },
    };
    assert.deepEqual(resolveFinalWrittenMark('candidate', source, undefined, [official]).eligibility,
      { status: 'EXCLUDED_PENDING_REVIEW', reason: 'CONFLICTING_FINAL_SOURCES' });
    const matching = { ...official, obtainedMarks: 85 };
    assert.equal(resolveFinalWrittenMark('candidate', source, undefined, [matching]).result?.sourceType, 'VERIFIED_OMR');
    assert.equal(resolveFinalWrittenMark('candidate', undefined, undefined, [official]).result?.sourceType, 'OFFICIAL_RESULT');
    assert.equal(resolveFinalWrittenMark('candidate', { ...source, verified: false, verifiedAt: null }, undefined, [official])
      .eligibility.status, 'PENDING_VERIFICATION');
    assert.deepEqual(resolveFinalWrittenMark('candidate', source, undefined, [{ ...official, publicationStatus: 'WITHHELD' }]).eligibility,
      { status: 'EXCLUDED_PENDING_REVIEW', reason: 'WITHHELD' });
    assert.deepEqual(resolveFinalWrittenMark('candidate', source, undefined, [matching, { ...matching, id: 'duplicate' }]).eligibility,
      { status: 'EXCLUDED_PENDING_REVIEW', reason: 'DUPLICATE_OFFICIAL_RESULTS' });
  });

  it('does not accept legacy Student.testScore or invalidate it through a write', async () => {
    await student('legacy');
    await pg.query(`UPDATE "Student" SET "testScore"=99 WHERE id='legacy'`);
    const resolution = (await loadFinalWrittenMarks(db, ['legacy'])).get('legacy')!;
    assert.equal(resolution.eligibility.status, 'PENDING_VERIFICATION');
    assert.equal(resolution.result, null);
    assert.equal((await pg.query<{ testScore: number }>(`SELECT "testScore" FROM "Student" WHERE id='legacy'`)).rows[0].testScore, 99);
  });

  it('preserves the manual seal conflict checks used by the Student list', async () => {
    await manual('candidate', 64);
    await pg.query('INSERT INTO "ExaminationResult" VALUES ($1)', ['candidate']);
    const display = (await findPublishedManualExamMarks(['candidate'], db)).get('candidate')!;
    assert.equal(display.verified, false);
    const resolution = (await loadFinalWrittenMarks(db, ['candidate'])).get('candidate')!;
    assert.equal(resolution.result?.marks, 64);
    assert.equal(resolution.result?.isFinal, false);
    assert.equal(resolution.eligibility.status, 'PENDING_VERIFICATION');
  });
});
