import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, ChevronLeft, ChevronRight, FilePlus2, Loader2, RefreshCw, Search } from 'lucide-react';
import { useAuth } from '../../lib/authContext';
import { createOfficialExamination, getOfficialExaminations, getOfficialResultDetail, getOfficialResults, publishOfficialExamination } from './ResultsApi';
import type { CreateOfficialExaminationInput, OfficialExaminationOption, OfficialResultSummary, OfficialResultsPage } from './ResultsApi';
import { OfficialResultDetailPanel } from './OfficialResultDetailPanel';

const PAGE_SIZE = 50;
const PAPER_VERSION_OPTIONS = ['A', 'B', 'C', 'D'] as const;
const statusOptions = [
  ['ALL', 'All statuses'],
  ['NO_SCORE', 'No score'],
  ['PROVISIONAL', 'Provisional'],
  ['VERIFIED', 'Verified'],
  ['PUBLISHED', 'Published'],
  ['WITHHELD', 'Withheld'],
  ['CORRECTED', 'Corrected'],
  ['OFFICIAL_DMC_ISSUED', 'Official DMC issued'],
] as const;
const fieldClass = 'mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal focus:border-[#185b9d] focus:outline-none focus:ring-2 focus:ring-blue-100';

export function OfficialResultsDashboard({ initialResultContext }: { initialResultContext?: { studentId: string; resultId: string; examinationId: string } | null }) {
  const { role } = useAuth();
  const permitted = role === 'SUPER_ADMIN' || role === 'ADMIN';
  const canEdit = role === 'SUPER_ADMIN';
  const [pageData, setPageData] = useState<OfficialResultsPage | null>(null);
  const [exams, setExams] = useState<OfficialExaminationOption[]>([]);
  const [search, setSearch] = useState('');
  const [classGroup, setClassGroup] = useState('');
  const [examinationId, setExaminationId] = useState('');
  const [status, setStatus] = useState('ALL');
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selected, setSelected] = useState<OfficialResultSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingExams, setLoadingExams] = useState(true);
  const [error, setError] = useState('');
  const [showExamForm, setShowExamForm] = useState(false);
  const [savingExam, setSavingExam] = useState(false);
  const [selectedPaperVersions, setSelectedPaperVersions] = useState<string[]>([]);
  const [keyRevisionLabels, setKeyRevisionLabels] = useState<Record<string, string>>({});
  const [publicationTarget, setPublicationTarget] = useState<{ exam: OfficialExaminationOption; action: 'PUBLISH' | 'WITHHOLD' } | null>(null);
  const [publicationReason, setPublicationReason] = useState('');
  const [publishingExam, setPublishingExam] = useState(false);

  const [examForm, setExamForm] = useState<CreateOfficialExaminationInput>({
    reference: '', title: '', sessionReference: '', examDate: '', classGroup: '', maximumMarks: '', questionCount: 100,
    paperKeyRevisions: [], scoringPolicy: { correctMarks: '1', wrongMarks: '0', blankMarks: '0', multipleMarks: '0', revision: '1' },
  });

  const classOptions = useMemo(() => {
    const groups = exams.map((item) => item.classGroup).filter((group): group is string => Boolean(group?.trim()));
    return [...new Set<string>(groups)].sort((a, b) => a.localeCompare(b));
  }, [exams]);

  const loadExams = useCallback(async () => {
    if (!permitted) { setExams([]); setLoadingExams(false); return; }
    setLoadingExams(true);
    try { setExams(await getOfficialExaminations()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load examination metadata.'); }
    finally { setLoadingExams(false); }
  }, [permitted]);

  useEffect(() => { void loadExams(); }, [loadExams]);

  const loadResults = useCallback(async (signal?: AbortSignal) => {
    if (!permitted) { setPageData(null); setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const data = await getOfficialResults({ page, limit: PAGE_SIZE, search, classGroup: classGroup || undefined, examinationId: examinationId || undefined, status: status === 'ALL' ? undefined : status }, { signal });
      setPageData(data);
      setSelected((current) => current ? data.results.find((item) => item.id === current.id) ?? current : null);
    } catch (cause) {
      if (!signal?.aborted) setError(cause instanceof Error ? cause.message : 'Could not load official examination results.');
    } finally { if (!signal?.aborted) setLoading(false); }
  }, [permitted, page, search, classGroup, examinationId, status]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void loadResults(controller.signal), search ? 180 : 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [loadResults, refreshKey]);

  useEffect(() => {
    if (!permitted || !initialResultContext?.resultId || !initialResultContext.studentId || !initialResultContext.examinationId) return;
    let cancelled = false;
    setExaminationId(initialResultContext.examinationId);
    setPage(1);
    setSelected(null);
    getOfficialResultDetail(initialResultContext.resultId).then((detail) => {
      if (cancelled) return;
      if (detail.studentId !== initialResultContext.studentId || detail.examinationId !== initialResultContext.examinationId) {
        setError('The requested result does not match the retained student and examination context.');
        return;
      }
      setSelected(detail);
    }).catch((cause) => {
      if (!cancelled) setError(cause instanceof Error ? cause.message : 'The requested result could not be reopened.');
    });
    return () => { cancelled = true; };
  }, [permitted, initialResultContext?.resultId, initialResultContext?.studentId, initialResultContext?.examinationId]);

  const refresh = () => { void loadExams(); setRefreshKey((value) => value + 1); };
  const updateFilter = (update: () => void) => { update(); setPage(1); setSelected(null); };
  const results = pageData?.results ?? [];
  const pagination = pageData?.pagination;

  const createExam = async () => {
    if (!canEdit || savingExam) return;
    if (!examForm.reference.trim() || !examForm.title.trim() || !examForm.sessionReference.trim() || !examForm.classGroup.trim() || !examForm.maximumMarks.trim() || !examForm.scoringPolicy.revision.trim() || selectedPaperVersions.length === 0 || selectedPaperVersions.some((version) => !keyRevisionLabels[version]?.trim())) {
      setError('Complete the examination details, select each paper version used, and enter a revision label for every selected version.');
      return;
    }
    setSavingExam(true); setError('');
    try {
      await createOfficialExamination({ ...examForm, reference: examForm.reference.trim(), title: examForm.title.trim(), sessionReference: examForm.sessionReference.trim(), examDate: examForm.examDate?.trim() || null, classGroup: examForm.classGroup.trim(), paperKeyRevisions: selectedPaperVersions.map((paperVersion) => ({ paperVersion, answerKeyRevision: keyRevisionLabels[paperVersion].trim() })) });
      setShowExamForm(false);
      setExamForm({ reference: '', title: '', sessionReference: '', examDate: '', classGroup: '', maximumMarks: '', questionCount: 100, paperKeyRevisions: [], scoringPolicy: { correctMarks: '1', wrongMarks: '0', blankMarks: '0', multipleMarks: '0', revision: '1' } });
      setSelectedPaperVersions([]); setKeyRevisionLabels({});
      await loadExams();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Examination metadata could not be saved.'); }
    finally { setSavingExam(false); }
  };

  const confirmExamPublication = async () => {
    if (!canEdit || !publicationTarget || publicationReason.trim().length < 12 || publishingExam) return;
    setPublishingExam(true); setError('');
    try {
      await publishOfficialExamination(publicationTarget.exam.id, {
        expectedRevision: publicationTarget.exam.revision,
        action: publicationTarget.action,
        reason: publicationReason.trim(),
      });
      setPublicationTarget(null); setPublicationReason('');
      await Promise.all([loadExams(), loadResults()]);
    } catch (cause) {
      const errorCause = cause as Error & { status?: number };
      setError(errorCause.status === 409
        ? 'This examination changed after it was opened. Its metadata has been refreshed; review the current status and try again.'
        : errorCause.message || 'Examination publication could not be changed.');
      if (errorCause.status === 409) await loadExams();
    } finally { setPublishingExam(false); }
  };

  if (!permitted) return <div className="border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">Your account does not have an explicitly assigned results scope. No result records are shown.</div>;

  return (
    <section className="space-y-4" aria-label="Official examination results">
      <div role="note" className="border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-950"><strong>Official exam-specific records.</strong> Legacy score fields remain separate and are never treated as verified marks. This view displays no answer-key contents.</div>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="text-base font-bold text-slate-900">Examination Results</h2><p className="mt-1 text-xs text-slate-600">Search, verify and review revision-bound examination records.</p></div>
        <div className="flex flex-wrap gap-2">
          {canEdit && <button type="button" onClick={() => setShowExamForm((value) => !value)} className="inline-flex items-center gap-1.5 rounded-md bg-[#185b9d] px-3 py-2 text-xs font-semibold text-white"><FilePlus2 size={14} /> Add examination</button>}
          <button type="button" onClick={refresh} disabled={loading || loadingExams} className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-40"><RefreshCw size={14} /> Refresh</button>
        </div>
      </header>

      {showExamForm && canEdit && <section className="rounded-md border border-slate-200 bg-slate-50 p-4" aria-label="Add examination metadata">
        <div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-semibold text-slate-900">Add examination metadata</h3><p className="mt-1 text-xs text-slate-600">Creates a draft and records an explicit paper-version-to-key-revision map. Only non-secret revision labels are submitted; answer-key contents stay on the server.</p></div><button type="button" onClick={() => setShowExamForm(false)} className="rounded border border-slate-300 px-2 py-1 text-xs">Close</button></div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-xs font-semibold">Exam reference<input className={fieldClass} maxLength={40} value={examForm.reference} onChange={(event) => setExamForm((current) => ({ ...current, reference: event.target.value }))} /></label>
          <label className="text-xs font-semibold">Examination title<input className={fieldClass} maxLength={120} value={examForm.title} onChange={(event) => setExamForm((current) => ({ ...current, title: event.target.value }))} /></label>
          <label className="text-xs font-semibold">Session / sitting reference<input className={fieldClass} maxLength={80} value={examForm.sessionReference} onChange={(event) => setExamForm((current) => ({ ...current, sessionReference: event.target.value }))} /></label>
          <label className="text-xs font-semibold">Class / group<input className={fieldClass} maxLength={80} value={examForm.classGroup} onChange={(event) => setExamForm((current) => ({ ...current, classGroup: event.target.value }))} /></label>
          <label className="text-xs font-semibold">Examination date<input className={fieldClass} type="date" value={examForm.examDate ?? ''} onChange={(event) => setExamForm((current) => ({ ...current, examDate: event.target.value || null }))} /></label>
          <label className="text-xs font-semibold">Question count<input className={fieldClass} type="number" min="1" max="500" value={examForm.questionCount} onChange={(event) => setExamForm((current) => ({ ...current, questionCount: Number(event.target.value) }))} /></label>
          <label className="text-xs font-semibold">Maximum marks<input className={fieldClass} inputMode="decimal" value={examForm.maximumMarks} onChange={(event) => setExamForm((current) => ({ ...current, maximumMarks: event.target.value }))} /></label>
          <fieldset className="rounded border border-slate-200 bg-white p-3 sm:col-span-2 lg:col-span-3"><legend className="px-1 text-xs font-semibold">Paper versions and non-secret key revision labels</legend><p className="mb-2 text-[11px] text-slate-500">Select only versions that exist for this exam, then enter the server-side revision reference for each one.</p><div className="flex flex-wrap gap-3">{PAPER_VERSION_OPTIONS.map((version) => <label key={version} className="inline-flex items-center gap-1.5 text-xs font-medium"><input type="checkbox" checked={selectedPaperVersions.includes(version)} onChange={(event) => setSelectedPaperVersions((current) => event.target.checked ? [...current, version] : current.filter((item) => item !== version))} />Version {version}</label>)}</div>{selectedPaperVersions.length > 0 && <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{selectedPaperVersions.map((version) => <label key={version} className="text-xs font-semibold">Version {version} key revision<input className={fieldClass} maxLength={80} value={keyRevisionLabels[version] ?? ''} onChange={(event) => setKeyRevisionLabels((current) => ({ ...current, [version]: event.target.value }))} placeholder="Revision label only" /></label>)}</div>}</fieldset>
          <label className="text-xs font-semibold">Scoring-policy revision<input className={fieldClass} maxLength={80} value={examForm.scoringPolicy.revision} onChange={(event) => setExamForm((current) => ({ ...current, scoringPolicy: { ...current.scoringPolicy, revision: event.target.value } }))} /></label>
          <label className="text-xs font-semibold">Marks per correct answer<input className={fieldClass} inputMode="decimal" value={examForm.scoringPolicy.correctMarks} onChange={(event) => setExamForm((current) => ({ ...current, scoringPolicy: { ...current.scoringPolicy, correctMarks: event.target.value } }))} /></label>
          <label className="text-xs font-semibold">Marks per wrong answer<input className={fieldClass} inputMode="decimal" value={examForm.scoringPolicy.wrongMarks} onChange={(event) => setExamForm((current) => ({ ...current, scoringPolicy: { ...current.scoringPolicy, wrongMarks: event.target.value } }))} /></label>
          <label className="text-xs font-semibold">Marks per blank response<input className={fieldClass} inputMode="decimal" value={examForm.scoringPolicy.blankMarks} onChange={(event) => setExamForm((current) => ({ ...current, scoringPolicy: { ...current.scoringPolicy, blankMarks: event.target.value } }))} /></label>
          <label className="text-xs font-semibold">Marks per multiple response<input className={fieldClass} inputMode="decimal" value={examForm.scoringPolicy.multipleMarks} onChange={(event) => setExamForm((current) => ({ ...current, scoringPolicy: { ...current.scoringPolicy, multipleMarks: event.target.value } }))} /></label>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><p className="max-w-2xl text-[11px] text-slate-500">This creates only draft metadata. An exam requires a separate explicit verification/publication transition before any DMC is available.</p><button type="button" disabled={savingExam} onClick={() => void createExam()} className="rounded-md bg-[#185b9d] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{savingExam ? 'Saving…' : 'Create draft examination'}</button></div>
      </section>}

      {exams.length > 0 && <details className="rounded-md border border-slate-200 bg-white">
        <summary className="cursor-pointer px-3 py-2.5 text-xs font-semibold text-slate-800">Examination metadata and publication · {exams.length} record(s)</summary>
        <div className="divide-y divide-slate-100 border-t border-slate-200">
          {exams.map((exam) => <div key={exam.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 text-xs">
            <div><p className="font-semibold text-slate-900">{exam.reference} · {exam.title}</p><p className="mt-0.5 text-slate-600">{exam.classGroup} · {exam.examDate || 'Date unavailable'} · Versions {exam.paperVersions.join('/') || 'none'} · revision {exam.revision}</p></div>
            <div className="flex items-center gap-2"><span className={`rounded-full px-2 py-1 font-semibold ${exam.publicationStatus === 'PUBLISHED' ? 'bg-green-100 text-green-800' : exam.publicationStatus === 'WITHHELD' ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-700'}`}>{exam.publicationStatus}</span>
              {canEdit && <button type="button" onClick={() => { setPublicationTarget({ exam, action: exam.publicationStatus === 'PUBLISHED' ? 'WITHHOLD' : 'PUBLISH' }); setPublicationReason(''); }} className="rounded border border-slate-300 px-2.5 py-1.5 font-semibold text-slate-700 hover:bg-slate-50">{exam.publicationStatus === 'PUBLISHED' ? 'Withhold examination' : exam.publicationStatus === 'WITHHELD' ? 'Republish examination' : 'Publish examination'}</button>}
            </div>
          </div>)}
        </div>
      </details>}

      <div className="grid gap-3 border-y border-slate-200 py-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="text-xs font-semibold text-slate-700 xl:col-span-2">Search by roll number or student name
          <span className="relative mt-1 block"><Search size={14} className="absolute left-3 top-3 text-slate-400" /><input value={search} onChange={(event) => updateFilter(() => setSearch(event.target.value))} placeholder="Search official results" autoComplete="off" className={`${fieldClass} pl-9`} /></span>
        </label>
        <label className="text-xs font-semibold text-slate-700">Examination
          <select value={examinationId} disabled={loadingExams} onChange={(event) => updateFilter(() => setExaminationId(event.target.value))} className={fieldClass}><option value="">All examinations</option>{exams.map((exam) => <option key={exam.id} value={exam.id}>{exam.reference} · {exam.title}</option>)}</select>
        </label>
        <label className="text-xs font-semibold text-slate-700">Class / group
          <select value={classGroup} onChange={(event) => updateFilter(() => setClassGroup(event.target.value))} className={fieldClass}><option value="">All classes</option>{classOptions.map((group) => <option key={group} value={group}>{group}</option>)}</select>
        </label>
        <label className="text-xs font-semibold text-slate-700">Result status
          <select value={status} onChange={(event) => updateFilter(() => setStatus(event.target.value))} className={fieldClass}>{statusOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select>
        </label>
      </div>

      {error && <div role="alert" className="flex items-start gap-2 border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-900"><AlertCircle size={15} className="mt-0.5 shrink-0" /><div><strong>Results could not be loaded or saved.</strong><p className="mt-1">{error}</p></div></div>}

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600"><span>{loading ? 'Loading official results…' : `${(pagination?.total ?? 0).toLocaleString()} record(s) · page ${page} of ${Math.max(1, pagination?.totalPages ?? 1)}`}</span><span>Page size {PAGE_SIZE} · no answer keys in browser</span></div>
      <div className="overflow-x-auto rounded-md border border-slate-200" aria-busy={loading}>
        <table className="w-full min-w-[1180px] border-collapse text-left text-xs">
          <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-600"><tr>
            <th className="px-3 py-2.5">Roll number</th><th className="px-3 py-2.5">Student</th><th className="px-3 py-2.5">Class / group</th><th className="px-3 py-2.5">Examination</th><th className="px-3 py-2.5 text-right">Marks</th><th className="px-3 py-2.5 text-right">Correct / wrong</th><th className="px-3 py-2.5 text-right">Blank / multiple / uncertain</th><th className="px-3 py-2.5">Identity · verification</th><th className="px-3 py-2.5">Publication</th><th className="px-3 py-2.5">DMC</th><th className="px-3 py-2.5">Action</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-100">
            {loading && <tr><td colSpan={11} className="px-3 py-8 text-center text-slate-500"><Loader2 size={15} className="mr-2 inline animate-spin" />Loading the selected page…</td></tr>}
            {!loading && results.map((row) => <tr key={row.id} className={selected?.id === row.id ? 'bg-blue-50/60' : 'hover:bg-slate-50'}>
              <td className="whitespace-nowrap px-3 py-2.5 font-mono">{row.student.rollNumber || '—'}</td><td className="px-3 py-2.5 font-semibold text-slate-800">{row.student.fullName}<p className="mt-0.5 font-normal text-[10px] text-slate-500">{row.resultReference}</p></td><td className="px-3 py-2.5">{row.student.classGroup}</td><td className="px-3 py-2.5">{row.examination.title}<p className="mt-0.5 text-[10px] text-slate-500">{row.examination.reference} · rev {row.resultRevision} · {row.attempt ? (row.attempt.state === 'CURRENT' ? 'Current attempt' : 'Historical attempt') : 'Attempt unverified'}</p></td><td className="px-3 py-2.5 text-right tabular-nums">{row.obtainedMarks === null ? 'Not recorded' : `${row.obtainedMarks} / ${row.maximumMarks}`}</td><td className="px-3 py-2.5 text-right tabular-nums">{count(row.correctCount)} / {count(row.wrongCount)}</td><td className="px-3 py-2.5 text-right tabular-nums">{count(row.blankCount)} / {count(row.multipleCount)} / {count(row.uncertainCount)}</td><td className="px-3 py-2.5">{row.identityStatus}<p className="mt-0.5 text-[10px] text-slate-500">{row.verificationStatus}</p></td><td className="px-3 py-2.5"><Status value={row.publicationStatus} corrected={row.resultRevision > 1} /></td><td className="px-3 py-2.5">{row.documents.latestOfficialIssuanceStatus === 'ISSUED' ? 'Issued' : row.documents.latestOfficialIssuanceStatus === 'SUPERSEDED' ? 'Superseded' : 'Not issued'}</td><td className="px-3 py-2.5"><button type="button" onClick={() => setSelected(row)} className="rounded border border-slate-300 px-2.5 py-1.5 font-semibold text-[#185b9d] hover:bg-blue-50">View result</button></td>
            </tr>)}
            {!loading && results.length === 0 && <tr><td colSpan={11} className="px-3 py-8 text-center text-slate-600">No examination result has been recorded for this search. Legacy scores are not included here.</td></tr>}
          </tbody>
        </table>
      </div>
      <nav aria-label="Official results pages" className="flex items-center justify-end gap-2 text-xs"><button type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)} className="inline-flex items-center gap-1 rounded border border-slate-300 px-2.5 py-1.5 disabled:opacity-40"><ChevronLeft size={14} /> Previous</button><span>Page {page} of {Math.max(1, pagination?.totalPages ?? 1)}</span><button type="button" disabled={page >= (pagination?.totalPages ?? 1) || loading} onClick={() => setPage((value) => value + 1)} className="inline-flex items-center gap-1 rounded border border-slate-300 px-2.5 py-1.5 disabled:opacity-40">Next <ChevronRight size={14} /></button></nav>

      {selected && <OfficialResultDetailPanel resultId={selected.id} source="RESULTS_DASHBOARD" canEdit={canEdit} onResultChanged={() => setRefreshKey((value) => value + 1)} />}

      {publicationTarget && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-3" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !publishingExam) setPublicationTarget(null); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="exam-publication-title" className="w-full max-w-lg rounded-lg bg-white p-4 shadow-xl sm:p-6">
          <h2 id="exam-publication-title" className="text-base font-bold text-slate-900">{publicationTarget.action === 'PUBLISH' ? 'Publish examination' : 'Withhold examination'}</h2>
          <p className="mt-1 text-xs text-slate-600">{publicationTarget.exam.reference} · {publicationTarget.exam.title} · examination revision {publicationTarget.exam.revision}. {publicationTarget.action === 'WITHHOLD' ? 'Withholding supersedes current Official DMCs.' : 'Publishing makes eligible, separately verified result records available for DMC actions.'}</p>
          <label className="mt-4 block text-xs font-semibold text-slate-800">Reason for this examination state change<textarea className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm" rows={3} maxLength={1000} value={publicationReason} onChange={(event) => setPublicationReason(event.target.value)} /></label>
          <p className="mt-1 text-[11px] text-slate-500">A reason of at least 12 characters is recorded in the publication audit.</p>
          <div className="mt-4 flex justify-end gap-2"><button type="button" disabled={publishingExam} onClick={() => setPublicationTarget(null)} className="rounded border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700">Cancel</button><button type="button" disabled={publishingExam || publicationReason.trim().length < 12} onClick={() => void confirmExamPublication()} className={`rounded px-3 py-2 text-xs font-semibold text-white disabled:opacity-40 ${publicationTarget.action === 'WITHHOLD' ? 'bg-red-700' : 'bg-[#185b9d]'}`}>{publishingExam ? 'Saving…' : `Confirm ${publicationTarget.action === 'PUBLISH' ? 'publish' : 'withhold'}`}</button></div>
        </section>
      </div>}
    </section>
  );
}

function count(value: number | null) { return value === null ? '—' : String(value); }

function Status({ value, corrected }: { value: string; corrected: boolean }) {
  const styles = value === 'PUBLISHED' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : value === 'WITHHELD' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-amber-200 bg-amber-50 text-amber-900';
  const label = corrected ? `Corrected · ${value}` : value === 'UNPUBLISHED' ? 'Awaiting publication' : value;
  return <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold ${styles}`}>{label}</span>;
}
