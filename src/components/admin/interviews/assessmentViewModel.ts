import type { AssessmentAttendance, AssessmentPanel, AssessmentTotals, CandidateAssessment, MemberScore, SaveAssessmentInput, WrittenMarkSource } from './assessmentApi';

export type AssessmentDraft = {
  attendance: AssessmentAttendance;
  scores: Array<{ memberId: string; interview: string; personality: string }>;
  extracurricular: string;
  extracurricularEvidence: string;
  extracurricularReviewed: boolean;
  academic: string;
  academicEvidence: string;
  academicReviewed: boolean;
  notes: string;
  reason: string;
};

const inputValue = (value: number | null | undefined) => value === null || value === undefined ? '' : String(value);

export function makeAssessmentDraft(assessment: CandidateAssessment | null, panel: AssessmentPanel | null): AssessmentDraft {
  const currentMembers = panel?.members ?? [];
  const samePanel = assessment?.panelRevision === panel?.revision;
  return {
    attendance: assessment?.attendance ?? 'UNKNOWN',
    scores: currentMembers.map(member => {
      const previous = samePanel ? assessment?.scores.find(score => score.memberId === member.id) : undefined;
      return { memberId: member.id, interview: inputValue(previous?.interview), personality: inputValue(previous?.personality) };
    }),
    extracurricular: inputValue(assessment?.extracurricular),
    extracurricularEvidence: assessment?.extracurricularEvidence ?? '',
    extracurricularReviewed: assessment?.extracurricularReviewed ?? false,
    academic: inputValue(assessment?.academic),
    academicEvidence: assessment?.academicEvidence ?? '',
    academicReviewed: assessment?.academicReviewed ?? false,
    notes: assessment?.notes ?? '',
    reason: '',
  };
}

export function optionalScore(value: string, maximum: number, label: string): number | null {
  if (!value.trim()) return null;
  const score = Number(value);
  if (!Number.isFinite(score) || score < 0 || score > maximum || Math.abs(score * 100 - Math.round(score * 100)) > 1e-7) {
    throw new Error(label + ' must be between 0 and ' + maximum + ', with at most two decimal places.');
  }
  return score;
}

export function assessmentPayload(draft: AssessmentDraft, assessment: CandidateAssessment | null, panel: AssessmentPanel): SaveAssessmentInput {
  return {
    expectedRevision: assessment?.revision ?? 0,
    panelRevision: panel.revision,
    attendance: draft.attendance,
    scores: draft.scores.map((score, index) => ({
      memberId: score.memberId,
      interview: optionalScore(score.interview, 20, 'Member ' + (index + 1) + ' interview'),
      personality: optionalScore(score.personality, 5, 'Member ' + (index + 1) + ' personality'),
    })),
    extracurricular: optionalScore(draft.extracurricular, 10, 'Extracurricular score'),
    extracurricularEvidence: draft.extracurricularEvidence.trim(),
    extracurricularReviewed: draft.extracurricularReviewed,
    academic: optionalScore(draft.academic, 5, 'Academic score'),
    academicEvidence: draft.academicEvidence.trim(),
    academicReviewed: draft.academicReviewed,
    notes: draft.notes.trim(),
    ...(draft.reason.trim() ? { reason: draft.reason.trim() } : {}),
  };
}

export function submissionIssues(body: SaveAssessmentInput, written: WrittenMarkSource, assessment: CandidateAssessment | null, hasSubmittedAssessment = false): string[] {
  const issues: string[] = [];
  if ((hasSubmittedAssessment || assessment?.status === 'SUBMITTED') && (body.reason?.length ?? 0) < 3) issues.push('Enter a reason for correcting the submitted assessment.');
  if (body.attendance === 'UNKNOWN') issues.push('Record whether the candidate attended.');
  if (body.attendance === 'ABSENT') return issues;
  if (body.scores.length !== 3 || new Set(body.scores.map(score => score.memberId)).size !== 3 ||
    body.scores.some(score => score.interview === null || score.personality === null)) {
    issues.push('Enter interview and personality marks for all three panel members.');
  }
  if (body.extracurricular === null || !body.extracurricularReviewed || !body.extracurricularEvidence) {
    issues.push('Record and review the extracurricular score and its evidence reference.');
  }
  if (body.academic === null || !body.academicReviewed || !body.academicEvidence) {
    issues.push('Record and review the previous academic score and its evidence reference.');
  }
  if (!written.isFinal || written.marks === null) issues.push('The written mark must be final and verified.');
  else if (written.marks < 60) issues.push('The final written mark is below the 60-mark interview threshold.');
  return issues;
}

function mean(scores: MemberScore[], key: 'interview' | 'personality'): number | null {
  if (scores.length !== 3 || new Set(scores.map(score => score.memberId)).size !== 3 || scores.some(score => score[key] === null)) return null;
  return scores.reduce((sum, score) => sum + (score[key] as number), 0) / 3;
}

// This is an explicitly unsaved preview. Persisted totals and ranking always come from the server.
export function draftTotals(body: SaveAssessmentInput, written: WrittenMarkSource): AssessmentTotals {
  const writtenPoints = written.isFinal && written.marks !== null && written.maximumMarks > 0
    ? written.marks / written.maximumMarks * 60 : null;
  const interview = mean(body.scores, 'interview');
  const personality = mean(body.scores, 'personality');
  const components = [writtenPoints, interview, body.extracurricular, body.academic, personality];
  const total = body.attendance === 'PRESENT' && components.every(value => value !== null)
    ? components.reduce<number>((sum, value) => sum + (value as number), 0) : null;
  return { written: writtenPoints, interview, extracurricular: body.extracurricular, academic: body.academic, personality, total };
}

export function formatAssessmentScore(value: number | null | undefined): string {
  return value === null || value === undefined || !Number.isFinite(value) ? '—' : value.toFixed(2);
}

export function safeCsvCell(value: string | number | null | undefined): string {
  let text = value === null || value === undefined ? '' : String(value);
  if (typeof value !== 'number' && /^[\s]*[=+@-]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
