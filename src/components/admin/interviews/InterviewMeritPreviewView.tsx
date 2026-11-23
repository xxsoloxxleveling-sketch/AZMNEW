import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Loader2, RefreshCw } from 'lucide-react';
import { assessmentApi } from './assessmentApi';
import type { MeritAwardCode, MeritPreview, MeritPreviewRow } from './assessmentApi';
import { formatAssessmentScore, safeCsvCell } from './assessmentViewModel';
import { assessmentUi as ui, writtenMarkLabel } from './assessmentUi';
import { maximumMeritListSize, meritGroupingLabel, meritRank, meritSortOptions, meritWrittenContribution, parseMeritListLimit, selectMeritRows, sortMeritRows } from './meritViewModel';
import type { MeritGrouping, MeritSortField, SortDirection } from './meritViewModel';
import { meritAwardLabel, meritAwardOptions, meritRegistrationLabel, meritScholarshipLabel } from './meritAwards';

const statusLabels: Record<MeritPreviewRow['status'], string> = {
  READY: 'Ready', INCOMPLETE: 'Incomplete', ABSENT: 'Absent', SOURCE_CHANGED: 'Source changed',
};
type AwardDraft = { awardCode: MeritAwardCode | null; expectedRevision: number; idempotencyKey: string };

export function InterviewMeritPreviewView({ roundId, roundTitle = 'Interview merit review', sessionRef = '2026-V' }: {
  roundId: string;
  roundTitle?: string;
  sessionRef?: string;
}) {
  const [data, setData] = useState<MeritPreview | null>(null);
  const [grouping, setGrouping] = useState<MeritGrouping>('overall');
  const [className, setClassName] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<MeritSortField>('total');
  const [direction, setDirection] = useState<SortDirection>('desc');
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exportingPdf, setExportingPdf] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const [documentTitle, setDocumentTitle] = useState('');
  const [limitMode, setLimitMode] = useState('all');
  const [customLimit, setCustomLimit] = useState('20');
  const [awardDrafts, setAwardDrafts] = useState<Record<string, AwardDraft>>({});
  const [awardErrors, setAwardErrors] = useState<Record<string, string>>({});
  const [unconfirmedSaves, setUnconfirmedSaves] = useState<Record<string, true>>({});
  const [awardNotice, setAwardNotice] = useState('');
  const [savingAward, setSavingAward] = useState<string | null>(null);
  const savingAwardRef = useRef(false);

  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    void assessmentApi.merit(roundId, className).then(result => { if (active) setData(result); })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : 'Unable to load merit preview.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [roundId, className, refresh]);

  const supportsOverall = data?.overallRankMethod === 'SHARED_COMPETITION_ALL_CLASSES';
  const supportsAwards = data?.manualAwardsEnabled === true;
  // An older server can still provide class ranks. Never present those as overall ranks.
  const effectiveGrouping: MeritGrouping = data && !supportsOverall ? 'class' : grouping;
  const limit = parseMeritListLimit(limitMode, customLimit);
  const limited = limitMode !== 'all';
  const effectiveStatus = limited ? 'READY' : status;
  const matches = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (loading || error ? [] : data?.rows ?? []).filter(row => (!effectiveStatus || row.status === effectiveStatus) &&
      (!term || row.studentName.toLowerCase().includes(term) || (row.rollNumber ?? '').toLowerCase().includes(term)));
  }, [data, effectiveStatus, search, loading, error]);
  const selection = useMemo(() => selectMeritRows(matches, limit.limit, supportsOverall, !!className),
    [matches, limit.limit, supportsOverall, className]);
  const selectionError = limit.error || selection.error;
  const filtered = useMemo(() => selectionError ? [] : sortMeritRows(selection.rows, sortBy, direction, effectiveGrouping),
    [selection.rows, selectionError, sortBy, direction, effectiveGrouping]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / 25));
  const currentPage = Math.min(page, totalPages);
  const rows = filtered.slice((currentPage - 1) * 25, currentPage * 25);
  const draftCount = Object.keys(awardDrafts).length;
  const requiresAwardReload = Object.keys(unconfirmedSaves).length > 0;
  const controlsLocked = savingAward !== null || draftCount > 0 || requiresAwardReload || exportingPdf;
  const cannotExport = loading || !data || !!error || !!selectionError || filtered.length === 0 || draftCount > 0 || requiresAwardReload || savingAward !== null;

  function recalculatePreview() {
    setLoading(true);
    setRefresh(value => value + 1);
  }

  function changeAward(row: MeritPreviewRow, code: string) {
    const awardCode = (code || null) as MeritAwardCode | null;
    setAwardNotice('');
    if (!unconfirmedSaves[row.placementId]) setAwardErrors(current => { const next = { ...current }; delete next[row.placementId]; return next; });
    setAwardDrafts(current => {
      const next = { ...current };
      if (awardCode === (row.meritAward?.awardCode ?? null)) delete next[row.placementId];
      else next[row.placementId] = { awardCode, expectedRevision: row.meritAward?.revision ?? 0, idempotencyKey: crypto.randomUUID() };
      return next;
    });
  }

  async function saveAward(row: MeritPreviewRow) {
    const draft = awardDrafts[row.placementId];
    if (!draft || savingAwardRef.current || loading || !supportsAwards) return;
    savingAwardRef.current = true;
    setSavingAward(row.placementId); setAwardNotice('');
    setAwardErrors(current => { const next = { ...current }; delete next[row.placementId]; return next; });
    try {
      // The same draft retains its key after an ambiguous network failure.
      const saved = await assessmentApi.saveMeritAward(roundId, row.placementId, draft);
      setData(current => current ? { ...current, rows: current.rows.map(candidate => candidate.placementId === row.placementId
        ? { ...candidate, meritAward: saved } : candidate) } : current);
      setAwardDrafts(current => { const next = { ...current }; delete next[row.placementId]; return next; });
      setUnconfirmedSaves(current => { const next = { ...current }; delete next[row.placementId]; return next; });
      setAwardNotice(`${row.studentName}: ${saved.awardCode ? meritAwardLabel(saved.awardCode) + ' saved.' : 'Award cleared.'}`);
    } catch (err) {
      // A timeout may follow a committed save. Discarding or reverting a draft
      // must not re-enable downloads of a now-stale stored award.
      setUnconfirmedSaves(current => ({ ...current, [row.placementId]: true }));
      setAwardErrors(current => ({ ...current, [row.placementId]: err instanceof Error ? err.message : 'Unable to save the award. Please try again.' }));
    } finally {
      savingAwardRef.current = false;
      setSavingAward(null);
    }
  }

  function discardAwardChanges(reload = false) {
    setAwardDrafts({}); setAwardErrors({}); setAwardNotice('');
    if (reload || requiresAwardReload) {
      setUnconfirmedSaves({});
      recalculatePreview();
    }
  }

  async function downloadPdf() {
    if (!data || cannotExport || exportingPdf) return;
    setExportingPdf(true); setPdfError('');
    try {
      const { exportMeritPdf } = await import('./meritPdf');
      await exportMeritPdf({
        rows: filtered,
        policyVersion: data.policyVersion,
        roundTitle,
        sessionRef,
        grouping: effectiveGrouping,
        documentTitle,
        filters: {
          className,
          readiness: effectiveStatus ? statusLabels[effectiveStatus as MeritPreviewRow['status']] : 'All candidates',
          search: search.trim(),
          sortLabel: meritSortOptions.find(option => option.value === sortBy)!.label,
          direction,
        },
      });
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : 'Unable to create the merit PDF. Please try again.');
    } finally {
      setExportingPdf(false);
    }
  }

  function exportCsv() {
    if (!data || cannotExport) return;
    const headings = ['Preview status', 'Class', effectiveGrouping === 'overall' ? 'Overall merit rank' : 'Class merit rank', 'Roll number', 'Student', 'Panel', 'Batch', 'Final written /100', 'Written /60', 'Interview average /20', 'Activities /10', 'Academic /5', 'Personality average /5', 'Total /100', 'Assessment status', 'Readiness', 'Review required', 'Policy version', 'Scholarship Category', 'Merit grouping'];
    const csvRows = filtered.map(row => [
      'PROVISIONAL - NOT PUBLISHED', row.className, meritRank(row, effectiveGrouping), row.rollNumber, row.studentName, row.panel, row.batch,
      row.written.isFinal ? row.written.marks : null, meritWrittenContribution(row), row.totals.interview, row.totals.extracurricular,
      row.totals.academic, row.totals.personality, row.status === 'READY' ? row.totals.total : null,
      row.assessmentStatus ?? 'Not entered', statusLabels[row.status], row.issues.join('; '), data.policyVersion, meritScholarshipLabel(row), meritGroupingLabel(effectiveGrouping),
    ]);
    const csv = '\uFEFF' + [headings, ...csvRows].map(row => row.map(safeCsvCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url; link.download = `AZM_Session_V_Provisional_Merit_${effectiveGrouping === 'overall' ? 'Overall' : 'By-Class'}_Preview.csv`;
    document.body.appendChild(link); link.click(); link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <section className="space-y-4" aria-label="Private provisional merit preview">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-sm font-semibold text-slate-900">Merit preview</h3><p className="mt-1 text-sm text-slate-600">{effectiveGrouping === 'overall' ? 'One private, provisional merit ranking across all classes.' : 'Private, provisional merit rankings within each class.'} Equal exact totals share a rank. Administrators choose and save General Merit awards manually.</p></div><button className={ui.button} type="button" disabled={loading || controlsLocked} onClick={recalculatePreview}><RefreshCw size={15} />Recalculate preview</button></div>
    <div className="border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">Written exam 60 + interview 20 + activities 10 + previous academics 5 + personality 5 = 100. Only complete, submitted assessments with current verified sources receive a rank.</div>
    {error && <div role="alert" className={ui.error}>{error}<button className={ui.button + ' ml-3'} type="button" disabled={loading} onClick={recalculatePreview}>Retry</button></div>}
    {data && !loading && !error && <dl className="grid grid-cols-2 gap-4 border-y border-slate-200 py-3 sm:grid-cols-4">{[
      ['Candidates', data.summary.total], ['Ready', data.summary.ready], ['Incomplete / review', data.summary.incomplete], ['Absent', data.summary.absent],
    ].map(([label, value]) => <div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{value}</dd></div>)}</dl>}
    <div className="space-y-3 border border-slate-200 bg-white p-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <label className="min-w-0"><span className={ui.label}>Merit grouping</span><select aria-label="Merit grouping" className={ui.input} value={effectiveGrouping} disabled={loading || controlsLocked} onChange={event => { setGrouping(event.target.value as MeritGrouping); setPage(1); }}><option value="overall" disabled={!!data && !supportsOverall}>All classes together</option><option value="class">Separate by class</option></select></label>
        <label className="min-w-0"><span className={ui.label}>Class filter</span><select aria-label="Class filter" className={ui.input} value={className} disabled={controlsLocked} onChange={event => { setLoading(true); setClassName(event.target.value); setPage(1); }}><option value="">All classes</option>{data?.classOptions.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
        <label className="min-w-0"><span className={ui.label}>Readiness</span><select aria-label="Readiness" className={ui.input} value={effectiveStatus} disabled={limited || loading || controlsLocked} onChange={event => { setStatus(event.target.value); setPage(1); }}><option value="">All candidates</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="min-w-0"><span className={ui.label}>Name or roll number</span><input aria-label="Name or roll number" className={ui.input} value={search} disabled={controlsLocked} onChange={event => { setSearch(event.target.value); setPage(1); }} /></label>
        <label className="min-w-0"><span className={ui.label}>Sort by</span><select aria-label="Sort by" className={ui.input} value={sortBy} disabled={loading || controlsLocked} onChange={event => { setSortBy(event.target.value as MeritSortField); setPage(1); }}>{meritSortOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <label className="min-w-0"><span className={ui.label}>Order</span><select aria-label="Order" className={ui.input} value={direction} disabled={loading || controlsLocked} onChange={event => { setDirection(event.target.value as SortDirection); setPage(1); }}><option value="asc">Ascending</option><option value="desc">Descending</option></select></label>
      </div>
      {data && !loading && !error && !supportsOverall && <p role="status" className="text-sm text-amber-800">Combined merit is currently unavailable. Separate class ranks are shown.</p>}
      <div className="grid gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2 xl:grid-cols-4">
        <label className="min-w-0 sm:col-span-2"><span className={ui.label}>PDF title</span><input aria-label="PDF title" className={ui.input} maxLength={120} value={documentTitle} disabled={exportingPdf} placeholder="e.g. Session V Part 1 Merit List" onChange={event => { setDocumentTitle(event.target.value); setPdfError(''); }} /><span className="mt-1 block text-xs text-slate-500">Used as the report heading and download filename. Leave blank for the standard merit title.</span></label>
        <label className="min-w-0"><span className={ui.label}>Students in merit list</span><select aria-label="Students in merit list" className={ui.input} value={limitMode} disabled={loading || controlsLocked} onChange={event => { setLimitMode(event.target.value); setPage(1); }}><option value="all">All matching candidates</option>{['20', '50', '100', '200'].map(value => <option key={value} value={value} disabled={!supportsOverall && !className}>Top {value} students</option>)}<option value="custom" disabled={!supportsOverall && !className}>Custom number</option></select></label>
        {limitMode === 'custom' && <label className="min-w-0"><span className={ui.label}>Custom student limit</span><input aria-label="Custom student limit" className={ui.input} type="number" min={1} max={maximumMeritListSize} step={1} value={customLimit} disabled={loading || controlsLocked} aria-invalid={!!limit.error} onChange={event => { setCustomLimit(event.target.value); setPage(1); }} /></label>}
      </div>
      {limited && <p className="text-xs text-slate-500">Selects the top ready candidates matching your filters before display sorting. This is one total limit across the list, including when classes are shown separately.</p>}
      {!!selectionError && !loading && !error && <p role="alert" className={ui.error}>{selectionError}</p>}
      {selection.includeTiesCount !== null && !selectionError && !loading && <div role="status" className="flex flex-wrap items-center gap-2 border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"><span>The {filtered.length}-student limit splits shared rank #{selection.cutoffRank}. Include all tied candidates to make a {selection.includeTiesCount}-student list.</span><button type="button" className={ui.button} disabled={controlsLocked} onClick={() => { setCustomLimit(String(selection.includeTiesCount)); setLimitMode('custom'); setPage(1); }}>Include all tied candidates</button></div>}
      {data && !loading && !error && !supportsAwards && <p role="status" className="text-sm text-amber-800">Manual awards are currently unavailable. General Merit awards remain unassigned in downloads.</p>}
      {draftCount > 0 && <div role="status" className="flex flex-wrap items-center gap-2 border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"><span>{draftCount} unsaved award {draftCount === 1 ? 'choice' : 'choices'}. Save or discard these choices before changing filters or downloading.</span><button className={ui.button} type="button" disabled={savingAward !== null} onClick={() => discardAwardChanges()}>Discard unsaved awards</button></div>}
      {requiresAwardReload && <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500"><span>A save could not be confirmed. Reloading current awards discards unsaved choices and retrieves the latest saved decisions before downloading.</span><button className={ui.button} type="button" disabled={savingAward !== null || loading} onClick={() => discardAwardChanges(true)}>Reload current awards</button></div>}
      {awardNotice && <p role="status" className={ui.notice}>{awardNotice}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
        <p className="text-xs text-slate-500">{limited ? `${filtered.length} selected of ${selection.available} matching ready candidates` : `${filtered.length} matching candidates`} · downloads include all selected pages in the selected order.</p>
        <div className="flex flex-wrap gap-2">
          <button className={ui.button} type="button" disabled={cannotExport || exportingPdf} onClick={exportCsv}><Download size={15} />Export CSV</button>
          <button className={ui.primary} type="button" disabled={cannotExport || exportingPdf} aria-busy={exportingPdf} onClick={() => void downloadPdf()}>{exportingPdf ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}{exportingPdf ? 'Preparing PDF…' : 'Download PDF'}</button>
        </div>
      </div>
      <p className="text-xs text-slate-500">{effectiveGrouping === 'overall'
        ? `Overall ranks compare ${!loading && !error && data?.overallRankedCandidates !== undefined ? data.overallRankedCandidates + ' ready candidates' : 'all ready candidates'} across all classes in this round. Filters and display order preserve those ranks and shared ties.`
        : 'Each class has its own ranks. Sorting applies within each class; filters and display order preserve the original ranks and shared ties.'}</p>
    </div>
    {pdfError && <div role="alert" className={ui.error}>{pdfError}</div>}
    {loading && <p role="status" className="flex items-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" />Calculating current merit preview…</p>}
    <div className="border border-slate-200 bg-white">
      <div className="overflow-x-auto"><table className="w-full min-w-[1320px]"><thead><tr>{[effectiveGrouping === 'overall' ? 'Class / overall rank' : 'Class / rank', 'Candidate', 'Written /60', 'Interview /20', 'Activities /10', 'Academic /5', 'Personality /5', 'Total /100', 'Readiness', 'Scholarship Category'].map(heading => <th key={heading} className={ui.th}>{heading}</th>)}</tr></thead><tbody>
        {rows.map(row => {
          const rank = meritRank(row, effectiveGrouping);
          return <tr key={row.placementId}>
          <td className={ui.td}><span className="block text-xs text-slate-500">{row.className}</span><span className="font-semibold tabular-nums text-slate-900">{rank === null ? 'Unranked' : '#' + rank}</span></td>
          <td className={ui.td}><span className="block font-medium text-slate-900">{row.studentName}</span><span className="block text-xs text-slate-500">{row.rollNumber ?? 'No roll number'} · Panel {row.panel} / {row.batch}</span><span className="block text-xs text-slate-500">{writtenMarkLabel(row.written)}</span></td>
          <td className={ui.td + ' tabular-nums'}>{formatAssessmentScore(meritWrittenContribution(row))}</td><td className={ui.td + ' tabular-nums'}>{formatAssessmentScore(row.totals.interview)}</td><td className={ui.td + ' tabular-nums'}>{formatAssessmentScore(row.totals.extracurricular)}</td><td className={ui.td + ' tabular-nums'}>{formatAssessmentScore(row.totals.academic)}</td><td className={ui.td + ' tabular-nums'}>{formatAssessmentScore(row.totals.personality)}</td><td className={ui.td + ' font-semibold tabular-nums'}>{row.status === 'READY' ? formatAssessmentScore(row.totals.total) : '—'}</td>
          <td className={ui.td}><span className={row.status === 'READY' ? 'font-medium text-emerald-700' : 'text-amber-800'}>{statusLabels[row.status]}</span>{row.issues.length > 0 && <details className="mt-1 max-w-64 text-xs text-slate-500"><summary className="cursor-pointer">Review details</summary><ul className="mt-1 list-disc pl-4">{row.issues.map(issue => <li key={issue}>{issue}</li>)}</ul></details>}</td>
          <td className={ui.td + ' min-w-64'}>
            <span className="mb-1 block text-xs text-slate-500">{meritRegistrationLabel(row.scholarshipCategory)}</span>
            {supportsAwards && (row.scholarshipCategory === 'GENERAL_MERIT' || row.meritAward?.awardCode) ? <div className="space-y-2">
              <select aria-label={`Award for ${row.studentName}`} className={ui.input} value={awardDrafts[row.placementId] ? awardDrafts[row.placementId].awardCode ?? '' : row.meritAward?.awardCode ?? ''} disabled={savingAward !== null || loading || exportingPdf} onChange={event => changeAward(row, event.target.value)}>
                <option value="">Not assigned</option>
                {(row.scholarshipCategory === 'GENERAL_MERIT' ? meritAwardOptions : meritAwardOptions.filter(option => option.value === row.meritAward?.awardCode)).map(option => <option key={option.value} value={option.value} disabled={row.scholarshipCategory !== 'GENERAL_MERIT'}>{option.label}</option>)}
              </select>
              {row.scholarshipCategory !== 'GENERAL_MERIT' && <p className="text-xs text-amber-800">Registration category changed. Clear the previous General Merit award.</p>}
              <button aria-label={`Save award for ${row.studentName}`} type="button" className={ui.button} disabled={!awardDrafts[row.placementId] || savingAward !== null || loading || exportingPdf} onClick={() => void saveAward(row)}>{savingAward === row.placementId ? <><Loader2 size={13} className="animate-spin" />Saving…</> : 'Save award'}</button>
              {row.meritAward?.actorName && <span className="block text-xs text-slate-500">Saved by {row.meritAward.actorName}</span>}
              {awardErrors[row.placementId] && <p role="alert" className="max-w-72 text-xs text-red-700">{awardErrors[row.placementId]}</p>}
            </div> : row.scholarshipCategory === 'GENERAL_MERIT' ? <span className="text-xs text-slate-500">Not assigned</span> : null}
          </td>
        </tr>; })}
        {data && !loading && !error && rows.length === 0 && <tr><td colSpan={10} className="p-6 text-center text-sm text-slate-500">No candidates match these filters.</td></tr>}
      </tbody></table></div>
      <div className="flex flex-wrap items-center justify-between gap-2 p-3"><span className="text-xs text-slate-500">{filtered.length} candidates · page {currentPage} of {totalPages} · {effectiveGrouping === 'overall' ? 'overall ranks across all classes' : 'rankings are within each class'}</span><div className="flex gap-2"><button className={ui.button} type="button" disabled={currentPage <= 1 || loading || controlsLocked} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={15} />Previous</button><button className={ui.button} type="button" disabled={currentPage >= totalPages || loading || controlsLocked} onClick={() => setPage(currentPage + 1)}>Next<ChevronRight size={15} /></button></div></div>
    </div>
    <p className="text-xs text-slate-500">General Merit awards are assigned only when an administrator saves a choice. Sorting, student limits and downloads never assign or change awards. PDF and CSV downloads remain private provisional review copies. Written exam marks remain final and verified.</p>
  </section>;
}
