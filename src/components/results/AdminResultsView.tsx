import { useMemo, useState } from 'react';
import { Download, FileSpreadsheet, FileText, History, SearchCheck } from 'lucide-react';
import { DEMO_EXAMINATIONS, DEMO_RESULTS } from './ResultsDemoData';
import { ResultsFilters } from './ResultsFilters';
import { ResultsTable } from './ResultsTable';
import { StudentResultDetail } from './StudentResultDetail';
import { downloadResultsCsv, downloadResultsXlsx } from './ResultsExport';
import { BackendResultsView } from './BackendResultsView';
import type { DemoStudentResult, ExportScope, ResultFilters as FiltersState, ResultStatus } from './ResultsTypes';

interface AuditEntry { id: string; action: string; count: number; time: string; }

export function AdminResultsView() {
  const [source, setSource] = useState<'backend' | 'demo'>('backend');
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
        <p className="text-xs text-slate-600">Choose the data source for this view.</p>
        <div role="group" aria-label="Results data source" className="inline-flex rounded-md border border-slate-300 p-0.5">
          <button type="button" aria-pressed={source === 'backend'} onClick={() => setSource('backend')} className={`rounded px-3 py-1.5 text-xs font-semibold ${source === 'backend' ? 'bg-[#185b9d] text-white' : 'text-slate-700 hover:bg-slate-50'}`}>Connected data</button>
          <button type="button" aria-pressed={source === 'demo'} onClick={() => setSource('demo')} className={`rounded px-3 py-1.5 text-xs font-semibold ${source === 'demo' ? 'bg-[#185b9d] text-white' : 'text-slate-700 hover:bg-slate-50'}`}>Demo data</button>
        </div>
      </div>
      {source === 'backend' ? <BackendResultsView /> : <DemoResultsView />}
    </div>
  );
}

function DemoResultsView() {
  const [examinationId, setExaminationId] = useState(DEMO_EXAMINATIONS[0].id);
  const [query, setQuery] = useState<FiltersState>({ query: '', className: 'All classes', status: 'All statuses', minimumMarks: '', maximumMarks: '' });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [overrides, setOverrides] = useState<Record<string, ResultStatus>>({});
  const [detail, setDetail] = useState<DemoStudentResult | null>(null);
  const [exportScope, setExportScope] = useState<ExportScope>('filtered');
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const exam = DEMO_EXAMINATIONS.find((item) => item.id === examinationId)!;

  const examRows = useMemo(() => DEMO_RESULTS.filter((row) => row.examinationId === examinationId).map((row) => ({
    ...row,
    status: overrides[row.id] ?? row.status,
    reviewReason: overrides[row.id] === 'Published' ? '' : row.reviewReason,
  })), [examinationId, overrides]);
  const classes = useMemo(() => [...new Set(examRows.map((row) => row.className))].sort(), [examRows]);
  const filteredRows = useMemo(() => {
    const search = query.query.trim().toLowerCase();
    const minimum = query.minimumMarks === '' ? null : Number(query.minimumMarks);
    const maximum = query.maximumMarks === '' ? null : Number(query.maximumMarks);
    return examRows.filter((row) => {
      const searchable = !search || row.studentName.toLowerCase().includes(search) || row.rollNumber.toLowerCase().includes(search);
      const matchesStatus = query.status === 'All statuses' || row.status === query.status;
      const matchesClass = query.className === 'All classes' || row.className === query.className;
      const matchesMarks = (minimum === null || (row.obtainedMarks !== null && row.obtainedMarks >= minimum)) && (maximum === null || (row.obtainedMarks !== null && row.obtainedMarks <= maximum));
      return searchable && matchesStatus && matchesClass && matchesMarks;
    });
  }, [examRows, query]);

  const metrics = useMemo(() => {
    const scanned = examRows.filter((row) => !['Draft', 'Processing'].includes(row.status)).length;
    const processed = examRows.filter((row) => ['Review Required', 'Verified', 'Published', 'Withheld'].includes(row.status)).length;
    const verified = examRows.filter((row) => ['Verified', 'Published'].includes(row.status));
    const published = examRows.filter((row) => row.status === 'Published').length;
    const pending = examRows.filter((row) => ['Draft', 'Processing', 'Review Required'].includes(row.status)).length;
    const review = examRows.filter((row) => row.status === 'Review Required').length;
    const validMarks = verified.flatMap((row) => row.obtainedMarks === null ? [] : [row.obtainedMarks]);
    const average = validMarks.length ? Math.round(validMarks.reduce((sum, mark) => sum + mark, 0) / validMarks.length) : null;
    return { scanned, processed, verified: verified.length, published, pending, review, invalid: Math.round(examRows.length * 0.0045), average, highest: validMarks.length ? Math.max(...validMarks) : null, lowest: validMarks.length ? Math.min(...validMarks) : null };
  }, [examRows]);

  const updateStatus = (rows: DemoStudentResult[], status: 'Published' | 'Withheld') => {
    const eligible = rows.filter((row) => status === 'Published' ? row.status === 'Verified' : ['Verified', 'Published'].includes(row.status));
    if (!eligible.length) return;
    const next = { ...overrides };
    for (const row of eligible) next[row.id] = status;
    setOverrides(next);
    const now = new Date().toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' });
    setAudit((items) => [{ id: `${Date.now()}`, action: status === 'Published' ? 'Published demo results' : 'Withheld demo results', count: eligible.length, time: now }, ...items].slice(0, 6));
    setSelectedIds(new Set());
    setDetail(null);
  };

  const exportRows = useMemo(() => {
    switch (exportScope) {
      case 'all': return examRows;
      case 'verified': return examRows.filter((row) => ['Verified', 'Published'].includes(row.status));
      case 'published': return examRows.filter((row) => row.status === 'Published');
      case 'pending': return examRows.filter((row) => ['Draft', 'Processing', 'Review Required'].includes(row.status));
      case 'selected': return examRows.filter((row) => selectedIds.has(row.id));
      default: return filteredRows;
    }
  }, [exportScope, examRows, filteredRows, selectedIds]);
  const filename = `AZM-DEMO-${exam.subject.replace(/[^a-z0-9]+/gi, '-')}-${exportScope}`;

  return (
    <div className="space-y-4" data-testid="admin-results-view">
      <div role="note" className="flex items-start gap-2 border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950"><SearchCheck size={15} className="mt-0.5 shrink-0" /><p><strong>DEMO DATA — NOT OFFICIAL.</strong> These 4,000 fictional student records are held only in this page. Status changes and exports are local demonstrations and do not publish official results.</p></div>

      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-end md:justify-between">
        <label className="max-w-xl flex-1 text-xs font-semibold text-slate-700">Examination
          <select value={examinationId} onChange={(event) => { setExaminationId(event.target.value); setSelectedIds(new Set()); setQuery({ query: '', className: 'All classes', status: 'All statuses', minimumMarks: '', maximumMarks: '' }); }} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal focus:border-[#185b9d] focus:outline-none focus:ring-2 focus:ring-blue-100">{DEMO_EXAMINATIONS.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.subject} · {item.className}</option>)}</select>
        </label>
        <dl className="grid grid-cols-2 gap-x-5 gap-y-1 text-xs text-slate-600 sm:grid-cols-4"><div><dt>Exam date</dt><dd className="font-semibold text-slate-900">{exam.date}</dd></div><div><dt>Maximum marks</dt><dd className="font-semibold text-slate-900">{exam.maximumMarks}</dd></div><div><dt>Registered</dt><dd className="font-semibold text-slate-900">{exam.registeredStudents.toLocaleString()}</dd></div><div><dt>Processing state</dt><dd className="font-semibold text-slate-900">Demo · mixed statuses</dd></div></dl>
      </div>

      <dl className="grid grid-cols-2 gap-y-2 border-b border-slate-200 pb-3 text-xs sm:grid-cols-4 xl:grid-cols-8">
        <Metric label="Students" value={examRows.length.toLocaleString()} /><Metric label="Scanned papers" value={metrics.scanned.toLocaleString()} /><Metric label="Processed" value={metrics.processed.toLocaleString()} /><Metric label="Verified" value={metrics.verified.toLocaleString()} /><Metric label="Published" value={metrics.published.toLocaleString()} /><Metric label="Pending" value={metrics.pending.toLocaleString()} /><Metric label="Review required" value={metrics.review.toLocaleString()} /><Metric label="Invalid sheets" value={metrics.invalid.toLocaleString()} />
      </dl>
      <dl className="grid grid-cols-3 gap-y-2 border-b border-slate-200 pb-3 text-xs sm:grid-cols-4"><Metric label="Verified average" value={metrics.average === null ? '—' : `${metrics.average} / 100`} /><Metric label="Highest" value={metrics.highest === null ? '—' : `${metrics.highest} / 100`} /><Metric label="Lowest" value={metrics.lowest === null ? '—' : `${metrics.lowest} / 100`} /><Metric label="Pass rate" value="Not configured" /></dl>

      <ResultsFilters value={query} classes={classes} onChange={setQuery} />

      <section aria-label="Result management actions" className="flex flex-col gap-3 border-b border-slate-200 pb-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button type="button" disabled={!selectedIds.size} onClick={() => updateStatus(examRows.filter((row) => selectedIds.has(row.id)), 'Published')} className="rounded-md bg-[#185b9d] px-3 py-2 font-semibold text-white disabled:opacity-40">Publish selected verified</button>
          <button type="button" disabled={!selectedIds.size} onClick={() => updateStatus(examRows.filter((row) => selectedIds.has(row.id)), 'Withheld')} className="rounded-md border border-slate-300 px-3 py-2 font-semibold text-slate-700 disabled:opacity-40">Withhold selected</button>
          <span className="text-slate-500">{selectedIds.size.toLocaleString()} selected · only verified results can be published</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="results-export-scope">Export scope</label><select id="results-export-scope" value={exportScope} onChange={(event) => setExportScope(event.target.value as ExportScope)} className="rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs">
            <option value="filtered">Currently filtered</option><option value="all">All for examination</option><option value="verified">Verified</option><option value="published">Published</option><option value="pending">Pending / review report</option><option value="selected">Selected records</option>
          </select>
          <button type="button" disabled={!exportRows.length} onClick={() => downloadResultsCsv(exportRows, `${filename}.csv`)} className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold disabled:opacity-40"><FileText size={14} /> CSV</button>
          <button type="button" disabled={!exportRows.length} onClick={() => downloadResultsXlsx(exportRows, `${filename}.xlsx`)} className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold disabled:opacity-40"><FileSpreadsheet size={14} /> Excel</button>
          <span className="sr-only" aria-live="polite"><Download size={12} /> Exports include a DEMO / NOT OFFICIAL label.</span>
        </div>
      </section>

      <ResultsTable rows={filteredRows} selectedIds={selectedIds} onSelectionChange={setSelectedIds} onView={setDetail} />

      <section aria-label="Demo publication history" className="border-t border-slate-200 pt-3">
        <h2 className="flex items-center gap-2 text-xs font-semibold text-slate-800"><History size={14} /> Demo publication history</h2>
        {audit.length ? <ol className="mt-2 space-y-1 text-[11px] text-slate-600">{audit.map((entry) => <li key={entry.id}>{entry.time} · {entry.action} · {entry.count.toLocaleString()} fictional record(s)</li>)}</ol> : <p className="mt-1 text-[11px] text-slate-500">No demo publication actions in this page session.</p>}
      </section>

      {detail && <StudentResultDetail result={{ ...detail, status: overrides[detail.id] ?? detail.status }} onClose={() => setDetail(null)} onStatusChange={(row, status) => updateStatus([row], status)} />}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="border-l border-slate-200 pl-3 first:border-0 first:pl-0"><dt className="text-slate-500">{label}</dt><dd className="mt-0.5 font-semibold tabular-nums text-slate-900">{value}</dd></div>; }
