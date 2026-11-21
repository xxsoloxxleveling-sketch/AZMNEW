import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileUp, Lock, RefreshCw } from 'lucide-react';
import {
  FixedSchedulePreview, FixedScheduleUpload, FixedScheduleView as FixedScheduleData, interviewApi,
} from './interviewApi';

const baseButton = 'inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium disabled:opacity-50';
const primaryButton = baseButton + ' border-[#185b9d] bg-[#185b9d] text-white';
const neutralButton = baseButton + ' border-slate-300 bg-white text-slate-700';
const tableCell = 'border-b border-slate-100 px-3 py-2 text-left text-sm text-slate-700';

async function toBase64(file: File): Promise<string> {
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Unable to read the selected CSV file.'));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
  const comma = data.indexOf(',');
  if (comma < 0) throw new Error('Unable to decode the uploaded CSV.');
  return data.slice(comma + 1);
}
async function sha256(file: File): Promise<string> {
  const bytes = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), v => v.toString(16).padStart(2, '0')).join('');
}

export function FixedScheduleView({ roundId, isSuperAdmin, onImported }: {
  roundId: string;
  isSuperAdmin: boolean;
  onImported: () => void;
}) {
  const [schedule, setSchedule] = useState<FixedScheduleData | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [upload, setUpload] = useState<FixedScheduleUpload | null>(null);
  const [preview, setPreview] = useState<FixedSchedulePreview | null>(null);
  const [panel, setPanel] = useState(1);
  const [batch, setBatch] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    setSchedule(null);
    setPreview(null);
    setUpload(null);
    setError('');
    void interviewApi.fixedSchedule(roundId).then(data => {
      if (active) setSchedule(data);
    }).catch(err => {
      if (active) setError(err instanceof Error ? err.message : 'Unable to load fixed interview schedule.');
    });
    return () => { active = false; };
  }, [roundId]);

  async function previewSchedule() {
    if (!csvFile || !pdfFile || !isSuperAdmin) return;
    setLoading(true);
    setError('');
    setNotice('');
    setPreview(null);
    setUpload(null);
    try {
      if (csvFile.size > 100_000 || pdfFile.size > 5_000_000) {
        throw new Error('The selected file exceeds the fixed schedule upload limit.');
      }
      const body = { csvBase64: await toBase64(csvFile), pdfSha256: await sha256(pdfFile) };
      const result = await interviewApi.previewFixedSchedule(roundId, body);
      setUpload(body);
      setPreview(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to preview the schedule.');
    } finally {
      setLoading(false);
    }
  }

  async function importSchedule() {
    if (!preview || !upload || !isSuperAdmin || !preview.canCommit || preview.alreadyImported) return;
    if (!window.confirm('Import and permanently lock exactly 349 candidates to the final panel, batch and time? No automatic sorting will be possible.')) return;
    setLoading(true);
    setError('');
    try {
      const result = await interviewApi.commitFixedSchedule(roundId, {
        ...upload, expectedRevision: preview.expectedRevision, planHash: preview.planHash, confirmed: true,
      });
      const refreshed = await interviewApi.fixedSchedule(roundId);
      setSchedule(refreshed);
      setPreview(null);
      setUpload(null);
      setNotice(result.idempotentReplay
        ? 'The final schedule was already imported, so no placements changed.'
        : 'All 349 final placements were imported and locked.');
      onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The schedule was not imported.');
    } finally {
      setLoading(false);
    }
  }

  const selected = useMemo(() => (schedule?.placements ?? []).filter(row =>
    row.panel === panel && row.batch === batch &&
    (!search.trim() || (row.rollNumber ?? '').toLowerCase().includes(search.toLowerCase()) ||
      row.studentName.toLowerCase().includes(search.toLowerCase()))), [schedule, panel, batch, search]);

  return (
    <section className="space-y-4" aria-label="Approved final interview panel schedule">
      <div className="border border-[#185b9d]/20 bg-[#185b9d]/5 p-4">
        <h3 className="text-base font-semibold text-slate-900">Final panel placements · 22 November 2026</h3>
        <p className="mt-1 text-sm text-slate-700">The official administrative timetable contains exactly 349 candidates, 6 panels and 12 batches. Panel, batch, sequence and 5-minute time slots are fixed. Printed marks are for comparison only and never overwrite examination results.</p>
        <p className="mt-2 text-xs text-slate-600">The source document does not specify physical room numbers or a venue. No rooms are invented.</p>
      </div>

      {error && <div role="alert" className="border border-red-200 bg-red-50 p-3 text-sm text-red-800"><AlertTriangle size={15} className="mr-2 inline-block" />{error}</div>}
      {notice && <div role="status" className="border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle2 size={15} className="mr-2 inline-block" />{notice}</div>}

      {!schedule?.imported && isSuperAdmin && (
        <div className="space-y-3 border border-slate-200 bg-white p-4">
          <div>
            <h4 className="font-semibold text-slate-900">Import approved final schedule</h4>
            <p className="mt-1 text-xs text-slate-600">Choose the exact approved PDF and its extracted CSV. Both file SHA-256 fingerprints are checked on the backend, and no student names or CSV rows are committed to GitHub.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">Final 349-candidate CSV
              <input className="mt-1 block w-full text-sm" type="file" accept=".csv,text/csv" onChange={event => { setCsvFile(event.target.files?.[0] ?? null); setPreview(null); setUpload(null); }} />
            </label>
            <label className="text-sm font-medium text-slate-700">Approved source PDF
              <input className="mt-1 block w-full text-sm" type="file" accept=".pdf,application/pdf" onChange={event => { setPdfFile(event.target.files?.[0] ?? null); setPreview(null); setUpload(null); }} />
            </label>
          </div>
          <button type="button" className={primaryButton} onClick={() => void previewSchedule()} disabled={loading || !csvFile || !pdfFile}><FileUp size={15} />{loading ? 'Checking…' : 'Validate and preview all 349'}</button>
        </div>
      )}

      {preview && (
        <div className="space-y-3 border border-slate-200 bg-white p-4">
          <h4 className="font-semibold text-slate-900">Import preview (no changes made)</h4>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>Scheduled <strong className="block text-lg">{preview.candidateCount}</strong></div>
            <div>Matched to backend <strong className="block text-lg">{preview.matchedCount}</strong></div>
            <div>Missing roll numbers <strong className="block text-lg">{preview.missingRollNumbers.length}</strong></div>
            <div>Official-result conflicts <strong className="block text-lg">{preview.resultConflicts.length}</strong></div>
          </div>
          <p className="text-xs text-slate-600">Panels: 6 · Batches: 12 · Existing conventional assignments: {preview.existingAssignments} · Revision: {preview.expectedRevision}</p>
          {preview.missingRollNumbers.length > 0 && <p className="text-sm text-red-700">Missing roll numbers: {preview.missingRollNumbers.join(', ')}</p>}
          {preview.resultConflicts.length > 0 && <p className="text-sm text-red-700">Result discrepancies: {preview.resultConflicts.map(item => item.rollNumber + ' (' + item.reason + ')').join(', ')}</p>}
          {preview.alreadyImported && <p className="text-sm text-slate-700">This exact approved schedule is already imported. A second import is unnecessary.</p>}
          {!preview.alreadyImported && (preview.canCommit ? (
            <button className={primaryButton} type="button" onClick={() => void importSchedule()} disabled={loading}><Lock size={15} />{loading ? 'Importing…' : 'Confirm exact placement and lock all 349'}</button>
          ) : <p className="text-sm text-amber-800">Import remains blocked until all identity, result and placement conflicts are resolved.</p>)}
        </div>
      )}

      {schedule?.imported && (
        <div className="space-y-4 border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h4 className="font-semibold text-slate-900">Approved locked timetable</h4>
              <p className="text-xs text-slate-600">{schedule.lockedCount ?? 0} fixed placements · imported {schedule.importedAt ? new Date(schedule.importedAt).toLocaleString() : '—'} · no automatic allocation</p>
            </div>
            <span className="inline-flex items-center gap-1 border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-800"><Lock size={13} /> Schedule locked</span>
          </div>
          <nav className="flex flex-wrap gap-1" aria-label="Select interview panel">
            {schedule.panels.map(p => (
              <button type="button" key={p.panel} className={panel === p.panel ? primaryButton : neutralButton}
                onClick={() => { setPanel(p.panel); setSearch(''); }}>Panel {p.panel}</button>
            ))}
          </nav>
          <nav className="flex flex-wrap gap-2" aria-label="Select interview batch">
            {[1, 2].map(b => {
              const meta = schedule.panels.find(p => p.panel === panel)?.batches.find(x => x.batch === b);
              return <button key={b} className={batch === b ? primaryButton : neutralButton} type="button" onClick={() => setBatch(b)}>
                Batch {b} · {meta?.count ?? 0} candidates · {meta?.start ?? ''}–{meta?.end ?? ''}
              </button>;
            })}
          </nav>
          <label className="block max-w-md text-xs font-medium text-slate-600">Find student by name or roll number
            <input type="search" className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm" value={search}
              onChange={event => setSearch(event.target.value)} placeholder="Search within selected batch" />
          </label>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-600">
                <tr>{['#', 'Interview time', 'Roll number', 'Candidate', 'Class', 'Printed marks', 'Status'].map(x => <th key={x} className="px-3 py-2">{x}</th>)}</tr>
              </thead>
              <tbody>{selected.map(row => (
                <tr key={row.studentId}>
                  <td className={tableCell}>{row.sequence}</td>
                  <td className={tableCell}>{row.slotTime}</td>
                  <td className={tableCell}>{row.rollNumber}</td>
                  <td className={tableCell}>{row.studentName}</td>
                  <td className={tableCell}>{row.currentClass}</td>
                  <td className={tableCell}>{row.printedMarks}</td>
                  <td className={tableCell}><span className="inline-flex items-center gap-1 text-emerald-700"><Lock size={13} /> Fixed</span></td>
                </tr>
              ))}
              {selected.length === 0 && <tr><td colSpan={7} className="p-5 text-center text-sm text-slate-500">No candidates match this selection.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <button type="button" className={neutralButton} disabled={loading} onClick={() => {
        setError('');
        void interviewApi.fixedSchedule(roundId).then(setSchedule).catch(err => setError(err.message));
      }}><RefreshCw size={14} /> Refresh schedule</button>
    </section>
  );
}
