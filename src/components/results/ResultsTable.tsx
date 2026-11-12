import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, ChevronsUpDown, Eye } from 'lucide-react';
import type { DemoStudentResult } from './ResultsTypes';

type SortKey = 'rollNumber' | 'studentName' | 'className' | 'obtainedMarks' | 'percentage' | 'status';

interface ResultsTableProps {
  rows: DemoStudentResult[];
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onView: (row: DemoStudentResult) => void;
}

const statusStyle: Record<DemoStudentResult['status'], string> = {
  Draft: 'text-slate-700', Processing: 'text-blue-700', 'Review Required': 'text-amber-800',
  Verified: 'text-emerald-800', Published: 'text-green-800', Withheld: 'text-red-700',
};

export function ResultsTable({ rows, selectedIds, onSelectionChange, onView }: ResultsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('rollNumber');
  const [ascending, setAscending] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const sorted = useMemo(() => [...rows].sort((a, b) => {
    const first = a[sortKey];
    const second = b[sortKey];
    const comparison = typeof first === 'number' || typeof second === 'number'
      ? Number(first ?? -1) - Number(second ?? -1)
      : String(first ?? '').localeCompare(String(second ?? ''), undefined, { numeric: true, sensitivity: 'base' });
    return ascending ? comparison : -comparison;
  }), [rows, sortKey, ascending]);
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageRows = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const allPageSelected = pageRows.length > 0 && pageRows.every((row) => selectedIds.has(row.id));

  useEffect(() => setPage(1), [rows]);

  const sort = (key: SortKey) => {
    if (key === sortKey) setAscending((value) => !value);
    else { setSortKey(key); setAscending(true); }
    setPage(1);
  };
  const heading = (key: SortKey, label: string) => {
    const Icon = sortKey === key ? ascending ? ChevronUp : ChevronDown : ChevronsUpDown;
    return <button type="button" onClick={() => sort(key)} className="inline-flex items-center gap-1 font-semibold text-slate-700 hover:text-[#185b9d]" aria-label={`Sort by ${label}`} aria-pressed={sortKey === key}><span>{label}</span><Icon size={13} /></button>;
  };

  return (
    <section aria-label="Student examination results">
      <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
        <table className="w-full min-w-[1480px] border-collapse text-left text-xs">
          <thead className="sticky top-0 bg-slate-50">
            <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-500">
              <th className="w-9 px-2 py-2"><input type="checkbox" aria-label="Select current page" checked={allPageSelected} onChange={(event) => {
                const next = new Set(selectedIds);
                for (const row of pageRows) event.target.checked ? next.add(row.id) : next.delete(row.id);
                onSelectionChange(next);
              }} /></th>
              <th className="px-2 py-2">{heading('rollNumber', 'Roll number')}</th>
              <th className="px-2 py-2">{heading('studentName', 'Student name')}</th>
              <th className="px-2 py-2">{heading('className', 'Class')}</th>
              <th className="px-2 py-2">Examination</th>
              <th className="px-2 py-2 text-right">{heading('obtainedMarks', 'Marks / 100')}</th>
              <th className="px-2 py-2 text-right">{heading('percentage', 'Percent')}</th>
              <th className="px-2 py-2 text-right">Correct</th><th className="px-2 py-2 text-right">Wrong</th><th className="px-2 py-2 text-right">Multiple</th><th className="px-2 py-2 text-right">Blank</th><th className="px-2 py-2 text-right">Uncertain</th>
              <th className="px-2 py-2">{heading('status', 'Status')}</th><th className="px-2 py-2">Review note</th><th className="px-2 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pageRows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50">
                <td className="px-2 py-2"><input type="checkbox" aria-label={`Select ${row.rollNumber}`} checked={selectedIds.has(row.id)} onChange={(event) => {
                  const next = new Set(selectedIds); event.target.checked ? next.add(row.id) : next.delete(row.id); onSelectionChange(next);
                }} /></td>
                <td className="whitespace-nowrap px-2 py-2 font-mono text-[11px] text-slate-700">{row.rollNumber}</td>
                <td className="whitespace-nowrap px-2 py-2 font-medium text-slate-900">{row.studentName}</td>
                <td className="whitespace-nowrap px-2 py-2">{row.className}</td>
                <td className="whitespace-nowrap px-2 py-2">{row.examinationName}</td>
                <td className="px-2 py-2 text-right tabular-nums">{row.obtainedMarks === null ? <span className="text-amber-800">Pending</span> : `${row.obtainedMarks} / ${row.maximumMarks}`}</td>
                <td className="px-2 py-2 text-right tabular-nums">{row.percentage === null ? '—' : `${row.percentage}%`}</td>
                {[row.correct, row.wrong, row.multiple, row.blank, row.uncertain].map((count, index) => <td key={index} className="px-2 py-2 text-right tabular-nums">{count}</td>)}
                <td className={`whitespace-nowrap px-2 py-2 font-semibold ${statusStyle[row.status]}`}>{row.status}</td>
                <td className="max-w-44 truncate px-2 py-2 text-slate-500" title={row.reviewReason}>{row.reviewReason || '—'}</td>
                <td className="px-2 py-2 text-right"><button type="button" onClick={() => onView(row)} className="inline-flex items-center gap-1 rounded px-2 py-1 font-semibold text-[#185b9d] hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-400"><Eye size={14} /> Details</button></td>
              </tr>
            ))}
            {!pageRows.length && <tr><td colSpan={15} className="px-4 py-12 text-center text-sm text-slate-500">No demo results match these filters.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 py-3 text-xs text-slate-600">
        <span>{rows.length.toLocaleString()} students · Showing {rows.length ? ((currentPage - 1) * pageSize + 1).toLocaleString() : 0}–{Math.min(currentPage * pageSize, rows.length).toLocaleString()} · Page {currentPage} of {pageCount}</span>
        <div className="flex gap-2"><button type="button" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded border border-slate-300 px-3 py-1.5 disabled:opacity-40">Previous</button><button type="button" disabled={currentPage >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))} className="rounded border border-slate-300 px-3 py-1.5 disabled:opacity-40">Next</button></div>
      </div>
    </section>
  );
}
