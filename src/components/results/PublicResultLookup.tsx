import { useState } from 'react';
import type { FormEvent } from 'react';
import { AlertCircle, ArrowLeft, FileCheck2, LoaderCircle, LockKeyhole, Printer, Search } from 'lucide-react';
import { EdmcCertificate } from './EdmcCertificate';
import type { PublicEdmcRecord } from './EdmcCertificate';
import './ResultsStyles.css';

type LookupState = 'idle' | 'loading' | 'not-found' | 'closed' | 'limited' | 'error' | 'success';

export function PublicResultLookup() {
  const [rollNumber, setRollNumber] = useState('');
  const [cnic, setCnic] = useState('');
  const [state, setState] = useState<LookupState>('idle');
  const [record, setRecord] = useState<PublicEdmcRecord | null>(null);

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
        body: JSON.stringify({ rollNumber: rollNumber.trim(), cnic: cnic.trim() }),
      });
      if (response.status === 503) { setState('closed'); return; }
      if (response.status === 429) { setState('limited'); return; }
      if (!response.ok) { setState('error'); return; }
      const body = await response.json() as { success?: boolean; found?: boolean; data?: PublicEdmcRecord };
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
          View your E-DMC
        </h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          Enter your official roll number and registered CNIC / B-Form to view your
          provisional electronic marks certificate. The Original DMC will be issued separately by the Regional Office.
        </p>
        <form onSubmit={submit} className="mt-7 grid gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-[1fr_1fr_auto] sm:items-end sm:p-6">
          <label className="grid gap-1.5 text-xs font-bold text-slate-700">
            Official roll number
            <input required minLength={4} maxLength={64} autoComplete="off" value={rollNumber}
              onChange={e => { setRollNumber(e.target.value); reset(); }} placeholder="Enter roll number"
              className="h-11 min-w-0 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 focus:border-[#185b9d] focus:outline-none focus:ring-2 focus:ring-blue-100" />
          </label>
          <label className="grid gap-1.5 text-xs font-bold text-slate-700">
            Registered CNIC / B-Form
            <input required maxLength={15} inputMode="numeric" autoComplete="off" value={cnic}
              pattern="(?:[0-9]{13}|[0-9]{5}-[0-9]{7}-[0-9])"
              onChange={e => { setCnic(e.target.value); reset(); }} placeholder="13 digits or with hyphens"
              className="h-11 min-w-0 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 focus:border-[#185b9d] focus:outline-none focus:ring-2 focus:ring-blue-100" />
          </label>
          <button type="submit" disabled={state === 'loading'} className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#0c355a] px-5 text-sm font-bold text-white transition hover:bg-[#174f80] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#18723e] disabled:opacity-60">
            {state === 'loading' ? <><LoaderCircle size={17} className="animate-spin" /> Searching</> : <><Search size={17} /> View E-DMC</>}
          </button>
        </form>
        <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-slate-500"><LockKeyhole size={15} className="mt-0.5 shrink-0" aria-hidden="true" /> Your details are sent through a protected request, not displayed in the website URL. Results are shown only for matching published records.</p>
        <div aria-live="polite" className="mt-5">
          {state === 'closed' && <StatusMessage title="E-DMC publication is not open">The Regional Office has not enabled the public E-DMC release yet. Please check again after the official announcement.</StatusMessage>}
          {state === 'limited' && <StatusMessage title="Too many attempts">Please wait 15 minutes before searching again.</StatusMessage>}
          {state === 'not-found' && <StatusMessage title="No published E-DMC found">Check the complete roll number and registered CNIC / B-Form. Unpublished records are not displayed.</StatusMessage>}
          {state === 'error' && <StatusMessage title="Unable to verify the result">The request could not be completed. Please try again later.</StatusMessage>}
        </div>
      </div>

      {state === 'success' && record && (
        <div className="mt-9">
          <div className="no-print mx-auto mb-5 flex max-w-[900px] flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 sm:px-4">
            <p className="text-xs font-semibold text-emerald-900">Record found. This is a provisional E-DMC, not the Final / Original DMC.</p>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => window.print()} className="inline-flex min-h-10 items-center gap-2 rounded-md bg-[#0c355a] px-4 text-xs font-semibold text-white hover:bg-[#185b9d]"><Printer size={16} /> Print / Save as PDF</button>
              <button type="button" onClick={() => { setRollNumber(''); setCnic(''); reset(); }} className="inline-flex min-h-10 items-center gap-1 rounded-md border border-emerald-300 bg-white px-3 text-xs font-semibold text-emerald-950 hover:bg-emerald-100"><ArrowLeft size={14} /> New search</button>
            </div>
          </div>
          <EdmcCertificate record={record} />
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
