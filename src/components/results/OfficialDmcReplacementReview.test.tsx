import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { canReviewLegacyDmc, OfficialDmcReplacementReview } from './OfficialDmcReplacementReview';
import type { OfficialDocumentIssuance, OfficialResultDetail } from './ResultsApi';

const result = {
  id: 'synthetic-result-01',
  resultRevision: 2,
  documents: { electronicAvailable: true },
  attempt: { id: 'synthetic-attempt-01', attemptNumber: 2, businessDate: '2026-11-14', state: 'CURRENT' },
} as unknown as OfficialResultDetail;
const original = {
  id: 'synthetic-legacy-01',
  documentNumber: 'AZM-DMC-LEGACY-01',
  issuedAt: '2026-11-14T01:00:00.000Z',
  issuer: 'Synthetic Administrator',
  verificationReference: 'synthetic-reference-01',
  status: 'ATTEMPT_UNVERIFIED',
  replacementIssuanceId: null,
  replacesLegacyIssuanceId: null,
} as OfficialDocumentIssuance;

test('replacement review requires a verified attempt, eligible result and active unbound legacy DMC', () => {
  assert.equal(canReviewLegacyDmc(result, original), true);
  assert.equal(canReviewLegacyDmc({ ...result, attempt: null }, original), false);
  assert.equal(canReviewLegacyDmc({ ...result, documents: { ...result.documents, electronicAvailable: false } }, original), false);
  for (const status of ['ISSUED', 'SUPERSEDED', 'REVOKED'] as const) {
    assert.equal(canReviewLegacyDmc(result, { ...original, status }), false);
  }
  assert.equal(canReviewLegacyDmc(result, { ...original, replacementIssuanceId: 'already-replaced' }), false);
});

test('Super Admin review renders original identity, confirmed attempt, evidence, reason and two-step preview', () => {
  const html = renderToStaticMarkup(createElement(OfficialDmcReplacementReview, {
    result, original, onCancel() {}, onCompleted() {},
  }));
  assert.match(html, /AZM-DMC-LEGACY-01/);
  assert.match(html, /synthetic-reference-01/);
  assert.match(html, /#2/);
  assert.match(html, /Evidence establishing the original examination and attempt/);
  assert.match(html, /Reason for superseding the original certificate/);
  assert.match(html, /Preview replacement/);
  assert.match(html, /disabled/);
  assert.doesNotMatch(html, /Confirm and supersede original DMC/, 'commit must require a successful preview');
});

test('frontend replacement API and result panel expose guarded old-to-new linkage', () => {
  const api = readFileSync(new URL('./ResultsApi.ts', import.meta.url), 'utf8');
  const panel = readFileSync(new URL('./OfficialResultDetailPanel.tsx', import.meta.url), 'utf8');
  assert.match(api, /export function replaceLegacyOfficialDmc\(/);
  assert.match(api, /dmc\/official\/\$\{encodeURIComponent\(originalIssuanceId\)\}\/replace/);
  assert.match(api, /confirmed: true/);
  assert.match(panel, /canEdit && issuance\.status === 'ATTEMPT_UNVERIFIED'/);
  assert.match(panel, /Review replacement/);
  assert.match(panel, /\!\!activeLegacyDocument/);
  assert.match(panel, /replacementIssuanceId/);
});
