import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { canAssignCandidates, clampPage, formatEligibility, getInterviewLoadState } from './interviewViewModel.ts';

describe('interview dashboard view model', () => {
  it('represents loading, permission, error, empty and ready states', () => {
    assert.equal(getInterviewLoadState({ loading: true, unauthorized: false, error: null, hasRounds: false }), 'loading');
    assert.equal(getInterviewLoadState({ loading: false, unauthorized: true, error: null, hasRounds: true }), 'unauthorized');
    assert.equal(getInterviewLoadState({ loading: false, unauthorized: false, error: 'offline', hasRounds: false }), 'error');
    assert.equal(getInterviewLoadState({ loading: false, unauthorized: false, error: null, hasRounds: false }), 'empty');
    assert.equal(getInterviewLoadState({ loading: false, unauthorized: false, error: null, hasRounds: true }), 'ready');
  });

  it('does not allow assignment unless the source, round, hall, role and capacity are valid', () => {
    const base = { isAdmin: true, sourceVerified: true, roundOpen: true, hallActive: true, seatsAvailable: 1 };
    assert.equal(canAssignCandidates(base), true);
    assert.equal(canAssignCandidates({ ...base, sourceVerified: false }), false);
    assert.equal(canAssignCandidates({ ...base, roundOpen: false }), false);
    assert.equal(canAssignCandidates({ ...base, hallActive: false }), false);
    assert.equal(canAssignCandidates({ ...base, seatsAvailable: 0 }), false);
    assert.equal(canAssignCandidates({ ...base, isAdmin: false }), false);
  });

  it('clamps a stale page after a filter reduces the number of pages', () => {
    assert.equal(clampPage(4, 2), 2);
    assert.equal(clampPage(2, 0), 1);
    assert.equal(clampPage(0, 4), 1);
  });

  it('uses explicit review labels for result states', () => {
    assert.equal(formatEligibility('QUALIFIED'), 'Eligible');
    assert.equal(formatEligibility('NOT_QUALIFIED'), 'Below threshold');
    assert.equal(formatEligibility('EXCLUDED_PENDING_REVIEW'), 'Withheld for review');
    assert.equal(formatEligibility('PENDING_VERIFICATION'), 'Pending verification');
  });
});
