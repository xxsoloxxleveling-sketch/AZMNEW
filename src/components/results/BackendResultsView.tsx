import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, ChevronLeft, ChevronRight, Download, RefreshCw } from 'lucide-react';
import { getResultsSessions, getSessionResults } from './ResultsApi';
import type { BackendResultsPage, BackendStudentResult, ResultsSessionOption } from './ResultsApi';
import { downloadResultsTableCsv, downloadResultsTableXlsx } from './ResultsExport';

const PAGE_SIZE = 50;
const EXPORT_HEADERS = [
  'Roll number', 'Student', 'Class/group', 'Attendance session', 'Legacy score (unverified)',
  'Maximum marks', 'Percentage', 'Correct', 'Wrong', 'Multiple', 'Blank', 'Uncertain',
  'Verification status', 'Publication status',
];

type ScoreAvailability = 'all' | 'with-score' | 'without-score';
type SortBy = 'rollNumber' | 'studentName' | 'className' | 'legacyScore';

export function BackendResultsView() {
  const [sessions, setSessions] = useState<ResultsSessionOption[]>([]);
  const [sessionId, setSessionId] = useState('');
  const [pageData, setPageData] = useState<BackendResultsPage | null>(null);
  const [classOptions, setClassOptions] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [className, setClassName] = useState('');
  const [minimumScore, setMinimumScore] = useState('');
  const [maximumScore, setMaximumScore] = useState('');
  const [scoreAvailability, setScoreAvailability] = useState<ScoreAvailability>('all');
  const [sortBy, setSortBy] = useState<SortBy>('rollNumber');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selected, setSelected] = useState<BackendStudentResult | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingResults, setLoadingResults] = useState(false);
  const [error, setError] = useState('');

  const selectedSession = useMemo(() => sessions.find((session) => session.id === sessionId) ?? null, [sessions, sessionId]);

  const loadSessions = useCallback(async () => {
    setLoadingSessions(true);
    setError('');
    try {
      const data = await getResultsSessions();
      setSessions(data);
      setSessionId((current) => current && data.some((session) => session.id === current) ? current : data[0]?.id ?? '');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load backend result sessions.');
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  useEffect(() => { void loadSessions(); }, [loadSessions]);

  useEffect(() => {
    const refreshVisibleResults = () => {
      if (document.visibilityState === 'visible') {
        void loadSessions();
        setRefreshKey((value) => value + 1);
      }
    };
    const timer = window.setInterval(refreshVisibleResults, 30_000);
    document.addEventListener('visibilitychange', refreshVisibleResults);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshVisibleResults);
    };
  }, [loadSessions]);

  useEffect(() => {
    if (!sessionId) { setPageData(null); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoadingResults(true);
      setError('');
      try {
        const data = await getSessionResults(sessionId, {
          page,
          limit: PAGE_SIZE,
          search,
          className,
          minimumScore,
          maximumScore,
          scoreAvailability,
          sortBy,
          sortOrder,
        }, { signal: controller.signal });
        if (!controller.signal.aborted) {
          setPageData(data);
          setClassOptions(data.classOptions);
          setSelected((current) => current && data.results.some((row) => row.id === current.id)
            ? data.results.find((row) => row.id === current.id) ?? null : null);
        }
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not load results for this session.');
      } finally {
        if (!controller.signal.aborted) setLoadingResults(false);
      }
    }, search ? 180 : 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [sessionId, page, search, className, minimumScore, maximumScore, scoreAvailability, sortBy, sortOrder, refreshKey]);

  const pageResults = pageData?.results ?? [];
  const pagination = pageData?.pagination;
  const updateFilter = (update: () => void) => {
    update();
    setPage(1);
    setPageData(null);
    setSelected(null);
  };
  const exportRows = pageResults.map((row) => [
    row.rollNumber,
    row.studentName,
    row.className,
    selectedSession ? `${selectedSession.hallName} · ${selectedSession.examDate}` : 'Legacy attendance session',
    row.legacyScore,
    row.maximumMarks,
    row.percentage,
    null,
    null,
    null,
    null,
    null,
    row.status === 'LEGACY_UNVERIFIED' ? 'Unverified legacy record' : 'Unavailable',
    'Unavailable',
  ]);
  const exportTitle = `UNVERIFIED LEGACY RECORDS — CURRENT PAGE ONLY (${pagination?.total ?? 0} matching record(s), page ${page})`;
  const exportFilename = `AZM-legacy-unverified-${slug(selectedSession?.hallName ?? 'session')}-page-${page}`;

  return (
    <section className="space-y-3" aria-label="Connected backend results">
      <div role="note" className="border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950">
        <strong>Connected backend · read-only.</strong> Existing aggregate scores are legacy values, not verified examination marks. Question-level counts, percentages, and publication status are unavailable and stay blank. No publication controls are enabled.
      </div>

      <div className="grid grid-cols-1 gap-3 border-b border-slate-200 pb-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="text-xs font-semibold text-slate-700 xl:col-span-2">Legacy attendance session with linked records
          <select value={sessionId} disabled={loadingSessions || !sessions.length} onChange={(event) => { setSessionId(event.target.value); setPage(1); setClassName(''); setPageData(null); setSelected(null); }} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal focus:border-[#185b9d] focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50">
            {!sessions.length && <option value="">{loadingSessions ? 'Loading sessions…' : 'No linked legacy result sessions'}</option>}
            {sessions.map((session) => <option key={session.id} value={session.id}>{session.hallName} · {session.examDate} · Attempt {session.attemptNumber}{session.isCurrent ? '' : ' · Archived'}</option>)}
          </select>
        </label>
        <label htmlFor="backend-results-search" className="text-xs font-semibold text-slate-700 xl:col-span-2">Search by roll number or student name
          <input id="backend-results-search" value={search} onChange={(event) => updateFilter(() => setSearch(event.target.value))} placeholder="Search this session" autoComplete="off" className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal focus:border-[#185b9d] focus:outline-none focus:ring-2 focus:ring-blue-100" />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <label className="text-xs font-semibold text-slate-700">Class / group
          <select value={className} onChange={(event) => updateFilter(() => setClassName(event.target.value))} disabled={!classOptions.length} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-2.5 text-sm font-normal disabled:bg-slate-50">
            <option value="">All classes</option>{classOptions.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-700">Legacy score availability
          <select value={scoreAvailability} onChange={(event) => updateFilter(() => setScoreAvailability(event.target.value as ScoreAvailability))} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-2.5 text-sm font-normal"><option value="all">All records</option><option value="with-score">Score recorded</option><option value="without-score">No score recorded</option></select>
        </label>
        <label className="text-xs font-semibold text-slate-700">Minimum legacy score
          <input type="number" min="0" max="100" value={minimumScore} onChange={(event) => updateFilter(() => setMinimumScore(event.target.value))} disabled={scoreAvailability === 'without-score'} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-2.5 text-sm font-normal disabled:bg-slate-50" />
        </label>
        <label className="text-xs font-semibold text-slate-700">Maximum legacy score
          <input type="number" min="0" max="100" value={maximumScore} onChange={(event) => updateFilter(() => setMaximumScore(event.target.value))} disabled={scoreAvailability === 'without-score'} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-2.5 text-sm font-normal disabled:bg-slate-50" />
        </label>
        <div className="flex items-end gap-2">
          <label className="min-w-0 flex-1 text-xs font-semibold text-slate-700">Sort by
            <select value={sortBy} onChange={(event) => updateFilter(() => setSortBy(event.target.value as SortBy))} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-2.5 text-sm font-normal"><option value="rollNumber">Roll number</option><option value="studentName">Student</option><option value="className">Class</option><option value="legacyScore">Legacy score</option></select>
          </label>
          <button type="button" onClick={() => updateFilter(() => setSortOrder((value) => value === 'asc' ? 'desc' : 'asc'))} className="mb-px min-h-10 rounded-md border border-slate-300 px-3 text-xs font-semibold text-slate-700" aria-label={`Sort ${sortOrder === 'asc' ? 'descending' : 'ascending'}`} title={`Sort ${sortOrder === 'asc' ? 'descending' : 'ascending'}`}>{sortOrder === 'asc' ? 'Asc' : 'Desc'}</button>
        </div>
      </div>

      {selectedSession && <dl className="grid grid-cols-2 gap-y-2 border-y border-slate-200 py-3 text-xs sm:grid-cols-3 xl:grid-cols-6">
        <Fact label="Source" value="Legacy attendance session" />
        <Fact label="Session date" value={selectedSession.examDate || selectedSession.businessDate} />
        <Fact label="Rostered candidates" value={selectedSession.rosterCount.toLocaleString()} />
        <Fact label="Linked result records" value={selectedSession.recordCount.toLocaleString()} />
        <Fact label="Records with legacy score" value={selectedSession.legacyScoreCount.toLocaleString()} />
        <Fact label="Verified / published" value="Not available" />
      </dl>}

      {error && <div role="alert" className="flex items-start gap-2 border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-900"><AlertCircle size={15} className="mt-0.5 shrink-0" /><div className="flex-1"><strong>Results could not be loaded.</strong><p className="mt-1">{error}</p><button type="button" onClick={() => { void loadSessions(); setRefreshKey((value) => value + 1); }} className="mt-2 font-semibold underline">Retry</button></div></div>}

      {!error && !loadingSessions && sessions.length === 0 && <p className="border border-slate-200 px-3 py-8 text-center text-sm text-slate-600">No session-linked legacy result records were found. Results outside a linked attendance session are not included.</p>}

      {sessions.length > 0 && <>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
          <p>{loadingResults ? 'Loading results…' : `${(pagination?.total ?? 0).toLocaleString()} matching record(s)`} · showing at most {PAGE_SIZE} per page</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={!pageResults.length || loadingResults || !selectedSession} onClick={() => selectedSession && downloadResultsTableCsv(exportTitle, EXPORT_HEADERS, exportRows, `${exportFilename}.csv`)} className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-2 font-semibold text-slate-700 disabled:opacity-40"><Download size={14} /> Export this page CSV</button>
            <button type="button" disabled={!pageResults.length || loadingResults || !selectedSession} onClick={() => selectedSession && downloadResultsTableXlsx(exportTitle, EXPORT_HEADERS, exportRows, `${exportFilename}.xlsx`, 'Unverified results')} className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-2 font-semibold text-slate-700 disabled:opacity-40"><Download size={14} /> Excel</button>
            <button type="button" onClick={() => { void loadSessions(); setRefreshKey((value) => value + 1); }} disabled={loadingSessions} className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-2 font-semibold text-slate-700 disabled:opacity-50"><RefreshCw size={14} /> Refresh</button>
          </div>
        </div>
        <p className="text-[11px] text-slate-500">Exports contain this page only and include no answer keys. Use the page controls to export another filtered page.</p>
        <div className="overflow-x-auto border border-slate-200" aria-busy={loadingResults}>
          <table className="w-full min-w-[1550px] border-collapse text-left text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-600"><tr>
              <th scope="col" className="px-3 py-2.5">Roll number</th><th scope="col" className="px-3 py-2.5">Student</th><th scope="col" className="px-3 py-2.5">Class / group</th><th scope="col" className="px-3 py-2.5">Examination source</th><th scope="col" className="px-3 py-2.5">Marks</th><th scope="col" className="px-3 py-2.5">Percentage</th><th scope="col" className="px-3 py-2.5">Correct</th><th scope="col" className="px-3 py-2.5">Wrong</th><th scope="col" className="px-3 py-2.5">Multiple</th><th scope="col" className="px-3 py-2.5">Blank</th><th scope="col" className="px-3 py-2.5">Uncertain</th><th scope="col" className="px-3 py-2.5">Status</th><th scope="col" className="px-3 py-2.5">Action</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {loadingResults && <tr><td colSpan={13} className="px-3 py-8 text-center text-slate-500">Loading the selected page…</td></tr>}
              {!loadingResults && pageResults.map((row) => <tr key={row.id} className={selected?.id === row.id ? 'bg-blue-50/60' : 'hover:bg-slate-50'}>
                <td className="whitespace-nowrap px-3 py-2 font-medium text-slate-900">{row.rollNumber || '—'}</td>
                <td className="px-3 py-2 text-slate-800">{row.studentName}</td>
                <td className="px-3 py-2 text-slate-700">{row.className}</td>
                <td className="px-3 py-2 text-slate-700">Legacy attendance session</td>
                <td className="px-3 py-2 tabular-nums text-slate-800">{formatLegacyScore(row.legacyScore)}</td>
                <td className="px-3 py-2 text-slate-500" aria-label="Percentage unavailable">—</td>
                <UnavailableCell /><UnavailableCell /><UnavailableCell /><UnavailableCell /><UnavailableCell />
                <td className="px-3 py-2 font-medium text-amber-800">{row.legacyScore === null ? 'Score unavailable' : 'Legacy · unverified'}</td>
                <td className="px-3 py-2"><button type="button" onClick={() => setSelected(row)} className="font-semibold text-[#185b9d] underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-400">View details</button></td>
              </tr>)}
              {!loadingResults && pageResults.length === 0 && <tr><td colSpan={13} className="px-3 py-8 text-center text-slate-500">No result records match these filters.</td></tr>}
            </tbody>
          </table>
        </div>
        {pagination && pagination.totalPages > 1 && <nav aria-label="Results pages" className="flex items-center justify-end gap-2 text-xs"><button type="button" disabled={page <= 1 || loadingResults} onClick={() => setPage((value) => value - 1)} className="inline-flex items-center gap-1 rounded border border-slate-300 px-2.5 py-1.5 disabled:opacity-40"><ChevronLeft size={14} /> Previous</button><span>Page {pagination.page} of {pagination.totalPages}</span><button type="button" disabled={page >= pagination.totalPages || loadingResults} onClick={() => setPage((value) => value + 1)} className="inline-flex items-center gap-1 rounded border border-slate-300 px-2.5 py-1.5 disabled:opacity-40">Next <ChevronRight size={14} /></button></nav>}
      </>}

      {selected && <section aria-label="Selected result detail" className="border-t border-slate-300 pt-3">
        <div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-semibold text-slate-900">{selected.studentName} · {selected.rollNumber || 'No roll number'}</h2><p className="mt-1 text-xs text-slate-600">{selected.className} · Legacy attendance session {selectedSession?.id}</p></div><button type="button" onClick={() => setSelected(null)} className="rounded border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700">Close details</button></div>
        <dl className="mt-3 grid grid-cols-2 gap-3 border-y border-slate-200 py-3 text-xs sm:grid-cols-3 xl:grid-cols-6"><Fact label="Legacy score" value={formatLegacyScore(selected.legacyScore)} /><Fact label="Maximum marks" value="Unavailable" /><Fact label="Percentage" value="Unavailable" /><Fact label="Result reference" value={selected.resultReference ?? 'Not assigned'} /><Fact label="Verification" value="Unverified legacy record" /><Fact label="Publication" value="Unavailable" /></dl>
        <h3 className="mt-3 text-xs font-semibold text-slate-800">Question breakdown</h3><dl className="mt-2 grid grid-cols-2 gap-2 border-b border-slate-200 pb-3 text-xs sm:grid-cols-5"><Fact label="Correct" value="Unavailable" /><Fact label="Wrong" value="Unavailable" /><Fact label="Multiple" value="Unavailable" /><Fact label="Blank" value="Unavailable" /><Fact label="Uncertain" value="Unavailable" /></dl>
        <p className="mt-2 text-xs text-slate-600">Unverified legacy result — not an official published examination score. Question-level counts, answer-key revisions, scan references, and publication history are not stored in the current backend.</p>
      </section>}
    </section>
  );
}

function formatLegacyScore(score: number | null) {
  if (score === null) return '—';
  if (!Number.isInteger(score) || score < 0 || score > 100) return `Invalid legacy value (${score})`;
  return `${score} · unverified`;
}

function UnavailableCell() {
  return <td className="px-3 py-2 text-slate-500" aria-label="Unavailable in legacy data" title="Not stored in the current backend">—</td>;
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-slate-500">{label}</dt><dd className="mt-1 break-words font-semibold text-slate-900">{value}</dd></div>;
}

function slug(value: string) {
  return value.normalize('NFKD').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 48) || 'session';
}
