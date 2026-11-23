import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Loader2, RefreshCw } from 'lucide-react';
import { assessmentApi } from './assessmentApi';
import type { MeritPreview, MeritPreviewRow } from './assessmentApi';
import { formatAssessmentScore, safeCsvCell } from './assessmentViewModel';
import { assessmentUi as ui, writtenMarkLabel } from './assessmentUi';
import { meritSortOptions, meritWrittenContribution, sortMeritRows } from './meritViewModel';
import type { MeritSortField, SortDirection } from './meritViewModel';

const statusLabels: Record<MeritPreviewRow['status'], string> = {
  READY: 'Ready', INCOMPLETE: 'Incomplete', ABSENT: 'Absent', SOURCE_CHANGED: 'Source changed',
};

export function InterviewMeritPreviewView({ roundId, roundTitle = 'Interview merit review', sessionRef = '2026-V' }: {
  roundId: string;
  roundTitle?: string;
  sessionRef?: string;
}) {
  const [data, setData] = useState<MeritPreview | null>(null);
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

  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    void assessmentApi.merit(roundId, className).then(result => { if (active) setData(result); })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : 'Unable to load merit preview.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [roundId, className, refresh]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const matches = (loading || error ? [] : data?.rows ?? []).filter(row => (!status || row.status === status) &&
      (!term || row.studentName.toLowerCase().includes(term) || (row.rollNumber ?? '').toLowerCase().includes(term)));
    return sortMeritRows(matches, sortBy, direction);
  }, [data, status, search, sortBy, direction, loading, error]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / 25));
  const currentPage = Math.min(page, totalPages);
  const rows = filtered.slice((currentPage - 1) * 25, currentPage * 25);
  const cannotExport = loading || !data || !!error || filtered.length === 0;

  function recalculatePreview() {
    setLoading(true);
    setRefresh(value => value + 1);
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
        filters: {
          className,
          readiness: status ? statusLabels[status as MeritPreviewRow['status']] : 'All candidates',
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
    if (!data || loading || error) return;
    const headings = ['Preview status', 'Class', 'Class merit rank', 'Roll number', 'Student', 'Panel', 'Batch', 'Final written /100', 'Written /60', 'Interview average /20', 'Activities /10', 'Academic /5', 'Personality average /5', 'Total /100', 'Assessment status', 'Readiness', 'Review required', 'Policy version'];
    const csvRows = filtered.map(row => [
      'PROVISIONAL - NOT PUBLISHED', row.className, row.rank, row.rollNumber, row.studentName, row.panel, row.batch,
      row.written.isFinal ? row.written.marks : null, meritWrittenContribution(row), row.totals.interview, row.totals.extracurricular,
      row.totals.academic, row.totals.personality, row.status === 'READY' ? row.totals.total : null,
      row.assessmentStatus ?? 'Not entered', statusLabels[row.status], row.issues.join('; '), data.policyVersion,
    ]);
    const csv = '\uFEFF' + [headings, ...csvRows].map(row => row.map(safeCsvCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url; link.download = 'AZM_Session_V_Provisional_Merit_Preview.csv';
    document.body.appendChild(link); link.click(); link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <section className="space-y-4" aria-label="Private provisional merit preview">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-sm font-semibold text-slate-900">Merit preview</h3><p className="mt-1 text-sm text-slate-600">Private, provisional ranking within each class. Equal totals share a rank. Scholarship decisions and public result publication are separate.</p></div><button className={ui.button} type="button" disabled={loading} onClick={recalculatePreview}><RefreshCw size={15} />Recalculate preview</button></div>
    <div className="border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">Written exam 60 + interview 20 + activities 10 + previous academics 5 + personality 5 = 100. Only complete, submitted assessments with current verified sources receive a rank.</div>
    {error && <div role="alert" className={ui.error}>{error}<button className={ui.button + ' ml-3'} type="button" disabled={loading} onClick={recalculatePreview}>Retry</button></div>}
    {data && !loading && !error && <dl className="grid grid-cols-2 gap-4 border-y border-slate-200 py-3 sm:grid-cols-4">{[
      ['Candidates', data.summary.total], ['Ready', data.summary.ready], ['Incomplete / review', data.summary.incomplete], ['Absent', data.summary.absent],
    ].map(([label, value]) => <div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{value}</dd></div>)}</dl>}
    <div className="space-y-3 border border-slate-200 bg-white p-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-12">
        <label className="min-w-0 xl:col-span-3"><span className={ui.label}>Class ranking</span><select className={ui.input} value={className} onChange={event => { setLoading(true); setClassName(event.target.value); setPage(1); }}><option value="">All classes · ranked separately</option>{data?.classOptions.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
        <label className="min-w-0 xl:col-span-2"><span className={ui.label}>Readiness</span><select className={ui.input} value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}><option value="">All candidates</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="min-w-0 xl:col-span-3"><span className={ui.label}>Name or roll number</span><input className={ui.input} value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} /></label>
        <label className="min-w-0 xl:col-span-2"><span className={ui.label}>Sort by</span><select className={ui.input} value={sortBy} onChange={event => { setSortBy(event.target.value as MeritSortField); setPage(1); }}>{meritSortOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <label className="min-w-0 xl:col-span-2"><span className={ui.label}>Order</span><select className={ui.input} value={direction} onChange={event => { setDirection(event.target.value as SortDirection); setPage(1); }}><option value="asc">Ascending</option><option value="desc">Descending</option></select></label>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
        <p className="text-xs text-slate-500">{filtered.length} matching candidates · downloads include all matching pages in the selected order.</p>
        <div className="flex flex-wrap gap-2">
          <button className={ui.button} type="button" disabled={cannotExport} onClick={exportCsv}><Download size={15} />Export CSV</button>
          <button className={ui.primary} type="button" disabled={cannotExport || exportingPdf} aria-busy={exportingPdf} onClick={() => void downloadPdf()}>{exportingPdf ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}{exportingPdf ? 'Preparing PDF…' : 'Download PDF'}</button>
        </div>
      </div>
      <p className="text-xs text-slate-500">Sorting applies across all matching candidates. Original class ranks and shared ties stay unchanged.</p>
    </div>
    {pdfError && <div role="alert" className={ui.error}>{pdfError}</div>}
    {loading && <p role="status" className="flex items-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" />Calculating current merit preview…</p>}
    <div className="border border-slate-200 bg-white">
      <div className="overflow-x-auto"><table className="w-full min-w-[1100px]"><thead><tr>{['Class / rank', 'Candidate', 'Written /60', 'Interview /20', 'Activities /10', 'Academic /5', 'Personality /5', 'Total /100', 'Readiness'].map(heading => <th key={heading} className={ui.th}>{heading}</th>)}</tr></thead><tbody>
        {rows.map(row => <tr key={row.placementId}>
          <td className={ui.td}><span className="block text-xs text-slate-500">{row.className}</span><span className="font-semibold tabular-nums text-slate-900">{row.rank === null ? 'Unranked' : '#' + row.rank}</span></td>
          <td className={ui.td}><span className="block font-medium text-slate-900">{row.studentName}</span><span className="block text-xs text-slate-500">{row.rollNumber ?? 'No roll number'} · Panel {row.panel} / {row.batch}</span><span className="block text-xs text-slate-500">{writtenMarkLabel(row.written)}</span></td>
          <td className={ui.td + ' tabular-nums'}>{formatAssessmentScore(meritWrittenContribution(row))}</td><td className={ui.td + ' tabular-nums'}>{formatAssessmentScore(row.totals.interview)}</td><td className={ui.td + ' tabular-nums'}>{formatAssessmentScore(row.totals.extracurricular)}</td><td className={ui.td + ' tabular-nums'}>{formatAssessmentScore(row.totals.academic)}</td><td className={ui.td + ' tabular-nums'}>{formatAssessmentScore(row.totals.personality)}</td><td className={ui.td + ' font-semibold tabular-nums'}>{row.status === 'READY' ? formatAssessmentScore(row.totals.total) : '—'}</td>
          <td className={ui.td}><span className={row.status === 'READY' ? 'font-medium text-emerald-700' : 'text-amber-800'}>{statusLabels[row.status]}</span>{row.issues.length > 0 && <details className="mt-1 max-w-64 text-xs text-slate-500"><summary className="cursor-pointer">Review details</summary><ul className="mt-1 list-disc pl-4">{row.issues.map(issue => <li key={issue}>{issue}</li>)}</ul></details>}</td>
        </tr>)}
        {data && !loading && !error && rows.length === 0 && <tr><td colSpan={9} className="p-6 text-center text-sm text-slate-500">No candidates match these filters.</td></tr>}
      </tbody></table></div>
      <div className="flex flex-wrap items-center justify-between gap-2 p-3"><span className="text-xs text-slate-500">{filtered.length} candidates · page {currentPage} of {totalPages} · rankings are within class</span><div className="flex gap-2"><button className={ui.button} type="button" disabled={currentPage <= 1 || loading} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={15} />Previous</button><button className={ui.button} type="button" disabled={currentPage >= totalPages || loading} onClick={() => setPage(currentPage + 1)}>Next<ChevronRight size={15} /></button></div></div>
    </div>
    <p className="text-xs text-slate-500">PDF and CSV downloads are private review copies labelled provisional. Written exam marks remain final and verified. This screen does not publish results, assign scholarship categories or grant benefits.</p>
  </section>;
}
