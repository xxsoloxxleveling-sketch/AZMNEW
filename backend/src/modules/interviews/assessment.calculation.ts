import { Prisma } from '@prisma/client';
import { AssessmentInput, AssessmentTotals, WrittenMarkDto } from './assessment.schema';

type ScoringInput = Pick<AssessmentInput, 'attendance' | 'scores' | 'extracurricular' | 'academic'>;
const rounded = (value: Prisma.Decimal) => value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toNumber();
function sumScores(input: ScoringInput, field: 'interview' | 'personality'): Prisma.Decimal | null {
  if (input.scores.length !== 3 || input.scores.some(card => card[field] === null)) return null;
  return input.scores.reduce((sum, card) => sum.add(card[field]!), new Prisma.Decimal(0));
}

/** A common-denominator numerator permits exact ranking without rounding repeating thirds. */
export function exactMeritNumerator(input: ScoringInput, written: WrittenMarkDto): Prisma.Decimal | null {
  const interview = sumScores(input, 'interview'), personality = sumScores(input, 'personality');
  if (input.attendance !== 'PRESENT' || !written.isFinal || written.status !== 'QUALIFIED'
    || written.marks === null || written.maximumMarks !== 100 || interview === null || personality === null
    || input.extracurricular === null || input.academic === null) return null;
  return new Prisma.Decimal(written.marks).mul('0.6').mul(3)
    .add(interview).add(personality).add(new Prisma.Decimal(input.extracurricular).add(input.academic).mul(3));
}

export function calculateAssessmentTotals(input: ScoringInput, written: WrittenMarkDto): AssessmentTotals {
  const present = input.attendance === 'PRESENT';
  const interview = present ? sumScores(input, 'interview') : null;
  const personality = present ? sumScores(input, 'personality') : null;
  const total = exactMeritNumerator(input, written);
  return {
    written: written.isFinal && written.marks !== null ? rounded(new Prisma.Decimal(written.marks).mul('0.6')) : null,
    interview: interview === null ? null : rounded(interview.div(3)),
    extracurricular: present ? input.extracurricular : null,
    personality: personality === null ? null : rounded(personality.div(3)),
    academic: present ? input.academic : null,
    total: total === null ? null : rounded(total.div(3)),
  };
}

export function assessmentCompletionIssues(input: AssessmentInput, written: WrittenMarkDto): string[] {
  if (input.attendance === 'ABSENT') return [];
  const issues: string[] = [];
  if (input.attendance !== 'PRESENT') issues.push('Record interview attendance.');
  if (input.scores.some(card => card.interview === null)) issues.push('Enter the interview mark for all three members.');
  if (input.scores.some(card => card.personality === null)) issues.push('Enter the personality mark for all three members.');
  if (input.extracurricular === null) issues.push('Enter extracurricular marks out of 10.');
  if (!input.extracurricularReviewed || input.extracurricularEvidence.trim().length < 3) issues.push('Review extracurricular evidence and record its reference.');
  if (input.academic === null) issues.push('Enter previous academic marks out of 5.');
  if (!input.academicReviewed || input.academicEvidence.trim().length < 3) issues.push('Review academic evidence and record its reference.');
  if (!written.isFinal) issues.push('The existing written examination mark needs final verification.');
  else if (written.status !== 'QUALIFIED') issues.push('The final written mark must meet the 60/100 interview threshold.');
  return issues;
}

export function sameWrittenRevision(left: WrittenMarkDto, right: WrittenMarkDto): boolean {
  return left.isFinal === right.isFinal && left.status === right.status && left.sourceType === right.sourceType
    && left.reference === right.reference && left.revision === right.revision
    && left.marks === right.marks && left.maximumMarks === right.maximumMarks;
}

/** Competition ranking (1,1,3), independently per class; names/IDs only stabilize display order. */
export function rankWithinClasses<T extends { className: string; studentName: string; placementId: string }>(
  rows: Array<{ row: T; numerator: Prisma.Decimal }>,
): Array<T & { rank: number }> {
  const sorted = [...rows].sort((a, b) => a.row.className.localeCompare(b.row.className)
    || b.numerator.comparedTo(a.numerator) || a.row.studentName.localeCompare(b.row.studentName)
    || a.row.placementId.localeCompare(b.row.placementId));
  let currentClass = '', index = 0, rank = 0, previous: Prisma.Decimal | null = null;
  return sorted.map(({ row, numerator }) => {
    if (row.className !== currentClass) { currentClass = row.className; index = 0; previous = null; }
    index += 1;
    if (previous === null || !numerator.equals(previous)) rank = index;
    previous = numerator;
    return { ...row, rank };
  });
}
