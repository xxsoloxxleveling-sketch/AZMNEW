export type InterviewLoadState = 'loading' | 'unauthorized' | 'error' | 'empty' | 'ready';

export function getInterviewLoadState(input: {
  loading: boolean;
  unauthorized: boolean;
  error: string | null;
  hasRounds: boolean;
}): InterviewLoadState {
  if (input.loading) return 'loading';
  if (input.unauthorized) return 'unauthorized';
  if (input.error) return 'error';
  return input.hasRounds ? 'ready' : 'empty';
}

export function clampPage(page: number, totalPages: number): number {
  if (!Number.isFinite(page) || totalPages < 1) return 1;
  return Math.max(1, Math.min(Math.floor(page), totalPages));
}

export function canAssignCandidates(input: {
  isAdmin: boolean;
  sourceVerified: boolean;
  roundOpen: boolean;
  hallActive: boolean;
  seatsAvailable: number;
}): boolean {
  return input.isAdmin && input.sourceVerified && input.roundOpen && input.hallActive && input.seatsAvailable > 0;
}

export function formatEligibility(status: string): string {
  switch (status) {
    case 'QUALIFIED': return 'Eligible';
    case 'NOT_QUALIFIED': return 'Below threshold';
    case 'EXCLUDED_PENDING_REVIEW': return 'Withheld for review';
    default: return 'Pending verification';
  }
}
