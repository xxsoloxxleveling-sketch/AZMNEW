import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import {
  AlertCircle, ArrowRightLeft, ChevronLeft, ChevronRight, ClipboardCheck,
  Loader2, Lock, Pencil, Plus, RefreshCw, Search, ShieldCheck, Unlock, Users, X,
} from 'lucide-react';
import { useAuth } from '../../../lib/authContext';
import { canAssignCandidates, clampPage, formatEligibility, getInterviewLoadState } from './interviewViewModel';
import {
  AllocationPreview, AuditPage, CandidateFilters, CandidatePage, InterviewCandidate, InterviewHall,
  InterviewOverview, InterviewRound, ResultSession, interviewApi,
} from './interviewApi';

type HallDraft = {
  name: string;
  roomNumber: string;
  venue: string;
  interviewDate: string;
  reportingTime: string;
  scheduleStartAt: string;
  scheduleEndAt: string;
  capacity: string;
  allowedClasses: string;
  description: string;
  status: 'ACTIVE' | 'INACTIVE';
};

const blankHall = (): HallDraft => ({
  name: '', roomNumber: '', venue: '', interviewDate: '', reportingTime: '',
  scheduleStartAt: '', scheduleEndAt: '', capacity: '40', allowedClasses: '',
  description: '', status: 'ACTIVE',
});

const buttonBase = 'inline-flex items-center justify-center gap-1.5 min-h-9 rounded-md border px-3 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[#185b9d]/30 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50';
const buttonPrimary = buttonBase + ' border-[#185b9d] bg-[#185b9d] text-white hover:bg-[#144d85]';
const buttonSecondary = buttonBase + ' border-slate-300 bg-white text-slate-700 hover:bg-slate-50';
const inputClass = 'h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 text-sm text-slate-900 outline-none focus:border-[#185b9d] focus:ring-2 focus:ring-[#185b9d]/15';
const labelClass = 'mb-1 block text-xs font-semibold text-slate-600';
const thClass = 'whitespace-nowrap border-b border-slate-200 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500';
const tdClass = 'border-b border-slate-100 px-3 py-2 align-middle text-sm text-slate-700';

function readableError(error: unknown): string {
  return error instanceof Error ? error.message : 'The request could not be completed. Please retry.';
}

function isUnauthorized(error: unknown): boolean {
  return Number((error as { status?: number } | null)?.status) === 401 ||
    Number((error as { status?: number } | null)?.status) === 403;
}

function localDateTime(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function Stat({ label, value, suffix }: { label: string; value: string | number; suffix?: string }) {
  return (
    <div className="min-w-0 border-l-2 border-[#185b9d] pl-3">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums text-slate-900">
        {value}{suffix ? <span className="ml-1 text-sm font-normal text-slate-500">{suffix}</span> : null}
      </div>
    </div>
  );
}

function StateNotice({ kind, children }: { kind: 'error' | 'info' | 'success'; children: ReactNode }) {
  const styles = kind === 'error'
    ? 'border-red-200 bg-red-50 text-red-800'
    : kind === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : 'border-blue-200 bg-blue-50 text-blue-900';
  return <div role={kind === 'error' ? 'alert' : 'status'} className={'flex gap-2 border px-3 py-2.5 text-sm ' + styles}>{children}</div>;
}

function auditLabel(action: string): string {
  return action.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, character => character.toUpperCase());
}

export function InterviewManagementView() {
  const { role } = useAuth();
  const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';
  const isSuperAdmin = role === 'SUPER_ADMIN';
  const [rounds, setRounds] = useState<InterviewRound[]>([]);
  const [sessions, setSessions] = useState<ResultSession[]>([]);
  const [selectedRoundId, setSelectedRoundId] = useState('');
  const [overview, setOverview] = useState<InterviewOverview | null>(null);
  const [halls, setHalls] = useState<InterviewHall[]>([]);
  const [candidatePage, setCandidatePage] = useState<CandidatePage | null>(null);
  const [auditPage, setAuditPage] = useState<AuditPage | null>(null);
  const [tab, setTab] = useState<'overview' | 'candidates' | 'halls' | 'allocation' | 'audit'>('overview');
  const [pageLoading, setPageLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [unauthorized, setUnauthorized] = useState(false);
  const [pageError, setPageError] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [page, setPage] = useState(1);
  const [draftFilters, setDraftFilters] = useState<CandidateFilters>({
    search: '', className: '', gender: '', schoolName: '', hallId: '',
    minimumMarks: '', maximumMarks: '', assignment: 'all', eligibility: 'qualified',
  });
  const [filters, setFilters] = useState<CandidateFilters>({
    assignment: 'all', eligibility: 'qualified', limit: 25,
  });
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [manualHallId, setManualHallId] = useState('');
  const [manualLocked, setManualLocked] = useState(true);
  const [manualReason, setManualReason] = useState('');
  const [newRoundOpen, setNewRoundOpen] = useState(false);
  const [roundDraft, setRoundDraft] = useState({ sessionRef: '', title: '', eligibilityThreshold: '60' });
  const [hallEditorOpen, setHallEditorOpen] = useState(false);
  const [editingHallId, setEditingHallId] = useState('');
  const [hallDraft, setHallDraft] = useState<HallDraft>(blankHall);
  const [strategy, setStrategy] = useState<'BALANCED' | 'SEQUENTIAL'>('BALANCED');
  const [preview, setPreview] = useState<AllocationPreview | null>(null);
  const [allowPartial, setAllowPartial] = useState(false);
  const [auditPageNumber, setAuditPageNumber] = useState(1);
  const [moveTargets, setMoveTargets] = useState<Record<string, string>>({});

  const loadInitial = useCallback(async () => {
    setPageLoading(true);
    setPageError('');
    setUnauthorized(false);
    try {
      const [nextRounds, nextSessions] = await Promise.all([interviewApi.rounds(), interviewApi.sessions()]);
      setRounds(nextRounds);
      setSessions(nextSessions);
      setSelectedRoundId(current => current || nextRounds[0]?.id || '');
      setRoundDraft(current => ({
        ...current,
        sessionRef: current.sessionRef || nextSessions.find(session => session.isCurrent)?.id || nextSessions[0]?.id || '',
      }));
    } catch (error) {
      setPageError(readableError(error));
      setUnauthorized(isUnauthorized(error));
    } finally {
      setPageLoading(false);
    }
  }, []);

  useEffect(() => { void loadInitial(); }, [loadInitial]);

  useEffect(() => {
    if (!selectedRoundId) {
      setOverview(null);
      setHalls([]);
      setCandidatePage(null);
      return;
    }
    let current = true;
    const run = async () => {
      setDataLoading(true);
      setActionError('');
      try {
        const [nextOverview, nextHalls, nextCandidates] = await Promise.all([
          interviewApi.overview(selectedRoundId),
          interviewApi.halls(selectedRoundId),
          interviewApi.candidates(selectedRoundId, { ...filters, page, limit: 25 }),
        ]);
        if (!current) return;
        setOverview(nextOverview);
        setHalls(nextHalls);
        setCandidatePage(nextCandidates);
        const boundedPage = clampPage(page, nextCandidates.pagination.totalPages);
        if (boundedPage !== page) setPage(boundedPage);
        setUnauthorized(false);
        if (tab === 'audit') setAuditPage(await interviewApi.audit(selectedRoundId, auditPageNumber));
      } catch (error) {
        if (!current) return;
        setActionError(readableError(error));
        setUnauthorized(isUnauthorized(error));
      } finally {
        if (current) setDataLoading(false);
      }
    };
    void run();
    return () => { current = false; };
  }, [selectedRoundId, filters, page, tab, auditPageNumber, refreshKey]);

  const selectedRound = rounds.find(round => round.id === selectedRoundId) ?? null;
  const sourceVerified = overview?.eligibilitySourceStatus === 'VERIFIED';
  const roundOpen = selectedRound?.status === 'OPEN' || selectedRound?.status === 'SETUP';
  const canManageExisting = isAdmin && (roundOpen || (isSuperAdmin && selectedRound?.status === 'PUBLISHED'));
  const activeHalls = halls.filter(hall => hall.status === 'ACTIVE');
  const pageCount = candidatePage?.pagination.totalPages ?? 0;
  const pageState = getInterviewLoadState({
    loading: pageLoading,
    unauthorized,
    error: pageError || '',
    hasRounds: rounds.length > 0,
  });
  const tabItems = useMemo(() => [
    { id: 'overview' as const, label: 'Overview' },
    { id: 'candidates' as const, label: 'Candidates' },
    { id: 'halls' as const, label: 'Interview halls' },
    { id: 'allocation' as const, label: 'Allocation center' },
    { id: 'audit' as const, label: 'Audit history' },
  ], []);

  const refreshRound = useCallback(() => setRefreshKey(value => value + 1), []);

  async function saveRound(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!roundDraft.sessionRef || !roundDraft.title.trim()) return;
    setSaving(true);
    setActionError('');
    try {
      const created = await interviewApi.createRound({
        sessionRef: roundDraft.sessionRef,
        title: roundDraft.title.trim(),
        eligibilityThreshold: Number(roundDraft.eligibilityThreshold),
        maximumMarks: 100,
      });
      const next = await interviewApi.rounds();
      setRounds(next);
      setSelectedRoundId(created.id);
      setNewRoundOpen(false);
      setTab('overview');
      setNotice('Interview round created.');
    } catch (error) {
      setActionError(readableError(error));
      setUnauthorized(isUnauthorized(error));
    } finally {
      setSaving(false);
    }
  }

  function updateDraftFilter(name: keyof CandidateFilters, value: string) {
    setDraftFilters(current => ({ ...current, [name]: value }));
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSelectedStudents([]);
    const next: CandidateFilters = {
      search: draftFilters.search?.trim() || undefined,
      className: draftFilters.className?.trim() || undefined,
      gender: draftFilters.gender || undefined,
      schoolName: draftFilters.schoolName?.trim() || undefined,
      hallId: draftFilters.hallId || undefined,
      minimumMarks: draftFilters.minimumMarks || undefined,
      maximumMarks: draftFilters.maximumMarks || undefined,
      assignment: draftFilters.assignment || 'all',
      eligibility: draftFilters.eligibility || 'qualified',
      limit: 25,
    };
    setFilters(next);
  }

  function toggleStudent(studentId: string) {
    setSelectedStudents(current => current.includes(studentId)
      ? current.filter(id => id !== studentId)
      : [...current, studentId]);
  }

  function toggleVisibleStudents() {
    const eligibleRows = (candidatePage?.results ?? []).filter(candidate => candidate.resultVerificationStatus === 'QUALIFIED');
    const visibleIds = eligibleRows.map(candidate => candidate.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedStudents.includes(id));
    setSelectedStudents(current => allSelected
      ? current.filter(id => !visibleIds.includes(id))
      : Array.from(new Set([...current, ...visibleIds])));
  }

  async function perform(work: () => Promise<unknown>, successText: string) {
    setSaving(true);
    setActionError('');
    setNotice('');
    try {
      await work();
      setNotice(successText);
      setSelectedStudents([]);
      setPreview(null);
      refreshRound();
    } catch (error) {
      setActionError(readableError(error));
      setUnauthorized(isUnauthorized(error));
    } finally {
      setSaving(false);
    }
  }

  function confirmPublishedOverride(): boolean {
    if (selectedRound?.status !== 'PUBLISHED') return false;
    return isSuperAdmin && window.confirm('Use a Super Admin override on this published interview round? The action and reason will be audited.');
  }

  async function assignSelected() {
    if (!selectedRoundId || !manualHallId || selectedStudents.length === 0) return;
    await perform(() => interviewApi.assign(selectedRoundId, {
      hallId: manualHallId, studentIds: selectedStudents, isLocked: manualLocked,
      reason: manualReason.trim() || undefined,
    }), selectedStudents.length + ' student assignment(s) saved.');
  }

  async function changeLock(candidate: InterviewCandidate) {
    if (!candidate.assignmentId) return;
    const override = confirmPublishedOverride();
    if (selectedRound?.status === 'PUBLISHED' && !override) return;
    const reason = selectedRound?.status === 'PUBLISHED'
      ? window.prompt('Enter the Super Admin override reason (at least 3 characters):')
      : window.prompt(candidate.isLocked ? 'Reason for unlocking this assignment:' : 'Optional reason for locking this assignment:');
    if (reason === null) return;
    if (candidate.isLocked && reason.trim().length < 3) {
      setActionError('Enter a reason of at least 3 characters to unlock an assignment.');
      return;
    }
    await perform(
      () => candidate.isLocked
        ? interviewApi.unlock(candidate.assignmentId as string, reason.trim(), override)
        : interviewApi.lock(candidate.assignmentId as string, reason.trim() || undefined, override),
      candidate.isLocked ? 'Assignment unlocked.' : 'Assignment locked.',
    );
  }

  async function moveCandidate(candidate: InterviewCandidate) {
    if (!candidate.assignmentId || candidate.isLocked) return;
    const hallId = moveTargets[candidate.id];
    if (!hallId || hallId === candidate.interviewHall?.id) return;
    const override = confirmPublishedOverride();
    if (selectedRound?.status === 'PUBLISHED' && !override) return;
    const reason = selectedRound?.status === 'PUBLISHED'
      ? window.prompt('Enter the Super Admin override reason (at least 3 characters):')
      : undefined;
    if (selectedRound?.status === 'PUBLISHED' && (!reason || reason.trim().length < 3)) return;
    await perform(() => interviewApi.move(candidate.assignmentId as string, { hallId, reason: reason?.trim(), override }),
      'Assignment moved to the selected hall.');
  }

  async function removeCandidate(candidate: InterviewCandidate) {
    if (!candidate.assignmentId || candidate.isLocked) return;
    const override = confirmPublishedOverride();
    if (selectedRound?.status === 'PUBLISHED' && !override) return;
    const reason = window.prompt('Reason for removing this interview assignment (at least 3 characters):');
    if (!reason || reason.trim().length < 3) return;
    await perform(() => interviewApi.remove(candidate.assignmentId as string, reason.trim(), override), 'Assignment removed.');
  }

  function editHall(hall: InterviewHall) {
    setEditingHallId(hall.id);
    setHallDraft({
      name: hall.name,
      roomNumber: hall.roomNumber,
      venue: hall.venue ?? '',
      interviewDate: hall.interviewDate ? new Date(hall.interviewDate).toISOString().slice(0, 10) : '',
      reportingTime: hall.reportingTime ?? '',
      scheduleStartAt: localDateTime(hall.scheduleStartAt),
      scheduleEndAt: localDateTime(hall.scheduleEndAt),
      capacity: String(hall.capacity),
      allowedClasses: hall.allowedClasses.join(', '),
      description: hall.description ?? '',
      status: hall.status,
    });
    setHallEditorOpen(true);
  }

  function hallBody() {
    const start = hallDraft.scheduleStartAt ? new Date(hallDraft.scheduleStartAt).toISOString() : null;
    const end = hallDraft.scheduleEndAt ? new Date(hallDraft.scheduleEndAt).toISOString() : null;
    return {
      name: hallDraft.name.trim(),
      roomNumber: hallDraft.roomNumber.trim(),
      venue: hallDraft.venue.trim() || null,
      interviewDate: hallDraft.interviewDate || null,
      reportingTime: hallDraft.reportingTime.trim() || null,
      scheduleStartAt: start,
      scheduleEndAt: end,
      capacity: Number(hallDraft.capacity),
      allowedClasses: hallDraft.allowedClasses.split(',').map(value => value.trim()).filter(Boolean),
      description: hallDraft.description.trim() || null,
      status: hallDraft.status,
    };
  }

  async function saveHall(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedRoundId) return;
    setSaving(true);
    setActionError('');
    try {
      if (editingHallId) await interviewApi.updateHall(editingHallId, hallBody());
      else await interviewApi.createHall(selectedRoundId, hallBody());
      setHallEditorOpen(false);
      setEditingHallId('');
      setHallDraft(blankHall());
      setNotice(editingHallId ? 'Interview hall updated.' : 'Interview hall created.');
      refreshRound();
    } catch (error) {
      setActionError(readableError(error));
      setUnauthorized(isUnauthorized(error));
    } finally {
      setSaving(false);
    }
  }

  async function toggleHallStatus(hall: InterviewHall) {
    const nextStatus = hall.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    if (nextStatus === 'INACTIVE' && hall.assignedCount > 0 &&
        !window.confirm('This hall has assigned students. Deactivating it will preserve those assignments. Continue?')) return;
    await perform(() => interviewApi.updateHall(hall.id, { status: nextStatus }),
      nextStatus === 'ACTIVE' ? 'Interview hall activated.' : 'Interview hall deactivated.');
  }

  async function loadPreview() {
    if (!selectedRoundId) return;
    setSaving(true);
    setActionError('');
    setNotice('');
    try {
      setPreview(await interviewApi.preview(selectedRoundId, strategy));
      setAllowPartial(false);
    } catch (error) {
      setActionError(readableError(error));
      setUnauthorized(isUnauthorized(error));
    } finally {
      setSaving(false);
    }
  }

  async function commitPreview() {
    if (!preview || !selectedRoundId) return;
    if (preview.unallocatedStudentIds.length > 0 && !allowPartial) return;
    if (!window.confirm('Save this allocation preview to the interview round? This action will be recorded in the audit history.')) return;
    await perform(() => interviewApi.commit(selectedRoundId, {
      strategy: preview.strategy,
      expectedRevision: preview.revision,
      planHash: preview.planHash,
      idempotencyKey: crypto.randomUUID(),
      allowPartial,
    }), 'Automatic allocation committed.');
  }

  async function publishRound() {
    if (!selectedRoundId || !overview || overview.pendingVerificationCandidates > 0) return;
    if (!window.confirm('Publish this interview round and lock its current assignments?')) return;
    await perform(() => interviewApi.publish(selectedRoundId), 'Interview allocations published.');
    const next = await interviewApi.rounds().catch(() => rounds);
    setRounds(next);
  }

  async function finalizeRound() {
    if (!selectedRoundId || !isSuperAdmin) return;
    const reason = window.prompt('Reason for finalizing this interview round (at least 3 characters):');
    if (!reason || reason.trim().length < 3) return;
    if (!window.confirm('Finalize this round? This cannot be reversed.')) return;
    await perform(() => interviewApi.finalize(selectedRoundId, reason.trim()), 'Interview round finalized.');
    const next = await interviewApi.rounds().catch(() => rounds);
    setRounds(next);
  }

  const currentCandidates = candidatePage?.results ?? [];

  if (pageState === 'loading') {
    return <div className="flex min-h-56 items-center justify-center gap-2 text-sm text-slate-500" role="status"><Loader2 className="animate-spin" size={18} /> Loading interview management…</div>;
  }
  if (pageState === 'unauthorized' || unauthorized) {
    return <div className="mx-auto max-w-3xl p-6"><StateNotice kind="error"><ShieldCheck size={18} /> You do not have permission to access interview management. Sign in with an Admin or Super Admin account.</StateNotice></div>;
  }
  if (pageState === 'error') {
    return <div className="mx-auto max-w-3xl space-y-3 p-6"><StateNotice kind="error"><AlertCircle size={18} /> {pageError}</StateNotice><button className={buttonSecondary} onClick={() => void loadInitial()}><RefreshCw size={15} /> Retry</button></div>;
  }

  return (
    <main className="space-y-4 pb-8">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">


        </div>
        <div className="flex flex-wrap items-center gap-2">
          {rounds.length > 0 && (
            <label className="flex min-w-56 items-center gap-2 text-sm">
              <span className="sr-only">Select interview round</span>
              <select className={inputClass} value={selectedRoundId} onChange={event => {
                setSelectedRoundId(event.target.value);
                setPage(1);
                setPreview(null);
                setSelectedStudents([]);
              }}>
                {rounds.map(round => <option key={round.id} value={round.id}>{round.title} · {round.status}</option>)}
              </select>
            </label>
          )}
          <button className={buttonSecondary} onClick={() => void loadInitial()} disabled={saving || pageLoading}><RefreshCw size={15} /> Refresh</button>
          <button className={buttonPrimary} onClick={() => setNewRoundOpen(value => !value)}><Plus size={15} /> New round</button>
        </div>
      </div>

      {actionError && <StateNotice kind="error"><AlertCircle size={18} /> {actionError}</StateNotice>}
      {notice && <StateNotice kind="success"><ShieldCheck size={18} /> {notice}</StateNotice>}

      {newRoundOpen && (
        <section className="border border-slate-200 bg-white p-4" aria-labelledby="new-round-heading">
          <div className="mb-3 flex items-center justify-between">
            <h3 id="new-round-heading" className="text-sm font-semibold text-slate-900">Create interview round</h3>
            <button type="button" onClick={() => setNewRoundOpen(false)} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Close round form"><X size={17} /></button>
          </div>
          <form onSubmit={saveRound} className="grid gap-3 md:grid-cols-4">
            <label><span className={labelClass}>Examination session</span><select required className={inputClass} value={roundDraft.sessionRef} onChange={event => setRoundDraft(current => ({ ...current, sessionRef: event.target.value }))}><option value="">Choose a session</option>{sessions.map(session => <option key={session.id} value={session.id}>{session.businessDate} · {session.testCenterName} · {session.rosterCount} on roster</option>)}</select></label>
            <label className="md:col-span-2"><span className={labelClass}>Round title</span><input required maxLength={160} className={inputClass} value={roundDraft.title} onChange={event => setRoundDraft(current => ({ ...current, title: event.target.value }))} placeholder="Session V 2026 interviews" /></label>
            <label><span className={labelClass}>Minimum marks out of 100</span><input required type="number" min="0" max="100" className={inputClass} value={roundDraft.eligibilityThreshold} onChange={event => setRoundDraft(current => ({ ...current, eligibilityThreshold: event.target.value }))} /></label>
            <div className="flex items-center gap-2 md:col-span-4"><button type="submit" className={buttonPrimary} disabled={saving || sessions.length === 0}><Plus size={15} /> Create round</button><span className="text-xs text-slate-500">Eligibility remains pending until a verified final result source is available.</span></div>
          </form>
        </section>
      )}

      {!selectedRound && rounds.length === 0 && (
        <section className="border border-slate-200 bg-white p-5">
          <div className="flex items-start gap-3">
            <ClipboardCheck className="mt-0.5 text-[#185b9d]" size={20} />
            <div>
              <h3 className="text-sm font-semibold text-slate-900">No interview rounds yet</h3>
              <p className="mt-1 text-sm text-slate-600">Create a round from an existing examination session to begin setting up interview halls.</p>
              {sessions.length === 0 && <p className="mt-2 text-sm text-amber-800">No examination sessions are available from Results. Create a result session first.</p>}
              {!newRoundOpen && <button className={buttonPrimary + ' mt-3'} onClick={() => setNewRoundOpen(true)} disabled={sessions.length === 0}><Plus size={15} /> Create first round</button>}
            </div>
          </div>
        </section>
      )}

      {selectedRound && overview && (
        <>
          {overview.eligibilitySourceStatus !== 'VERIFIED' && (
            <StateNotice kind="info">
              <AlertCircle size={18} />
              <span><strong>Eligibility source unavailable.</strong> The existing Results API exposes legacy scores as unverified. Candidate qualification, manual assignment, auto-allocation and publication stay blocked until a verified final result on a 100-mark scale is available.</span>
            </StateNotice>
          )}

          <nav aria-label="Interview management sections" className="flex gap-1 overflow-x-auto border-b border-slate-200">
            {tabItems.map(item => <button key={item.id} type="button" className={'whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ' + (tab === item.id ? 'border-[#185b9d] text-[#185b9d]' : 'border-transparent text-slate-600 hover:text-slate-900')} onClick={() => setTab(item.id)}>{item.label}</button>)}
          </nav>

          {tab === 'overview' && (
            <section className="space-y-4">
              <div className="grid grid-cols-2 gap-x-6 gap-y-4 border-b border-slate-200 py-2 sm:grid-cols-4 xl:grid-cols-8">
                <Stat label="Qualified candidates" value={overview.totalQualifiedCandidates} />
                <Stat label="Allocated" value={overview.allocatedCandidates} />
                <Stat label="Unassigned" value={overview.unassignedCandidates} />
                <Stat label="Locked" value={overview.lockedCandidates} />
                <Stat label="Active halls" value={overview.activeHallCount} />
                <Stat label="Total capacity" value={overview.totalCapacity} />
                <Stat label="Remaining seats" value={overview.remainingSeats} />
                <Stat label="Allocation complete" value={overview.completionPercent} suffix="%" />
              </div>
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                <section className="border border-slate-200 bg-white">
                  <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                    <div><h3 className="text-sm font-semibold text-slate-900">Interview halls</h3><p className="mt-0.5 text-xs text-slate-500">Capacity and current assignments for this round.</p></div>
                    <button type="button" className={buttonSecondary} onClick={() => { setTab('halls'); setHallEditorOpen(true); setEditingHallId(''); setHallDraft(blankHall()); }}><Plus size={15} /> Add hall</button>
                  </div>
                  {halls.length === 0 ? <p className="px-4 py-5 text-sm text-slate-500">No halls created for this round.</p> : (
                    <div className="overflow-x-auto"><table className="w-full min-w-[560px]"><thead><tr><th className={thClass}>Hall</th><th className={thClass}>Date / reporting</th><th className={thClass}>Assigned</th><th className={thClass}>Available</th><th className={thClass}>Status</th></tr></thead><tbody>
                      {halls.slice(0, 6).map(hall => <tr key={hall.id}><td className={tdClass}><div className="font-medium text-slate-900">{hall.name}</div><div className="text-xs text-slate-500">Room {hall.roomNumber}{hall.venue ? ' · ' + hall.venue : ''}</div></td><td className={tdClass}>{hall.interviewDate ? new Date(hall.interviewDate).toLocaleDateString() : 'Not scheduled'}<div className="text-xs text-slate-500">{hall.reportingTime || '—'}</div></td><td className={tdClass}>{hall.assignedCount} / {hall.capacity}</td><td className={tdClass}>{hall.availableCapacity}</td><td className={tdClass}>{hall.status === 'ACTIVE' ? 'Active' : 'Inactive'}</td></tr>)}
                    </tbody></table></div>
                  )}
                </section>
                <section className="border border-slate-200 bg-white p-4">
                  <h3 className="text-sm font-semibold text-slate-900">Round status</h3>
                  <dl className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between gap-3"><dt className="text-slate-500">Status</dt><dd className="font-medium text-slate-800">{selectedRound.status}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-slate-500">Minimum eligibility</dt><dd className="font-medium text-slate-800">{selectedRound.eligibilityThreshold} / {selectedRound.maximumMarks}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-slate-500">Pending verification</dt><dd className="font-medium text-amber-800">{overview.pendingVerificationCandidates}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-slate-500">Revision</dt><dd className="font-medium text-slate-800">{selectedRound.revision}</dd></div>
                  </dl>
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                    {selectedRound.status === 'OPEN' && <button className={buttonSecondary} onClick={() => void publishRound()} disabled={!sourceVerified || overview.pendingVerificationCandidates > 0 || overview.unassignedCandidates > 0 || saving}>Publish and lock</button>}
                    {selectedRound.status === 'PUBLISHED' && isSuperAdmin && <button className={buttonSecondary} onClick={() => void finalizeRound()} disabled={saving}>Finalize round</button>}
                    {selectedRound.status === 'FINALIZED' && <span className="text-xs text-slate-500">This round is finalized and read-only.</span>}
                  </div>
                </section>
              </div>
            </section>
          )}

          {tab === 'candidates' && (
            <section className="space-y-3">
              <form onSubmit={applyFilters} className="grid gap-2 border border-slate-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
                <label className="xl:col-span-2"><span className={labelClass}>Search name, application or roll no.</span><div className="relative"><Search className="absolute left-2.5 top-2.5 text-slate-400" size={15} /><input className={inputClass + ' pl-8'} value={draftFilters.search ?? ''} onChange={event => updateDraftFilter('search', event.target.value)} /></div></label>
                <label><span className={labelClass}>Eligibility</span><select className={inputClass} value={draftFilters.eligibility} onChange={event => updateDraftFilter('eligibility', event.target.value)}><option value="qualified">Eligible (verified)</option><option value="pending">Pending verification</option><option value="excluded">Withheld / excluded</option><option value="all">All statuses</option></select></label>
                <label><span className={labelClass}>Class</span><input className={inputClass} value={draftFilters.className ?? ''} onChange={event => updateDraftFilter('className', event.target.value)} /></label>
                <label><span className={labelClass}>Gender</span><select className={inputClass} value={draftFilters.gender ?? ''} onChange={event => updateDraftFilter('gender', event.target.value)}><option value="">All</option><option value="MALE">Male</option><option value="FEMALE">Female</option></select></label>
                <label><span className={labelClass}>School</span><input className={inputClass} value={draftFilters.schoolName ?? ''} onChange={event => updateDraftFilter('schoolName', event.target.value)} /></label>
                <label><span className={labelClass}>Hall</span><select className={inputClass} value={draftFilters.hallId ?? ''} onChange={event => updateDraftFilter('hallId', event.target.value)}><option value="">All halls</option>{halls.map(hall => <option key={hall.id} value={hall.id}>{hall.name} · {hall.roomNumber}</option>)}</select></label>
                <label><span className={labelClass}>Assignment</span><select className={inputClass} value={draftFilters.assignment} onChange={event => updateDraftFilter('assignment', event.target.value)}><option value="all">All</option><option value="assigned">Assigned</option><option value="unassigned">Unassigned</option></select></label>
                <div className="flex items-end gap-2 xl:col-span-2"><label className="min-w-0 flex-1"><span className={labelClass}>Marks from</span><input type="number" min="0" max="100" className={inputClass} value={draftFilters.minimumMarks ?? ''} onChange={event => updateDraftFilter('minimumMarks', event.target.value)} /></label><label className="min-w-0 flex-1"><span className={labelClass}>Marks to</span><input type="number" min="0" max="100" className={inputClass} value={draftFilters.maximumMarks ?? ''} onChange={event => updateDraftFilter('maximumMarks', event.target.value)} /></label><button type="submit" className={buttonPrimary}><Search size={15} /> Apply</button></div>
              </form>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm text-slate-600">{candidatePage?.pagination.total ?? 0} record(s) · page {candidatePage?.pagination.page ?? 1} of {Math.max(1, pageCount)}</div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={manualLocked} onChange={event => setManualLocked(event.target.checked)} /> Lock manual assignments</label>
                  <select className={inputClass + ' w-auto min-w-40'} value={manualHallId} onChange={event => setManualHallId(event.target.value)} aria-label="Hall for selected students"><option value="">Choose hall</option>{activeHalls.map(hall => <option key={hall.id} value={hall.id} disabled={hall.availableCapacity < 1}>{hall.name} · {hall.availableCapacity} seats</option>)}</select>
                  <button className={buttonPrimary} onClick={() => void assignSelected()} disabled={!canAssignCandidates({ isAdmin, sourceVerified, roundOpen: !!roundOpen, hallActive: activeHalls.some(hall => hall.id === manualHallId && hall.availableCapacity > 0), seatsAvailable: activeHalls.find(hall => hall.id === manualHallId)?.availableCapacity ?? 0 }) || selectedStudents.length === 0 || selectedStudents.length > (activeHalls.find(hall => hall.id === manualHallId)?.availableCapacity ?? 0) || saving}>Assign selected ({selectedStudents.length})</button>
                </div>
              </div>
              {!sourceVerified && <p className="text-xs text-slate-600">Unverified and legacy scores are not eligible for selection. The qualified list remains empty until approved final results are connected.</p>}
              <div className="overflow-x-auto border border-slate-200 bg-white">
                <table className="w-full min-w-[1000px]">
                  <thead><tr><th className={thClass}><input aria-label="Select visible eligible students" type="checkbox" checked={currentCandidates.filter(candidate => candidate.resultVerificationStatus === 'QUALIFIED').length > 0 && currentCandidates.filter(candidate => candidate.resultVerificationStatus === 'QUALIFIED').every(candidate => selectedStudents.includes(candidate.id))} onChange={toggleVisibleStudents} /></th><th className={thClass}>Student</th><th className={thClass}>Class / group</th><th className={thClass}>School</th><th className={thClass}>Gender</th><th className={thClass}>Final marks</th><th className={thClass}>Verification</th><th className={thClass}>Interview hall</th><th className={thClass}>Assignment</th><th className={thClass}>Actions</th></tr></thead>
                  <tbody>
                    {currentCandidates.map(candidate => {
                      const verifiedAssignment = canAssignCandidates({ isAdmin, sourceVerified, roundOpen: !!roundOpen, hallActive: true, seatsAvailable: 1 });
                      const moveHalls = activeHalls.filter(hall => hall.id !== candidate.interviewHall?.id && hall.availableCapacity > 0);
                      return <tr key={candidate.id} className="hover:bg-slate-50/70">
                        <td className={tdClass}><input type="checkbox" aria-label={'Select ' + candidate.studentName} checked={selectedStudents.includes(candidate.id)} disabled={candidate.resultVerificationStatus !== 'QUALIFIED' || !verifiedAssignment} onChange={() => toggleStudent(candidate.id)} /></td>
                        <td className={tdClass}><div className="font-medium text-slate-900">{candidate.studentName}</div><div className="text-xs text-slate-500">{candidate.applicationNo}{candidate.rollNumber ? ' · ' + candidate.rollNumber : ''}</div></td>
                        <td className={tdClass}>{candidate.className}{candidate.groupName ? <div className="text-xs text-slate-500">{candidate.groupName}</div> : null}</td>
                        <td className={tdClass}>{candidate.schoolName || '—'}</td>
                        <td className={tdClass}>{candidate.gender || '—'}</td>
                        <td className={tdClass}>{candidate.finalApprovedMarks === null ? '—' : candidate.finalApprovedMarks + ' / 100'}</td>
                        <td className={tdClass}><span className={candidate.resultVerificationStatus === 'QUALIFIED' ? 'font-medium text-emerald-700' : candidate.resultVerificationStatus === 'EXCLUDED_PENDING_REVIEW' ? 'font-medium text-red-700' : 'text-amber-800'}>{formatEligibility(candidate.resultVerificationStatus)}</span></td>
                        <td className={tdClass}>{candidate.interviewHall ? candidate.interviewHall.name + ' · ' + candidate.interviewHall.roomNumber : '—'}</td>
                        <td className={tdClass}>{candidate.assignmentId ? <span className="flex items-center gap-1.5">{candidate.isLocked ? <Lock size={14} aria-label="Locked" className="text-[#185b9d]" /> : null}{candidate.isLocked ? 'Locked' : 'Unlocked'}</span> : 'Unassigned'}</td>
                        <td className={tdClass}>
                          <div className="flex items-center gap-1.5">
                            {candidate.assignmentId && canManageExisting && <button type="button" className="rounded border border-slate-300 p-1.5 text-slate-700 hover:bg-slate-100" onClick={() => void changeLock(candidate)} aria-label={candidate.isLocked ? 'Unlock assignment' : 'Lock assignment'} title={candidate.isLocked ? 'Unlock assignment' : 'Lock assignment'}>{candidate.isLocked ? <Unlock size={14} /> : <Lock size={14} />}</button>}
                            {candidate.assignmentId && !candidate.isLocked && canManageExisting && (
                              <>
                                <select className="h-8 max-w-36 rounded border border-slate-300 bg-white px-1.5 text-xs" aria-label={'Move ' + candidate.studentName + ' to hall'} value={moveTargets[candidate.id] ?? ''} onChange={event => setMoveTargets(current => ({ ...current, [candidate.id]: event.target.value }))}><option value="">Move to…</option>{moveHalls.map(hall => <option key={hall.id} value={hall.id}>{hall.name}</option>)}</select>
                                <button type="button" className="rounded border border-slate-300 p-1.5 text-slate-700 hover:bg-slate-100 disabled:opacity-50" disabled={!moveTargets[candidate.id] || saving} onClick={() => void moveCandidate(candidate)} aria-label="Move assignment" title="Move assignment"><ArrowRightLeft size={14} /></button>
                                <button type="button" className="rounded border border-red-200 p-1.5 text-red-700 hover:bg-red-50" onClick={() => void removeCandidate(candidate)} aria-label="Unassign student" title="Unassign student"><X size={14} /></button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>;
                    })}
                    {currentCandidates.length === 0 && <tr><td colSpan={10} className="px-4 py-10 text-center text-sm text-slate-500">{filters.eligibility === 'qualified' && !sourceVerified ? 'No verified eligible candidates are available from the current Results source.' : 'No students match these filters.'}</td></tr>}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Showing at most 25 students per page.</span>
                <div className="flex gap-2"><button className={buttonSecondary} onClick={() => setPage(value => Math.max(1, value - 1))} disabled={page <= 1 || dataLoading}><ChevronLeft size={15} /> Previous</button><button className={buttonSecondary} onClick={() => setPage(value => value + 1)} disabled={page >= pageCount || dataLoading}>Next <ChevronRight size={15} /></button></div>
              </div>
              <label className="block max-w-xl"><span className={labelClass}>Optional assignment note</span><input className={inputClass} value={manualReason} onChange={event => setManualReason(event.target.value)} maxLength={500} placeholder="Reason or scheduling note" /></label>
            </section>
          )}

          {tab === 'halls' && (
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div><h3 className="text-sm font-semibold text-slate-900">Interview halls</h3><p className="mt-0.5 text-xs text-slate-500">Occupied halls are retained when deactivated. Capacity cannot be reduced below assigned students.</p></div>
                {roundOpen && <button type="button" className={buttonPrimary} onClick={() => { setHallDraft(blankHall()); setEditingHallId(''); setHallEditorOpen(value => !value); }}><Plus size={15} /> Create hall</button>}
              </div>
              {hallEditorOpen && roundOpen && (
                <form onSubmit={saveHall} className="grid gap-3 border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="flex items-center justify-between sm:col-span-2 lg:col-span-4"><h4 className="text-sm font-semibold text-slate-900">{editingHallId ? 'Edit hall' : 'Create interview hall'}</h4><button type="button" className="rounded p-1 text-slate-500 hover:bg-slate-100" onClick={() => setHallEditorOpen(false)} aria-label="Close hall form"><X size={17} /></button></div>
                  <label><span className={labelClass}>Hall name *</span><input required maxLength={120} className={inputClass} value={hallDraft.name} onChange={event => setHallDraft(current => ({ ...current, name: event.target.value }))} /></label>
                  <label><span className={labelClass}>Room number *</span><input required maxLength={80} className={inputClass} value={hallDraft.roomNumber} onChange={event => setHallDraft(current => ({ ...current, roomNumber: event.target.value }))} /></label>
                  <label><span className={labelClass}>Venue / center</span><input maxLength={200} className={inputClass} value={hallDraft.venue} onChange={event => setHallDraft(current => ({ ...current, venue: event.target.value }))} /></label>
                  <label><span className={labelClass}>Maximum student capacity *</span><input required type="number" min="1" step="1" className={inputClass} value={hallDraft.capacity} onChange={event => setHallDraft(current => ({ ...current, capacity: event.target.value }))} /></label>
                  <label><span className={labelClass}>Interview date</span><input type="date" className={inputClass} value={hallDraft.interviewDate} onChange={event => setHallDraft(current => ({ ...current, interviewDate: event.target.value }))} /></label>
                  <label><span className={labelClass}>Reporting time</span><input className={inputClass} maxLength={80} placeholder="09:00 AM" value={hallDraft.reportingTime} onChange={event => setHallDraft(current => ({ ...current, reportingTime: event.target.value }))} /></label>
                  <label><span className={labelClass}>Interview start</span><input type="datetime-local" className={inputClass} value={hallDraft.scheduleStartAt} onChange={event => setHallDraft(current => ({ ...current, scheduleStartAt: event.target.value }))} /></label>
                  <label><span className={labelClass}>Interview end</span><input type="datetime-local" className={inputClass} value={hallDraft.scheduleEndAt} onChange={event => setHallDraft(current => ({ ...current, scheduleEndAt: event.target.value }))} /></label>
                  <label><span className={labelClass}>Allowed classes / groups</span><input className={inputClass} placeholder="Class 9, Pre-Engineering" value={hallDraft.allowedClasses} onChange={event => setHallDraft(current => ({ ...current, allowedClasses: event.target.value }))} /><span className="mt-1 block text-[11px] text-slate-500">Separate multiple values with commas.</span></label>
                  <label><span className={labelClass}>Hall status</span><select className={inputClass} value={hallDraft.status} onChange={event => setHallDraft(current => ({ ...current, status: event.target.value as HallDraft['status'] }))}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></label>
                  <label className="sm:col-span-2 lg:col-span-2"><span className={labelClass}>Description</span><input maxLength={1000} className={inputClass} value={hallDraft.description} onChange={event => setHallDraft(current => ({ ...current, description: event.target.value }))} /></label>
                  <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4"><button type="submit" className={buttonPrimary} disabled={saving}>{editingHallId ? 'Save hall' : 'Create hall'}</button><button type="button" className={buttonSecondary} onClick={() => { setHallEditorOpen(false); setEditingHallId(''); }}>Cancel</button></div>
                </form>
              )}
              <div className="overflow-x-auto border border-slate-200 bg-white">
                <table className="w-full min-w-[900px]"><thead><tr><th className={thClass}>Hall</th><th className={thClass}>Date / schedule</th><th className={thClass}>Reporting</th><th className={thClass}>Capacity</th><th className={thClass}>Assigned</th><th className={thClass}>Available</th><th className={thClass}>Allowed classes</th><th className={thClass}>Status</th><th className={thClass}>Actions</th></tr></thead>
                  <tbody>{halls.map(hall => <tr key={hall.id}>
                    <td className={tdClass}><span className="font-medium text-slate-900">{hall.name}</span><div className="text-xs text-slate-500">Room {hall.roomNumber}{hall.venue ? ' · ' + hall.venue : ''}</div></td>
                    <td className={tdClass}>{hall.interviewDate ? new Date(hall.interviewDate).toLocaleDateString() : 'Not set'}{hall.scheduleStartAt && hall.scheduleEndAt ? <div className="text-xs text-slate-500">{new Date(hall.scheduleStartAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}–{new Date(hall.scheduleEndAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div> : null}</td>
                    <td className={tdClass}>{hall.reportingTime || '—'}</td><td className={tdClass}>{hall.capacity}</td><td className={tdClass}>{hall.assignedCount}</td><td className={tdClass}>{hall.availableCapacity}</td>
                    <td className={tdClass}>{hall.allowedClasses.length ? hall.allowedClasses.join(', ') : 'All classes'}</td><td className={tdClass}>{hall.status === 'ACTIVE' ? 'Active' : 'Inactive'}</td>
                    <td className={tdClass}><div className="flex items-center gap-2"><button type="button" className="rounded border border-slate-300 p-1.5 text-slate-700 hover:bg-slate-100" aria-label={'Edit ' + hall.name} title="Edit hall" onClick={() => editHall(hall)} disabled={!roundOpen}><Pencil size={14} /></button><button type="button" className={buttonSecondary + ' min-h-8 px-2 text-xs'} onClick={() => void toggleHallStatus(hall)} disabled={!roundOpen}>{hall.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}</button></div></td>
                  </tr>)}
                  {halls.length === 0 && <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-slate-500">No interview halls for this round. Create a hall to define available capacity.</td></tr>}</tbody>
                </table>
              </div>
            </section>
          )}

          {tab === 'allocation' && (
            <section className="space-y-4">
              <div className="border border-slate-200 bg-white p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div><h3 className="text-sm font-semibold text-slate-900">Automatic allocation</h3><p className="mt-1 max-w-3xl text-sm text-slate-600">Preview a deterministic allocation before saving. Existing locked assignments remain fixed; active hall restrictions and remaining capacity are checked on the server.</p></div>
                  <div className="flex items-center gap-2"><label><span className={labelClass}>Strategy</span><select className={inputClass} value={strategy} onChange={event => { setStrategy(event.target.value as typeof strategy); setPreview(null); }}><option value="BALANCED">Balanced</option><option value="SEQUENTIAL">Sequential</option></select></label><button className={buttonPrimary} onClick={() => void loadPreview()} disabled={saving || !roundOpen || !sourceVerified}><Users size={15} /> Preview allocation</button></div>
                </div>
                {!sourceVerified && <p className="mt-3 text-sm text-amber-800">Preview is disabled because no verified final-result source is available.</p>}
              </div>
              {preview && (
                <div className="space-y-3 border border-slate-200 bg-white p-4">
                  <div><h4 className="text-sm font-semibold text-slate-900">Allocation preview · {preview.strategy.toLowerCase()}</h4><p className="mt-1 text-xs text-slate-500">This preview is tied to round revision {preview.revision}. Any intervening change will make it stale.</p></div>
                  <div className="grid grid-cols-2 gap-4 border-y border-slate-100 py-3 sm:grid-cols-4">
                    <Stat label="Qualified" value={preview.totalQualifiedCandidates} /><Stat label="Already assigned" value={preview.alreadyAssignedCandidates} /><Stat label="Locked" value={preview.lockedCandidates} /><Stat label="To allocate" value={preview.toAllocateCount} />
                    <Stat label="Available seats" value={preview.availableHallCapacity} /><Stat label="Cannot fit" value={preview.unallocatedStudentIds.length} /><Stat label="Pending verification" value={preview.pendingVerificationCandidates} />
                  </div>
                  <div className="overflow-x-auto"><table className="w-full min-w-[600px]"><thead><tr><th className={thClass}>Hall</th><th className={thClass}>Current</th><th className={thClass}>Locked</th><th className={thClass}>Projected</th><th className={thClass}>Remaining</th></tr></thead><tbody>{preview.hallProjection.map(hall => <tr key={hall.hallId}><td className={tdClass}>{hall.name} · {hall.roomNumber}</td><td className={tdClass}>{hall.assigned} / {hall.capacity}</td><td className={tdClass}>{hall.locked}</td><td className={tdClass}>{hall.projected} / {hall.capacity}</td><td className={tdClass}>{hall.remaining}</td></tr>)}</tbody></table></div>
                  {preview.unallocatedStudentIds.length > 0 && <StateNotice kind="info"><AlertCircle size={18} /> {preview.unallocatedStudentIds.length} qualified student(s) cannot be placed. Confirm partial allocation to save the assignments that fit; remaining students will stay unassigned.</StateNotice>}
                  <div className="flex flex-col gap-3 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
                    {preview.unallocatedStudentIds.length > 0 ? <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={allowPartial} onChange={event => setAllowPartial(event.target.checked)} /> Confirm partial allocation</label> : <span className="text-xs text-slate-500">No capacity shortfall in this preview.</span>}
                    <div className="flex gap-2"><button className={buttonSecondary} onClick={() => setPreview(null)}>Discard preview</button><button className={buttonPrimary} onClick={() => void commitPreview()} disabled={saving || (preview.unallocatedStudentIds.length > 0 && !allowPartial) || preview.toAllocateCount === 0}>Confirm and save allocation</button></div>
                  </div>
                </div>
              )}
            </section>
          )}

          {tab === 'audit' && (
            <section className="space-y-3">
              <div className="flex items-center justify-between"><div><h3 className="text-sm font-semibold text-slate-900">Interview audit history</h3><p className="mt-0.5 text-xs text-slate-500">Append-only record of hall and assignment changes.</p></div><button className={buttonSecondary} onClick={() => setRefreshKey(value => value + 1)}><RefreshCw size={15} /> Refresh</button></div>
              <div className="overflow-x-auto border border-slate-200 bg-white">
                <table className="w-full min-w-[760px]"><thead><tr><th className={thClass}>Time</th><th className={thClass}>Action</th><th className={thClass}>Administrator</th><th className={thClass}>Student / hall</th><th className={thClass}>Reason</th></tr></thead><tbody>
                  {(auditPage?.rows ?? []).map(row => <tr key={row.id}><td className={tdClass}>{new Date(row.occurredAt).toLocaleString()}</td><td className={tdClass}>{auditLabel(row.action)}</td><td className={tdClass}>{row.actor.name}<div className="text-xs text-slate-500">{row.actor.role}</div></td><td className={tdClass}><div className="max-w-56 truncate">{row.studentId || '—'}</div><div className="text-xs text-slate-500">{row.hallId || '—'}</div></td><td className={tdClass}>{row.reason || '—'}</td></tr>)}
                  {(auditPage?.rows.length ?? 0) === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">{dataLoading ? 'Loading audit entries…' : 'No audit entries for this round yet.'}</td></tr>}
                </tbody></table>
              </div>
              <div className="flex justify-end gap-2"><button className={buttonSecondary} onClick={() => setAuditPageNumber(value => Math.max(1, value - 1))} disabled={auditPageNumber <= 1}><ChevronLeft size={15} /> Previous</button><span className="self-center text-xs text-slate-500">Page {auditPage?.pagination.page ?? 1} of {Math.max(1, auditPage?.pagination.totalPages ?? 0)}</span><button className={buttonSecondary} onClick={() => setAuditPageNumber(value => value + 1)} disabled={auditPageNumber >= (auditPage?.pagination.totalPages ?? 0)}><ChevronRight size={15} /> Next</button></div>
            </section>
          )}
        </>
      )}

      {dataLoading && selectedRound && <div className="fixed bottom-4 right-4 flex items-center gap-2 border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 shadow-sm" role="status"><Loader2 className="animate-spin" size={14} /> Refreshing interview data…</div>}
    </main>
  );
}
