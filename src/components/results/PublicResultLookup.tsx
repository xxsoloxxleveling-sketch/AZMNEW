import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Download, LoaderCircle, LockKeyhole, Printer } from 'lucide-react';
import { DEMO_EXAMINATIONS, PUBLIC_DEMO_LOOKUPS } from './ResultsDemoData';
import './ResultsStyles.css';

type LookupState = 'idle' | 'loading' | 'invalid' | 'unpublished' | 'error' | 'success';
type PublicResult = (typeof PUBLIC_DEMO_LOOKUPS)[number];

export function PublicResultLookup() {
  if (import.meta.env.PROD) return <PublicResultsUnavailable />;
  return <DemoPublicResultLookup />;
}

function PublicResultsUnavailable() {
  return (
    <main className="mx-auto max-w-4xl space-y-5 px-4 py-7 sm:px-6">
      <div className="border-b border-slate-200 pb-4">
        <p className="text-xs font-semibold text-[#185b9d]">Public student service</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Examination Results</h1>
        <p className="mt-2 text-sm text-slate-600">Secure online result verification is not available yet.</p>
      </div>
      <div role="status" className="border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        <h2 className="font-semibold">Identity verification is required</h2>
        <p className="mt-1 text-xs leading-5">The current public results service cannot verify student identity and official publication status. This page will not search student records or display legacy, provisional, or unpublished marks.</p>
      </div>
    </main>
  );
}

function DemoPublicResultLookup() {
  const [examinationId, setExaminationId] = useState(DEMO_EXAMINATIONS[0].id);
  const [rollNumber, setRollNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [state, setState] = useState<LookupState>('idle');
  const [result, setResult] = useState<PublicResult | null>(null);
  const [simulateError, setSimulateError] = useState(false);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setResult(null);
    if (!rollNumber.trim() || !verificationCode.trim()) { setState('invalid'); return; }
    setState('loading');
    window.setTimeout(() => {
      if (simulateError) { setState('error'); return; }
      const match = PUBLIC_DEMO_LOOKUPS.find((entry) => entry.examinationId === examinationId && entry.rollNumber === rollNumber.trim().toUpperCase());
      if (!match || match.verificationCode !== verificationCode.trim().toUpperCase()) { setState('invalid'); return; }
      if (match.status !== 'Published') { setState('unpublished'); return; }
      setResult(match); setState('success');
    }, 250);
  };

  return (
    <div className="results-public-page mx-auto max-w-4xl space-y-5 px-4 py-7 sm:px-6">
      <div className="border-b border-slate-200 pb-4">
        <p className="text-xs font-semibold text-[#185b9d]">Public student service</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Examination Results</h1>
        <p className="mt-2 text-sm text-slate-600">Check your published examination results using your examination details.</p>
      </div>

      <div role="note" className="flex gap-3 border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-950">
        <LockKeyhole size={16} className="mt-0.5 shrink-0" /><p><strong>DEMO MODE — FICTIONAL RECORDS.</strong> This lookup does not contact the AZM.AIO results service. Access code verification is simulated for this demonstration.</p>
      </div>

      <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="text-xs font-semibold text-slate-700 sm:col-span-2">Examination
          <select value={examinationId} onChange={(event) => setExaminationId(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal focus:border-[#185b9d] focus:outline-none focus:ring-2 focus:ring-blue-100">{DEMO_EXAMINATIONS.map((exam) => <option key={exam.id} value={exam.id}>{exam.name} · {exam.subject} · {exam.className}</option>)}</select>
        </label>
        <label className="text-xs font-semibold text-slate-700">Roll number
          <input autoComplete="off" value={rollNumber} onChange={(event) => setRollNumber(event.target.value)} placeholder="Enter roll number" className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal focus:border-[#185b9d] focus:outline-none focus:ring-2 focus:ring-blue-100" />
        </label>
        <label className="text-xs font-semibold text-slate-700">Result access code
          <input autoComplete="off" value={verificationCode} onChange={(event) => setVerificationCode(event.target.value)} placeholder="Enter demo access code" className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal focus:border-[#185b9d] focus:outline-none focus:ring-2 focus:ring-blue-100" />
        </label>
        <button type="submit" disabled={state === 'loading'} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-[#185b9d] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#13497e] focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60 sm:col-span-2">
          {state === 'loading' ? <><LoaderCircle size={16} className="animate-spin" /> Checking demo record…</> : 'View result'}
        </button>
      </form>

      <details className="border-t border-slate-200 pt-3 text-xs text-slate-600">
        <summary className="cursor-pointer font-semibold text-slate-700">Fictional demo access examples</summary>
        <div className="mt-2 grid gap-1 sm:grid-cols-2"><p>Published: <code>DEMO-RESULT-0001</code> · code <code>AZM-DEMO-1001</code></p><p>Unpublished: <code>DEMO-RESULT-0002</code> · code <code>AZM-DEMO-1002</code></p></div>
        <label className="mt-3 inline-flex items-center gap-2"><input type="checkbox" checked={simulateError} onChange={(event) => setSimulateError(event.target.checked)} /> Simulate a service error (demo only)</label>
      </details>

      {state === 'invalid' && <Message tone="error" title="Verification failed">Check the examination, roll number, and access code, then try again.</Message>}
      {state === 'unpublished' && <Message tone="notice" title="Result not published">A result matching those demo details is not published. Marks are not shown until publication.</Message>}
      {state === 'error' && <Message tone="error" title="Result service unavailable">The demo service could not complete this lookup. Please try again later.</Message>}

      {state === 'success' && result && <article data-result-print-root="true" className="printable-result printable-document space-y-5 border border-slate-300 bg-white p-4 sm:p-6">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
          <div><p className="text-[11px] font-bold uppercase tracking-wide text-amber-800">AZM.AIO · DEMO / NOT OFFICIAL</p><h2 className="mt-1 text-xl font-bold text-slate-900">Examination Result</h2><p className="mt-1 text-xs text-slate-600">Published demonstration result · Reference DEMO-{result.rollNumber.slice(-4)}</p></div>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800"><CheckCircle2 size={15} /> Published (demo)</span>
        </header>
        <dl className="grid grid-cols-2 gap-x-5 gap-y-3 text-xs sm:grid-cols-3"><Fact label="Student" value={result.studentName} /><Fact label="Roll number" value={result.rollNumber} /><Fact label="Class" value={result.className} /><Fact label="Examination" value={DEMO_EXAMINATIONS.find((exam) => exam.id === result.examinationId)?.name ?? '—'} /><Fact label="Examination date" value="8 November 2026" /><Fact label="Subject" value="General Science" /></dl>
        <div className="border-y border-slate-200 py-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Marks obtained</p><p className="mt-1 text-3xl font-bold tabular-nums text-slate-900">{result.marks} <span className="text-lg font-medium text-slate-500">/ 100</span></p><p className="mt-1 text-sm text-slate-700">{result.marks}% · Published</p></div>
        <div><h3 className="text-sm font-semibold text-slate-900">Question summary</h3><dl className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4"><Fact label="Correct" value={`${result.correct}`} /><Fact label="Wrong" value={`${result.wrong}`} /><Fact label="Multiple" value={`${result.multiple}`} /><Fact label="Blank" value={`${result.blank}`} /></dl></div>
        <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-4 no-print"><button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-md bg-[#185b9d] px-3 py-2 text-xs font-semibold text-white"><Printer size={14} /> Print result</button><button type="button" onClick={() => downloadPublicResult(result)} className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-800"><Download size={14} /> Download result</button></div>
      </article>}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) { return <div><dt className="text-slate-500">{label}</dt><dd className="mt-1 font-semibold text-slate-900">{value}</dd></div>; }
function Message({ tone, title, children }: { tone: 'error' | 'notice'; title: string; children: ReactNode }) {
  return <div role="status" className={`flex gap-2 border px-3 py-3 text-xs ${tone === 'error' ? 'border-red-200 bg-red-50 text-red-900' : 'border-amber-200 bg-amber-50 text-amber-950'}`}><AlertCircle size={16} className="shrink-0" /><div><strong>{title}</strong><p className="mt-1">{children}</p></div></div>;
}
function downloadPublicResult(result: PublicResult) {
  const exam = DEMO_EXAMINATIONS.find((item) => item.id === result.examinationId);
  const text = [`AZM.AIO · DEMO / NOT OFFICIAL`, `Reference: DEMO-${result.rollNumber.slice(-4)}`, `Student: ${result.studentName}`, `Roll number: ${result.rollNumber}`, `Class: ${result.className}`, `Examination: ${exam?.name ?? ''}`, `Date: 8 November 2026`, `Marks obtained: ${result.marks} / 100`, `Percentage: ${result.marks}%`, `Correct: ${result.correct}`, `Wrong: ${result.wrong}`, `Multiple: ${result.multiple}`, `Blank: ${result.blank}`, `Status: Published (demo)`].join('\n');
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${result.rollNumber}-DEMO-result.txt`; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
