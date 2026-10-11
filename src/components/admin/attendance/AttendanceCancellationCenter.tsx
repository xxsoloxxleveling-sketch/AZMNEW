import React, { useEffect, useRef, useState } from 'react';
import type { AttendanceSession } from '../../../lib/mockApi';
import {
  attendanceCancellationApi,
  type CancellationHistory,
  type CancellationPreview,
  type CancellationResult,
  type CancellationConfirm,
} from '../../../lib/attendanceCancellationApi';
import {
  AttendanceDialog, attendanceField, attendancePrimary, attendanceSecondary, attendanceValue,
} from './AttendanceDialog';

type Props = {
  selectedSession: AttendanceSession | null;
  disabled?: boolean;
  onDialogChange?: (open: boolean) => void;
  onCancelled: (result: CancellationResult) => void;
};
const errorText = (error: unknown): string =>
  error instanceof Error ? error.message : 'The server did not confirm this cancellation.';

export function AttendanceCancellationCenter({ selectedSession, disabled = false, onDialogChange, onCancelled }: Props) {
  const [opened, setOpened] = useState(false);
  const [preview, setPreview] = useState<CancellationPreview | null>(null);
  const [reason, setReason] = useState('');
  const [confirmationText, setConfirmationText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<CancellationHistory | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyError, setHistoryError] = useState('');
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const retryKey = useRef<string | null>(null);

  const sessionId = selectedSession?.id ?? '';
  const eligible = !!selectedSession && selectedSession.isCurrent !== false &&
    (selectedSession.status === 'OPEN' || selectedSession.status === 'CLOSED');

  useEffect(() => {
    let active = true;
    attendanceCancellationApi.history(historyPage)
      .then(value => { if (active) { setHistory(value); setHistoryError(''); } })
      .catch(error => { if (active) { setHistory(null); setHistoryError(errorText(error)); } });
    return () => { active = false; };
  }, [historyPage, historyRefresh]);

  const reset = () => {
    setPreview(null);
    setReason('');
    setConfirmationText('');
    setError('');
    retryKey.current = null;
  };
  const show = () => {
    if (!eligible || disabled) return;
    reset();
    setOpened(true);
    onDialogChange?.(true);
  };
  const close = () => {
    if (busy) return;
    setOpened(false);
    onDialogChange?.(false);
    reset();
  };
  const createPreview = async () => {
    if (!eligible || !sessionId || busy) return;
    setBusy(true); setError(''); setPreview(null); retryKey.current = null;
    try {
      const received = await attendanceCancellationApi.preview(sessionId);
      if (received.session.id !== sessionId || received.session.status !== selectedSession?.status ||
        received.purgeAttendance !== false)
        throw new Error('The server returned a different or destructive action. Refresh before continuing.');
      setPreview(received);
    } catch (cause) { setError(errorText(cause)); }
    finally { setBusy(false); }
  };
  const allowConfirm = eligible && !!preview && !preview.blockers.length &&
    preview.session.id === sessionId && preview.purgeAttendance === false &&
    Date.parse(preview.expiresAt) > Date.now() &&
    reason.trim().length >= 10 && reason.trim().length <= 1000 &&
    confirmationText === 'CANCEL SESSION';

  const confirm = async () => {
    if (!allowConfirm || !preview || busy) return;
    const key = retryKey.current ?? crypto.randomUUID();
    retryKey.current = key;
    setBusy(true); setError('');
    const input: CancellationConfirm = {
      challenge: preview.challenge,
      reason: reason.trim(),
      confirmationText: 'CANCEL SESSION',
    };
    try {
      const result = await attendanceCancellationApi.confirm(sessionId, input, key);
      if (result.purgeAttendance !== false || result.deletedCount !== 0) {
        throw new Error('The server returned an unexpected destructive cancellation result.');
      }
      setOpened(false);
      onDialogChange?.(false);
      reset();
      setHistoryPage(1);
      setHistoryRefresh(value => value + 1);
      onCancelled(result);
    } catch (cause) {
      // An uncertain outcome must be checked with the identical idempotency key.
      setError(errorText(cause) +
        ' If the request may have completed, retry the same confirmation or check the audit history.');
    } finally { setBusy(false); }
  };

  return (
    <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="Super Admin session cancellation">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Super Admin · Cancel Session</h2>
          <p className="mt-1 max-w-2xl text-xs text-slate-600">
            Cancel one exact Hall attendance attempt while preserving every attendance mark,
            method, timestamp, frozen roster and immutable cancellation audit.
          </p>
          <p className="mt-2 text-xs font-semibold text-amber-800">
            Stage 1 safety rule: permanent attendance deletion is disabled.
          </p>
        </div>
        <button type="button" className={attendanceSecondary}
          disabled={!eligible || disabled || opened} onClick={show}>Manage selected session</button>
      </div>
      {!eligible && <p className="mt-2 text-xs text-slate-600">
        Choose a current OPEN or CLOSED Hall session. Archived and cancelled attempts cannot be cancelled again.
      </p>}

      <div className="mt-3 border-t border-slate-100 pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-bold text-slate-700">Cancellation audit history</h3>
          <button type="button" className={attendanceSecondary} disabled={opened || busy}
            onClick={() => setHistoryRefresh(value => value + 1)}>Refresh history</button>
        </div>
        {historyError && <p role="alert" className="mt-2 text-xs text-red-700">{historyError}</p>}
        {history && history.operations.length === 0 &&
          <p className="mt-2 text-xs text-slate-500">No cancellation operations yet.</p>}
        {history && history.operations.length > 0 && (
          <div className="mt-2 overflow-x-auto" role="region"
            aria-label="Recent cancellation audit records" tabIndex={0}>
            <table className="w-full min-w-[650px] text-left text-xs">
              <thead className="bg-slate-50 text-slate-600">
                <tr>{['Cancelled', 'Session', 'Operator', 'Reason', 'Marks preserved', 'Prior status'].map(title =>
                  <th scope="col" key={title} className="px-2 py-2 font-semibold">{title}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.operations.map(row => (
                  <tr key={row.id}>
                    <td className="whitespace-nowrap px-2 py-2">{new Date(row.cancelledAt).toLocaleString()}</td>
                    <td className="break-all px-2 py-2">{row.sessionId}</td>
                    <td className="px-2 py-2">{row.actorName}</td>
                    <td className="max-w-[210px] break-words px-2 py-2">{row.reason}</td>
                    <td className="px-2 py-2 tabular-nums">
                      {row.retainedCount} / {row.markedCount}
                      {row.deletedCount > 0 ? ' (prior history: ' + row.deletedCount + ' removed)' : ''}
                    </td>
                    <td className="px-2 py-2">{row.previousStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {history && <div className="mt-3 flex items-center justify-between gap-2 text-xs text-slate-600">
          <span>{history.pagination.total} records · Page {historyPage} of {Math.max(1,history.pagination.totalPages)}</span>
          <div className="flex gap-2">
            <button type="button" className={attendanceSecondary} disabled={opened || busy || historyPage <= 1}
              onClick={() => setHistoryPage(page => page - 1)}>Previous</button>
            <button type="button" className={attendanceSecondary}
              disabled={opened || busy || historyPage >= history.pagination.totalPages}
              onClick={() => setHistoryPage(page => page + 1)}>Next</button>
          </div>
        </div>}
      </div>

      {opened && selectedSession && (
        <AttendanceDialog title="Cancel session · Preserve all attendance" busy={busy} onClose={close}
          footer={<>
            <button type="button" className={attendanceSecondary} disabled={busy} onClick={close}>Keep session</button>
            {!preview
              ? <button type="button" className={attendancePrimary} disabled={busy} onClick={createPreview}>
                  {busy ? 'Loading impact…' : 'Review cancellation impact'}</button>
              : <button type="button" className={attendancePrimary} disabled={busy || !allowConfirm} onClick={confirm}>
                  {busy ? 'Cancelling…' : 'Cancel and preserve attendance'}</button>}
          </>}>
          <div className="space-y-4 text-sm">
            <div className="rounded-lg bg-slate-50 p-3 text-xs">
              <p className="font-semibold">Exact session: {selectedSession.id}</p>
              <p className="mt-1">Hall: {attendanceValue(selectedSession.hallNameSnapshot)} · {attendanceValue(selectedSession.roomNumberSnapshot)}</p>
              <p>Date: {attendanceValue(selectedSession.examDateSnapshot)} · Attempt {selectedSession.attemptNumber ?? 1}</p>
              <p>Current status: <strong>{selectedSession.status}</strong></p>
            </div>
            <p className="rounded-lg border border-slate-200 p-3 text-xs text-slate-700">
              All current attendance marks, scan methods, timestamps and the frozen candidate roster will
              be retained as historical evidence. The cancelled attempt cannot accept further scans or marks.
              A separate authorized action is required to start a new attempt.
            </p>
            {preview && <>
              <button type="button" className={attendanceSecondary} disabled={busy}
                onClick={() => { setPreview(null); setError(''); setConfirmationText(''); retryKey.current = null; }}>
                Refresh impact preview
              </button>
              <div className="rounded-lg border border-slate-200 p-3 text-xs">
                <p className="font-semibold">Verified server impact preview</p>
                <p className="mt-1">{preview.session.hallName} · {preview.session.examDate} · Attempt {preview.session.attemptNumber}</p>
                <p>Roster: {preview.impact.expectedCount} · Marked: {preview.impact.markedCount}</p>
                <p>Present: {preview.impact.presentCount} · Late: {preview.impact.lateCount} · Absent: {preview.impact.absentCount}</p>
                <p>QR: {preview.impact.qrCount} · Manual: {preview.impact.manualCount}</p>
                <p className="mt-2 font-bold text-emerald-800">All {preview.impact.markedCount} attendance marks will remain. Nothing will be deleted.</p>
                <p>Candidate scores/ranks present: {preview.impact.scoredOrRankedCandidates}</p>
                <p>Preserved fees: {preview.impact.feeReferences} · Transactions: {preview.impact.feeTransactions}</p>
                <p>Preserved documents: {preview.impact.documentReferences} · Document audits: {preview.impact.documentAuditReferences}</p>
                <p className="mt-2 text-amber-800">External OMR/results are not reliably linked to this session.
                  Cancellation does not erase, void or modify external records.</p>
                <p className="mt-2 text-slate-500">Preview expires {new Date(preview.expiresAt).toLocaleString()}.</p>
              </div>
              {preview.blockers.length > 0 && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                {preview.blockers.map(message => <p key={message}>{message}</p>)}
              </div>}
              <div>
                <label htmlFor="cancel-reason" className="block text-xs font-semibold">Reason for cancellation (required)</label>
                <textarea id="cancel-reason" className={attendanceField + ' mt-1'} rows={3}
                  maxLength={1000} disabled={busy} value={reason}
                  onChange={event => { setReason(event.target.value); retryKey.current = null; }}
                  placeholder="Explain why this exact examination session needs cancellation."/>
              </div>
              <div>
                <label htmlFor="cancel-phrase" className="block text-xs font-semibold">
                  Type <strong>CANCEL SESSION</strong> exactly
                </label>
                <input id="cancel-phrase" data-autofocus className={attendanceField + ' mt-1'}
                  autoComplete="off" spellCheck={false} disabled={busy} value={confirmationText}
                  onChange={event => { setConfirmationText(event.target.value); retryKey.current = null; }}/>
              </div>
            </>}
            {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">{error}</p>}
          </div>
        </AttendanceDialog>
      )}
    </section>
  );
}
