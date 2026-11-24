import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { InterviewAssessmentService } from '../src/modules/interviews/assessment.service.ts';
import { AssessmentInput, MERIT_AWARD_CODES, MeritAwardInput } from '../src/modules/interviews/assessment.schema.ts';

const admin = { id: 'admin-1', name: 'Data Entry Admin', role: 'ADMIN' };
const superAdmin = { id: 'super-1', name: 'Review Admin', role: 'SUPER_ADMIN' };
function fixture(count = 2) {
  const placements = Array.from({ length: count }, (_, index) => ({
    id: `place-${index + 1}`, scheduleId: 'schedule-v', studentId: `student-${index + 1}`,
    panel: Math.min(6, Math.floor(index / 60) + 1), batch: index % 60 < 30 ? 1 : 2,
    sequence: index % 30 + 1, slotTime: '09:00 AM', printedMarks: 80,
    student: { id: `student-${index + 1}`, fullName: `Student ${String(index + 1).padStart(3, '0')}`,
      rollNumber: `ROLL-${index + 1}`, currentClass: 'Class 10', fatherName: `Parent ${index + 1}`,
      schoolName: `Institute ${index + 1}`, scholarshipCategory: 'GENERAL_MERIT' },
  }));
  const state: any = { panels: [], assessments: [], awards: [], placements, nextId: 0, sourceRevision: 'manual-c1-v1', marks: 80, final: true, roundStatus: 'SETUP' };
  const matchesAssessment = (row: any, where: any = {}) => (!where.roundId || where.roundId === row.roundId)
    && (!where.placementId || where.placementId === row.placementId)
    && (!where.status || where.status === row.status)
    && (!where.panelRevision?.panel || row.panelRevision.panel === where.panelRevision.panel);
  let tail = Promise.resolve();
  const db: any = {
    $transaction: async (work: any) => {
      const previous = tail; let release!: () => void; tail = new Promise<void>(resolve => { release = resolve; });
      await previous; try { return await work(db); } finally { release(); }
    },
    $queryRaw: async () => [{ id: 'round-v' }],
    interviewRound: { findUnique: async ({ where }: any) => where.id === 'round-v' ? { id: 'round-v', sessionRef: '2026-V', status: state.roundStatus } : null },
    interviewFixedSchedule: { findUnique: async ({ where }: any) => where.roundId === 'round-v' ? { id: 'schedule-v', placements } : null },
    interviewFixedPlacement: { findFirst: async ({ where }: any) => placements.find(row =>
      (!where.id || row.id === where.id) && (!where.panel || row.panel === where.panel) && where.schedule.roundId === 'round-v') ?? null },
    interviewPanelRevision: {
      findFirst: async ({ where }: any) => [...state.panels].reverse().find((row: any) => row.roundId === where.roundId && row.panel === where.panel) ?? null,
      findMany: async () => [...new Map(state.panels.map((row: any) => [row.panel, row])).values()],
      create: async ({ data }: any) => {
        const row = { id: `panel-${++state.nextId}`, ...data, createdAt: new Date('2026-11-21T16:00:00Z') };
        state.panels.push(row); return row;
      },
    },
    interviewAssessmentRevision: {
      findFirst: async ({ where }: any) => [...state.assessments].reverse().find((row: any) => matchesAssessment(row, where)) ?? null,
      findUnique: async ({ where }: any) => state.assessments.find((row: any) => row.roundId === where.roundId_idempotencyKey.roundId && row.idempotencyKey === where.roundId_idempotencyKey.idempotencyKey) ?? null,
      findMany: async ({ where, distinct }: any) => {
        const rows = state.assessments.filter((row: any) => matchesAssessment(row, where));
        return distinct ? [...new Map(rows.map((row: any) => [row.placementId, row])).values()] : [...rows].reverse();
      },
      create: async ({ data }: any) => {
        const row = { id: `assessment-${++state.nextId}`, ...data,
          panelRevision: state.panels.find((panel: any) => panel.id === data.panelRevisionId), createdAt: new Date('2026-11-21T16:05:00Z') };
        state.assessments.push(row); return row;
      },
    },
    interviewMeritAwardRevision: {
      findFirst: async ({ where }: any) => [...state.awards].reverse().find((row: any) => matchesAssessment(row, where)) ?? null,
      findUnique: async ({ where }: any) => state.awards.find((row: any) =>
        row.roundId === where.roundId_idempotencyKey.roundId && row.idempotencyKey === where.roundId_idempotencyKey.idempotencyKey) ?? null,
      findMany: async ({ where, distinct }: any) => {
        const rows = state.awards.filter((row: any) => matchesAssessment(row, where));
        return distinct ? [...new Map(rows.map((row: any) => [row.placementId, row])).values()] : [...rows].reverse();
      },
      create: async ({ data }: any) => {
        const row = { id: `award-${++state.nextId}`, ...data, createdAt: new Date('2026-11-23T16:00:00Z') };
        state.awards.push(row); return row;
      },
    },
  };
  const source: any = async (_db: any, ids: string[]) => new Map(ids.map(id => [id, {
    result: { marks: state.marks, maximumMarks: 100, isFinal: state.final, verificationStatus: state.final ? 'VERIFIED' : 'PENDING',
      sourceType: 'VERIFIED_MANUAL', reference: `manual-${id}`, revision: state.sourceRevision },
    eligibility: { status: state.final ? (state.marks >= 60 ? 'QUALIFIED' : 'NOT_QUALIFIED') : 'PENDING_VERIFICATION' },
  }]));
  return { service: new InterviewAssessmentService(db, source), state };
}
async function configure(service: InterviewAssessmentService) {
  return service.savePanel('round-v', 1, { expectedRevision: 0, members: [{ name: 'Member One' }, { name: 'Member Two' }, { name: 'Member Three' }], reason: 'Initial panel appointments' }, admin);
}
function complete(panel: any, key = 'save-complete-1'): AssessmentInput {
  return { expectedRevision: 0, panelRevision: panel.revision, idempotencyKey: key, attendance: 'PRESENT',
    scores: panel.members.map((member: any) => ({ memberId: member.id, interview: 18, personality: 4 })),
    extracurricular: 8, extracurricularEvidence: 'Certificate reviewed', extracurricularReviewed: true,
    academic: 4, academicEvidence: 'Academic DMC reviewed', academicReviewed: true, notes: '', reason: '' };
}

describe('Interview assessment service boundaries', () => {
  it('starts scoring after allocation was finalized without changing the timetable or weakening submission controls', async () => {
    const { service, state } = fixture(); state.roundStatus = 'FINALIZED';
    const before = JSON.stringify(state.placements), panel = await configure(service);
    const saved = await service.save('round-v', 'place-1', complete(panel), admin, true);
    assert.equal(saved.status, 'SUBMITTED');
    assert.equal(state.roundStatus, 'FINALIZED');
    assert.equal(JSON.stringify(state.placements), before);
    await assert.rejects(service.save('round-v', 'place-1', { ...complete(panel, 'after-finalized-submit'), expectedRevision: 1, reason: 'Correction' }, admin), /Only a Super Admin/);
  });

  it('lists all 349 fixed placements independently of ordinary allocation/result approvals', async () => {
    const { service, state } = fixture(349);
    const before = JSON.stringify(state.placements);
    const roster = await service.roster('round-v', { page: 1, limit: 25 });
    assert.equal(roster.pagination.total, 349);
    assert.equal(roster.rows.length, 25);
    assert.deepEqual(roster.panelOptions, [1, 2, 3, 4, 5, 6]);
    assert.equal(roster.rows[0].written.isFinal, true);
    assert.equal(JSON.stringify(state.placements), before);
  });

  it('preserves zero/blank drafts and rejects incomplete submission without writing a revision', async () => {
    const { service, state } = fixture(); const panel = await configure(service);
    const draft = complete(panel); draft.scores[0].interview = null; draft.academic = 0;
    const saved = await service.save('round-v', 'place-1', draft, admin);
    assert.equal(saved.status, 'DRAFT'); assert.equal(saved.totals.total, null); assert.equal(saved.academic, 0);
    await assert.rejects(service.save('round-v', 'place-1', { ...draft, expectedRevision: 1, idempotencyKey: 'incomplete-submit' }, admin, true), /Complete the assessment/);
    assert.equal(state.assessments.length, 1);
  });

  it('replays the exact saved request and rejects reuse for different data', async () => {
    const { service, state } = fixture(); const panel = await configure(service); const input = complete(panel);
    const first = await service.save('round-v', 'place-1', input, admin, true);
    const second = await service.save('round-v', 'place-1', input, admin, true);
    assert.equal(second.id, first.id); assert.equal(state.assessments.length, 1);
    await assert.rejects(service.save('round-v', 'place-1', { ...input, academic: 3 }, admin, true), /different request/);
  });

  it('prevents stale concurrent drafts and never overwrites a previous version', async () => {
    const { service, state } = fixture(); const panel = await configure(service); const input = complete(panel);
    const results = await Promise.allSettled([
      service.save('round-v', 'place-1', input, admin),
      service.save('round-v', 'place-1', { ...input, idempotencyKey: 'other-device-save', academic: 2 }, admin),
    ]);
    assert.equal(results.filter(row => row.status === 'fulfilled').length, 1);
    assert.equal(results.filter(row => row.status === 'rejected').length, 1);
    assert.equal(state.assessments.length, 1); assert.equal(state.assessments[0].academic, 4);
  });

  it('requires Super Admin and a reason for any correction after submission, preserving original scorers', async () => {
    const { service, state } = fixture(); const panel = await configure(service); const input = complete(panel);
    const submitted = await service.save('round-v', 'place-1', input, admin, true);
    const correction = { ...input, expectedRevision: 1, idempotencyKey: 'correction-save-1', reason: 'Corrected transcription from signed sheet', academic: 5 };
    await assert.rejects(service.save('round-v', 'place-1', correction, admin), /Only a Super Admin/);
    await assert.rejects(service.save('round-v', 'place-1', { ...correction, reason: '' }, superAdmin), /Record a reason/);
    const draft = await service.save('round-v', 'place-1', correction, superAdmin);
    assert.equal(draft.revision, 2); assert.equal(draft.status, 'DRAFT');
    assert.equal(state.assessments[0].academic, 4); assert.deepEqual(draft.members, submitted.members);
    assert.equal((await service.candidate('round-v', 'place-1')).hasSubmittedAssessment, true);
    await assert.rejects(service.save('round-v', 'place-1', { ...correction, expectedRevision: 2, idempotencyKey: 'admin-after-reopen' }, admin), /Only a Super Admin/);
  });

  it('invalidates merit on source or panel revision changes without relabeling historical scores', async () => {
    const { service, state } = fixture(); const panel = await configure(service);
    await service.save('round-v', 'place-1', complete(panel), admin, true);
    assert.equal((await service.merit('round-v')).summary.ready, 1);
    state.sourceRevision = 'manual-c2-v2';
    const sourceChanged = (await service.merit('round-v')).rows.find(row => row.placementId === 'place-1')!;
    assert.equal(sourceChanged.status, 'SOURCE_CHANGED');
    assert.equal(sourceChanged.rank, null); assert.equal(sourceChanged.overallRank, null);
    state.sourceRevision = 'manual-c1-v1';
    await assert.rejects(service.savePanel('round-v', 1, { expectedRevision: 1, members: [{ name: 'New One' }, { name: 'New Two' }, { name: 'New Three' }], reason: 'Replacement panel' }, admin), /Only a Super Admin/);
    await service.savePanel('round-v', 1, { expectedRevision: 1, members: [{ name: 'New One' }, { name: 'New Two' }, { name: 'New Three' }], reason: 'Replacement panel' }, superAdmin);
    const merit = await service.merit('round-v'); assert.equal(merit.summary.ready, 0);
    assert.equal(merit.overallRankedCandidates, 0);
    assert.ok(merit.rows.every(row => row.rank === null && row.overallRank === null));
    const candidate = await service.candidate('round-v', 'place-1');
    assert.equal(candidate.assessment?.members[0].name, 'Member One');
    assert.equal(candidate.panelConfiguration?.members[0].name, 'New One');
    assert.equal(candidate.assessment?.totals.total, 82);
  });

  it('calculates overall ranks before class filtering without rounding ties or writing records', async () => {
    const { service, state } = fixture(7);
    ['Class 6', 'Class 7', 'Class 8', 'Class 6', 'Class 10', 'Class 10', 'Class 10']
      .forEach((className, index) => { state.placements[index].student.currentClass = className; });
    const panel = await configure(service);
    for (let index = 1; index <= 6; index += 1) {
      const input = complete(panel, `combined-ranking-${index}`);
      if (index <= 2) input.scores[0].interview = 18.01;
      if (index === 4) input.academic = 3;
      if (index === 6) input.attendance = 'ABSENT';
      await service.save('round-v', `place-${index}`, input, admin, index !== 5);
    }
    const beforeRead = JSON.stringify(state);
    const merit = await service.merit('round-v');
    const byId = new Map(merit.rows.map(row => [row.placementId, row]));
    assert.equal(merit.rankMethod, 'SHARED_COMPETITION_WITHIN_CLASS');
    assert.equal(merit.overallRankMethod, 'SHARED_COMPETITION_ALL_CLASSES');
    assert.equal(merit.overallRankedCandidates, 4);
    assert.deepEqual(merit.summary, { total: 7, ready: 4, incomplete: 2, absent: 1 });
    assert.deepEqual(['place-1', 'place-2', 'place-3', 'place-4'].map(id => [
      byId.get(id)!.rank, byId.get(id)!.overallRank,
    ]), [[1, 1], [1, 1], [1, 3], [2, 4]]);
    assert.equal(byId.get('place-1')!.totals.total, byId.get('place-3')!.totals.total);
    assert.ok(merit.rows.filter(row => row.status !== 'READY').every(row => row.rank === null && row.overallRank === null));
    assert.ok(merit.rows.every(row => !('numerator' in row)));
    const filtered = await service.merit('round-v', 'Class 8');
    assert.equal(filtered.overallRankedCandidates, 4);
    assert.deepEqual(filtered.rows.map(row => [row.placementId, row.rank, row.overallRank]), [['place-3', 1, 3]]);
    assert.deepEqual(filtered.summary, { total: 1, ready: 1, incomplete: 0, absent: 0 });
    assert.deepEqual(filtered.classOptions, merit.classOptions);
    const empty = await service.merit('round-v', 'No matching class');
    assert.deepEqual(empty.rows, []); assert.equal(empty.overallRankedCandidates, 4);
    assert.equal(JSON.stringify(state), beforeRead);
  });

  it('projects current registration details into merit without deriving a scholarship award', async () => {
    const { service, state } = fixture();
    Object.assign(state.placements[0].student, {
      fatherName: 'Synthetic Parent One', schoolName: 'Synthetic Institute One', scholarshipCategory: 'FINANCIALLY_NEEDY',
    });
    Object.assign(state.placements[1].student, { fatherName: '', schoolName: '', scholarshipCategory: 'ORPHAN' });
    const beforeRead = JSON.stringify(state);
    const merit = await service.merit('round-v');
    assert.deepEqual(merit.rows.map(row => [row.placementId, row.fatherName, row.institute, row.scholarshipCategory]), [
      ['place-1', 'Synthetic Parent One', 'Synthetic Institute One', 'FINANCIALLY_NEEDY'],
      ['place-2', '', '', 'ORPHAN'],
    ]);
    assert.ok(merit.rows.every(row => row.overallRank === null && row.totals.total === null));
    const roster = await service.roster('round-v', { page: 1, limit: 25 });
    assert.ok(roster.rows.every(row => !('fatherName' in row) && !('institute' in row) && !('scholarshipCategory' in row)));
    assert.equal(JSON.stringify(state), beforeRead);
  });

  it('keeps absent and unsaved candidates unranked and rejects cross-round/non-admin access', async () => {
    const { service } = fixture(); const panel = await configure(service);
    const input = complete(panel); input.attendance = 'ABSENT'; input.scores.forEach(card => { card.interview = null; card.personality = null; });
    await service.save('round-v', 'place-1', input, admin, true);
    const merit = await service.merit('round-v');
    assert.equal(merit.publicationEnabled, false); assert.equal(merit.provisional, true);
    assert.equal(merit.summary.absent, 1); assert.equal(merit.summary.incomplete, 1);
    assert.ok(merit.rows.every(row => row.rank === null && row.overallRank === null));
    assert.equal(merit.overallRankedCandidates, 0);
    await assert.rejects(service.save('round-v', 'outside-placement', complete(panel, 'other-place-save'), admin), /not in this round/);
    await assert.rejects(service.save('round-v', 'place-2', complete(panel, 'teacher-write-save'), { id: 'teacher-1', role: 'TEACHER' }), /Only an administrator/);
  });
});

describe('Manual interview merit award selections', () => {
  const input = (awardCode: MeritAwardInput['awardCode'] = 'LAPTOP', expectedRevision = 0,
    idempotencyKey = 'manual-award-request-1'): MeritAwardInput => ({ awardCode, expectedRevision, idempotencyKey });

  it('starts unassigned without writing records or deriving awards from marks', async () => {
    const { service, state } = fixture(); const panel = await configure(service);
    await service.save('round-v', 'place-1', complete(panel), admin, true);
    const beforeRead = JSON.stringify(state);
    const merit = await service.merit('round-v');
    assert.equal(merit.manualAwardsEnabled, true);
    assert.ok(merit.rows.every(row => row.meritAward.revision === 0 && row.meritAward.awardCode === null
      && row.meritAward.id === null && row.meritAward.actorName === null && row.meritAward.createdAt === null));
    assert.deepEqual(await service.meritAwardHistory('round-v', 'place-1'), []);
    assert.equal(JSON.stringify(state), beforeRead);
  });

  it('persists every explicit choice independently of readiness and keeps a complete ordered audit', async () => {
    const { service, state } = fixture();
    const before = (await service.merit('round-v')).rows;
    const stripAward = (rows: typeof before) => rows.map(({ meritAward: _award, ...row }) => row);
    for (const [index, awardCode] of MERIT_AWARD_CODES.entries()) {
      const actor = superAdmin;
      const saved = await service.saveMeritAward('round-v', 'place-1', input(awardCode, index, `award-selection-${index}`), actor);
      assert.equal(saved.awardCode, awardCode); assert.equal(saved.revision, index + 1);
      assert.equal(saved.actorName, actor.name); assert.equal(saved.createdAt, '2026-11-23T16:00:00.000Z');
      assert.ok(saved.id);
    }
    const after = (await service.merit('round-v')).rows;
    assert.deepEqual(stripAward(after), stripAward(before));
    assert.equal(after.find(row => row.placementId === 'place-1')!.meritAward.awardCode, 'CASH_PRIZE_5000');
    assert.deepEqual((await service.meritAwardHistory('round-v', 'place-1')).map(row => row.awardCode), [...MERIT_AWARD_CODES].reverse());
    assert.equal(state.assessments.length, 0);
  });

  it('replays identical saves and rejects conflicting keys, actors, candidates and stale revisions', async () => {
    const { service, state } = fixture();
    const request = input();
    const saved = await service.saveMeritAward('round-v', 'place-1', request, superAdmin);
    assert.deepEqual(await service.saveMeritAward('round-v', 'place-1', request, superAdmin), saved);
    await assert.rejects(service.saveMeritAward('round-v', 'place-1', { ...request, awardCode: 'UMRAH_TICKET' }, superAdmin), /different request/);
    await assert.rejects(service.saveMeritAward('round-v', 'place-1', request, { ...superAdmin, id: 'other-super-admin' }), /different request/);
    await assert.rejects(service.saveMeritAward('round-v', 'place-2', request, superAdmin), /different request/);
    await assert.rejects(service.saveMeritAward('round-v', 'place-1', input('UMRAH_TICKET', 0, 'stale-award-request'), superAdmin), /newer award/);
    assert.equal(state.awards.length, 1);
  });

  it('allows only one concurrent writer for an award revision', async () => {
    const { service, state } = fixture();
    const results = await Promise.allSettled([
      service.saveMeritAward('round-v', 'place-1', input('LAPTOP', 0, 'concurrent-award-one'), superAdmin),
      service.saveMeritAward('round-v', 'place-1', input('UMRAH_TICKET', 0, 'concurrent-award-two'), superAdmin),
    ]);
    assert.equal(results.filter(row => row.status === 'fulfilled').length, 1);
    const rejected = results.find(row => row.status === 'rejected');
    assert.ok(rejected?.status === 'rejected' && rejected.reason.statusCode === 409);
    assert.equal(state.awards.length, 1);
  });

  it('allows explicit assignment and clearing for every registration category, never derives an award from it', async () => {
    const { service, state } = fixture();
    let revision = 0;
    for (const category of ['GENERAL_MERIT', 'FINANCIALLY_NEEDY', 'ORPHAN', 'PERSON_WITH_DISABILITY']) {
      state.placements[0].student.scholarshipCategory = category;
      assert.equal((await service.merit('round-v')).rows[0].meritAward.awardCode, null);
      const saved = await service.saveMeritAward('round-v', 'place-1', input('UMRAH_TICKET', revision++, 'category-' + category), superAdmin);
      assert.equal(saved.awardCode, 'UMRAH_TICKET');
      assert.equal((await service.merit('round-v')).rows[0].meritAward.awardCode, 'UMRAH_TICKET');
      await assert.rejects(service.saveMeritAward('round-v', 'place-1', input(null, revision, 'ordinary-clear-' + category), admin), /Only a Super Admin/);
      const cleared = await service.saveMeritAward('round-v', 'place-1', input(null, revision++, 'clear-' + category), superAdmin);
      assert.equal(cleared.awardCode, null);
      assert.equal(state.placements[0].student.scholarshipCategory, category);
    }
    assert.equal((await service.meritAwardHistory('round-v', 'place-1')).length, 8);
  });

  it('rejects all non-Super-Admin writes, unknown codes and candidates outside the round without altering scores or awards', async () => {
    const { service, state } = fixture();
    const before = JSON.stringify(state);
    for (const role of ['ADMIN', 'TEACHER', 'ACCOUNTANT']) {
      await assert.rejects(service.saveMeritAward('round-v', 'place-1', input(), { id: 'other-user', role }), /Only a Super Admin/);
    }
    await assert.rejects(service.saveMeritAward('round-v', 'place-1', { ...input(), awardCode: 'AUTOMATIC' } as any, superAdmin));
    await assert.rejects(service.saveMeritAward('round-v', 'outside-placement', input(), superAdmin), /not in this round/);
    await assert.rejects(service.meritAwardHistory('round-v', 'outside-placement'), /not in this round/);
    await assert.rejects(service.saveMeritAward('outside-round', 'place-1', input(), superAdmin), /round not found/);
    assert.equal(JSON.stringify(state), before);
  });
});
