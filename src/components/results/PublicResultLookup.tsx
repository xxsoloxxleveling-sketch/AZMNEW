import { useState } from 'react';
import type { FormEvent } from 'react';
import { AlertCircle, ArrowLeft, FileCheck2, LoaderCircle, LockKeyhole, Printer, Search } from 'lucide-react';
import { EdmcCertificate } from './EdmcCertificate';
import type { PublicEdmcRecord } from './EdmcCertificate';
import './ResultsStyles.css';

type LookupState = 'idle' | 'loading' | 'not-found' | 'closed' | 'limited' | 'error' | 'success';

/** Public score-only response for marks that are not yet verified.
 * CNIC alone never exposes photo, father, school or original scan evidence.
 */
interface CurrentOmrRecord {
  status: 'REVIEW_REQUIRED';
  source?: 'MANUAL_ENTRY';
  session: string;
  obtainedMarks: number;
  maximumMarks: number;
  percentage: number;
  resultStatus: 'PASS' | 'FAIL';
  passThreshold: number;
  publishedAt: string;
  notice: string;
}
type PublicResultRecord = PublicEdmcRecord | CurrentOmrRecord;

export function PublicResultLookup() {
  const [cnic, setCnic] = useState('');
  const [state, setState] = useState<LookupState>('idle');
  const [record, setRecord] = useState<PublicResultRecord | null>(null);

  const reset = () => { setState('idle'); setRecord(null); };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === 'loading') return;
    setState('loading');
    setRecord(null);
    try {
      const response = await fetch('/api/students/public/omr-marks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        cache: 'no-store',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        body: JSON.stringify({ cnic: cnic.trim() }),
      });
      if (response.status === 503) { setState('closed'); return; }
      if (response.status === 429) { setState('limited'); return; }
      if (!response.ok) { setState('error'); return; }
      const body = await response.json() as { success?: boolean; found?: boolean; data?: PublicResultRecord };
      if (!body.success || !body.found || !body.data) { setState('not-found'); return; }
      setRecord(body.data);
      setState('success');
    } catch {
      setState('error');
    }
  }

  return (
    <main className="results-public-page mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="no-print mx-auto max-w-3xl">
        <div className="flex items-center gap-2 text-xs font-bold tracking-[.14em] text-[#18723e] uppercase">
          <FileCheck2 size={17} aria-hidden="true" /> AZM.AIO · Scholarship Examination
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#0c355a] sm:text-4xl">
          View your examination marks
        </h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          Enter your registered CNIC / B-Form to see your current obtained marks. An E-DMC is available once your examination record has been verified. The Official / Original DMC will be issued separately by the Regional Office.
        </p>
        <form onSubmit={submit} className="mt-7 grid gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-[1fr_auto] sm:items-end sm:p-6">
          <label className="grid gap-1.5 text-xs font-bold text-slate-700">
            Registered CNIC / B-Form
            <input required maxLength={15} inputMode="numeric" autoComplete="off" value={cnic}
              pattern="(?:[0-9]{13}|[0-9]{5}-[0-9]{7}-[0-9])"
              onChange={e => { setCnic(e.target.value); reset(); }} placeholder="13 digits or with hyphens"
              className="h-11 min-w-0 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 focus:border-[#185b9d] focus:outline-none focus:ring-2 focus:ring-blue-100" />
          </label>
          <button type="submit" disabled={state === 'loading'} className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#0c355a] px-5 text-sm font-bold text-white transition hover:bg-[#174f80] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#18723e] disabled:opacity-60">
            {state === 'loading' ? <><LoaderCircle size={17} className="animate-spin" /> Searching</> : <><Search size={17} /> View Result</>}
          </button>
        </form>
        <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-slate-500"><LockKeyhole size={15} className="mt-0.5 shrink-0" aria-hidden="true" /> Your details are sent through a protected request, not displayed in the website URL. Current marks can be viewed now. A verified E-DMC with student identity details is only available after examination review.</p>
        <div aria-live="polite" className="mt-5">
          {state === 'closed' && <StatusMessage title="Result publication is not open">Public examination marks have not yet been released. Please check again after the announcement.</StatusMessage>}
          {state === 'limited' && <StatusMessage title="Too many attempts">Please wait 15 minutes before searching again.</StatusMessage>}
          {state === 'not-found' && <StatusMessage title="No recorded result found">Check the registered CNIC / B-Form. Unpublished records or ambiguous registration matches are not displayed.</StatusMessage>}
          {state === 'error' && <StatusMessage title="Unable to verify the result">The request could not be completed. Please try again later.</StatusMessage>}
        </div>
      </div>

      {state === 'success' && record && (
        <div className="mt-9">
          <div className={`no-print mx-auto mb-5 flex max-w-[900px] flex-wrap items-center justify-between gap-3 rounded-lg border p-3 sm:px-4 ${record.status === 'VERIFIED' ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
            <p className={`text-xs font-semibold ${record.status === 'VERIFIED' ? 'text-emerald-900' : 'text-amber-950'}`}>
              {record.status === 'VERIFIED'
                ? 'Verified final marks found. This E-DMC is not the Official / Original DMC.'
                : 'Your currently recorded marks are available. Examination verification is still pending.'}
            </p>
            <div className="flex items-center gap-2">
              {record.status === 'VERIFIED' && (
                <button type="button" onClick={() => window.print()} className="inline-flex min-h-10 items-center gap-2 rounded-md bg-[#0c355a] px-4 text-xs font-semibold text-white hover:bg-[#185b9d]">
                  <Printer size={16} /> Print / Save as PDF
                </button>
              )}
              <button type="button" onClick={() => { setCnic(''); reset(); }} className="inline-flex min-h-10 items-center gap-1 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-100">
                <ArrowLeft size={14} /> New search
              </button>
            </div>
          </div>
          {record.status === 'VERIFIED' ? (
            <EdmcCertificate record={record} />
          ) : (
            <section aria-label="Currently recorded examination marks" className="mx-auto max-w-[900px] rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="mb-6">
                <p className="text-xs font-bold uppercase tracking-[.15em] text-[#18723e]">AZM.AIO · {record.session}</p>
                <h2 className="mt-2 text-2xl font-bold text-[#0c355a]">Your current obtained marks</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">These scores are linked to the registered CNIC/B-Form you entered. Examination review is still in progress.</p>
                {record.source === 'MANUAL_ENTRY' && (
                  <p className="mt-3 inline-flex rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-950">
                    Manually recorded by examination administration · Verification pending
                  </p>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-center">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Obtained marks</p>
                  <p className="mt-2 text-4xl font-bold tabular-nums text-[#0c355a]">{record.obtainedMarks}<span className="text-base font-medium text-slate-500"> / {record.maximumMarks}</span></p>
                </div>
                <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-center">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Percentage</p>
                  <p className="mt-2 text-4xl font-bold tabular-nums text-[#0c355a]">{record.percentage}%</p>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-center">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">Pass threshold</p>
                  <p className="mt-2 text-2xl font-bold text-amber-950">{record.resultStatus === 'PASS' ? '60 or above' : 'Below 60'}</p>
                  <p className="mt-1 text-xs text-amber-800">Assessment subject to review</p>
                </div>
              </div>
              <p className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
                <strong>Review pending.</strong> {record.notice}
              </p>
              <p className="mt-3 text-xs leading-5 text-slate-500">Passing rule: 60 marks or above qualifies as Pass; below 60 does not. Final eligibility depends on verification and subsequent selection stages.</p>
            </section>
          )}
        </div>
      )}
    </main>
  );
}

function StatusMessage({ title, children }: { title: string; children: string }) {
  return (
    <div role="status" className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      <AlertCircle size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div><strong>{title}</strong><p className="mt-1 text-xs leading-5">{children}</p></div>
    </div>
  );
}
