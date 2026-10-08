import React, { useEffect, useId, useState } from 'react';
import { mockApi, type AttendanceSessionDetail, type AttendanceSessionCandidate, type AttendanceStatus, type AttendanceCandidatesResponse } from '../../../lib/mockApi';
import { AttendanceDialog, attendancePrimary, attendanceSecondary, attendanceField, attendanceValue } from './AttendanceDialog';

export interface ManualAttendanceTabProps {
  detail: AttendanceSessionDetail;
  canMark: boolean;
  refresh: number;
  onRecorded: () => void;
  onDialogChange: (open: boolean) => void;
}
const label = (status: string) => status === 'NOT_MARKED' ? 'NOT MARKED' : status;
const markedTime = (value: string | null) => {
  if (!value || !Number.isFinite(new Date(value).getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Karachi', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
};
export const ManualAttendanceTab: React.FC<ManualAttendanceTabProps> = ({ detail, canMark, refresh, onRecorded, onDialogChange }) => {
  const [search, setSearch] = useState(''), [page, setPage] = useState(1), [retry, setRetry] = useState(0);
  const [result, setResult] = useState<AttendanceCandidatesResponse | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [candidate, setCandidate] = useState<AttendanceSessionCandidate | null>(null), [status, setStatus] = useState<AttendanceStatus>('PRESENT');
  const [busy, setBusy] = useState(false), [markError, setMarkError] = useState('');
  const formId = useId();
  const session = detail.session;
  useEffect(() => {
    let active = true; setLoading(true); setError(''); setResult(null);
    const timer = window.setTimeout(() => {
      mockApi.getAttendanceSessionCandidates(session.id, { page, limit: 25, search }).then(data => { if (active) setResult(data); })
        .catch((failure: Error) => { if (active) setError(failure.message || 'Failed to load frozen roster.'); })
        .finally(() => { if (active) setLoading(false); });
    }, search ? 200 : 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [session.id, search, page, refresh, retry]);
  const dismiss = () => { if (!busy) { setCandidate(null); setMarkError(''); onDialogChange(false); } };
  const mark = async (event: React.FormEvent) => {
    event.preventDefault(); if (!candidate || busy || !canMark || session.status !== 'OPEN') return;
    setBusy(true); setMarkError('');
    try {
      const response = await mockApi.markAttendanceSession(session.id, { studentId: candidate.studentId, status });
      if (!response.attendance?.id) throw new Error('Attendance was not confirmed. Refresh the session before retrying.');
      setCandidate(null); onDialogChange(false); onRecorded();
    } catch (failure: any) { setMarkError(failure.message || 'Attendance could not be recorded.'); }
    finally { setBusy(false); }
  };
  return <section className="min-w-0 rounded-xl border border-slate-200 bg-white shadow-sm" aria-labelledby="attendance-roster-title">
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 p-4">
      <div><h2 id="attendance-roster-title" className="text-sm font-bold text-slate-900">Frozen Hall Roster</h2><p className="mt-1 text-xs text-slate-500">Class is informational only. Times are shown in Asia/Karachi.</p></div>
      <div className="w-full sm:w-72"><label htmlFor="attendance-search" className="mb-1 block text-xs font-semibold text-slate-700">Search this session roster</label>
        <input id="attendance-search" type="search" className={attendanceField} placeholder="Name, roll, application or seat" value={search} disabled={!!candidate} onChange={event => { setSearch(event.target.value); setPage(1); }} /></div>
    </div>
    {loading && <p role="status" className="p-4 text-sm text-slate-600">Loading frozen roster…</p>}
    {error && <div role="alert" className="flex flex-wrap items-center gap-3 p-4 text-sm text-red-700"><span>Failed to load frozen roster: {error}</span><button className={attendanceSecondary} onClick={() => setRetry(value => value + 1)}>Retry roster</button></div>}
    {!loading && !error && result && <>
      <div className="max-w-full overflow-x-auto" role="region" aria-label="Frozen Hall roster table" tabIndex={0}>
        <table className="w-full min-w-[980px] text-left text-xs">
          <caption className="sr-only">Candidates explicitly snapshotted into this Hall session.</caption>
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-600"><tr>{['Seat', 'Candidate', 'Roll Number', 'Application No', 'Class', 'Attendance', 'Method', 'Marked At', 'Marked By', 'Action'].map(heading => <th key={heading} scope="col" className="px-3 py-2.5 font-semibold">{heading}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">{result.candidates.map(row => <tr key={row.studentId} className="hover:bg-slate-50">
            <td className="px-3 py-2.5 whitespace-nowrap">{attendanceValue(row.seatNoSnapshot)}</td>
            <td className="px-3 py-2.5 font-semibold text-slate-900">{attendanceValue(row.fullNameSnapshot)}</td>
            <td className="px-3 py-2.5 whitespace-nowrap">{attendanceValue(row.rollNumberSnapshot)}</td><td className="px-3 py-2.5">{attendanceValue(row.applicationNoSnapshot)}</td><td className="px-3 py-2.5 whitespace-nowrap">{attendanceValue(row.currentClassSnapshot)}</td>
            <td className="px-3 py-2.5"><span className={'inline-block whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-semibold ' + ({ PRESENT: 'bg-emerald-50 text-emerald-800', LATE: 'bg-amber-50 text-amber-800', ABSENT: 'bg-red-50 text-red-800', NOT_MARKED: 'bg-slate-100 text-slate-600' }[row.status])}>{label(row.status)}</span></td>
            <td className="px-3 py-2.5 whitespace-nowrap">{row.method === 'QR_SCAN' ? 'QR Scan' : row.method === 'MANUAL' ? 'Manual' : '—'}</td><td className="px-3 py-2.5 whitespace-nowrap">{markedTime(row.markedAt)}</td><td className="px-3 py-2.5">{attendanceValue(row.markedByName)}</td>
            <td className="px-3 py-2.5">{row.status === 'NOT_MARKED' && canMark ? <button className={attendanceSecondary + ' whitespace-nowrap'} disabled={session.status !== 'OPEN'} onClick={() => { setCandidate(row); setStatus('PRESENT'); setMarkError(''); onDialogChange(true); }}>Mark Attendance</button> : <span className="text-slate-500">{row.status === 'NOT_MARKED' ? '—' : 'Recorded'}</span>}</td>
          </tr>)}</tbody>
        </table>
      </div>
      {!result.candidates.length && <p className="p-4 text-sm text-slate-500">{search ? 'No candidates match this search in the frozen session roster.' : 'No candidates are available in this frozen session roster.'}</p>}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-4 py-3 text-xs text-slate-600"><span>{result.pagination.total} candidates{result.pagination.totalPages > 0 ? ` · Page ${page} of ${result.pagination.totalPages}` : ''}</span><div className="flex gap-2"><button className={attendanceSecondary} disabled={page <= 1 || !!candidate} onClick={() => setPage(value => value - 1)}>Previous roster page</button><button className={attendanceSecondary} disabled={page >= result.pagination.totalPages || !!candidate} onClick={() => setPage(value => value + 1)}>Next roster page</button></div></div>
    </>}
    {candidate && <AttendanceDialog title="Record Attendance" busy={busy} onClose={dismiss} footer={<><button className={attendanceSecondary} disabled={busy} onClick={dismiss}>Cancel</button><button type="submit" form={formId} className={attendancePrimary} disabled={busy || session.status !== 'OPEN'}>{busy ? 'Recording…' : 'Record Attendance'}</button></>}>
      <form id={formId} onSubmit={mark} className="space-y-4">
        <dl className="grid grid-cols-2 gap-x-3 gap-y-3 text-sm">{[['Candidate', candidate.fullNameSnapshot], ['Roll', candidate.rollNumberSnapshot], ['Seat', candidate.seatNoSnapshot], ['Hall', session.hallNameSnapshot]].map(([name, value]) => <div key={name}><dt className="text-xs text-slate-500">{name}</dt><dd className="mt-1 break-words font-semibold">{attendanceValue(value)}</dd></div>)}</dl>
        <div><label htmlFor="attendance-mark-status" className="mb-1 block text-xs font-semibold">Attendance status</label><select id="attendance-mark-status" data-autofocus className={attendanceField} value={status} disabled={busy} onChange={event => setStatus(event.target.value as AttendanceStatus)}><option value="PRESENT">Present</option><option value="LATE">Late</option><option value="ABSENT">Absent</option></select></div>
        <p className="text-xs text-slate-500">Recorded attendance cannot be edited in this workspace.</p>
        {markError && <p role="alert" className="text-sm text-red-700">{markError}</p>}
      </form>
    </AttendanceDialog>}
  </section>;
};
