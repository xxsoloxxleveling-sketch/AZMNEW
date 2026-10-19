import { ExamSessionControl } from './ExamSessionControl';
import { examControlApi } from '../../../lib/examControlApi';
import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../../lib/authContext';
import { mockApi, type AttendanceSession, type AttendanceSessionListResponse, type AttendanceSessionDetail } from '../../../lib/mockApi';
import { AttendanceResetCenter } from './AttendanceResetCenter';
import { AttendanceCancellationCenter } from './AttendanceCancellationCenter';
import { ManualAttendanceTab } from './ManualAttendanceTab';
import { QrScannerTab } from './QrScannerTab';
import { AttendanceDialog, attendancePrimary, attendanceSecondary, attendanceField, attendanceValue } from './AttendanceDialog';

type HallOption = { id: string; name: string | null; roomNumber: string | null; examDate: string | null; reportingTime: string | null; testCenterId: string | null; centerName: string | null; assignedCount: number | null };
type CenterOption = { id: string; name: string | null };
const permitted = ['ADMIN', 'SUPER_ADMIN', 'TEACHER'];
const summaryLabels = ['Expected Candidates', 'Marked', 'Present', 'Late', 'Absent', 'Not Marked', 'Attendance %'];
const contextRows = (session: AttendanceSession) => [['Test Center', session.testCenterNameSnapshot], ['Hall', session.hallNameSnapshot], ['Room', session.roomNumberSnapshot], ['Exam Date', session.examDateSnapshot], ['Reporting Time', session.reportingTimeSnapshot]];

export const AttendanceHubView: React.FC<{ role?: string }> = ({ role: overrideRole }) => {
  const auth = useAuth();
  if (auth.isLoading) return <p role="status" className="p-4 text-sm text-slate-600">Loading examination attendance access…</p>;
  const role = overrideRole ?? auth.role;
  if (!auth.user?.id || !role || !permitted.includes(role)) return <section className="rounded-xl border border-slate-200 bg-white p-4"><h1 className="text-base font-bold">Examination Attendance Hub</h1><p role="alert" className="mt-2 text-sm text-slate-600">You do not have access to examination attendance.</p></section>;
  return role==='SUPER_ADMIN'?<AttendanceControlTabs key={auth.user.id} actorId={auth.user.id}/>:<AttendanceWorkspace role={role}/>;
};

function AttendanceControlTabs({actorId}:{actorId:string}){
 const [tab,setTab]=useState<'attendance'|'control'|'history'>('attendance');
 return <div className="min-w-0 space-y-3"><nav className="flex flex-wrap gap-2 border-b border-slate-200 pb-3" aria-label="Examination workspace">{[['attendance','Attendance'],['control','Exam Session Control'],['history','Activity History']].map(([key,label])=><button key={key} aria-pressed={tab===key} className={tab===key?attendancePrimary:attendanceSecondary} onClick={()=>setTab(key as typeof tab)}>{label}</button>)}</nav>{tab==='attendance'?<AttendanceWorkspace role="SUPER_ADMIN"/>:<ExamSessionControl key={actorId} actorId={actorId} historyOnly={tab==='history'}/>}</div>;
}

function AttendanceWorkspace({ role }: { role: string }) {
  const administrator = role === 'ADMIN' || role === 'SUPER_ADMIN';
  const [centers, setCenters] = useState<CenterOption[]>([]), [halls, setHalls] = useState<HallOption[]>([]);
  const [loading, setLoading] = useState(true), [sourceError, setSourceError] = useState(''), [sourceRetry, setSourceRetry] = useState(0);
  const [centerId, setCenterId] = useState('all'), [hallId, setHallId] = useState('');
  const [history, setHistory] = useState<AttendanceSessionListResponse | null>(null), [historyLoading, setHistoryLoading] = useState(false), [historyError, setHistoryError] = useState('');
  const [currentHall,setCurrentHall]=useState<{session:AttendanceSession|null;canPrepare:boolean;canOpen:boolean}|null>(null);
  const [historyPage, setHistoryPage] = useState(1), [historyStatus, setHistoryStatus] = useState(''), [historyDate, setHistoryDate] = useState('');
  const [sessionId, setSessionId] = useState(''), [detail, setDetail] = useState<AttendanceSessionDetail | null>(null), [detailLoading, setDetailLoading] = useState(false), [detailError, setDetailError] = useState('');
  const [resetDialog, setResetDialog] = useState(false);
  const [cancelDialog, setCancelDialog] = useState(false);
  const [refresh, setRefresh] = useState(0), [notice, setNotice] = useState('');
  const [attendanceTab, setAttendanceTab] = useState<'manual' | 'scan'>('manual'), [scanBusy, setScanBusy] = useState(false);
  const [dialog, setDialog] = useState<'open' | 'close' | 'reopen' | null>(null), [busy, setBusy] = useState(false), [modalError, setModalError] = useState(''), [convertAbsent, setConvertAbsent] = useState(false), [markDialog, setMarkDialog] = useState(false);
  const [reopenReason, setReopenReason] = useState(''), [reopenConfirmation, setReopenConfirmation] = useState('');
  const hall = halls.find(item => item.id === hallId);
  const visibleHalls = halls.filter(item => centerId === 'all' || (item.testCenterId ?? 'unknown') === centerId);
  const locked = busy || !!dialog || markDialog || scanBusy || resetDialog || cancelDialog;
  const desiredSession = useRef('');
  useEffect(() => {
    let active = true; setLoading(true); setSourceError('');
    const load = async () => {
      if (administrator) {
        const [nextCenters, nextHalls] = await Promise.all([mockApi.getTestCenters(), mockApi.getExamHalls()]);
        if (!active) return;
        setCenters(nextCenters.map(item => ({ id: item.id, name: item.name })));
        setHalls(nextHalls.map(item => ({ id: item.id, name: item.name ?? null, roomNumber: item.roomNumber ?? null, examDate: item.examDate ?? null, reportingTime: item.reportingTime ?? null, testCenterId: item.testCenterId ?? null, centerName: item.centerName ?? nextCenters.find(center => center.id === item.testCenterId)?.name ?? null, assignedCount: Number.isInteger(item.assignedCount) && item.assignedCount >= 0 ? item.assignedCount : null })));
      } else {
        // Teachers only read authorized session snapshots; configuration APIs are admin-only.
        const sessions: AttendanceSession[] = []; let page = 1;
        while (active) {
          const result = await mockApi.getAttendanceSessions({ page, limit: 100 }); sessions.push(...result.sessions);
          if (page >= result.pagination.totalPages) break; page++;
        }
        if (!active) return;
        const options = new Map<string, HallOption>(), centerOptions = new Map<string, CenterOption>();
        for (const session of sessions) {
          const key = session.testCenterNameSnapshot ? 'snapshot:' + session.testCenterNameSnapshot : 'unknown';
          if (!options.has(session.examHallId)) options.set(session.examHallId, { id: session.examHallId, name: session.hallNameSnapshot, roomNumber: session.roomNumberSnapshot, examDate: session.examDateSnapshot, reportingTime: session.reportingTimeSnapshot, testCenterId: key, centerName: session.testCenterNameSnapshot, assignedCount: null });
        }
        for (const option of options.values()) centerOptions.set(option.testCenterId!, { id: option.testCenterId!, name: option.centerName });
        setCenters([...centerOptions.values()]); setHalls([...options.values()]);
      }
    };
    load().catch((error: Error) => { if (active) setSourceError(error.message || 'Failed to load examination attendance workspace.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [administrator, sourceRetry]);
  useEffect(() => {
    if (loading || sourceError) return;
    if (!visibleHalls.some(item => item.id === hallId)) { setHallId(visibleHalls[0]?.id ?? ''); setHistoryPage(1); setSessionId(''); setNotice(''); }
  }, [halls, centerId, hallId, loading, sourceError]);
  useEffect(() => {
    let active = true; setHistory(null); setHistoryError('');
    if (!hallId || loading || sourceError) { setHistoryLoading(false); setSessionId(''); return; }
    setHistoryLoading(true);
    Promise.all([administrator?examControlApi.currentHall(hallId):Promise.resolve(null),mockApi.getAttendanceSessions({ examHallId: hallId, page: historyPage, limit: 10, includeHistory: true, ...(historyStatus ? { status: historyStatus as 'OPEN' | 'CLOSED' | 'CANCELLED' } : {}), ...(historyDate ? { businessDate: historyDate } : {}) })])
      .then(([current,result]) => {
        if(active)setCurrentHall(current);
        if (!active) return;
        if (result.sessions.some(session => session.examHallId !== hallId)) throw new Error('Returned sessions do not belong to the selected Hall.');
        setHistory(result); setSessionId(previous => result.sessions.some(session => session.id === desiredSession.current) ? desiredSession.current : result.sessions.some(session => session.id === previous) ? previous : (result.sessions.find(session => session.isCurrent !== false) ?? result.sessions[0])?.id ?? '');
        desiredSession.current = '';
      }).catch((error: Error) => { if (active) { setHistoryError(error.message || 'Failed to load Hall sessions.'); setSessionId(''); } })
      .finally(() => { if (active) setHistoryLoading(false); });
    return () => { active = false; };
  }, [hallId, historyPage, historyStatus, historyDate, refresh, loading, sourceError]);
  useEffect(() => {
    let active = true; setDetail(null); setDetailError('');
    if (!sessionId || loading || sourceError || historyLoading || historyError) { setDetailLoading(false); return; }
    setDetailLoading(true);
    mockApi.getAttendanceSession(sessionId).then(result => {
      if (!active) return;
      if (result.session.id !== sessionId || result.session.examHallId !== hallId || !['PRE_OPEN', 'OPEN', 'CLOSED', 'CANCELLED'].includes(result.session.status)) throw new Error('The selected attendance session is unavailable.');
      setDetail(result);
    }).catch((error: Error) => { if (active) setDetailError(error.message || 'Failed to load selected session.'); }).finally(() => { if (active) setDetailLoading(false); });
    return () => { active = false; };
  }, [sessionId, hallId, refresh, loading, sourceError, historyLoading, historyError]);
  const changeHall = (id: string) => { setHallId(id); setSessionId(''); setDetail(null); setHistoryPage(1); setHistoryStatus(''); setHistoryDate(''); setNotice(''); };
  const openDialog = (kind: 'open' | 'close' | 'reopen') => { setModalError(''); setConvertAbsent(false); setReopenReason(''); setReopenConfirmation(''); setDialog(kind); setNotice(''); };
  const submit = async () => {
    if (busy || !administrator) return;
    setBusy(true); setModalError('');
    try {
      if (dialog === 'open' && hall) {
        if (!currentHall?.session || currentHall.session.status !== 'PRE_OPEN' || currentHall.session.examHallId !== hall.id) throw new Error('The prepared session changed. Refresh before opening attendance.');
        const created = await mockApi.createAttendanceSession({ examHallId: hall.id, sessionId: currentHall.session.id, revision: currentHall.session.revision });
        if (created.session.examHallId !== hall.id || created.session.status !== 'OPEN') throw new Error('Session opening was not confirmed. Refresh Hall sessions before retrying.');
        desiredSession.current = created.session.id; setSessionId(created.session.id); setHistoryPage(1); setHistoryDate(''); setHistoryStatus(''); setNotice('Attendance session opened. Current assignments form the attendance roster snapshot. Placements remain explicitly controlled.');
      } else if (dialog === 'reopen' && detail) {
        const reopened = await mockApi.reopenAttendanceSession(detail.session.id, {
          reason: reopenReason.trim(), confirmationText: 'REOPEN SESSION',
        });
        if (reopened.session.id !== detail.session.id || reopened.session.status !== 'OPEN' ||
            reopened.session.isCurrent === false)
          throw new Error('Reopening was not confirmed. Refresh the session before retrying.');
        setDetail(reopened);
        setNotice('Session reopened by Super Admin. All existing attendance marks and attendance roster snapshot entries are preserved.');
        setAttendanceTab('manual');
      } else if (dialog === 'close' && detail) {
        const closed = await mockApi.closeAttendanceSession(detail.session.id, { markRemainingAbsent: convertAbsent });
        if (closed.session.id !== detail.session.id || closed.session.status !== 'CLOSED') throw new Error('Session closure was not confirmed. Refresh the session before retrying.');
        setDetail(closed); setNotice('Attendance session closed. Historical attendance is preserved.');
      } else return;
      setDialog(null); setRefresh(value => value + 1);
    } catch (error: any) { setModalError(error.message || 'The attendance operation could not be completed.'); }
    finally { setBusy(false); }
  };
  const knownCount = hall?.assignedCount !== null && hall?.assignedCount !== undefined;
  // A CANCELLED Hall/date can explicitly start its next attempt. Older attempts remain immutable.
  // Backend remains authoritative, including a Super Admin-only reopen permission.
  const prepared=currentHall?.session?.status==='PRE_OPEN'?currentHall.session:null;
  const canOpen=administrator&&!!prepared&&!!hall&&!!hall.assignedCount&&!historyLoading&&!loading&&!sourceError&&!historyError;
  const sessionReady = !!detail && !detailLoading && !detailError && !historyLoading && !historyError && !loading && !sourceError;
  return <div className="min-w-0 space-y-4 text-slate-800">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[11px] font-semibold tracking-wide text-slate-500">EXAMINATION ATTENDANCE</p><h1 className="mt-1 text-base sm:text-lg font-bold text-slate-900">Examination Attendance Hub</h1><p className="mt-1 text-xs text-slate-500">Select a Center and Hall, open or view a session, record attendance, then close the session.</p></div><button className={attendanceSecondary} disabled={loading || locked} onClick={() => { setSourceRetry(value => value + 1); setRefresh(value => value + 1); }}>Refresh workspace</button></header>
    {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}
    {loading && <p role="status" className="text-sm text-slate-600">Loading examination attendance workspace…</p>}
    {sourceError && <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><span>Failed to load workspace: {sourceError}</span><button className={attendanceSecondary} onClick={() => setSourceRetry(value => value + 1)}>Retry workspace</button></div>}
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="Center and Hall selection">
      <div className="grid gap-3 sm:grid-cols-2"><div><label htmlFor="attendance-center" className="mb-1 block text-xs font-semibold">Test Center</label><select id="attendance-center" className={attendanceField} value={centerId} disabled={loading || !!sourceError || locked} onChange={event => { setCenterId(event.target.value); setSessionId(''); setHistoryPage(1); setHistoryStatus(''); setHistoryDate(''); }}><option value="all">All Test Centers</option>{centers.map(center => <option key={center.id} value={center.id}>{attendanceValue(center.name)}</option>)}{administrator && halls.some(item => !item.testCenterId) && <option value="unknown">Unknown Test Center</option>}</select></div>
        <div><label htmlFor="attendance-hall" className="mb-1 block text-xs font-semibold">Exam Hall</label><select id="attendance-hall" className={attendanceField} value={hallId} disabled={loading || !!sourceError || locked || !visibleHalls.length} onChange={event => changeHall(event.target.value)}><option value="">Select an Exam Hall</option>{visibleHalls.map(item => <option key={item.id} value={item.id}>{attendanceValue(item.name)} · {attendanceValue(item.roomNumber)}{item.assignedCount !== null ? ` · ${item.assignedCount} explicitly assigned` : ''}</option>)}</select></div></div>
      {!loading && !sourceError && !visibleHalls.length && <p className="mt-3 text-sm text-slate-500">{administrator ? 'No Exam Halls are available for this Test Center.' : 'No examination sessions are available for your attendance workspace.'}</p>}
      {hall && !loading && !sourceError && <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-slate-100 pt-3 text-xs sm:grid-cols-4">{[['Room', hall.roomNumber], [administrator ? 'Configured Exam Date' : 'Session Exam Date', hall.examDate], ['Reporting Time', hall.reportingTime], ...(administrator ? [['Explicitly Assigned', hall.assignedCount]] : [])].map(([name, value]) => <div key={name}><dt className="text-slate-500">{name}</dt><dd className="mt-1 break-words font-semibold">{attendanceValue(value)}</dd></div>)}</dl>}
      {administrator && hall && knownCount && hall.assignedCount === 0 && !loading && !sourceError && <p className="mt-3 text-sm text-slate-600">No explicitly assigned candidates are available for this Hall.</p>}
    </section>
    {hall && !loading && !sourceError && <>
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="Attendance session">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-sm font-bold">Attendance Session</h2><div className="flex flex-wrap gap-2">{administrator&&currentHall?.canPrepare&&<button className={attendanceSecondary} disabled={locked||historyLoading||busy} onClick={async()=>{setBusy(true);try{await examControlApi.prepare(hallId);setRefresh(v=>v+1);setNotice('PRE_OPEN session prepared. Open explicitly to start attendance.');}catch(e:any){setNotice(e.message);}finally{setBusy(false);}}}>Prepare session</button>}{administrator && <button className={attendancePrimary} disabled={!canOpen || locked} onClick={() => openDialog('open')}>Open Attendance Session</button>}{administrator && sessionReady && detail.session.status === 'OPEN' && detail.session.isCurrent !== false && <button className={attendanceSecondary} disabled={locked} onClick={() => openDialog('close')}>Close Attendance Session</button>}{role === 'SUPER_ADMIN' && sessionReady && detail.session.status === 'CLOSED' && detail.session.isCurrent !== false && <button className={attendanceSecondary} disabled={locked} onClick={() => openDialog('reopen')}>Reopen Closed Session</button>}</div></div>
        {historyLoading && <p role="status" className="mt-3 text-sm text-slate-600">Loading Hall sessions…</p>}
        {historyError && <div role="alert" className="mt-3 flex flex-wrap items-center gap-3 text-sm text-red-700"><span>Failed to load Hall sessions: {historyError}</span><button className={attendanceSecondary} onClick={() => setRefresh(value => value + 1)}>Retry sessions</button></div>}
        {!historyLoading && !historyError && history && !history.sessions.length && <div className="mt-3"><span className="text-xs font-semibold text-slate-600">NO SESSION</span><p className="mt-1 text-sm text-slate-600">{historyDate || historyStatus ? 'No attendance sessions match these filters for this Hall.' : 'No attendance session has been opened for this Hall.'}</p></div>}
        {history && history.sessions.length > 0 && !historyLoading && !historyError && <div className="mt-3"><label className="mb-1 block text-xs font-semibold" htmlFor="attendance-session">View Attendance Session</label><select id="attendance-session" className={attendanceField + ' sm:max-w-lg'} value={sessionId} disabled={locked} onChange={event => { setSessionId(event.target.value); setNotice(''); }}>{history.sessions.map(session => <option key={session.id} value={session.id}>{attendanceValue(session.examDateSnapshot)} · Attempt {session.attemptNumber ?? 1} · {session.status === 'CANCELLED' ? 'Cancelled' : session.isCurrent === false ? 'Archived' : session.status} · {attendanceValue(session.hallNameSnapshot)}</option>)}</select></div>}
        {detailLoading && <p role="status" className="mt-3 text-sm text-slate-600">Loading selected session…</p>}
        {detailError && <div role="alert" className="mt-3 flex flex-wrap items-center gap-3 text-sm text-red-700"><span>Failed to load selected session: {detailError}</span><button className={attendanceSecondary} onClick={() => setRefresh(value => value + 1)}>Retry selected session</button></div>}
        {sessionReady && <>
          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3"><span className={'rounded px-2 py-1 text-xs font-semibold ' + (detail.session.status === 'OPEN' && detail.session.isCurrent !== false ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-700')}>{detail.session.status === 'CANCELLED' ? 'CANCELLED SESSION' : detail.session.isCurrent === false ? 'ARCHIVED ATTEMPT' : `${detail.session.status} SESSION`}</span><p className="text-xs text-slate-500">{detail.session.status === 'OPEN' && detail.session.isCurrent !== false ? 'Attendance is recorded against this attendance roster snapshot.' : detail.session.status==='PRE_OPEN'?'Preparation state. Open explicitly to begin attendance.':'Historical session. Further attendance marking is closed.'}</p></div>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-xs sm:grid-cols-3 lg:grid-cols-5">{contextRows(detail.session).map(([name, value]) => <div key={name}><dt className="text-slate-500">{name}</dt><dd className="mt-1 break-words font-semibold">{attendanceValue(value)}</dd></div>)}</dl>
          <dl className="mt-4 grid grid-cols-2 divide-x divide-slate-100 border-y border-slate-100 py-3 sm:grid-cols-4 lg:grid-cols-7">{[detail.stats.expectedCount, detail.stats.markedCount, detail.stats.presentCount, detail.stats.lateCount, detail.stats.absentCount, detail.stats.unmarkedCount, detail.stats.attendancePercentage === null ? '—' : `${detail.stats.attendancePercentage}%`].map((value, index) => <div key={summaryLabels[index]} className="px-3 py-1"><dt className="text-xs text-slate-500">{summaryLabels[index]}</dt><dd className="mt-1 text-lg font-bold tabular-nums text-slate-900">{value}</dd></div>)}</dl>
        </>}
      </section>
      {sessionReady && !resetDialog && <>
        <div className="flex flex-wrap gap-2" aria-label="Attendance method">
          <button aria-pressed={attendanceTab === 'manual'} className={attendanceTab === 'manual' ? attendancePrimary : attendanceSecondary} disabled={locked} onClick={() => { setAttendanceTab('manual'); if (attendanceTab === 'scan') setRefresh(value => value + 1); }}>Manual attendance</button>
          <button aria-pressed={attendanceTab === 'scan'} className={attendanceTab === 'scan' ? attendancePrimary : attendanceSecondary} disabled={locked || detail.session.status !== 'OPEN' || detail.session.isCurrent === false} onClick={() => setAttendanceTab('scan')}>QR attendance</button>
        </div>
        {attendanceTab === 'scan' && detail.session.status === 'OPEN' && detail.session.isCurrent !== false ? <QrScannerTab key={detail.session.id} detail={detail} onBusyChange={setScanBusy} onManualAttendance={() => { setAttendanceTab('manual'); setRefresh(value => value + 1); }} /> : <ManualAttendanceTab key={detail.session.id} detail={detail} canMark={permitted.includes(role) && detail.session.status === 'OPEN' && detail.session.isCurrent !== false} refresh={refresh} onRecorded={() => { setNotice('Attendance recorded successfully.'); setRefresh(value => value + 1); }} onDialogChange={setMarkDialog} />}
      </>}
      <section className="min-w-0 rounded-xl border border-slate-200 bg-white shadow-sm" aria-labelledby="attendance-history-title">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 p-4"><div><h2 id="attendance-history-title" className="text-sm font-bold">Hall Session History</h2><p className="mt-1 text-xs text-slate-500">Session snapshots and recorded metrics.</p></div><div className="flex flex-wrap gap-3"><div><label className="mb-1 block text-xs font-semibold" htmlFor="attendance-history-date">Business date</label><input id="attendance-history-date" type="date" className={attendanceField} value={historyDate} disabled={locked} onChange={event => { setHistoryDate(event.target.value); setHistoryPage(1); setSessionId(''); }} /></div><div><label className="mb-1 block text-xs font-semibold" htmlFor="attendance-history-status">Session status</label><select id="attendance-history-status" className={attendanceField} value={historyStatus} disabled={locked} onChange={event => { setHistoryStatus(event.target.value); setHistoryPage(1); setSessionId(''); }}><option value="">All statuses</option><option value="OPEN">Open</option><option value="CLOSED">Closed</option><option value="CANCELLED">Cancelled</option></select></div></div></div>
        {historyLoading && <p role="status" className="p-4 text-sm text-slate-600">Loading session history…</p>}
        {historyError && <p role="alert" className="p-4 text-sm text-red-700">Session history could not be loaded. Use Retry sessions above.</p>}
        {history && !historyLoading && !historyError && <><div className="max-w-full overflow-x-auto" role="region" aria-label="Hall session history table" tabIndex={0}><table className="w-full min-w-[880px] text-left text-xs"><thead className="border-b border-slate-200 bg-slate-50 text-slate-600"><tr>{['Exam Date', 'Center', 'Hall', 'Status', 'Expected', 'Present', 'Late', 'Absent', 'Not Marked', '%', 'Action'].map(name => <th scope="col" className="px-3 py-2.5 font-semibold" key={name}>{name}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{history.sessions.map(session => <tr key={session.id} className={session.id === sessionId ? 'bg-blue-50/50' : 'hover:bg-slate-50'}><td className="whitespace-nowrap px-3 py-2.5">{attendanceValue(session.examDateSnapshot)}</td><td className="px-3 py-2.5">{attendanceValue(session.testCenterNameSnapshot)}</td><td className="px-3 py-2.5">{attendanceValue(session.hallNameSnapshot)}</td><td className="px-3 py-2.5 font-semibold">{session.status === 'CANCELLED' ? 'Cancelled' : session.isCurrent === false ? 'Archived' : session.status} · Attempt {session.attemptNumber ?? 1}</td><td className="px-3 py-2.5 tabular-nums">{session.stats.expectedCount}</td><td className="px-3 py-2.5 tabular-nums">{session.stats.presentCount}</td><td className="px-3 py-2.5 tabular-nums">{session.stats.lateCount}</td><td className="px-3 py-2.5 tabular-nums">{session.stats.absentCount}</td><td className="px-3 py-2.5 tabular-nums">{session.stats.unmarkedCount}</td><td className="px-3 py-2.5 tabular-nums">{session.stats.attendancePercentage === null ? '—' : `${session.stats.attendancePercentage}%`}</td><td className="px-3 py-2.5"><button className={attendanceSecondary} disabled={locked || session.id === sessionId} onClick={() => { setSessionId(session.id); setNotice(''); }}>View Session</button></td></tr>)}</tbody></table></div>{!history.sessions.length && <p className="p-4 text-sm text-slate-500">No session history to display.</p>}<div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-4 py-3 text-xs text-slate-600"><span>{history.pagination.total} sessions{history.pagination.totalPages > 0 ? ` · Page ${historyPage} of ${history.pagination.totalPages}` : ''}</span><div className="flex gap-2"><button className={attendanceSecondary} disabled={historyPage <= 1 || locked} onClick={() => setHistoryPage(value => value - 1)}>Previous history page</button><button className={attendanceSecondary} disabled={historyPage >= history.pagination.totalPages || locked} onClick={() => setHistoryPage(value => value + 1)}>Next history page</button></div></div></>}
      </section>
    </>}
    {dialog && <AttendanceDialog title={dialog === 'open' ? 'Confirm Open Session' : dialog === 'reopen' ? 'Confirm Reopen Closed Session' : 'Confirm Close Session'} busy={busy} onClose={() => { if (!busy) setDialog(null); }} footer={<><button data-autofocus className={attendanceSecondary} disabled={busy} onClick={() => setDialog(null)}>Cancel</button><button className={attendancePrimary} disabled={busy || (dialog === 'reopen' && (reopenReason.trim().length < 10 || reopenConfirmation !== 'REOPEN SESSION'))} onClick={submit}>{busy ? 'Saving…' : dialog === 'open' ? 'Open Session' : dialog === 'reopen' ? 'Reopen Session' : 'Close Session'}</button></>}>
      {dialog === 'reopen' && detail ? <div className="space-y-3 text-sm">
        <p className="font-semibold text-slate-900">Unlock this CLOSED session without resetting attendance?</p>
        <dl className="grid grid-cols-3 gap-2 text-xs">
          <div><dt>Expected</dt><dd className="font-bold">{detail.stats.expectedCount}</dd></div>
          <div><dt>Already marked</dt><dd className="font-bold">{detail.stats.markedCount}</dd></div>
          <div><dt>Not marked</dt><dd className="font-bold">{detail.stats.unmarkedCount}</dd></div>
        </dl>
        <p className="text-slate-600">All Present, Late and Absent marks will remain unchanged, including marks entered automatically on closure. Previously marked candidates cannot be marked again. This action is permanently audited.</p>
        <label className="block font-semibold" htmlFor="attendance-reopen-reason">Reason for reopening (required, at least 10 characters)</label>
        <textarea id="attendance-reopen-reason" rows={3} maxLength={1000} value={reopenReason} disabled={busy}
          onChange={event => setReopenReason(event.target.value)}
          className={attendanceField + ' w-full'} placeholder="Explain why the session needs to reopen..." />
        <label className="block font-semibold" htmlFor="attendance-reopen-confirm">Type REOPEN SESSION to confirm</label>
        <input id="attendance-reopen-confirm" type="text" autoComplete="off" value={reopenConfirmation} disabled={busy}
          onChange={event => setReopenConfirmation(event.target.value)} className={attendanceField + ' w-full'} />
      </div> : dialog === 'open' && hall ? <><dl className="grid grid-cols-2 gap-x-3 gap-y-3 text-sm">{[['Test Center', hall.centerName], ['Hall', hall.name], ['Room', hall.roomNumber], ['Exam Date', hall.examDate], ['Reporting Time', hall.reportingTime], ['Candidates to snapshot', hall.assignedCount]].map(([name, value]) => <div key={name}><dt className="text-xs text-slate-500">{name}</dt><dd className="mt-1 break-words font-semibold">{attendanceValue(value)}</dd></div>)}</dl><p className="mt-4 text-sm text-slate-600">Opening creates an attendance roster snapshot from current assignments. It does not freeze placements.</p></> : detail && <><dl className="grid grid-cols-3 gap-3 text-sm">{[['Expected', detail.stats.expectedCount], ['Marked', detail.stats.markedCount], ['Not Marked', detail.stats.unmarkedCount]].map(([name, value]) => <div key={name}><dt className="text-xs text-slate-500">{name}</dt><dd className="mt-1 font-semibold tabular-nums">{value}</dd></div>)}</dl><label className="mt-4 flex items-start gap-2 text-sm"><input id="attendance-close-absent" type="checkbox" checked={convertAbsent} disabled={busy} onChange={event => setConvertAbsent(event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[#185b9d] focus-visible:outline-2 focus-visible:outline-[#185b9d]" /><span>Mark all remaining Not Marked candidates as Absent</span></label><p className="mt-3 text-sm text-slate-600">Closing the session prevents further attendance marking.</p><p className="mt-2 text-xs text-slate-500">{convertAbsent ? 'Only remaining Not Marked candidates will be recorded as Absent.' : 'Remaining candidates will stay Not Marked in the historical roster.'}</p></>}
      {modalError && <p role="alert" className="mt-3 text-sm text-red-700">{modalError}</p>}
    </AttendanceDialog>}
  </div>;
}
