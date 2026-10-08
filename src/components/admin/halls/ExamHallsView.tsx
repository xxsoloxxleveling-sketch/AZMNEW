import React, { useEffect, useId, useRef, useState } from 'react';
import { Building2, Users, Armchair, Plus, Printer, Search, X, Loader2, Pencil, Trash2, UserPlus } from 'lucide-react';
import { mockApi, HallCandidate, MockTestCenter } from '../../../lib/mockApi';
import { useAuth } from '../../../lib/authContext';

export interface ExamHall {
  id: string; name: string; roomNumber: string; targetClass: string; wing: string | null;
  capacity: number; assignedCount: number; availableSeats: number; utilizationPercent: number | null; isOverCapacity: boolean;
  testCenterId: string | null; centerName: string | null; reportingTime: string; examDate: string;
  invigilatorName: string | null; invigilatorPhone: string | null;
}
type HallForm = Record<'name' | 'roomNumber' | 'targetClass' | 'wing' | 'capacity' | 'testCenterId' | 'examDate' | 'reportingTime' | 'invigilatorName' | 'invigilatorPhone', string>;
type Dialog = { kind: 'place' | 'create' } | { kind: 'edit' | 'delete'; hall: ExamHall } | { kind: 'move' | 'seat' | 'unassign'; candidate: HallCandidate };
const blankForm = (): HallForm => ({ name: '', roomNumber: '', targetClass: '', wing: '', capacity: '', testCenterId: '', examDate: '', reportingTime: '', invigilatorName: '', invigilatorPhone: '' });
const classes = [['CLASS_6', 'Class 6th'], ['CLASS_7', 'Class 7th'], ['CLASS_8', 'Class 8th'], ['CLASS_9', 'Class 9th'], ['CLASS_10', 'Class 10th'], ['HSSC_1', 'First Year'], ['HSSC_2', 'Second Year']];
const primary = 'inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold bg-[#185b9d] text-white hover:bg-[#13497d] disabled:opacity-50 disabled:cursor-not-allowed';
const secondary = 'inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50';
const field = 'w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#185b9d]/30 focus:border-[#185b9d]';
const knownCapacity = (hall: ExamHall) => Number.isFinite(hall.capacity) && hall.capacity > 0;
const remaining = (hall: ExamHall) => knownCapacity(hall) ? Math.max(hall.capacity - hall.assignedCount, 0) : null;
const hallState = (hall: ExamHall) => !knownCapacity(hall) ? 'Capacity unknown' : hall.assignedCount > hall.capacity ? 'Over Capacity' : hall.assignedCount === hall.capacity ? 'Full' : 'Available';
const escapeHtml = (value: unknown) => String(value ?? '—').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export function buildHallRosterHtml(hall: ExamHall, candidates: HallCandidate[]) {
  const rows = candidates.filter(candidate => candidate.assignedHallId === hall.id);
  const meta = [['Center', hall.centerName], ['Hall', hall.name], ['Room', hall.roomNumber], ['Target Class', hall.targetClass],
    ['Exam Date', hall.examDate || null], ['Reporting Time', hall.reportingTime || null], ['Capacity', knownCapacity(hall) ? hall.capacity : null],
    ['Assigned Candidates', rows.length], ['Recorded Invigilator', hall.invigilatorName]];
  return '<!doctype html><html><head><meta charset="utf-8"><title>Official Examination Seating Roster</title><style>' +
    '@page{size:A4;margin:12mm}*{box-sizing:border-box}body{font:11px Arial,sans-serif;color:#0f172a;margin:0}h1{font-size:20px;color:#185b9d;margin:0}h2{font-size:14px;margin:5px 0 14px}.meta{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;border:1px solid #cbd5e1;padding:10px;margin-bottom:14px}.meta b{display:block;margin-top:3px}table{width:100%;border-collapse:collapse}th{background:#e2e8f0;text-align:left}td,th{border:1px solid #cbd5e1;padding:7px}thead{display:table-header-group}tr{break-inside:avoid}.signature{height:24px;min-width:90px}.footer{margin-top:22px;display:flex;justify-content:space-between}</style></head><body>' +
    '<h1>AZM.AIO</h1><h2>Official Examination Seating Roster</h2><div class="meta">' +
    meta.map(([label, value]) => '<div>' + escapeHtml(label) + '<b>' + escapeHtml(value) + '</b></div>').join('') +
    '</div><table><thead><tr><th>Seat</th><th>Roll Number</th><th>Candidate Name</th><th>Class</th><th>Candidate Signature</th></tr></thead><tbody>' +
    rows.map(c => '<tr><td>' + escapeHtml(c.seatNo || 'Unassigned') + '</td><td>' + escapeHtml(c.rollNumber || null) + '</td><td>' + escapeHtml(c.fullName) + '</td><td>' + escapeHtml(c.currentClass || null) + '</td><td class="signature"></td></tr>').join('') +
    '</tbody></table><div class="footer"><span>Recorded Invigilator Signature: __________________</span><span>Center Superintendent: __________________</span></div></body></html>';
}

// Local equivalent of the classic confirmation shell, with focus containment,
// Escape dismissal, semantic title, and focus restoration. Shared modals stay unchanged.
function HallDialog({ title, busy, onClose, children }: { title: string; busy: boolean; onClose: () => void; children: React.ReactNode }) {
  const id = useId(); const panel = useRef<HTMLDivElement>(null);
  const latest = useRef({ busy, onClose }); latest.current = { busy, onClose };
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const focusables = (): HTMLElement[] => Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]') || []) as HTMLElement[];
    (panel.current?.querySelector<HTMLElement>('input,select') || focusables()[0])?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !latest.current.busy) { event.preventDefault(); latest.current.onClose(); }
      if (event.key === 'Tab') {
        const items = focusables(), first = items[0], last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', keydown); previous?.focus(); };
  }, []);
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 p-4 flex items-start sm:items-center justify-center">
    <div ref={panel} role="dialog" aria-modal="true" aria-labelledby={id} className="my-auto w-full max-w-3xl min-w-0 max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xl">
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3 mb-4"><h2 id={id} className="text-base font-bold text-slate-900">{title}</h2>
        <button type="button" aria-label="Close dialog" title="Close dialog" disabled={busy} className={secondary} onClick={onClose}><X size={16}/></button></div>
      {children}
    </div>
  </div>;
}

export const ExamHallsView: React.FC<{ onOpenQrScanner?: () => void }> = () => {
  const { isLoading: authLoading } = useAuth();
  const [halls, setHalls] = useState<ExamHall[]>([]), [centers, setCenters] = useState<MockTestCenter[]>([]);
  const [centerFilter, setCenterFilter] = useState('all'), [selectedId, setSelectedId] = useState('');
  const [unassigned, setUnassigned] = useState<number | null>(null), [loading, setLoading] = useState(true), [loadError, setLoadError] = useState('');
  const [roster, setRoster] = useState<HallCandidate[]>([]), [rosterId, setRosterId] = useState(''), [rosterError, setRosterError] = useState('');
  const [refresh, setRefresh] = useState(0), [rosterSearch, setRosterSearch] = useState('');
  const [dialog, setDialog] = useState<Dialog | null>(null), [busy, setBusy] = useState(false), [modalError, setModalError] = useState(''), [notice, setNotice] = useState('');
  const [form, setForm] = useState<HallForm>(blankForm), [targetId, setTargetId] = useState(''), [newSeat, setNewSeat] = useState('');
  const [search, setSearch] = useState(''), [classFilter, setClassFilter] = useState(''), [genderFilter, setGenderFilter] = useState<'ALL' | 'MALE' | 'FEMALE'>('ALL'), [assignment, setAssignment] = useState<'unassigned' | 'assigned' | 'all'>('unassigned'), [page, setPage] = useState(1);
  const [candidates, setCandidates] = useState<HallCandidate[]>([]), [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [candidateLoading, setCandidateLoading] = useState(false), [candidateError, setCandidateError] = useState(''), [candidateRetry, setCandidateRetry] = useState(0);
  const [selected, setSelected] = useState<Record<string, HallCandidate>>({});
  const loadVersion = useRef(0);
  const visibleHalls = halls.filter(h => centerFilter === 'all' || h.testCenterId === centerFilter);
  const hall = visibleHalls.find(h => h.id === selectedId);

  const load = async () => {
    const version = ++loadVersion.current; setLoading(true); setLoadError('');
    try {
      const [nextCenters, nextHalls, count] = await Promise.all([mockApi.getTestCenters(), mockApi.getExamHalls(), mockApi.getHallCandidates({ assignment: 'unassigned', limit: 1 })]);
      if (version !== loadVersion.current) return;
      setCenters(nextCenters); setHalls(nextHalls); setUnassigned(count.pagination.total);
      setRefresh(value => value + 1);
    } catch (error: any) { if (version === loadVersion.current) setLoadError(error.message || 'Unable to load Hall workspace.'); }
    finally { if (version === loadVersion.current) setLoading(false); }
  };
  useEffect(() => { if (!authLoading) load(); return () => { loadVersion.current++; }; }, [authLoading]);
  useEffect(() => {
    if (!visibleHalls.some(h => h.id === selectedId)) setSelectedId(visibleHalls[0]?.id || '');
  }, [halls, centerFilter, selectedId]);
  useEffect(() => {
    let active = true; setRoster([]); setRosterId(''); setRosterError('');
    if (!selectedId) return;
    mockApi.getExamHall(selectedId).then(detail => { if (active) { setRoster(detail.assignedStudents); setRosterId(detail.id); } })
      .catch(error => { if (active) setRosterError(error.message); });
    return () => { active = false; };
  }, [selectedId, refresh]);
  useEffect(() => {
    let active = true;
    if (dialog?.kind !== 'place') return;
    setCandidateLoading(true); setCandidateError(''); setCandidates([]);
    mockApi.getHallCandidates({ search, class: classFilter || undefined, gender: genderFilter === 'ALL' ? undefined : genderFilter, assignment, page, limit: 25 })
      .then(result => { if (active) { setCandidates(result.candidates); setPagination(result.pagination); } })
      .catch(error => { if (active) setCandidateError(error.message); })
      .finally(() => { if (active) setCandidateLoading(false); });
    return () => { active = false; };
  }, [dialog?.kind, search, classFilter, genderFilter, assignment, page, refresh, candidateRetry]);

  const open = (next: Dialog) => {
    setModalError(''); setNotice(''); setDialog(next); setTargetId('');
    if (next.kind === 'create') setForm(blankForm());
    if (next.kind === 'edit') setForm(Object.fromEntries(Object.keys(blankForm()).map(key => [key, String((next.hall as any)[key] ?? '')])) as HallForm);
    if (next.kind === 'seat') setNewSeat(next.candidate.seatNo || '');
    if (next.kind === 'place') { setSearch(''); setClassFilter(''); setGenderFilter('ALL'); setAssignment('unassigned'); setPage(1); setSelected({}); }
  };
  const close = () => { if (!busy) setDialog(null); };
  const mutate = async (operation: () => Promise<string>, keepOpen = false) => {
    setBusy(true); setModalError('');
    try {
      const message = await operation(); setNotice(message);
      setSelected({}); if (!keepOpen) setDialog(null); else setPage(1);
      await load();
    } catch (error: any) { setModalError(error.message || 'Operation failed. Please retry.'); }
    finally { setBusy(false); }
  };
  const print = () => {
    if (!hall || rosterId !== hall.id || rosterError) return;
    const popup = window.open('', '_blank');
    if (!popup) { setLoadError('Allow popups to print the seating roster, then retry.'); return; }
    popup.document.open(); popup.document.write(buildHallRosterHtml(hall, roster)); popup.document.close();
    popup.focus(); popup.print();
  };
  const seats = hall ? remaining(hall) : null;
  const selection = Object.values(selected), excess = seats === null || selection.length > seats;
  const totalAssigned = halls.reduce((sum, h) => sum + h.assignedCount, 0);
  const totalAvailable = halls.every(knownCapacity) ? halls.reduce((sum, h) => sum + (remaining(h) ?? 0), 0) : null;
  const filteredRoster = roster.filter(c => c.assignedHallId === hall?.id && [c.fullName, c.rollNumber, c.applicationNo].some(value => value?.toLowerCase().includes(rosterSearch.toLowerCase())));
  const showEmpty = !loading && !loadError;
  const updateFilter = (change: () => void) => { change(); setPage(1); setSelected({}); };
  const toggle = (candidate: HallCandidate) => setSelected(previous => { const next = { ...previous }; if (next[candidate.id]) delete next[candidate.id]; else next[candidate.id] = candidate; return next; });
  const footer = (text: string, action: () => void, disabled = false, danger = false) => <div className="mt-4 pt-3 border-t border-slate-200 flex justify-end gap-2">
    <button className={secondary} type="button" disabled={busy} onClick={close}>Cancel</button>
    <button className={danger ? primary.replace('bg-[#185b9d]', 'bg-red-600').replace('hover:bg-[#13497d]', 'hover:bg-red-700') : primary} type="button" disabled={busy || disabled} onClick={action}>{busy && <Loader2 size={14} className="animate-spin"/>}{busy ? 'Saving...' : text}</button></div>;

  return <div className="space-y-4 min-w-0 text-slate-800">
    <section className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 rounded-xl bg-white border border-slate-200 p-4 shadow-sm">
      <div className="flex items-center gap-3 min-w-0"><span className="rounded-xl bg-blue-50 text-[#185b9d] p-2"><Building2 size={20}/></span><div><h1 className="text-base sm:text-lg font-bold">Examination Centers &amp; Hall Seating Management</h1><p className="text-xs text-slate-500 mt-1">Manage centers, rooms, candidate placement, and seating rosters.</p></div></div>
      <div className="flex flex-wrap gap-2"><button className={primary} disabled={!hall || loading || !!loadError} onClick={() => open({ kind: 'place' })}><UserPlus size={15}/>Place Candidates</button>
        <button className={secondary} disabled={!hall || rosterId !== hall.id || !!rosterError} onClick={print}><Printer size={15}/>Print Seating Roster</button>
        <button className={secondary} disabled={loading || !!loadError} onClick={() => open({ kind: 'create' })}><Plus size={15}/>Add Hall</button></div>
    </section>
    {loading && <p role="status" className="text-xs flex items-center gap-2"><Loader2 size={14} className="animate-spin"/>{halls.length ? 'Refreshing Hall workspace...' : 'Loading Hall workspace...'}</p>}
    {loadError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm">{loadError} <button className={secondary} onClick={load}>Retry</button></div>}
    {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm">{notice}</p>}
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      {([['Examination Centers', centers.length, Building2], ['Configured Halls', halls.length, Building2], ['Assigned Candidates', totalAssigned, Users], ['Unassigned Candidates', unassigned, Users], ['Available Seats', totalAvailable, Armchair]] as const).map(([label, value, Icon]) =>
        <div key={label} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><div className="flex items-center justify-between gap-2 text-xs text-slate-500"><span>{label}</span><Icon size={16} className="text-[#185b9d]"/></div><p className="text-xl font-bold mt-1 tabular-nums">{loading && !halls.length || loadError ? '—' : value ?? '—'}</p></div>)}
    </div>
    <section className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm">
      <label className="block text-xs font-semibold mb-1" htmlFor="hall-center-filter">Examination Center</label>
      <select id="hall-center-filter" className={field + ' sm:max-w-lg'} value={centerFilter} onChange={e => setCenterFilter(e.target.value)}>
        <option value="all">All Centers ({halls.length} halls)</option>{centers.map(center => <option key={center.id} value={center.id}>{center.name} · {center.code} · {halls.filter(h => h.testCenterId === center.id).length} halls</option>)}
      </select>
      {showEmpty && !centers.length && <p className="text-sm text-slate-500 mt-3">No examination centers have been configured.</p>}
      {showEmpty && !visibleHalls.length && <p className="text-sm text-slate-500 mt-3">No examination halls have been configured{centerFilter === 'all' ? '.' : ' for this center.'}</p>}
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3 mt-3">
        {visibleHalls.map(item => <button key={item.id} type="button" aria-pressed={item.id === selectedId} onClick={() => { setSelectedId(item.id); setRosterSearch(''); }} className={'min-w-0 rounded-xl border p-3 text-left ' + (item.id === selectedId ? 'border-[#185b9d] bg-blue-50 ring-1 ring-[#185b9d]/20' : 'border-slate-200 bg-white hover:bg-slate-50')}>
          <div className="flex items-start justify-between gap-2"><span className="font-bold text-sm break-words">{item.name}</span><span className={'text-xs font-semibold shrink-0 ' + (item.isOverCapacity ? 'text-red-700' : remaining(item) === 0 ? 'text-amber-700' : 'text-emerald-700')}>{hallState(item)}</span></div>
          <p className="text-xs text-slate-500 mt-1">{item.roomNumber} · {item.targetClass}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs mt-3"><span>Capacity <b>{knownCapacity(item) ? item.capacity : '—'}</b></span><span>Assigned <b>{item.assignedCount}</b></span><span>Available <b>{remaining(item) ?? '—'}</b></span></div>
        </button>)}
      </div>
    </section>
    {hall && <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3"><h2 className="text-base font-bold">{hall.name} · {hall.roomNumber}</h2>
        <div className="flex flex-wrap gap-2"><button className={secondary} onClick={() => open({ kind: 'edit', hall })}><Pencil size={14}/>Edit Hall</button><button className={secondary} onClick={() => open({ kind: 'place' })}>Place Candidates</button><button className={secondary} disabled={rosterId !== hall.id || !!rosterError} onClick={print}>Print Roster</button><button className={secondary + ' text-red-700'} onClick={() => open({ kind: 'delete', hall })}><Trash2 size={14}/>Delete Hall</button></div>
      </div>
      <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3 py-4 text-xs">
        {([['Center', hall.centerName], ['Target Class', hall.targetClass], ['Wing', hall.wing], ['Exam Date', hall.examDate], ['Reporting Time', hall.reportingTime], ['Capacity', knownCapacity(hall) ? hall.capacity : null], ['Assigned', hall.assignedCount], ['Available', seats], ['Recorded Invigilator', hall.invigilatorName]] as const).map(([label, value]) => <div key={label}><dt className="text-slate-500">{label}</dt><dd className="font-semibold mt-1 break-words">{value === '' || value == null ? '—' : value}</dd></div>)}
      </dl>
      <label htmlFor="hall-roster-search" className="block text-xs font-semibold mb-1">Search seated candidates</label><div className="relative sm:max-w-md"><Search size={15} className="absolute left-3 top-2.5 text-slate-400"/><input id="hall-roster-search" className={field + ' pl-9'} value={rosterSearch} onChange={e => setRosterSearch(e.target.value)} placeholder="Name, roll number or application ID"/></div>
      {rosterError && <p role="alert" className="text-red-700 text-sm mt-3">{rosterError} <button className={secondary} onClick={() => setRefresh(v => v + 1)}>Retry roster</button></p>}
      {!rosterError && rosterId !== hall.id && <p role="status" className="text-sm mt-3">Loading Hall roster...</p>}
      <div className="overflow-x-auto max-w-full rounded-xl border border-slate-200 mt-3"><table className="w-full min-w-[850px] text-left text-xs"><thead className="bg-slate-50 text-slate-600"><tr>{['Seat', 'Candidate', 'Roll Number', 'Application ID', 'Class', 'Room', 'Actions'].map(label => <th key={label} className="px-3 py-2 font-semibold">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">
        {filteredRoster.map(candidate => <tr key={candidate.id} className="hover:bg-slate-50"><td className="px-3 py-2 font-mono">{candidate.seatNo || 'Unassigned'}</td><td className="px-3 py-2 font-semibold">{candidate.fullName}</td><td className="px-3 py-2 font-mono">{candidate.rollNumber || '—'}</td><td className="px-3 py-2 font-mono">{candidate.applicationNo || '—'}</td><td className="px-3 py-2">{candidate.currentClass || '—'}</td><td className="px-3 py-2">{candidate.assignedRoom || '—'}</td><td className="px-3 py-2"><div className="flex gap-2 whitespace-nowrap"><button className="text-[#185b9d] hover:underline" onClick={() => open({ kind: 'move', candidate })}>Move</button><button className="text-[#185b9d] hover:underline" onClick={() => open({ kind: 'seat', candidate })}>Change Seat</button><button className="text-red-700 hover:underline" onClick={() => open({ kind: 'unassign', candidate })}>Unassign</button></div></td></tr>)}
        {rosterId === hall.id && !filteredRoster.length && <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-500">{roster.length ? 'No seated candidates match your search.' : 'No candidates are explicitly assigned to this Hall.'}</td></tr>}
      </tbody></table></div>
    </section>}
    {dialog && <HallDialog title={dialog.kind === 'place' ? 'Place Candidates' : dialog.kind === 'create' ? 'Add Hall' : dialog.kind === 'edit' ? 'Edit Hall' : dialog.kind === 'move' ? 'Move Candidate' : dialog.kind === 'seat' ? 'Change Seat' : dialog.kind === 'delete' ? 'Delete Hall?' : 'Unassign candidate from this Hall?'} busy={busy} onClose={close}>
      {modalError && <p role="alert" className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700 mb-3">{modalError}</p>}
      {dialog.kind === 'place' && hall && <>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs mb-4">{[['Capacity', knownCapacity(hall) ? hall.capacity : '—'], ['Currently Assigned', hall.assignedCount], ['Available Seats', seats ?? '—'], ['Selected Candidates', selection.length]].map(([label, value]) => <div key={label} className="bg-slate-50 rounded-xl p-2"><span className="block text-slate-500">{label}</span><b className="block text-base mt-1">{value}</b></div>)}</div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3"><label className="text-xs font-semibold">Search<input className={field + ' mt-1'} value={search} onChange={e => updateFilter(() => setSearch(e.target.value))} placeholder="Candidate name, roll or application"/></label>
          <label className="text-xs font-semibold">Class<select className={field + ' mt-1'} value={classFilter} onChange={e => updateFilter(() => setClassFilter(e.target.value))}><option value="">All Classes</option>{classes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="text-xs font-semibold">Gender<select className={field + ' mt-1'} value={genderFilter} onChange={e => updateFilter(() => setGenderFilter(e.target.value as 'ALL' | 'MALE' | 'FEMALE'))}><option value="ALL">All Genders</option><option value="MALE">Male</option><option value="FEMALE">Female</option></select></label>
          <label className="text-xs font-semibold">Assignment<select className={field + ' mt-1'} value={assignment} onChange={e => updateFilter(() => setAssignment(e.target.value as any))}><option value="unassigned">Unassigned</option><option value="assigned">Assigned</option><option value="all">All Candidates</option></select></label>
        </div>
        {candidateLoading && <p role="status" className="text-xs mt-3">Loading placement candidates...</p>}
        {candidateError && <p role="alert" className="text-sm text-red-700 mt-3">{candidateError} <button className={secondary} onClick={() => setCandidateRetry(v => v + 1)}>Retry candidates</button></p>}
        {!candidateLoading && !candidateError && <div className="overflow-x-auto rounded-xl border border-slate-200 mt-3 max-h-72"><table className="w-full min-w-[560px] text-xs text-left"><thead className="bg-slate-50 sticky top-0"><tr><th className="p-2">Select</th><th className="p-2">Name</th><th className="p-2">Roll / Application</th><th className="p-2">Class</th><th className="p-2">Current Hall State</th></tr></thead><tbody className="divide-y divide-slate-100">
          {candidates.map(candidate => <tr key={candidate.id} className="hover:bg-slate-50"><td className="p-2"><input type="checkbox" aria-label={'Select ' + candidate.fullName} checked={!!selected[candidate.id]} disabled={busy || candidate.assignedHallId === hall.id} onChange={() => toggle(candidate)}/></td><td className="p-2 font-semibold">{candidate.fullName}{candidate.legacyAllocationNeedsReview && <span className="block text-[11px] font-normal text-amber-700">Legacy allocation needs review</span>}</td><td className="p-2 font-mono">{candidate.rollNumber || candidate.applicationNo || '—'}</td><td className="p-2">{candidate.currentClass}</td><td className="p-2">{candidate.assignedHallId === hall.id ? 'Already in this Hall' : candidate.assignedHallId ? halls.find(h => h.id === candidate.assignedHallId)?.name || 'Assigned' : 'Unassigned'}</td></tr>)}
          {!candidates.length && <tr><td colSpan={5} className="p-5 text-center text-slate-500">No candidates match these filters.</td></tr>}
        </tbody></table></div>}
        <div className="flex flex-wrap items-center justify-between gap-2 mt-3 text-xs"><span>Page {page} of {pagination.totalPages || 1} · {pagination.total} candidates</span><div className="flex gap-2"><button className={secondary} disabled={busy || candidateLoading || !!candidateError || page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button><button className={secondary} disabled={busy || candidateLoading || !!candidateError || page >= pagination.totalPages} onClick={() => setPage(p => p + 1)}>Next</button></div></div>
        {excess && selection.length > 0 && <p role="alert" className="text-sm text-amber-800 mt-3">{seats === null ? 'Hall capacity is unknown.' : 'Only ' + seats + ' seats are available in this hall.'}</p>}
        {footer('Assign Candidates', () => mutate(async () => { const count = await mockApi.batchAssignStudentsToHall(hall.id, { hallName: hall.name, roomNumber: hall.roomNumber }, Object.keys(selected)); return 'Assigned ' + count + ' candidate(s).'; }, true), !selection.length || excess || candidateLoading || !!candidateError)}
      </>}
      {(dialog.kind === 'create' || dialog.kind === 'edit') && <form onSubmit={e => { e.preventDefault(); mutate(async () => {
        const payload = { ...form, capacity: Number(form.capacity), testCenterId: form.testCenterId || null };
        if (dialog.kind === 'edit') await mockApi.updateExamHall(dialog.hall.id, payload);
        else await mockApi.createExamHall({ ...payload, reportingTime: form.reportingTime || undefined, examDate: form.examDate || undefined });
        return dialog.kind === 'edit' ? 'Hall updated.' : 'Hall created.';
      }); }}>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-xs font-semibold">Test Center<select className={field + ' mt-1'} value={form.testCenterId} disabled={busy} onChange={e => { const center = centers.find(c => c.id === e.target.value); setForm({ ...form, testCenterId: e.target.value, reportingTime: center?.reportingTime || '', examDate: center?.testDate || '' }); }}><option value="">No center — schedule unknown</option>{centers.map(center => <option key={center.id} value={center.id}>{center.name} · {center.code}</option>)}</select></label>
          {([['name', 'Hall Name'], ['roomNumber', 'Room Number'], ['targetClass', 'Target Class'], ['wing', 'Wing'], ['capacity', 'Capacity'], ['examDate', 'Exam Date'], ['reportingTime', 'Reporting Time'], ['invigilatorName', 'Invigilator Name'], ['invigilatorPhone', 'Invigilator Phone']] as const).map(([key, label]) => <label key={key} className="text-xs font-semibold">{label}<input className={field + ' mt-1'} name={key} value={form[key]} type={key === 'capacity' ? 'number' : key === 'invigilatorPhone' ? 'tel' : 'text'} min={key === 'capacity' ? 1 : undefined} max={key === 'capacity' ? 100000 : undefined} step={key === 'capacity' ? 1 : undefined} required={['name', 'roomNumber', 'targetClass', 'capacity'].includes(key)} disabled={busy} onChange={e => setForm({ ...form, [key]: e.target.value })}/></label>)}
        </div><p className="text-xs text-slate-500 mt-3">Center schedules are copied when available. Blank schedule fields represent unknown values.</p>
        <div className="mt-4 border-t border-slate-200 pt-3 flex justify-end gap-2"><button className={secondary} type="button" disabled={busy} onClick={close}>Cancel</button><button className={primary} type="submit" disabled={busy}>{busy ? 'Saving...' : dialog.kind === 'edit' ? 'Save Hall' : 'Create Hall'}</button></div>
      </form>}
      {(dialog.kind === 'move' || dialog.kind === 'seat') && hall && <>
        <dl className="text-sm space-y-1 mb-4"><div><dt className="inline text-slate-500">Candidate: </dt><dd className="inline font-semibold">{dialog.candidate.fullName}</dd></div><div><dt className="inline text-slate-500">Current Hall: </dt><dd className="inline">{hall.name}</dd></div><div><dt className="inline text-slate-500">Current Seat: </dt><dd className="inline">{dialog.candidate.seatNo || 'Unassigned'}</dd></div></dl>
        {dialog.kind === 'move' ? <label className="text-xs font-semibold">Target Hall<select className={field + ' mt-1'} value={targetId} disabled={busy} onChange={e => setTargetId(e.target.value)}><option value="">Select target Hall</option>{halls.filter(h => h.id !== hall.id).map(item => <option key={item.id} value={item.id} disabled={!remaining(item)}>{item.name} · {item.roomNumber} · {item.centerName || 'No center'} · {remaining(item) ?? 'Unknown'} available</option>)}</select></label> :
          <label className="text-xs font-semibold">New Seat<input className={field + ' mt-1'} value={newSeat} maxLength={100} disabled={busy} onChange={e => setNewSeat(e.target.value)}/></label>}
        {footer(dialog.kind === 'move' ? 'Move Candidate' : 'Save Seat', () => mutate(async () => { await mockApi.updateStudentAllocation(dialog.candidate.id, dialog.kind === 'move' ? { assignedHallId: targetId } : { seatNo: newSeat.trim() }); return dialog.kind === 'move' ? 'Candidate moved.' : 'Seat updated.'; }), dialog.kind === 'move' ? !targetId : !newSeat.trim())}
      </>}
      {dialog.kind === 'unassign' && <><p className="text-sm font-semibold">{dialog.candidate.fullName}</p><p className="text-sm text-slate-500 mt-2">This removes the current Hall, room, and seat allocation.</p>{footer('Unassign Candidate', () => mutate(async () => { await mockApi.unassignStudentFromHall(dialog.candidate.id); return 'Candidate unassigned.'; }), false, true)}</>}
      {dialog.kind === 'delete' && <><p className="text-sm font-semibold">{dialog.hall.name} · {dialog.hall.roomNumber}</p><p className="text-sm text-slate-500 mt-2">Only empty Halls may be deleted. Assigned candidates must be reassigned or unassigned first.</p>{footer('Delete Hall', () => mutate(async () => { await mockApi.deleteExamHall(dialog.hall.id); return 'Hall deleted.'; }), false, true)}</>}
    </HallDialog>}
  </div>;
};
