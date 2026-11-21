import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { InterviewAllocationType, InterviewHallStatus, InterviewRoundStatus } from '@prisma/client';
import { InterviewsService } from '../src/modules/interviews/interviews.service.ts';

const actor = { id: 'admin-1', role: 'ADMIN' };
const approvedAt = new Date('2026-11-20T08:00:00.000Z');

function officialResult(studentId: string, sessionId: string, marks = 60) {
  return {
    id: `official-${studentId}`,
    resultReference: `gazette-${studentId}`,
    studentId,
    examinationId: 'exam-session-v',
    attendanceSessionId: sessionId,
    paperVersion: 'A',
    obtainedMarks: marks,
    maximumMarks: 100,
    uncertainCount: 0,
    identityStatus: 'VERIFIED',
    scoringStatus: 'VERIFIED',
    verificationStatus: 'VERIFIED',
    publicationStatus: 'PUBLISHED',
    resultRevision: 1,
    verifiedAt: approvedAt,
    verifiedById: 'super-admin-1',
    publishedAt: approvedAt,
    publishedById: 'super-admin-1',
    updatedAt: approvedAt,
    corrections: [{ id: `initial-audit-${studentId}`, previousRevision: 0, newRevision: 1, occurredAt: approvedAt }],
    examination: {
      id: 'exam-session-v', reference: 'EXAM-SESSION-V', sessionReference: '2026-V',
      examDate: new Date('2026-10-01T00:00:00.000Z'), classGroup: 'Class 10', maximumMarks: 100,
      publicationStatus: 'PUBLISHED', publishedAt: approvedAt, publishedById: 'super-admin-1', revision: 1,
      paperKeyRevisions: [{ paperVersion: 'A' }],
    },
    attendanceSession: { id: sessionId, isCurrent: true, status: 'CLOSED', attemptNumber: 1, businessDate: new Date('2026-10-01T00:00:00.000Z'), hallNameSnapshot: `Exam Hall ${sessionId}`, roomNumberSnapshot: sessionId },
    attemptBinding: { sessionId, studentId },
  };
}

function makeService(options: { candidateCount?: number; assignments?: any[] } = {}) {
  const candidateCount = options.candidateCount ?? 2;
  const students = Array.from({ length: candidateCount }, (_, index) => ({
    id: `student-${index + 1}`, applicationNo: `APP-${index + 1}`, rollNumber: `00${index + 1}`,
    fullName: `Candidate ${index + 1}`, currentClass: 'Class 10', hsscGroup: 'Science', schoolName: 'Synthetic School', gender: 'FEMALE',
  }));
  const sessions = students.map((_, index) => ({
    id: `exam-hall-${index + 1}-attempt-1`, businessDate: new Date('2026-10-01T00:00:00.000Z'),
    isCurrent: true, status: 'CLOSED', attemptNumber: 1, hallNameSnapshot: `Exam Hall ${index + 1}`, roomNumberSnapshot: `${index + 1}`,
  }));
  const rosterRows = students.map((student, index) => ({
    studentId: student.id, sessionId: sessions[index].id, fullNameSnapshot: student.fullName,
    rollNumberSnapshot: student.rollNumber, applicationNoSnapshot: student.applicationNo, currentClassSnapshot: 'Class 10',
  }));
  const results = students.map((student, index) => officialResult(student.id, sessions[index].id, index === 0 ? 60 : 75));
  const exam = {
    id: 'exam-session-v', reference: 'EXAM-SESSION-V', sessionReference: '2026-V',
    examDate: new Date('2026-10-01T00:00:00.000Z'), classGroup: 'Class 10', maximumMarks: 100,
    publicationStatus: 'PUBLISHED', publishedAt: approvedAt, publishedById: 'super-admin-1', revision: 1,
  };
  const halls: any[] = [{
    id: 'interview-hall-a', roundId: 'interview-round-v', name: 'Interview Hall A', roomNumber: 'A-01', venue: 'Main Center',
    interviewDate: new Date('2026-11-25T00:00:00.000Z'), capacity: 10, allowedClasses: [], status: InterviewHallStatus.ACTIVE,
  }];
  const state: any = {
    round: {
      id: 'interview-round-v', sessionRef: '2026-V', title: 'Session V 2026', eligibilityThreshold: 60,
      maximumMarks: 100, status: InterviewRoundStatus.OPEN, revision: 1,
    },
    assignments: options.assignments ?? [], approvals: [], audits: [], nextId: 1,
  };
  let transactionTail = Promise.resolve();
  const hallFor = (id: string) => halls.find(hall => hall.id === id);
  const db: any = {
    $transaction: async (work: (tx: any) => Promise<any>) => {
      const prior = transactionTail;
      let release!: () => void;
      transactionTail = new Promise<void>(resolve => { release = resolve; });
      await prior;
      try { return await work(db); } finally { release(); }
    },
    $queryRawUnsafe: async (sql: string, ...values: any[]) => {
      if (sql.includes('"InterviewRound"')) return state.round ? [{ id: state.round.id }] : [];
      if (sql.includes('"Examination"')) return [{ id: exam.id }];
      if (sql.includes('"ExaminationResult"')) return results.map(result => ({ id: result.id }));
      return [];
    },
    interviewRound: {
      findUnique: async () => state.round,
      update: async ({ data }: any) => {
        state.round = { ...state.round, ...data, revision: data.revision?.increment ? state.round.revision + data.revision.increment : (data.revision ?? state.round.revision) };
        return state.round;
      },
    },
    interviewFixedSchedule: { findUnique: async () => null },
    examination: { findMany: async () => [exam] },
    examinationResult: { findMany: async () => results },
    omrProvisionalMark: { findMany: async () => [] },
    attendanceSession: { findMany: async () => sessions },
    attendanceSessionCandidate: { findMany: async () => rosterRows },
    student: { findMany: async ({ where }: any) => students.filter(student => where?.id?.in?.includes(student.id)) },
    interviewHall: {
      findMany: async ({ include, select }: any = {}) => include?._count || select?._count
        ? halls.map(hall => ({ ...hall, _count: { assignments: state.assignments.filter((item: any) => item.hallId === hall.id).length } }))
        : halls,
      findFirst: async ({ where }: any) => halls.find(hall => hall.id === where.id && hall.roundId === where.roundId && hall.status === where.status),
    },
    interviewAssignment: {
      findMany: async ({ where }: any = {}) => state.assignments.filter((item: any) => !where?.roundId || item.roundId === where.roundId).map((item: any) => ({ ...item, hall: hallFor(item.hallId) })),
      findUnique: async ({ where }: any) => state.assignments.find((item: any) => item.id === where.id) ?? null,
      create: async ({ data }: any) => {
        const row = { id: `assignment-${state.nextId++}`, ...data, hall: hallFor(data.hallId) };
        state.assignments.push(row);
        return row;
      },
    },
    interviewAllocationAudit: {
      findUnique: async ({ where }: any) => state.audits.find((item: any) => item.roundId === where.roundId_idempotencyKey.roundId && item.idempotencyKey === where.roundId_idempotencyKey.idempotencyKey) ?? null,
      create: async ({ data }: any) => {
        const row = { id: `audit-${state.nextId++}`, ...data };
        state.audits.push(row);
        return row;
      },
    },
    interviewResultApproval: {
      findFirst: async ({ where }: any) => state.approvals.filter((row: any) => row.roundId === where.roundId && row.campaignReference === where.campaignReference).at(-1) ?? null,
      create: async ({ data }: any) => {
        const row = { id: `approval-${state.nextId++}`, approvedAt: new Date(approvedAt.getTime() + state.approvals.length), ...data };
        state.approvals.push(row);
        return row;
      },
    },
  };
  return { service: new InterviewsService(db), state, results, halls, students };
}

async function approveCampaign(service: InterviewsService) {
  return service.approveResults('interview-round-v', {
    evidenceReference: 'final-gazette-session-v-2026', evidenceSha256: 'a'.repeat(64),
    reason: 'Matched all published official revisions to the approved final Gazette.',
  }, { id: 'super-admin-1', role: 'SUPER_ADMIN' });
}

describe('Session V interview allocation service', () => {
  it('requires a Super Admin Gazette evidence approval before allocation', async () => {
    const { service, state } = makeService({ candidateCount: 1 });
    await assert.rejects(service.previewAutoAllocation('interview-round-v', 'BALANCED'), /Super Admin must confirm/);
    await assert.rejects(service.approveResults('interview-round-v', {
      evidenceReference: 'final-gazette-session-v-2026', evidenceSha256: 'a'.repeat(64),
      reason: 'Matched the final Gazette.',
    }, actor), /Only a Super Admin/);
    const approval = await approveCampaign(service);
    assert.equal(approval.candidateCount, 1);
    assert.equal(approval.snapshotHash.length, 64);
    assert.equal(state.audits.some((item: any) => item.action === 'RESULTS_APPROVED'), true);
    assert.equal((await service.previewAutoAllocation('interview-round-v', 'BALANCED')).eligibilitySourceStatus, 'VERIFIED');
  });

  it('builds one campaign preview from eligible candidates in multiple original exam halls', async () => {
    const { service } = makeService();
    await approveCampaign(service);
    const preview = await service.previewAutoAllocation('interview-round-v', 'BALANCED');
    assert.equal(preview.eligibilitySourceStatus, 'VERIFIED');
    assert.equal(preview.totalQualifiedCandidates, 2);
    assert.equal(preview.toAllocateCount, 2);
    assert.equal(new Set(preview.assignments.map(row => row.studentId)).size, 2);
  });

  it('keeps a locked candidate in place during a repeated allocation preview', async () => {
    const seed = {
      id: 'locked-assignment', roundId: 'interview-round-v', studentId: 'student-1', hallId: 'interview-hall-a',
      approvedResultReference: 'gazette-student-1', resultRevision: 'official-student-1:r1:e1', approvedMarksSnapshot: 60,
      allocationType: InterviewAllocationType.MANUAL, queueNumber: 1, isLocked: true,
    };
    const { service, state } = makeService({ assignments: [seed] });
    await approveCampaign(service);
    const preview = await service.previewAutoAllocation('interview-round-v', 'SEQUENTIAL');
    assert.equal(preview.lockedCandidates, 1);
    assert.equal(preview.assignments.some(row => row.studentId === seed.studentId), false);
    assert.equal(state.assignments[0].hallId, seed.hallId);
    assert.equal(state.assignments[0].isLocked, true);
  });

  it('flags a locked assignment when corrected marks fall below 60 and blocks publication', async () => {
    const seed = {
      id: 'locked-assignment', roundId: 'interview-round-v', studentId: 'student-1', hallId: 'interview-hall-a',
      approvedResultReference: 'gazette-student-1', resultRevision: 'official-student-1:r1:e1', approvedMarksSnapshot: 60,
      allocationType: InterviewAllocationType.MANUAL, queueNumber: 1, isLocked: true,
    };
    const { service, state, results } = makeService({ candidateCount: 1, assignments: [seed] });
    await approveCampaign(service);
    results[0].obtainedMarks = 59;
    results[0].resultRevision = 2;
    results[0].updatedAt = new Date('2026-11-21T08:00:00.000Z');
    results[0].corrections = [{ id: 'correction-2', previousRevision: 1, newRevision: 2, occurredAt: results[0].updatedAt }];
    const overview = await service.getOverview('interview-round-v');
    assert.equal(overview.notQualifiedCandidates, 1);
    assert.equal(overview.reviewRequiredAssignments, 1);
    const candidates = await service.listCandidates('interview-round-v', {
      page: 1, limit: 25, assignment: 'assigned', eligibility: 'unqualified', minimumMarks: 59, maximumMarks: 59,
    });
    assert.equal(candidates.pagination.total, 1);
    assert.equal(candidates.results[0].assignmentNeedsReview, true);
    await approveCampaign(service);
    await assert.rejects(service.publishRound('interview-round-v', actor), /Review assignments/);
    assert.equal(state.assignments[0].hallId, seed.hallId);
    assert.equal(state.assignments[0].isLocked, true);
  });

  it('rejects a preview commit when official marks and revision change after preview', async () => {
    const { service, state, results } = makeService({ candidateCount: 1 });
    await approveCampaign(service);
    const preview = await service.previewAutoAllocation('interview-round-v', 'BALANCED');
    results[0].obtainedMarks = 59;
    results[0].resultRevision = 2;
    results[0].updatedAt = new Date('2026-11-21T08:00:00.000Z');
    results[0].corrections = [{ id: 'correction-2', previousRevision: 1, newRevision: 2, occurredAt: results[0].updatedAt }];
    await assert.rejects(service.commitAutoAllocation('interview-round-v', {
      strategy: 'BALANCED', expectedRevision: preview.revision, planHash: preview.planHash,
      idempotencyKey: '00000000-0000-4000-8000-000000000001', allowPartial: false,
    }, actor), /changed after preview|stale|changed after Gazette evidence approval/);
    assert.equal(state.assignments.length, 0);
  });

  it('returns the original result for a repeated idempotent auto-allocation commit', async () => {
    const { service, state } = makeService({ candidateCount: 1 });
    await approveCampaign(service);
    const preview = await service.previewAutoAllocation('interview-round-v', 'BALANCED');
    const request = {
      strategy: 'BALANCED' as const, expectedRevision: preview.revision, planHash: preview.planHash,
      idempotencyKey: '00000000-0000-4000-8000-000000000002', allowPartial: false,
    };
    const first = await service.commitAutoAllocation('interview-round-v', request, actor);
    const replay = await service.commitAutoAllocation('interview-round-v', request, actor);
    assert.equal(first.createdCount, 1);
    assert.equal(replay.idempotentReplay, true);
    assert.equal(state.assignments.length, 1);
  });

  it('serializes concurrent commits so a second administrator cannot commit the same stale plan', async () => {
    const { service, state } = makeService({ candidateCount: 1 });
    await approveCampaign(service);
    const preview = await service.previewAutoAllocation('interview-round-v', 'BALANCED');
    const commit = (key: string) => service.commitAutoAllocation('interview-round-v', {
      strategy: 'BALANCED', expectedRevision: preview.revision, planHash: preview.planHash,
      idempotencyKey: key, allowPartial: false,
    }, actor);
    const outcomes = await Promise.allSettled([
      commit('00000000-0000-4000-8000-000000000003'),
      commit('00000000-0000-4000-8000-000000000004'),
    ]);
    assert.equal(outcomes.filter(item => item.status === 'fulfilled').length, 1);
    assert.equal(outcomes.filter(item => item.status === 'rejected').length, 1);
    assert.equal(state.assignments.length, 1);
  });
});
