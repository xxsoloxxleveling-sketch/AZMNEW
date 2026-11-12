/** Server-only deterministic grading. This module never saves or publishes a result. */
export type OmrOption = 'A' | 'B' | 'C' | 'D';
export type OmrResponse = OmrOption | 'BLANK' | 'MULTIPLE' | 'UNCERTAIN';
export interface GradingContext { examId: string; candidateGroup: string; paperVersion: OmrOption }
export interface ApprovedKey extends GradingContext {
  id: string; revision: number; status: 'DRAFT' | 'APPROVED'; answers: readonly OmrOption[];
}
export interface GradingPolicy {
  questionCount: number; correctMarks: number; incorrectPenalty: number; minimumScore?: number;
}
const options = new Set<string>(['A', 'B', 'C', 'D']);
const classifications = new Set<string>([...options, 'BLANK', 'MULTIPLE', 'UNCERTAIN']);
const scale = 10_000;
function units(value: number): number {
  const result = Math.round(value * scale);
  if (!Number.isFinite(value) || !Number.isSafeInteger(result) || Math.abs(result / scale - value) > 1e-9) {
    throw new Error('Marks must be finite with at most four decimal places');
  }
  return result;
}
export function scoreOmr(
  responses: readonly OmrResponse[], key: ApprovedKey | null,
  policy: GradingPolicy, context: GradingContext,
) {
  if (!key || key.status !== 'APPROVED' || !key.id || !Number.isInteger(key.revision) || key.revision < 1) {
    throw new Error('An approved answer-key revision is required');
  }
  if (key.examId !== context.examId || key.candidateGroup !== context.candidateGroup || key.paperVersion !== context.paperVersion) {
    throw new Error('Answer key does not match examination, candidate group and paper version');
  }
  if (!Number.isInteger(policy.questionCount) || policy.questionCount < 1 || policy.questionCount > 100 ||
      responses.length !== policy.questionCount || key.answers.length !== policy.questionCount ||
      key.answers.some(answer => !options.has(answer)) || responses.some(answer => !classifications.has(answer))) {
    throw new Error('Incomplete or invalid response/answer sequence');
  }
  const correctUnits = units(policy.correctMarks);
  const penaltyUnits = units(policy.incorrectPenalty);
  if (correctUnits <= 0 || penaltyUnits < 0) throw new Error('Invalid marking policy');
  const maximumUnits = policy.questionCount * correctUnits;
  if (!Number.isSafeInteger(maximumUnits) || !Number.isSafeInteger(policy.questionCount * penaltyUnits)) {
    throw new Error('Marking policy exceeds safe arithmetic limits');
  }
  const counts = { correct: 0, incorrect: 0, blank: 0, multiple: 0, uncertain: 0 };
  const questions = responses.map((answer, index) => {
    let marks = 0;
    if (answer === 'BLANK') counts.blank++;
    else if (answer === 'MULTIPLE') counts.multiple++;
    else if (answer === 'UNCERTAIN') counts.uncertain++;
    else if (answer === key.answers[index]) { counts.correct++; marks = correctUnits; }
    else { counts.incorrect++; marks = -penaltyUnits; }
    return { question: index + 1, response: answer, marks: marks / scale };
  });
  const rawUnits = counts.correct * correctUnits - counts.incorrect * penaltyUnits;
  const minimumUnits = policy.minimumScore === undefined ? undefined : units(policy.minimumScore);
  if (minimumUnits !== undefined && minimumUnits > maximumUnits) throw new Error('Minimum score exceeds maximum');
  const adjustedUnits = minimumUnits === undefined ? rawUnits : Math.max(minimumUnits, rawUnits);
  return {
    totalQuestions: policy.questionCount, ...counts, rawScore: rawUnits / scale,
    adjustedScore: adjustedUnits / scale, maximumScore: maximumUnits / scale,
    percentage: Math.round(adjustedUnits / maximumUnits * 1_000_000) / 10_000,
    paperVersion: context.paperVersion, answerKeyRevision: key.revision, answerKeyId: key.id,
    reviewRequired: counts.multiple > 0 || counts.uncertain > 0,
    questions,
  };
}
