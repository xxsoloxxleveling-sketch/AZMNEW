import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import { assessmentPanelSchema, assessmentSaveSchema, AssessmentInput, WrittenMarkDto } from '../src/modules/interviews/assessment.schema.ts';
import { assessmentCompletionIssues, calculateAssessmentTotals, exactMeritNumerator, rankWithinClasses, sameWrittenRevision } from '../src/modules/interviews/assessment.calculation.ts';

const written: WrittenMarkDto = { marks: 100, maximumMarks: 100, isFinal: true, sourceType: 'VERIFIED_MANUAL', reference: 'manual:s1', revision: 'c1:v1', status: 'QUALIFIED' };
function input(): AssessmentInput {
  return {
    expectedRevision: 0, panelRevision: 1, idempotencyKey: 'synthetic-save-1', attendance: 'PRESENT',
    scores: ['m1', 'm2', 'm3'].map(memberId => ({ memberId, interview: 20, personality: 5 })),
    extracurricular: 10, extracurricularEvidence: 'Reviewed activity certificate', extracurricularReviewed: true,
    academic: 5, academicEvidence: 'Reviewed previous academic DMC', academicReviewed: true,
    notes: '', reason: '',
  };
}

describe('Interview assessment policy and precision', () => {
  it('averages the three members once and applies the exact five component weights', () => {
    const draft = input();
    draft.scores[1] = { memberId: 'm2', interview: 19, personality: 4 };
    draft.scores[2] = { memberId: 'm3', interview: 18, personality: 3 };
    assert.deepEqual(calculateAssessmentTotals(draft, written), { written: 60, interview: 19, extracurricular: 10, personality: 4, academic: 5, total: 98 });
    assert.equal(calculateAssessmentTotals(input(), written).total, 100);
    assert.equal(calculateAssessmentTotals(input(), { ...written, marks: 60 }).total, 76);
  });

  it('keeps missing values pending while accepting deliberate zero marks', () => {
    const draft = input();
    draft.scores[0].interview = null;
    assert.equal(calculateAssessmentTotals(draft, written).interview, null);
    assert.equal(calculateAssessmentTotals(draft, written).total, null);
    assert.ok(assessmentCompletionIssues(draft, written).some(issue => issue.includes('all three')));
    draft.scores[0].interview = 0;
    assert.equal(assessmentCompletionIssues(draft, written).length, 0);
    assert.equal(calculateAssessmentTotals(draft, written).interview, 13.33);
  });

  it('does not rank absentees or unverified/below-threshold marks', () => {
    assert.equal(exactMeritNumerator({ ...input(), attendance: 'ABSENT' }, written), null);
    assert.equal(exactMeritNumerator(input(), { ...written, isFinal: false }), null);
    assert.equal(exactMeritNumerator(input(), { ...written, marks: 59, status: 'NOT_QUALIFIED' }), null);
    assert.equal(calculateAssessmentTotals(input(), { ...written, isFinal: false }).written, null);
  });

  it('requires reviewed evidence even when the awarded component is zero', () => {
    const draft = { ...input(), extracurricular: 0, extracurricularReviewed: false, extracurricularEvidence: '' };
    assert.ok(assessmentCompletionIssues(draft, written).some(issue => issue.includes('extracurricular evidence')));
  });

  it('rejects duplicate member identities, excessive precision, non-finite and out-of-range marks', () => {
    assert.equal(assessmentSaveSchema.safeParse(input()).success, true);
    for (const value of [-1, 20.01, 1.001, Infinity, NaN]) {
      const draft = input(); draft.scores[0].interview = value;
      assert.equal(assessmentSaveSchema.safeParse(draft).success, false);
    }
    const duplicate = input(); duplicate.scores[1].memberId = 'm1';
    assert.equal(assessmentSaveSchema.safeParse(duplicate).success, false);
    assert.equal(assessmentPanelSchema.safeParse({ expectedRevision: 0, members: [{ name: 'Ali Khan' }, { name: ' ali   khan ' }, { name: 'Sara Ahmed' }], reason: 'Initial panel' }).success, false);
  });

  it('uses shared competition ranks per class without rounded-total ties', () => {
    const row = (id: string, className: string, value: string) => ({ row: { placementId: id, studentName: id, className }, numerator: new Prisma.Decimal(value) });
    const ranked = rankWithinClasses([row('B', 'Class 6', '258'), row('A', 'Class 6', '258.01'), row('C', 'Class 6', '258.01'), row('D', 'Class 7', '150')]);
    assert.deepEqual(ranked.map(x => [x.placementId, x.rank]), [['A', 1], ['C', 1], ['B', 3], ['D', 1]]);
    assert.equal(new Prisma.Decimal('258.01').div(3).toFixed(2), new Prisma.Decimal('258').div(3).toFixed(2));
  });

  it('detects reverification and correction fingerprint changes, not just numerical changes', () => {
    assert.equal(sameWrittenRevision(written, { ...written }), true);
    assert.equal(sameWrittenRevision(written, { ...written, revision: 'c1:v2' }), false);
    assert.equal(sameWrittenRevision(written, { ...written, marks: 99 }), false);
  });
});
