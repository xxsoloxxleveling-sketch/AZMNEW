import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../../lib/authContext';
import { mockApi, type AttendanceSession, type AttendanceSessionMetrics } from '../../../lib/mockApi';
import { attendanceResetApi, type ResetMode, type ResetPreview, type ResetResult, type ResetHistory } from '../../../lib/attendanceResetApi';
import { AttendanceDialog, attendanceField, attendancePrimary, attendanceSecondary } from './AttendanceDialog';

type Option = AttendanceSession & { stats: AttendanceSessionMetrics };
const time = (value: string) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Karachi', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
export function AttendanceResetCenter({ selectedSession, disabled, onReset, onDialogChange, centers = [], hallCenters = [] }: { selectedSession: AttendanceSession | null; disabled: boolean; onReset: (result: ResetResult) => void; onDialogChange: (open: boolean) => void; centers?: { id: string; name: string | null }[]; hallCenters?: { id: string; testCenterId: string | null }[] }) {
  const { role } = useAuth();
  const [mode, setMode] = useState<ResetMode>('HALL'), [date, setDate] = useState(''), [centerId, setCenterId] = useState('');
  const [sessions, setSessions] = useState<Option[]>([]), [chosen, setChosen] = useState<string[]>([]);
  const [loading, setLoading] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [preview, setPreview] = useState<ResetPreview | null>(null), [reason, setReason] = useState(''), [phrase, setPhrase] = useState('');
  const [busy, setBusy] = useState(false), [uncertain, setUncertain] = useState(false), [expired, setExpired] = useState(false);
  const [history, setHistory] = useState<ResetHistory | null>(null), [historyError, setHistoryError] = useState(''), [page, setPage] = useState(1), [revision, setRevision] = useState(0);
  const key = useRef(''), submission = useRef<{ reason: string; phrase: string } | null>(null);
  useEffect(() => { if (selectedSession && !preview) setDate(selectedSession.businessDate.slice(0, 10)); }, [selectedSession?.id]);
  useEffect(() => {
    let active = true; setSessions([]); setChosen([]); setError('');
    if (role !== 'SUPER_ADMIN' || !date) return;
    setLoading(true);
    (async () => {
      const all: Option[] = []; let current = 1;
      while (active) { const result = await mockApi.getAttendanceSessions({ businessDate: date, page: current, limit: 100 }); all.push(...result.sessions); if (current >= result.pagination.totalPages) break; current++; }
      if (active) { const eligible = all.filter(session => (session.status === 'OPEN' || session.status === 'CLOSED') && session.isCurrent !== false && (!centerId || hallCenters.some(hall => hall.id === session.examHallId && hall.testCenterId === centerId))); setSessions(eligible); setChosen(mode === 'EXAM_DATE' || mode === 'CURRENT' ? eligible.map(session => session.id) : selectedSession && eligible.some(session => session.id === selectedSession.id) ? [selectedSession.id] : []); }
    })().catch(failure => { if (active) setError(failure.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [role, date, mode, centerId, revision]);
  useEffect(() => { let active = true; if (role !== 'SUPER_ADMIN') return; setHistory(null); setHistoryError(''); attendanceResetApi.history(page).then(result => { if (active) setHistory(result); }).catch(failure => { if (active) setHistoryError(failure.message); }); return () => { active = false; }; }, [role, page, revision]);
  useEffect(() => { if (!preview) return; const update = () => setExpired(Date.now() >= Date.parse(preview.expiresAt)); update(); const timer = window.setInterval(update, 1000); return () => clearInterval(timer); }, [preview]);
  useEffect(() => { onDialogChange(!!preview); return () => onDialogChange(false); }, [!!preview]);
  if (role !== 'SUPER_ADMIN') return null;
  const locked = disabled || busy || !!preview;
  const startPreview = async () => {
    if (locked || !date || !chosen.length) return;
    setBusy(true); setError(''); setNotice('');
    try { const result = await attendanceResetApi.preview({ mode, businessDate: date, sessionIds: chosen, ...(centerId ? { testCenterId: centerId } : {}) }); key.current = crypto.randomUUID(); submission.current = null; setReason(''); setPhrase(''); setUncertain(false); setPreview(result); }
    catch (failure: any) { setError(failure.message); } finally { setBusy(false); }
  };
  const confirm = async () => {
    if (!preview || busy || (!uncertain && (expired || !reason.trim() || phrase !== 'RESET ATTENDANCE'))) return;
    if (!submission.current) submission.current = { reason: reason.trim(), phrase };
    setBusy(true); setError('');
    try {
      const result = await attendanceResetApi.confirm(preview.challenge, submission.current.reason, submission.current.phrase, key.current);
      if (result.attempts.length !== preview.halls.length || result.attempts.some(attempt => !preview.halls.some(hall => hall.sessionId === attempt.previousSessionId && hall.examHallId === attempt.examHallId && hall.hallName === attempt.hallName && hall.attemptNumber + 1 === attempt.attemptNumber && hall.expectedCount === attempt.expectedCount))) throw new Error('Reset confirmation did not match the reviewed scope. Retry to check its outcome.');
      setPreview(null); setUncertain(false); setNotice(`Reset ${result.resetReference} completed. A fresh attendance attempt is ready; historical evidence is preserved.`); setRevision(value => value + 1); onReset(result);
    } catch (failure: any) { setUncertain(!failure.status || failure.status >= 500); setError(failure.message); } finally { setBusy(false); }
  };
  return <section className="min-w-0 border-t border-slate-200 pt-4" aria-labelledby="reset-center-title">
    <h2 id="reset-center-title" className="text-sm font-bold">Attendance Reset Center</h2>
    <p className="mt-1 text-xs text-slate-600">Super Admin only. Reset current OPEN or CLOSED attempts for the selected examination date and Center. Original attempts and their attendance evidence remain protected.</p>
    {notice && <p role="status" className="mt-3 text-sm text-emerald-800">{notice}</p>}
    <div className="mt-3 grid gap-3 sm:grid-cols-2"><div><label htmlFor="reset-mode" className="mb-1 block text-xs font-semibold">Reset scope</label><select id="reset-mode" value={mode} disabled={locked} className={attendanceField} onChange={event => setMode(event.target.value as ResetMode)}><option value="HALL">Reset Selected Hall</option><option value="SELECTED">Reset Selected Halls</option><option value="EXAM_DATE">Reset Examination Session</option><option value="CURRENT">Reset All Current Attendance — selected date / Center</option></select></div><div><label htmlFor="reset-date" className="mb-1 block text-xs font-semibold">Examination business date</label><input id="reset-date" type="date" value={date} disabled={locked} className={attendanceField} onChange={event => setDate(event.target.value)} /></div></div>
    <div className="mt-3 sm:max-w-sm"><label htmlFor="reset-center" className="mb-1 block text-xs font-semibold">Examination Center</label><select id="reset-center" className={attendanceField} value={centerId} disabled={locked} onChange={event => setCenterId(event.target.value)}><option value="">All examination Centers</option>{centers.map(center => <option key={center.id} value={center.id}>{center.name || 'Unknown Center'}</option>)}</select></div>
    {!date && <p className="mt-3 text-xs text-slate-600">Select a date to load eligible attendance attempts.</p>}
    {loading && <p role="status" className="mt-3 text-xs">Loading current attendance attempts…</p>}
    {date && !loading && !sessions.length && !error && <p className="mt-3 text-xs text-slate-600">No current OPEN or CLOSED attendance attempts are eligible on this date.</p>}
    {sessions.length > 0 && <><dl className="mt-3 grid grid-cols-2 gap-3 border-y border-slate-200 py-3 text-xs sm:grid-cols-5">{[['Current attempts', sessions.length], ['Present', sessions.reduce((sum, item) => sum + item.stats.presentCount, 0)], ['Late', sessions.reduce((sum, item: any) => sum + item.stats.lateCount, 0)], ['Absent', sessions.reduce((sum, item: any) => sum + item.stats.absentCount, 0)], ['Completion', (() => { const expected = sessions.reduce((sum, item: any) => sum + item.stats.expectedCount, 0), marked = sessions.reduce((sum, item: any) => sum + item.stats.markedCount, 0); return expected ? (100 * marked / expected).toFixed(1) + '%' : '—'; })()]].map(([label, value]) => <div key={label}><dt className="text-slate-500">{label}</dt><dd className="mt-1 font-semibold tabular-nums">{value}</dd></div>)}</dl><fieldset className="mt-3 space-y-2"><legend className="mb-2 text-xs font-semibold">Review affected Halls {(mode === 'EXAM_DATE' || mode === 'CURRENT') && '(all current OPEN and CLOSED attempts in this date / Center scope)'}</legend>{sessions.map(session => <label key={session.id} className="flex items-start gap-2 text-xs"><input type={mode === 'HALL' ? 'radio' : 'checkbox'} name="reset-halls" checked={chosen.includes(session.id)} disabled={locked || mode === 'EXAM_DATE' || mode === 'CURRENT'} className="mt-0.5 accent-[#185b9d]" onChange={event => setChosen(previous => mode === 'HALL' ? [session.id] : event.target.checked ? [...previous, session.id] : previous.filter(id => id !== session.id))} /><span>{session.testCenterNameSnapshot || 'Unknown Center'} · {session.hallNameSnapshot} · {session.roomNumberSnapshot} · Attempt {session.attemptNumber ?? 1} · {session.status}</span></label>)}</fieldset></>}
    {error && !preview && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    <button id="attendance-reset-preview" className={attendanceSecondary + ' mt-3'} disabled={locked || loading || !chosen.length} onClick={startPreview}>{busy && !preview ? 'Loading preview…' : 'Preview Attendance Reset'}</button>
    <div className="mt-5 border-t border-slate-200 pt-4"><h3 className="text-sm font-bold">Reset History</h3><p className="mt-1 text-xs text-slate-500">Immutable audit events. Times shown in Asia/Karachi.</p>
      {historyError && <p role="alert" className="mt-3 text-sm text-red-700">{historyError} <button className={attendanceSecondary} disabled={busy} onClick={() => setRevision(value => value + 1)}>Retry history</button></p>}
      {!history && !historyError && <p role="status" className="mt-3 text-xs">Loading reset history…</p>}
      {history && <><div className="mt-3 max-w-full overflow-x-auto" role="region" aria-label="Reset audit history" tabIndex={0}><table className="w-full min-w-[800px] text-left text-xs"><thead className="border-y border-slate-200 bg-slate-50"><tr>{['Reference', 'Completed', 'Performed by', 'Reason', 'Scope / Date', 'Attempts', 'Candidates', 'Status'].map(label => <th scope="col" key={label} className="px-3 py-2 font-semibold">{label}</th>)}</tr></thead><tbody>{history.operations.map(event => <tr key={event.id} className="border-b border-slate-100"><td className="px-3 py-2">{event.id}</td><td className="px-3 py-2 whitespace-nowrap">{time(event.completedAt)}</td><td className="px-3 py-2">{event.actorName}</td><td className="px-3 py-2 break-words">{event.reason}</td><td className="px-3 py-2">{event.mode} · {event.businessDate}</td><td className="px-3 py-2">{event.result.attempts.map(attempt => <div key={attempt.newSessionId}>Attempt {attempt.attemptNumber - 1} → {attempt.attemptNumber}</div>)}</td><td className="px-3 py-2 tabular-nums">{event.affectedCandidates}</td><td className="px-3 py-2">Completed</td></tr>)}</tbody></table></div>{!history.operations.length && <p className="mt-3 text-xs text-slate-500">No attendance reset events recorded.</p>}<div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs"><span>{history.pagination.total} reset events</span><div className="flex gap-2"><button className={attendanceSecondary} disabled={locked || page <= 1} onClick={() => setPage(value => value - 1)}>Previous resets</button><button className={attendanceSecondary} disabled={locked || page >= history.pagination.totalPages} onClick={() => setPage(value => value + 1)}>Next resets</button></div></div></>}
    </div>
    {preview && <AttendanceDialog returnFocusId="attendance-reset-preview" title="Confirm Attendance Reset" busy={busy} onClose={() => { if (!busy && !uncertain) { setPreview(null); setError(''); } }} footer={<><button data-autofocus className={attendanceSecondary} disabled={busy || uncertain} onClick={() => { setPreview(null); setError(''); }}>Cancel</button><button className={attendancePrimary} disabled={busy || (!uncertain && (expired || !reason.trim() || phrase !== 'RESET ATTENDANCE'))} onClick={confirm}>{busy ? 'Confirming…' : uncertain ? 'Retry Same Confirmation' : 'Reset Attendance'}</button></>}>
      <p className="text-sm text-amber-900">This archives the reviewed attempts and starts attendance from zero. Candidate assignments, signed QR tokens, and historical evidence are preserved.</p>
      <p className="mt-2 text-xs">{date} · {preview.halls.length} Halls · {preview.totals.expectedCount} frozen candidates · {preview.totals.markedCount} attendance records preserved</p>
      <div className="mt-3 max-w-full overflow-x-auto" tabIndex={0} role="region" aria-label="Reset impact preview"><table className="min-w-[650px] w-full text-left text-xs"><thead><tr>{['Hall / Attempt', 'Roster', 'Present', 'Late', 'Absent', 'QR', 'Manual', 'Original status'].map(label => <th scope="col" className="px-2 py-2" key={label}>{label}</th>)}</tr></thead><tbody>{preview.halls.map(hall => <tr key={hall.sessionId} className="border-t border-slate-200"><td className="px-2 py-2">{hall.hallName} · {hall.roomNumber}<br />Attempt {hall.attemptNumber} · {hall.status}</td>{[hall.expectedCount, hall.presentCount, hall.lateCount, hall.absentCount, hall.qrCount, hall.manualCount, hall.status].map((value, index) => <td key={index} className="px-2 py-2 tabular-nums">{value}</td>)}</tr>)}</tbody></table></div>
      <p className="mt-2 text-xs text-slate-600">Staff activity is unknown: the system has no live staff-presence signal. Concurrent marks or session closure require a fresh preview.</p>
      <label htmlFor="reset-reason" className="mt-4 mb-1 block text-xs font-semibold">Reset reason (required)</label><textarea id="reset-reason" maxLength={1000} rows={3} className={attendanceField} value={reason} disabled={busy || uncertain} onChange={event => setReason(event.target.value)} />
      <label htmlFor="reset-phrase" className="mt-3 mb-1 block text-xs font-semibold">Type RESET ATTENDANCE</label><input id="reset-phrase" className={attendanceField} value={phrase} disabled={busy || uncertain} autoComplete="off" onChange={event => setPhrase(event.target.value)} />
      {expired && !uncertain && <p role="alert" className="mt-3 text-sm text-red-700">Preview expired. Cancel and preview the scope again.</p>}
      {uncertain && <p role="alert" className="mt-3 text-sm text-amber-900">The outcome is unconfirmed. Retry this same confirmation to check it without creating a second reset.</p>}
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    </AttendanceDialog>}
  </section>;
}
