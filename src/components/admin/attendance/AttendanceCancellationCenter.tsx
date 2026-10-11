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

const phrase = (purge: boolean): CancellationConfirm['confirmationText'] =>
  purge ? 'CANCEL SESSION AND DELETE ATTENDANCE' : 'CANCEL SESSION';
const cancelledError = (error: unknown): string =>
  error instanceof Error ? error.message : 'The server could not confirm this cancellation.';

export function AttendanceCancellationCenter({ selectedSession, disabled = false, onDialogChange, onCancelled }: Props) {
  const [opened, setOpened] = useState(false);
  const [purge, setPurge] = useState(false);
  const [preview, setPreview] = useState<CancellationPreview | null>(null);
  const [reason, setReason] = useState('');
  const [approvalReference, setApprovalReference] = useState('');
  const [retentionApproved, setRetentionApproved] = useState(false);
  const [externalDispositionAttested, setExternalDispositionAttested] = useState(false);
  const [irreversibleDeletionAcknowledged, setIrreversibleDeletionAcknowledged] = useState(false);
  const [closedEvidenceApproved, setClosedEvidenceApproved] = useState(false);
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
      .catch(error => { if (active) { setHistory(null); setHistoryError(cancelledError(error)); } });
    return () => { active = false; };
  }, [historyPage, historyRefresh]);

  const resetForm = () => {
    setPurge(false);
    setPreview(null);
    setReason('');
    setApprovalReference('');
    setRetentionApproved(false);
    setExternalDispositionAttested(false);
    setIrreversibleDeletionAcknowledged(false);
    setClosedEvidenceApproved(false);
    setConfirmationText('');
    setError('');
    retryKey.current = null;
  };
  const show = () => {
    if (!eligible || disabled) return;
    resetForm();
    setOpened(true);
    onDialogChange?.(true);
  };
  const close = () => {
    if (busy) return;
    setOpened(false);
    onDialogChange?.(false);
    resetForm();
  };
  const setMode = (next: boolean) => {
    setPurge(next);
    setPreview(null);
    setError('');
    setConfirmationText('');
    retryKey.current = null;
  };
  const createPreview = async () => {
    if (!eligible || !sessionId || busy) return;
    setBusy(true); setError(''); setPreview(null); retryKey.current = null;
    try {
      const received = await attendanceCancellationApi.preview(sessionId, purge);
      if (received.session.id !== sessionId || received.session.status !== selectedSession?.status)
        throw new Error('The server returned a different session. Refresh before continuing.');
      setPreview(received);
    } catch (cause) { setError(cancelledError(cause)); }
    finally { setBusy(false); }
  };

  const reasonValid = reason.trim().length >= 10 && reason.trim().length <= 1000;
  const approvalValid = approvalReference.trim().length >= 8 && approvalReference.trim().length <= 160;
  const allowConfirm = eligible && !!preview && !preview.blockers.length &&
    preview.session.id === sessionId && preview.purgeAttendance === purge &&
    Date.parse(preview.expiresAt) > Date.now() &&
    reasonValid && confirmationText === phrase(purge) &&
    (!purge || (approvalValid && retentionApproved && externalDispositionAttested &&
      irreversibleDeletionAcknowledged &&
      (preview.session.status !== 'CLOSED' || closedEvidenceApproved)));

  const confirm = async () => {
    if (!allowConfirm || !preview || busy) return;
    const key = retryKey.current ?? crypto.randomUUID();
    retryKey.current = key;
    setBusy(true); setError('');
    const input: CancellationConfirm = {
      challenge: preview.challenge,
      reason: reason.trim(),
      confirmationText: phrase(purge),
      ...(purge ? {
        approvalReference: approvalReference.trim(),
        retentionApproved, externalDispositionAttested,
        irreversibleDeletionAcknowledged, closedEvidenceApproved,
      } : {}),
    };
    try {
      const result = await attendanceCancellationApi.confirm(sessionId, input, key);
      if (result.purgeAttendance !== purge) throw new Error('Cancellation result does not match the selected action.');
      setOpened(false);
      onDialogChange?.(false);
      resetForm();
      setHistoryPage(1);
      setHistoryRefresh(value => value + 1);
      onCancelled(result);
    } catch (cause) {
      // Keep the same key and unchanged request, including the signed preview,
      // so uncertain HTTP outcomes can be checked with an idempotent retry.
      setError(cancelledError(cause) +
        ' If the request may have completed, retry the SAME confirmation or review cancellation history.');
    } finally { setBusy(false); }
  };

  return (
    <section className="min-w-0 rounded-xl border border-rose-200 bg-white p-4 shadow-sm" aria-label="Super Admin session cancellation">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Super Admin · Cancel Session</h2>
          <p className="mt-1 max-w-2xl text-xs text-slate-600">
            Cancel one exact Hall attendance attempt. Optionally purge only its attendance markings.
            Frozen rosters, session identity, audit evidence, students, fees and documents remain.
          </p>
        </div>
        <button type="button" className={attendanceSecondary}
          disabled={!eligible || disabled || opened} onClick={show}>
          Manage selected session
        </button>
      </div>
      {!eligible && <p className="mt-2 text-xs text-slate-600">
        Choose a current OPEN or CLOSED Hall session to enable cancellation. Archived and cancelled attempts cannot be deleted again.
      </p>}
      <div className="mt-3 border-t border-slate-100 pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-bold text-slate-700">Cancellation audit history</h3>
          <button className={attendanceSecondary} disabled={opened || busy}
            onClick={() => setHistoryRefresh(value => value + 1)}>Refresh history</button>
        </div>
        {historyError && <p role="alert" className="mt-2 text-xs text-red-700">{historyError}</p>}
        {history && !history.operations.length && <p className="mt-2 text-xs text-slate-500">No cancellation operations yet.</p>}
        {history && history.operations.length > 0 && (
          <div className="mt-2 overflow-x-auto" role="region" aria-label="Recent cancellation audit records" tabIndex={0}>
            <table className="w-full min-w-[650px] text-left text-xs">
              <thead className="bg-slate-50 text-slate-600">
                <tr>{['Cancelled', 'Session', 'Operator', 'Reason', 'Attendance deleted', 'Prior status'].map(title =>
                  <th scope="col" key={title} className="px-2 py-2 font-semibold">{title}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.operations.map(row => (
                  <tr key={row.id}>
                    <td className="whitespace-nowrap px-2 py-2">{new Date(row.cancelledAt).toLocaleString()}</td>
                    <td className="break-all px-2 py-2">{row.sessionId}</td>
                    <td className="px-2 py-2">{row.actorName}</td>
                    <td className="max-w-[210px] break-words px-2 py-2">{row.reason}</td>
                    <td className="px-2 py-2 tabular-nums">{row.deletedCount} / {row.markedCount}</td>
                    <td className="px-2 py-2">{row.previousStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {history && <div className="mt-3 flex items-center justify-between gap-2 text-xs text-slate-600">
          <span>{history.pagination.total} cancellation records · Page {historyPage} of {Math.max(1, history.pagination.totalPages)}</span>
          <div className="flex gap-2">
            <button className={attendanceSecondary} disabled={opened || busy || historyPage <= 1}
              onClick={() => setHistoryPage(page => page - 1)}>Previous</button>
            <button className={attendanceSecondary} disabled={opened || busy || historyPage >= history.pagination.totalPages}
              onClick={() => setHistoryPage(page => page + 1)}>Next</button>
          </div>
        </div>}
      </div>

      {opened && selectedSession && (
        <AttendanceDialog title="Cancel exact examination session" busy={busy} onClose={close}
          footer={<>
            <button className={attendanceSecondary} type="button" disabled={busy} onClick={close}>Keep session</button>
            {!preview
              ? <button className={attendancePrimary} type="button" disabled={busy} onClick={createPreview}>
                  {busy ? 'Loading impact…' : 'Review cancellation impact'}
                </button>
              : <button className={attendancePrimary} type="button" disabled={busy || !allowConfirm}
                  onClick={confirm}>{busy ? 'Cancelling…' : purge ? 'Permanently purge & cancel' : 'Cancel session'}</button>}
          </>}>
          <div className="space-y-4 text-sm">
            <div className="rounded-lg bg-slate-50 p-3 text-xs">
              <p className="font-semibold">Exact session: {selectedSession.id}</p>
              <p className="mt-1">Hall: {attendanceValue(selectedSession.hallNameSnapshot)} · {attendanceValue(selectedSession.roomNumberSnapshot)}</p>
              <p>Date: {attendanceValue(selectedSession.examDateSnapshot)} · Attempt {selectedSession.attemptNumber ?? 1}</p>
              <p>Current status: <strong>{selectedSession.status}</strong></p>
            </div>
            <fieldset disabled={busy || !!preview} className="space-y-2">
              <legend className="mb-2 text-xs font-bold">Choose one operation</legend>
              <label className="flex items-start gap-2 rounded-lg border border-slate-200 p-3">
                <input type="radio" name="session-cancel-mode" className="mt-0.5" checked={!purge}
                  onChange={() => setMode(false)}/>
                <span><strong>Cancel and keep attendance</strong>
                  <span className="mt-1 block text-xs text-slate-600">Marks remain as historical evidence. Stop further scans and close this attempt permanently.</span></span>
              </label>
              <label className="flex items-start gap-2 rounded-lg border border-rose-300 bg-rose-50 p-3">
                <input type="radio" name="session-cancel-mode" className="mt-0.5" checked={purge}
                  onChange={() => setMode(true)}/>
                <span><strong>Cancel AND permanently delete attendance</strong>
                  <span className="mt-1 block text-xs text-rose-800">Irreversible loss of marks, methods and timestamps for this exact session only.
                    {selectedSession.status === 'CLOSED' ? ' This includes FINALIZED attendance evidence.' : ''}</span></span>
              </label>
            </fieldset>
            {preview && (
              <>
                <button type="button" className={attendanceSecondary} disabled={busy}
                  onClick={() => { setPreview(null); setError(''); setConfirmationText(''); retryKey.current = null; }}>
                  Change operation or refresh impact preview
                </button>
                <div className="rounded-lg border border-slate-200 p-3 text-xs">
                  <p className="font-semibold">Verified server impact preview</p>
                  <p className="mt-1">Hall: {preview.session.hallName} · {preview.session.examDate} · Attempt {preview.session.attemptNumber}</p>
                  <p>Roster: {preview.impact.expectedCount} · Marked: {preview.impact.markedCount}</p>
                  <p>Present: {preview.impact.presentCount} · Late: {preview.impact.lateCount} · Absent: {preview.impact.absentCount}</p>
                  <p>QR: {preview.impact.qrCount} · Manual: {preview.impact.manualCount}</p>
                  <p className={purge ? 'mt-2 font-bold text-rose-800' : 'mt-2 font-bold'}>
                    {purge ? preview.impact.markedCount + ' individual attendance marks would be deleted permanently.' :
                      'No individual attendance marks will be deleted.'}
                  </p>
                  <p className="mt-2">Scored or ranked candidates: {preview.impact.scoredOrRankedCandidates}</p>
                  <p>Preserved fee records: {preview.impact.feeReferences} · Fee transactions: {preview.impact.feeTransactions}</p>
                  <p>Preserved documents: {preview.impact.documentReferences} · Document audit rows: {preview.impact.documentAuditReferences}</p>
                  <p className="mt-2 text-amber-800">OMR and external results cannot be reliably linked to this session: UNKNOWN.
                    Cancellation does not erase or void external records automatically.</p>
                  <p className="mt-2 text-slate-500">Confirmation expires {new Date(preview.expiresAt).toLocaleString()}.</p>
                </div>
                {preview.blockers.length > 0 && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                  {preview.blockers.map(message => <p key={message}>{message}</p>)}
                </div>}
                <div>
                  <label htmlFor="cancel-reason" className="block text-xs font-semibold">Reason for cancellation (required)</label>
                  <textarea id="cancel-reason" className={attendanceField + ' mt-1'} rows={3}
                    value={reason} maxLength={1000} disabled={busy}
                    onChange={event => { setReason(event.target.value); retryKey.current = null; }}
                    placeholder="Explain why this specific examination session must be cancelled."/>
                </div>
                {purge && <>
                  <div>
                    <label htmlFor="cancel-approval" className="block text-xs font-semibold">Retention policy / approval reference (required)</label>
                    <input id="cancel-approval" className={attendanceField + ' mt-1'} value={approvalReference}
                      maxLength={160} disabled={busy}
                      onChange={event => { setApprovalReference(event.target.value); retryKey.current = null; }}
                      placeholder="Approved retention exception or authorization ticket"/>
                  </div>
                  {([
                    [retentionApproved, setRetentionApproved,
                      'I confirm that retention requirements permit permanent erasure of these attendance marks.'],
                    [externalDispositionAttested, setExternalDispositionAttested,
                      'I have separately checked how related OMR, results and external records must be handled.'],
                    [irreversibleDeletionAcknowledged, setIrreversibleDeletionAcknowledged,
                      'I understand that the deleted attendance history cannot be recovered through the application.'],
                  ] as const).map(([checked, setter, title]) => (
                    <label key={title} className="flex items-start gap-2 text-xs">
                      <input className="mt-0.5" type="checkbox" checked={checked} disabled={busy}
                        onChange={event => { setter(event.target.checked); retryKey.current = null; }}/>
                      <span>{title}</span>
                    </label>
                  ))}
                  {preview.session.status === 'CLOSED' && (
                    <label className="flex items-start gap-2 rounded-lg border border-rose-300 bg-rose-50 p-3 text-xs">
                      <input className="mt-0.5" type="checkbox" checked={closedEvidenceApproved} disabled={busy}
                        onChange={event => { setClosedEvidenceApproved(event.target.checked); retryKey.current = null; }}/>
                      <span><strong>Exceptional CLOSED-session authorization:</strong> I explicitly approve deleting finalized attendance evidence for this exact session.</span>
                    </label>
                  )}
                </>}
                <div>
                  <label htmlFor="cancel-phrase" className="block text-xs font-semibold">
                    Type <strong>{phrase(purge)}</strong> exactly to confirm
                  </label>
                  <input data-autofocus id="cancel-phrase" className={attendanceField + ' mt-1'}
                    autoComplete="off" spellCheck={false} value={confirmationText} disabled={busy}
                    onChange={event => { setConfirmationText(event.target.value); retryKey.current = null; }}/>
                </div>
              </>
            )}
            {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">{error}</p>}
          </div>
        </AttendanceDialog>
      )}
    </section>
  );
}
