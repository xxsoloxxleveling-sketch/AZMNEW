import React, { useEffect, useState } from 'react';
import { AlertTriangle, ClipboardCheck, History, ShieldCheck } from 'lucide-react';
import { AttendanceDialog, attendanceField, attendancePrimary, attendanceSecondary } from '../attendance/AttendanceDialog';
import { mockApi, type MockStudent } from '../../../lib/mockApi';
import { hasManualMarksForCorrection } from './manualApprovalEligibility';

type HistoryRecord = Awaited<ReturnType<typeof mockApi.getManualExamMarkHistory>>;

export function ManualMarksCorrectionDialog({ student, onClose, onSaved }: {
  student: MockStudent;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const current = student.testScore;
  const original = student.manualExamMark?.originalRecordedMarks ?? current;
  const [newMarks, setNewMarks] = useState(current == null ? '' : String(current));
  const [evidenceReference, setEvidenceReference] = useState('');
  const [reason, setReason] = useState('');
  const [identityReviewed, setIdentityReviewed] = useState(false);
  const [attendanceReviewed, setAttendanceReviewed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<HistoryRecord>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const canReview = hasManualMarksForCorrection(student) &&
    /^(100|[1-9]?\d)$/.test(newMarks) && Number(newMarks) !== current &&
    evidenceReference.trim().length >= 10 && evidenceReference.trim().length <= 500 &&
    reason.trim().length >= 30 && reason.trim().length <= 1000 &&
    identityReviewed && attendanceReviewed && !busy;

  useEffect(() => {
    let cancelled = false;
    void mockApi.getManualExamMarkHistory(student.id)
      .then(rows => { if (!cancelled) setHistory(rows); })
      .catch(cause => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Could not load earlier corrections.');
      })
      .finally(() => { if (!cancelled) setHistoryLoading(false); });
    return () => { cancelled = true; };
  }, [student.id]);

  const save = async () => {
    if (!canReview || !confirming || current == null) return;
    setBusy(true); setError('');
    try {
      await mockApi.correctManualExamMark(student.id, {
        expectedCurrentMarks: current, newMarks: Number(newMarks),
        evidenceReference: evidenceReference.trim(), reason: reason.trim(),
        identityReviewed: true, attendanceReviewed: true,
      });
      await onSaved();
      onClose();
    } catch (cause) {
      setConfirming(false);
      setError(cause instanceof Error ? cause.message : 'Could not save correction. Refresh the roster and retry.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AttendanceDialog
      title={confirming ? 'Confirm manual marks correction' : 'Edit manual examination marks'}
      busy={busy} onClose={onClose}
      footer={<>
        <button type="button" className={attendanceSecondary} disabled={busy}
          onClick={confirming ? () => setConfirming(false) : onClose}>
          {confirming ? 'Back to review' : 'Cancel'}
        </button>
        <button type="button" className={attendancePrimary} disabled={!canReview}
          onClick={() => confirming ? void save() : setConfirming(true)}>
          <ClipboardCheck size={15} className="mr-1 inline" />
          {busy ? 'Saving…' : confirming ? 'Confirm & save corrected marks' : 'Review correction'}
        </button>
      </>}
    >
      <div className="space-y-4 text-sm">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="font-semibold text-slate-900">{student.fullName}</p>
          <p className="mt-1 text-xs text-slate-600">
            {student.rollNumber} · {student.currentClass} · {student.schoolName}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-200 pt-3">
            <div><p className="text-xs text-slate-500">Original entered score</p>
              <p className="text-lg font-bold tabular-nums">{original ?? '—'} / 100</p></div>
            <div><p className="text-xs text-slate-500">Current score</p>
              <p className="text-lg font-bold tabular-nums text-[#185b9d]">{current ?? '—'} / 100</p></div>
          </div>
          <p className="mt-1 text-xs text-slate-600">
            Current status: {student.manualExamMark?.verified ? 'Approved' : 'Review pending'}
          </p>
        </div>

        <p className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950">
          <AlertTriangle size={17} className="shrink-0" />
          <span>Super Admin can correct marks again even after approval. The original score and every
            previous decision remain permanently recorded. A corrected score requires a fresh approval
            before its updated E-DMC can be downloaded. Published gazettes are not updated automatically.</span>
        </p>

        {confirming ? (
          <div className="rounded-lg border-2 border-[#185b9d] bg-blue-50 p-4 text-xs leading-6">
            <p className="flex items-center gap-2 font-bold"><ShieldCheck size={16} /> Final confirmation</p>
            <p className="mt-2 text-base font-bold">{current} / 100 → {newMarks} / 100</p>
            <p>Candidate: {student.fullName}</p>
            <p><strong>Evidence:</strong> {evidenceReference.trim()}</p>
            <p><strong>Reason:</strong> {reason.trim()}</p>
            <p><strong>Checks:</strong> Student identity, attendance and signed examination record reviewed.</p>
            <p className="mt-1 font-bold text-amber-900">Prior approval will no longer certify the new score.</p>
          </div>
        ) : (
          <>
            <label className="block text-xs font-semibold text-slate-800">
              New obtained marks (0–100)
              <input type="number" inputMode="numeric" min={0} max={100} step={1} required
                value={newMarks} onChange={e => { setNewMarks(e.target.value); setError(''); }}
                data-autofocus className={attendanceField + ' mt-1.5'} />
              <span className="mt-1 block font-normal text-slate-500">60 and above is PASS. Enter a different whole number.</span>
            </label>
            <label className="block text-xs font-semibold text-slate-800">
              Evidence reference (10–500 characters)
              <input type="text" minLength={10} maxLength={500} required
                value={evidenceReference} onChange={e => { setEvidenceReference(e.target.value); setError(''); }}
                className={attendanceField + ' mt-1.5'}
                placeholder="Signed marks register / examination review reference" />
            </label>
            <label className="block text-xs font-semibold text-slate-800">
              Explanation for correction (30–1000 characters)
              <textarea rows={3} minLength={30} maxLength={1000} required
                value={reason} onChange={e => { setReason(e.target.value); setError(''); }}
                className={attendanceField + ' mt-1.5 resize-y'}
                placeholder="Explain why the previous value needs correction and what evidence supports the new value." />
            </label>
            <label className="flex items-start gap-2 rounded-md border border-slate-200 p-3 text-xs leading-5">
              <input type="checkbox" className="mt-1 h-4 w-4 accent-[#185b9d]"
                checked={identityReviewed} onChange={e => setIdentityReviewed(e.target.checked)} />
              <span>I checked the student's identity and examination roll number against the source register.</span>
            </label>
            <label className="flex items-start gap-2 rounded-md border border-slate-200 p-3 text-xs leading-5">
              <input type="checkbox" className="mt-1 h-4 w-4 accent-[#185b9d]"
                checked={attendanceReviewed} onChange={e => setAttendanceReviewed(e.target.checked)} />
              <span>I reviewed attendance and the original signed score evidence.</span>
            </label>
          </>
        )}

        {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-xs font-semibold text-rose-800">{error}</p>}
        <div className="border-t border-slate-200 pt-3">
          <h3 className="flex items-center gap-2 text-xs font-bold"><History size={14} /> Correction history</h3>
          {historyLoading ? <p className="mt-2 text-xs text-slate-500">Loading history…</p>
            : !history.length ? <p className="mt-2 text-xs text-slate-500">No previous corrections.</p>
              : <ol className="mt-2 max-h-32 space-y-2 overflow-y-auto">
                {history.map(item => <li key={item.id} className="rounded-md border border-slate-200 p-2 text-xs">
                  <strong>{item.previousEffectiveMarks} → {item.newEffectiveMarks} / 100</strong>
                  <p className="mt-1 text-slate-700">{item.reason}</p>
                  <p className="mt-1 text-slate-500">{item.actorName} · {new Date(item.occurredAt).toLocaleString()}</p>
                </li>)}
              </ol>}
        </div>
      </div>
    </AttendanceDialog>
  );
}
