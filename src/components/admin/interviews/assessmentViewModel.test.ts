import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { AssessmentPanel, CandidateAssessment, SaveAssessmentInput, WrittenMarkSource } from './assessmentApi.ts';
import { assessmentPayload, draftTotals, makeAssessmentDraft, optionalScore, safeCsvCell, submissionIssues } from './assessmentViewModel.ts';

const panel: AssessmentPanel = {
  id: 'panel-revision-1', panel: 1, revision: 1,
  members: [
    { id: 'assessor-a', name: 'Synthetic Member A', position: 1 },
    { id: 'assessor-b', name: 'Synthetic Member B', position: 2 },
    { id: 'assessor-c', name: 'Synthetic Member C', position: 3 },
  ],
};
const written: WrittenMarkSource = { marks: 80, maximumMarks: 100, isFinal: true, sourceType: 'VERIFIED_MANUAL', reference: 'synthetic-exam-1', revision: 'written-revision-1', status: 'QUALIFIED' };
function completeInput(): SaveAssessmentInput {
  return {
    expectedRevision: 0, panelRevision: 1, attendance: 'PRESENT',
    scores: [
      { memberId: 'assessor-a', interview: 16, personality: 4 },
      { memberId: 'assessor-b', interview: 17, personality: 4.5 },
      { memberId: 'assessor-c', interview: 18, personality: 5 },
    ],
    extracurricular: 8, extracurricularEvidence: 'Checked synthetic activity record', extracurricularReviewed: true,
    academic: 4.25, academicEvidence: 'Checked synthetic academic record', academicReviewed: true, notes: '',
  };
}
function savedAssessment(): CandidateAssessment {
  const body = completeInput();
  return {
    ...body, id: 'synthetic-assessment-1', revision: 1, status: 'SUBMITTED', members: panel.members,
    actorName: 'Synthetic Admin', createdAt: '2026-11-21T10:00:00Z', written,
    totals: draftTotals(body, written), issues: [],
  };
}

describe('interview assessment entry safeguards', () => {
  it('uses weighted component points once and calculates the three-member mean', () => {
    const totals = draftTotals(completeInput(), written);
    assert.deepEqual(totals, { written: 48, interview: 17, extracurricular: 8, academic: 4.25, personality: 4.5, total: 81.75 });
  });

  it('keeps a missing third score pending rather than averaging two or supplying zero', () => {
    const body = completeInput(); body.scores[2].interview = null;
    const totals = draftTotals(body, written);
    assert.equal(totals.interview, null);
    assert.equal(totals.total, null);
    assert.ok(submissionIssues(body, written, null).some(issue => issue.includes('all three')));
  });

  it('preserves an explicit zero but encodes a blank score as null', () => {
    const draft = makeAssessmentDraft(null, panel);
    draft.scores[0].interview = '0';
    const body = assessmentPayload(draft, null, panel);
    assert.equal(body.scores[0].interview, 0);
    assert.equal(body.scores[1].interview, null);
    assert.equal(body.academic, null);
    const saved = savedAssessment(); saved.scores[0].interview = 0;
    assert.equal(makeAssessmentDraft(saved, panel).scores[0].interview, '0');
  });

  it('does not move a previous member score to a replacement member', () => {
    const replacement = { ...panel, revision: 2, members: panel.members.map(member => ({ ...member, id: member.id + '-new' })) };
    const draft = makeAssessmentDraft(savedAssessment(), replacement);
    assert.ok(draft.scores.every(score => score.interview === '' && score.personality === ''));
    assert.deepEqual(draft.scores.map(score => score.memberId), replacement.members.map(member => member.id));
    assert.equal(draft.extracurricular, '8');
  });

  it('requires all three distinct members and reviewed evidence for a present candidate', () => {
    const body = completeInput();
    assert.deepEqual(submissionIssues(body, written, null), []);
    body.scores[2].memberId = body.scores[0].memberId;
    body.academicReviewed = false;
    body.extracurricularEvidence = '';
    const issues = submissionIssues(body, written, null);
    assert.equal(issues.length, 3);
    assert.equal(draftTotals(body, written).total, null);
  });

  it('honors the inclusive 60 threshold and requires verified final written marks', () => {
    assert.deepEqual(submissionIssues(completeInput(), { ...written, marks: 60 }, null), []);
    assert.ok(submissionIssues(completeInput(), { ...written, marks: 59 }, null).some(issue => issue.includes('below')));
    assert.ok(submissionIssues(completeInput(), { ...written, isFinal: false }, null).some(issue => issue.includes('verified')));
    assert.equal(draftTotals(completeInput(), { ...written, isFinal: false }).total, null);
  });

  it('records absence without requiring invented marks or producing a merit total', () => {
    const draft = makeAssessmentDraft(null, panel); draft.attendance = 'ABSENT';
    const body = assessmentPayload(draft, null, panel);
    assert.deepEqual(submissionIssues(body, { ...written, isFinal: false }, null), []);
    assert.equal(draftTotals(body, written).total, null);
  });

  it('requires a reason even when the latest correction is a draft after a prior submission', () => {
    const saved = { ...savedAssessment(), status: 'DRAFT' as const };
    assert.ok(submissionIssues(completeInput(), written, saved, true).some(issue => issue.includes('reason')));
    assert.deepEqual(submissionIssues({ ...completeInput(), reason: 'Reviewed the original panel sheet' }, written, saved, true), []);
  });

  it('rejects nonfinite, negative, over-cap and overprecision values', () => {
    for (const value of ['NaN', 'Infinity', '-1', '20.01', '1.001']) assert.throws(() => optionalScore(value, 20, 'Interview'));
    assert.equal(optionalScore('20', 20, 'Interview'), 20);
    assert.equal(optionalScore('19.99', 20, 'Interview'), 19.99);
  });

  it('exports literal student text instead of executable spreadsheet formulas', () => {
    assert.equal(safeCsvCell('=HYPERLINK("bad")'), '"\'=HYPERLINK(""bad"")"');
    assert.equal(safeCsvCell('\t+formula'), '"\'\t+formula"');
    assert.equal(safeCsvCell('A, "B"'), '"A, ""B"""');
    assert.equal(safeCsvCell(null), '""');
    assert.equal(safeCsvCell(81.75), '"81.75"');
  });
});
