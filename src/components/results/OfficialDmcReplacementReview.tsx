import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Eye, FileLock2, Loader2, RotateCcw, X } from 'lucide-react';
import {
  prepareOfficialDmc,
  previewPreparedOfficialDmc,
  replaceLegacyOfficialDmc,
} from './ResultsApi';
import type { OfficialDocumentIssuance, OfficialResultDetail } from './ResultsApi';

interface Props {
  result: OfficialResultDetail;
  original: OfficialDocumentIssuance;
  onCancel: () => void;
  onCompleted: () => Promise<void> | void;
}

interface PreparedReview {
  url: string;
  preparationId: string;
  idempotencyKey: string;
  expiresAt: string;
  evidence: string;
  reason: string;
  attemptSessionId: string;
  expectedRevision: number;
}

const secondaryButton = 'inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50';
const fieldClass = 'mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-200';

export function canReviewLegacyDmc(result: OfficialResultDetail, original: OfficialDocumentIssuance) {
  return !!result.attempt
    && result.documents.electronicAvailable
    && original.status === 'ATTEMPT_UNVERIFIED'
    && !original.replacementIssuanceId;
}

function newIdempotencyKey() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function OfficialDmcReplacementReview({ result, original, onCancel, onCompleted }: Props) {
  const [evidence, setEvidence] = useState('');
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [prepared, setPrepared] = useState<PreparedReview | null>(null);
  const [busy, setBusy] = useState<'preparing' | 'replacing' | ''>('');
  const [error, setError] = useState('');

  // A private PDF preview is never left in browser memory after this review closes.
  useEffect(() => () => {
    if (prepared?.url) URL.revokeObjectURL(prepared.url);
  }, [prepared?.url]);

  const eligible = canReviewLegacyDmc(result, original);
  const formReady = eligible && evidence.trim().length >= 24 && reason.trim().length >= 12 && confirmed;

  const previewReplacement = async () => {
    if (!formReady || busy || !result.attempt) return;
    setBusy('preparing');
    setError('');
    try {
      const preparation = await prepareOfficialDmc(result.id, result.resultRevision);
      const url = await previewPreparedOfficialDmc(result.id, preparation.preparationId);
      setPrepared({
        url,
        preparationId: preparation.preparationId,
        idempotencyKey: newIdempotencyKey(),
        expiresAt: preparation.expiresAt,
        evidence: evidence.trim(),
        reason: reason.trim(),
        attemptSessionId: result.attempt.id,
        expectedRevision: result.resultRevision,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not prepare the replacement preview.');
    } finally {
      setBusy('');
    }
  };

  const confirmReplacement = async () => {
    if (!prepared || busy || !eligible || !result.attempt
      || result.attempt.id !== prepared.attemptSessionId
      || result.resultRevision !== prepared.expectedRevision) return;
    setBusy('replacing');
    setError('');
    try {
      await replaceLegacyOfficialDmc(result.id, original.id, {
        preparationId: prepared.preparationId,
        expectedRevision: prepared.expectedRevision,
        idempotencyKey: prepared.idempotencyKey,
        attemptSessionId: prepared.attemptSessionId,
        evidence: prepared.evidence,
        reason: prepared.reason,
        confirmed: true,
      });
      await onCompleted();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The legacy DMC could not be replaced.');
    } finally {
      setBusy('');
    }
  };

  const discardPreview = () => {
    if (busy) return;
    setPrepared(null);
    setConfirmed(false);
    setError('');
  };

  return (
    <section aria-label="Review legacy Official DMC replacement" className="mt-3 rounded-lg border border-amber-300 bg-amber-50/50 p-4 text-sm">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-amber-800">Super Admin review · Legacy DMC</p>
          <h4 className="mt-1 text-sm font-bold text-slate-900">Replace an unverified historical certificate</h4>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-700">
            Review the original document and independent examination evidence. The old certificate and its audit history
            are retained; confirmation marks it superseded and issues a new, separately verifiable certificate.
          </p>
        </div>
        <button type="button" aria-label="Close legacy DMC review" onClick={onCancel} disabled={!!busy}
          className={secondaryButton}><X size={14} /> Close</button>
      </header>

      <dl className="mt-4 grid gap-3 rounded-md border border-slate-200 bg-white p-3 text-xs sm:grid-cols-2">
        <div><dt className="font-medium text-slate-500">Original certificate</dt><dd className="mt-1 break-words font-semibold text-slate-900">{original.documentNumber}</dd></div>
        <div><dt className="font-medium text-slate-500">Original issuer / date</dt><dd className="mt-1 text-slate-900">{original.issuer} · {new Date(original.issuedAt).toLocaleString()}</dd></div>
        <div><dt className="font-medium text-slate-500">Original verification reference</dt><dd className="mt-1 break-all font-mono text-slate-900">{original.verificationReference}</dd></div>
        <div><dt className="font-medium text-slate-500">Verified examination attempt</dt><dd className="mt-1 text-slate-900">
          {result.attempt ? `#${result.attempt.attemptNumber} · ${result.attempt.businessDate} · ${result.attempt.state.toLowerCase()}` : 'Not verified'}
        </dd></div>
      </dl>

      {!eligible && <p role="alert" className="mt-3 flex items-start gap-2 rounded-md border border-amber-300 bg-white p-3 text-xs text-amber-950">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
        Replacement requires a currently unverified legacy issuance, an explicitly bound examination attempt,
        and a verified published result eligible for an Official DMC.
      </p>}

      {!prepared ? (
        <div className="mt-4 space-y-3">
          <label className="block text-xs font-semibold text-slate-800">
            Evidence establishing the original examination and attempt
            <textarea rows={3} minLength={24} maxLength={1000} required className={fieldClass}
              disabled={!eligible || !!busy} value={evidence} onChange={(event) => setEvidence(event.target.value)}
              placeholder="Identify the signed attendance sheet, examination register, original certificate, dates and matching candidate reference." />
            <span className="mt-1 block text-[11px] font-normal text-slate-600">At least 24 characters. A roster match alone is insufficient; cite independently reviewed records.</span>
          </label>
          <label className="block text-xs font-semibold text-slate-800">
            Reason for superseding the original certificate
            <textarea rows={2} minLength={12} maxLength={1000} required className={fieldClass}
              disabled={!eligible || !!busy} value={reason} onChange={(event) => setReason(event.target.value)}
              placeholder="Explain why this specific historical certificate needs an officially reviewed replacement." />
            <span className="mt-1 block text-[11px] font-normal text-slate-600">At least 12 characters. The reason becomes part of the append-only issuance history.</span>
          </label>
          <label className="flex items-start gap-2 text-xs font-medium leading-5 text-slate-800">
            <input className="mt-1" type="checkbox" disabled={!eligible || !!busy} checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)} />
            I inspected the original certificate, matching examination documents, the correct student,
            and the verified attempt shown above. I understand that this review is permanent.
          </label>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" disabled={!!busy} onClick={onCancel} className={secondaryButton}>Cancel review</button>
            <button type="button" disabled={!formReady || !!busy} onClick={() => void previewReplacement()}
              className="inline-flex items-center gap-2 rounded-md bg-[#185b9d] px-3 py-2 text-xs font-semibold text-white hover:bg-[#12477d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:opacity-50">
              {busy === 'preparing' ? <Loader2 size={15} className="animate-spin" /> : <Eye size={15} />}
              Preview replacement
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-3" aria-label="Final replacement confirmation">
          <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-white p-3 text-xs leading-5 text-slate-800">
            <FileLock2 size={17} className="mt-0.5 shrink-0 text-[#185b9d]" />
            <div>
              <p className="font-bold">Read the complete replacement PDF before confirming.</p>
              <p className="mt-1">Original: {original.documentNumber} · Verified attempt: {result.attempt?.attemptNumber} · Result revision: {prepared.expectedRevision}</p>
              <p className="mt-1">Reason: {prepared.reason}</p>
              <p className="mt-1">Evidence: {prepared.evidence}</p>
              <p className="mt-1 text-slate-600">Preview expires {new Date(prepared.expiresAt).toLocaleString()}. The server checks eligibility again at confirmation.</p>
            </div>
          </div>
          <iframe title="Private preview of replacement Official DMC" src={prepared.url}
            className="h-[440px] w-full rounded-md border border-slate-200 bg-slate-100 sm:h-[580px]" />
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" disabled={!!busy} onClick={discardPreview} className={secondaryButton}>
              <RotateCcw size={14} /> Revise evidence
            </button>
            <button type="button" disabled={!!busy} onClick={() => void confirmReplacement()}
              className="inline-flex items-center gap-2 rounded-md bg-[#185b9d] px-3 py-2 text-xs font-bold text-white hover:bg-[#12477d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:opacity-50">
              {busy === 'replacing' ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
              {busy === 'replacing' ? 'Replacing…' : 'Confirm and supersede original DMC'}
            </button>
          </div>
        </div>
      )}
      {error && <p role="alert" className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-900">{error}</p>}
    </section>
  );
}
