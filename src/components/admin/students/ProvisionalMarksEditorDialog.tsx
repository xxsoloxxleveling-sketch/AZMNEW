import React, { useEffect, useState } from 'react';
import { AlertCircle, Clock3, RotateCcw, ShieldCheck } from 'lucide-react';
import { AttendanceDialog, attendanceField, attendancePrimary, attendanceSecondary } from '../attendance/AttendanceDialog';
import { mockApi, type MockStudent } from '../../../lib/mockApi';

type CorrectionHistory = Awaited<ReturnType<typeof mockApi.getProvisionalOmrMarkHistory>>;

export function ProvisionalMarksEditorDialog({
  student,
  onClose,
  onSaved,
}: {
  student: MockStudent;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const currentMarks = student.testScore;
  const originalMarks = student.provisionalOmr?.originalScannedMarks;
  const [newMarks, setNewMarks] = useState(currentMarks === null || currentMarks === undefined ? '' : String(currentMarks));
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<CorrectionHistory>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const validMarks = /^(100|[1-9]?\d)$/.test(newMarks) && Number(newMarks) !== currentMarks;
  const canSave = student.provisionalOmr !== null && student.provisionalOmr !== undefined &&
    currentMarks !== null && currentMarks !== undefined &&
    validMarks && reason.trim().length >= 10 && reason.trim().length <= 500 && !busy;

  useEffect(() => {
    let cancelled = false;
    void mockApi.getProvisionalOmrMarkHistory(student.id)
      .then(rows => { if (!cancelled) setHistory(rows); })
      .catch(() => { if (!cancelled) setHistory([]); })
      .finally(() => { if (!cancelled) setHistoryLoading(false); });
    return () => { cancelled = true; };
  }, [student.id]);

  const save = async () => {
    if (!canSave || currentMarks === null || currentMarks === undefined) return;
    setBusy(true); setError('');
    try {
      await mockApi.correctProvisionalOmrMarks(student.id, {
        expectedCurrentMarks: currentMarks,
        newMarks: Number(newMarks),
        reason: reason.trim(),
      });
      await onSaved();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save correction. Refresh and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AttendanceDialog
      title="Correct overall OMR marks"
      busy={busy}
      onClose={onClose}
      footer={<>
        <button type="button" className={attendanceSecondary} disabled={busy} onClick={onClose}>Cancel</button>
        <button type="button" className={attendancePrimary} disabled={!canSave} onClick={() => { void save(); }}>
          {busy ? 'Saving correction…' : 'Save corrected marks'}
        </button>
      </>}
    >
      <div className="space-y-4 text-sm">
        <p className="font-semibold text-slate-900">
          {student.fullName} <span className="ml-1 font-mono font-normal text-slate-600">{student.rollNumber || student.applicationNo}</span>
        </p>
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
          <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <p>This updates the recorded overall mark. If the score was verified, that verification becomes invalid and requires a new evidence review. The original scanned score, scan evidence, previously issued official results and DMCs remain unchanged. Every correction is permanently audited.</p>
        </div>
        <dl className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3">
          <div>
            <dt className="text-xs text-slate-500">Original scanned score</dt>
            <dd className="mt-1 font-semibold tabular-nums text-slate-900">{originalMarks ?? '—'} / 100</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Currently displayed</dt>
            <dd className="mt-1 font-semibold tabular-nums text-slate-900">{currentMarks ?? '—'} / 100</dd>
          </div>
        </dl>
        {student.provisionalOmr?.reviewCategory.startsWith('HOLD_') && (
          <p className="text-xs font-medium text-amber-800">This scan has unresolved identity or printed-class flags. Correcting marks does not verify the result; review the evidence separately.</p>
        )}
        <label className="block text-xs font-semibold text-slate-700">
          Corrected mark (out of 100)
          <input
            data-autofocus
            type="number"
            inputMode="numeric"
            min={0}
            max={100}
            step={1}
            required
            value={newMarks}
            onChange={event => { setNewMarks(event.target.value); setError(''); }}
            className={attendanceField + ' mt-1.5'}
            aria-describedby="omr-mark-guidance"
          />
        </label>
        <p id="omr-mark-guidance" className="text-xs text-slate-500">
          Enter a whole number from 0 to 100, different from the currently displayed mark.
        </p>
        {student.provisionalOmr?.manuallyCorrected && originalMarks !== undefined && (
          <button type="button" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#185b9d] hover:underline" disabled={busy} onClick={() => setNewMarks(String(originalMarks))}>
            <RotateCcw size={13} /> Restore original scanned mark
          </button>
        )}
        <label className="block text-xs font-semibold text-slate-700">
          Correction reason (required, 10–500 characters)
          <textarea
            value={reason}
            maxLength={500}
            rows={3}
            onChange={event => { setReason(event.target.value); setError(''); }}
            className={attendanceField + ' mt-1.5 resize-y'}
            placeholder="Describe the checked sheet, recognition mistake, or authorization for this correction."
          />
        </label>
        <div className="flex justify-between text-xs text-slate-500">
          <span><ShieldCheck size={13} className="mr-1 inline" /> Super Admin changes are audited</span>
          <span className="tabular-nums">{reason.trim().length}/500</span>
        </div>
        {error && <p role="alert" className="rounded-lg bg-rose-50 p-2 text-xs font-medium text-rose-700">{error}</p>}
        <div className="border-t border-slate-200 pt-3">
          <h3 className="flex items-center gap-1.5 text-xs font-bold text-slate-700"><Clock3 size={14} /> Previous corrections</h3>
          {historyLoading ? <p className="mt-2 text-xs text-slate-500">Loading history…</p>
            : history.length === 0 ? <p className="mt-2 text-xs text-slate-500">No earlier corrections recorded.</p>
              : <ol className="mt-2 max-h-32 space-y-2 overflow-y-auto">
                {history.map(item => <li key={item.id} className="rounded-lg border border-slate-200 p-2 text-xs">
                  <div className="font-semibold tabular-nums text-slate-800">{item.previousEffectiveMarks} → {item.newEffectiveMarks} / 100</div>
                  <div className="mt-0.5 text-slate-600">{item.reason}</div>
                  <div className="mt-1 text-slate-500">{item.actorName} · {new Date(item.occurredAt).toLocaleString()}</div>
                </li>)}
              </ol>}
        </div>
      </div>
    </AttendanceDialog>
  );
}
