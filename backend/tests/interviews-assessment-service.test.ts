import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { InterviewAssessmentService } from '../src/modules/interviews/assessment.service.ts';
import { AssessmentInput } from '../src/modules/interviews/assessment.schema.ts';

const admin = { id: 'admin-1', name: 'Data Entry Admin', role: 'ADMIN' };
const superAdmin = { id: 'super-1', name: 'Review Admin', role: 'SUPER_ADMIN' };
function fixture(count = 2) {
  const placements = Array.from({ length: count }, (_, index) => ({
    id: `place-${index + 1}`, scheduleId: 'schedule-v', studentId: `student-${index + 1}`,
    panel: Math.min(6, Math.floor(index / 60) + 1), batch: index % 60 < 30 ? 1 : 2,
    sequence: index % 30 + 1, slotTime: '09:00 AM', printedMarks: 80,
    student: { id: `student-${index + 1}`, fullName: `Student ${String(index + 1).padStart(3, '0')}`, rollNumber: `ROLL-${index + 1}`, currentClass: 'Class 10' },
  }));
  const state: any = { panels: [], assessments: [], placements, nextId: 0, sourceRevision: 'manual-c1-v1', marks: 80, final: true, roundStatus: 'SETUP' };
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
    assert.equal((await service.merit('round-v')).rows.find(row => row.placementId === 'place-1')?.status, 'SOURCE_CHANGED');
    state.sourceRevision = 'manual-c1-v1';
    await assert.rejects(service.savePanel('round-v', 1, { expectedRevision: 1, members: [{ name: 'New One' }, { name: 'New Two' }, { name: 'New Three' }], reason: 'Replacement panel' }, admin), /Only a Super Admin/);
    await service.savePanel('round-v', 1, { expectedRevision: 1, members: [{ name: 'New One' }, { name: 'New Two' }, { name: 'New Three' }], reason: 'Replacement panel' }, superAdmin);
    const merit = await service.merit('round-v'); assert.equal(merit.summary.ready, 0);
    const candidate = await service.candidate('round-v', 'place-1');
    assert.equal(candidate.assessment?.members[0].name, 'Member One');
    assert.equal(candidate.panelConfiguration?.members[0].name, 'New One');
    assert.equal(candidate.assessment?.totals.total, 82);
  });

  it('keeps absent and unsaved candidates unranked and rejects cross-round/non-admin access', async () => {
    const { service } = fixture(); const panel = await configure(service);
    const input = complete(panel); input.attendance = 'ABSENT'; input.scores.forEach(card => { card.interview = null; card.personality = null; });
    await service.save('round-v', 'place-1', input, admin, true);
    const merit = await service.merit('round-v');
    assert.equal(merit.publicationEnabled, false); assert.equal(merit.provisional, true);
    assert.equal(merit.summary.absent, 1); assert.equal(merit.summary.incomplete, 1);
    assert.ok(merit.rows.every(row => row.rank === null));
    await assert.rejects(service.save('round-v', 'outside-placement', complete(panel, 'other-place-save'), admin), /not in this round/);
    await assert.rejects(service.save('round-v', 'place-2', complete(panel, 'teacher-write-save'), { id: 'teacher-1', role: 'TEACHER' }), /Only an administrator/);
  });
});
