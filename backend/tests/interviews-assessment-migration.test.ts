import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

let db: PGlite;
let serial = 0;
const members = ['One', 'Two', 'Three'].map((name, index) => ({ id: `m${index + 1}`, name: `Member ${name}`, position: index + 1 }));
const scores = members.map(member => ({ memberId: member.id, interview: 18, personality: 4 }));
const written = { marks: 80, maximumMarks: 100, isFinal: true, status: 'QUALIFIED', sourceType: 'VERIFIED_MANUAL', reference: 'manual-student', revision: 'v1' };

async function insert(overrides: Record<string, unknown> = {}) {
  const number = ++serial;
  const data: Record<string, unknown> = {
    id: `a${number}`, roundId: 'round-v', placementId: 'place-1', panelRevisionId: 'panel-v1', revision: number,
    status: 'SUBMITTED', attendance: 'PRESENT', scores, extracurricular: 8, extracurricularEvidence: 'Signed evidence',
    extracurricularReviewed: true, academic: 4, academicEvidence: 'Verified DMC', academicReviewed: true,
    classSnapshot: 'Class 10', writtenSnapshot: written, actorId: 'admin-1', actorName: 'Synthetic Admin',
    idempotencyKey: `request-key-${number}`, requestHash: 'a'.repeat(64), ...overrides,
  };
  const keys = Object.keys(data), values = keys.map(key => typeof data[key] === 'object' && data[key] !== null ? JSON.stringify(data[key]) : data[key]);
  await db.query(`INSERT INTO "InterviewAssessmentRevision" (${keys.map(key => `"${key}"`).join(',')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(',')})`, values);
  return data.id;
}

describe('Additive interview assessment database constraints', () => {
  before(async () => {
    db = new PGlite();
    await db.exec(`
      CREATE TABLE "User" (id TEXT PRIMARY KEY);
      CREATE TABLE "InterviewRound" (id TEXT PRIMARY KEY);
      CREATE TABLE "InterviewFixedSchedule" (id TEXT PRIMARY KEY, "roundId" TEXT NOT NULL REFERENCES "InterviewRound"(id));
      CREATE TABLE "InterviewFixedPlacement" (id TEXT PRIMARY KEY, "scheduleId" TEXT NOT NULL REFERENCES "InterviewFixedSchedule"(id), panel INTEGER NOT NULL);
      INSERT INTO "User" VALUES ('admin-1');
      INSERT INTO "InterviewRound" VALUES ('round-v'), ('round-other');
      INSERT INTO "InterviewFixedSchedule" VALUES ('schedule-v', 'round-v');
      INSERT INTO "InterviewFixedPlacement" VALUES ('place-1', 'schedule-v', 1);
    `);
    await db.exec(readFileSync(fileURLToPath(new URL('../prisma/migrations/20261121160000_interview_assessment_revisions/migration.sql', import.meta.url)), 'utf8'));
    await db.query(`INSERT INTO "InterviewPanelRevision" (id,"roundId",panel,revision,members,reason,"actorId","actorName") VALUES ('panel-v1','round-v',1,1,$1,'Initial panel','admin-1','Synthetic Admin')`, [JSON.stringify(members)]);
  });
  after(async () => { await db?.close(); });

  it('accepts a complete submission and null-valued draft without changing the fixed placement', async () => {
    await insert();
    await insert({ status: 'DRAFT', academic: null, scores: scores.map(card => ({ ...card, interview: null })) });
    const count = await db.query<{ count: number }>('SELECT count(*)::int AS count FROM "InterviewFixedPlacement"');
    assert.equal(count.rows[0].count, 1);
  });

  it('rejects updates, deletes and truncation of both historical tables', async () => {
    for (const table of ['InterviewPanelRevision', 'InterviewAssessmentRevision']) {
      await assert.rejects(db.exec(`UPDATE "${table}" SET "actorName"='Changed'`), /append-only/);
      await assert.rejects(db.exec(`DELETE FROM "${table}"`), /append-only/);
      await assert.rejects(db.exec(`TRUNCATE "${table}" CASCADE`), /append-only/);
    }
  });

  it('rejects submitted missing written verification metadata and incomplete idempotency pairs', async () => {
    await assert.rejects(insert({ writtenSnapshot: {} }), /Invalid written mark snapshot|submitted_check/);
    await assert.rejects(insert({ writtenSnapshot: { ...written, isFinal: false } }), /submitted_check/);
    await assert.rejects(insert({ writtenSnapshot: { ...written, marks: null } }), /final written source/);
    await assert.rejects(insert({ writtenSnapshot: { ...written, revision: null } }), /final written source/);
    await assert.rejects(insert({ requestHash: null }), /submission_key_check/);
    await assert.rejects(insert({ idempotencyKey: null, status: 'DRAFT' }), /submission_key_check/);
  });

  it('rejects out-of-range, absent and duplicate member scores and mismatched round relations', async () => {
    await assert.rejects(insert({ scores: scores.map((card, index) => ({ ...card, interview: index === 0 ? 21 : 18 })) }), /outside approved scale/);
    await assert.rejects(insert({ scores: scores.map((card, index) => ({ ...card, personality: index === 0 ? 1.001 : 4 })) }), /outside approved scale/);
    await assert.rejects(insert({ scores: scores.map((card, index) => ({ ...card, interview: index === 0 ? null : 18 })) }), /complete member scores/);
    await assert.rejects(insert({ scores: [scores[0], scores[0], scores[2]] }), /saved panel membership/);
    await assert.rejects(insert({ roundId: 'round-other' }), /fixed placement and panel/);
    await assert.rejects(insert({ extracurricular: 11 }), /check constraint/);
  });

  it('rejects duplicate names with casing or whitespace differences', async () => {
    const duplicate = [{ id: 'n1', name: 'Ali Khan', position: 1 }, { id: 'n2', name: ' ali   khan ', position: 2 }, { id: 'n3', name: 'Third Member', position: 3 }];
    await assert.rejects(db.query(`INSERT INTO "InterviewPanelRevision" (id,"roundId",panel,revision,members,reason,"actorId","actorName") VALUES ('panel-bad','round-v',1,2,$1,'Updated panel','admin-1','Synthetic Admin')`, [JSON.stringify(duplicate)]), /Duplicate interview member/);
  });
});
