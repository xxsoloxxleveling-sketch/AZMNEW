import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { MERIT_AWARD_CODES } from '../src/modules/interviews/assessment.schema.ts';

let db: PGlite;
let serial = 0;
async function insert(overrides: Record<string, unknown> = {}) {
  const index = ++serial;
  const data: Record<string, unknown> = {
    id: `award-${index}`, roundId: 'round-v', placementId: 'place-1', revision: index,
    awardCode: 'LAPTOP', actorId: 'admin-1', actorName: 'Synthetic Administrator',
    idempotencyKey: `award-request-${index}`, requestHash: 'a'.repeat(64), ...overrides,
  };
  const keys = Object.keys(data);
  await db.query(`INSERT INTO "InterviewMeritAwardRevision" (${keys.map(key => `"${key}"`).join(',')})
    VALUES (${keys.map((_, index) => `$${index + 1}`).join(',')})`, keys.map(key => data[key]));
  return data;
}

describe('Append-only manual merit award database boundaries', () => {
  before(async () => {
    db = new PGlite();
    await db.exec(`
      CREATE TABLE "User" (id TEXT PRIMARY KEY, role TEXT NOT NULL, status TEXT NOT NULL);
      CREATE TABLE "Student" (id TEXT PRIMARY KEY, "scholarshipCategory" TEXT NOT NULL, "testScore" INTEGER);
      CREATE TABLE "InterviewRound" (id TEXT PRIMARY KEY);
      CREATE TABLE "InterviewFixedSchedule" (id TEXT PRIMARY KEY, "roundId" TEXT NOT NULL REFERENCES "InterviewRound"(id));
      CREATE TABLE "InterviewFixedPlacement" (id TEXT PRIMARY KEY, "scheduleId" TEXT NOT NULL REFERENCES "InterviewFixedSchedule"(id),
        "studentId" TEXT NOT NULL REFERENCES "Student"(id), panel INTEGER NOT NULL);
      INSERT INTO "User" VALUES ('admin-1','ADMIN','ACTIVE'), ('super-1','SUPER_ADMIN','ACTIVE'),
        ('teacher-1','TEACHER','ACTIVE'), ('inactive-admin','ADMIN','INACTIVE');
      INSERT INTO "Student" VALUES ('student-1','GENERAL_MERIT',80), ('student-2','GENERAL_MERIT',85),
        ('student-3','FINANCIALLY_NEEDY',95);
      INSERT INTO "InterviewRound" VALUES ('round-v'), ('round-other');
      INSERT INTO "InterviewFixedSchedule" VALUES ('schedule-v','round-v');
      INSERT INTO "InterviewFixedPlacement" VALUES ('place-1','schedule-v','student-1',1),
        ('place-2','schedule-v','student-2',1), ('place-3','schedule-v','student-3',1);
    `);
    for (const migration of ['20261121160000_interview_assessment_revisions', '20261123160000_interview_merit_award_revisions']) {
      await db.exec(readFileSync(fileURLToPath(new URL(`../prisma/migrations/${migration}/migration.sql`, import.meta.url)), 'utf8'));
    }
  });
  after(async () => { await db?.close(); });

  it('starts empty, stores all seven explicit choices and clear, and leaves source marks/categories unchanged', async () => {
    assert.equal((await db.query<{ count: number }>('SELECT count(*)::int AS count FROM "InterviewMeritAwardRevision"')).rows[0].count, 0);
    const before = await db.query('SELECT * FROM "Student" ORDER BY id');
    for (const awardCode of [...MERIT_AWARD_CODES, null]) await insert({ awardCode });
    assert.deepEqual((await db.query('SELECT * FROM "Student" ORDER BY id')).rows, before.rows);
    assert.equal((await db.query<{ count: number }>('SELECT count(*)::int AS count FROM "InterviewAssessmentRevision"')).rows[0].count, 0);
  });

  it('rejects unknown codes, invalid revisions and malformed replay identifiers', async () => {
    for (const overrides of [
      { awardCode: 'AUTOMATIC' }, { awardCode: 'GENERAL_MERIT' }, { revision: 0 },
      { idempotencyKey: 'short' }, { requestHash: 'invalid' },
    ]) await assert.rejects(insert(overrides), /check constraint/);
  });

  it('requires an active administrator and the candidate fixed placement in the same round', async () => {
    await insert({ actorId: 'super-1' });
    for (const actorId of ['teacher-1', 'inactive-admin']) {
      await assert.rejects(insert({ actorId }), /active administrator/);
    }
    await assert.rejects(insert({ roundId: 'round-other' }), /fixed placement and round/);
    await assert.rejects(insert({ placementId: 'missing' }), /fixed placement and round/);
  });

  it('restricts awards to General Merit but preserves history when a changed category requires clearing', async () => {
    await assert.rejects(insert({ placementId: 'place-3' }), /General Merit/);
    await insert({ placementId: 'place-2' });
    await db.exec(`UPDATE "Student" SET "scholarshipCategory"='ORPHAN' WHERE id='student-2'`);
    await assert.rejects(insert({ placementId: 'place-2', awardCode: 'UMRAH_TICKET' }), /General Merit/);
    await insert({ placementId: 'place-2', awardCode: null });
    assert.deepEqual((await db.query<{ awardCode: string | null }>(
      'SELECT "awardCode" FROM "InterviewMeritAwardRevision" WHERE "placementId"=$1 ORDER BY revision', ['place-2'],
    )).rows.map(row => row.awardCode), ['LAPTOP', null]);
  });

  it('rejects duplicate revisions and replay keys and all history mutations including owner truncation', async () => {
    const row = await insert();
    await assert.rejects(insert({ revision: row.revision }), /unique constraint/);
    await assert.rejects(insert({ idempotencyKey: row.idempotencyKey }), /unique constraint/);
    await assert.rejects(db.exec('UPDATE "InterviewMeritAwardRevision" SET "awardCode"=NULL'), /append-only/);
    await assert.rejects(db.exec('DELETE FROM "InterviewMeritAwardRevision"'), /append-only/);
    await assert.rejects(db.exec('TRUNCATE "InterviewMeritAwardRevision"'), /append-only/);
  });
});
