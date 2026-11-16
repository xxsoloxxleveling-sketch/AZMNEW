import React, { useState } from 'react';
import { AlertTriangle, BadgeCheck, ClipboardCheck, ShieldCheck } from 'lucide-react';
import { AttendanceDialog, attendanceField, attendancePrimary, attendanceSecondary } from '../attendance/AttendanceDialog';
import { mockApi, type MockStudent } from '../../../lib/mockApi';

export function ManualMarkVerificationDialog({
  student, onClose, onVerified, batchProgress,
}: {
  student: MockStudent;
  onClose: () => void;
  onVerified: (student: MockStudent) => void | Promise<void>;
  batchProgress?: { current: number; total: number };
}) {
  const [evidenceReference, setEvidenceReference] = useState('');
  const [reason, setReason] = useState('');
  const [identityReviewed, setIdentityReviewed] = useState(false);
  const [attendanceReviewed, setAttendanceReviewed] = useState(false);
  const [marksEvidenceReviewed, setMarksEvidenceReviewed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const score = student.testScore;
  const manual = student.manualExamMark;
  const canVerify = Boolean(manual && !manual.verified
    && !student.provisionalOmr && Number.isInteger(score)
    && score !== null && score !== undefined && score >= 0 && score <= 100
    && evidenceReference.trim().length >= 10 && evidenceReference.trim().length <= 500
    && reason.trim().length >= 30 && reason.trim().length <= 1000
    && identityReviewed && attendanceReviewed && marksEvidenceReviewed && !busy);

  const verify = async () => {
    if (!canVerify || !confirming || score === null || score === undefined) return;
    setBusy(true); setError('');
    try {
      await mockApi.verifyManualExamMark(student.id, {
        expectedCurrentMarks: score,
        evidenceReference: evidenceReference.trim(),
        reason: reason.trim(),
        identityReviewed: true,
        attendanceReviewed: true,
        marksEvidenceReviewed: true,
      });
      await onVerified(student);
    } catch (cause) {
      setConfirming(false);
      setError(cause instanceof Error ? cause.message : 'Manual verification could not be completed. Refresh and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AttendanceDialog
      title={batchProgress
        ? `Verify manual marks · ${batchProgress.current} of ${batchProgress.total}`
        : confirming ? 'Confirm manual marks verification' : 'Verify manually recorded examination marks'}
      busy={busy} onClose={onClose}
      footer={<>
        <button type="button" disabled={busy} className={attendanceSecondary}
          onClick={confirming ? () => setConfirming(false) : onClose}>
          {confirming ? 'Back to review' : 'Cancel'}
        </button>
        <button type="button" className={attendancePrimary} disabled={!canVerify}
          onClick={() => confirming ? void verify() : setConfirming(true)}>
          <BadgeCheck size={15} className="mr-1 inline" />
          {busy ? 'Verifying…' : confirming ? 'Confirm & verify final marks' : 'Review verification'}
        </button>
      </>}
    >
      <div className="space-y-4 text-sm">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="font-semibold text-slate-900">{student.fullName}</p>
          <div className="mt-1 grid gap-1 text-xs text-slate-600 sm:grid-cols-2">
            <p>Father: <strong>{student.fatherName}</strong></p>
            <p>Roll: <strong className="font-mono">{student.rollNumber}</strong></p>
            <p>Application: <strong className="font-mono">{student.applicationNo}</strong></p>
            <p>Class: <strong>{student.currentClass}</strong></p>
            <p className="sm:col-span-2">School: <strong>{student.schoolName}</strong></p>
          </div>
          <div className="mt-3 border-t border-slate-200 pt-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Manually recorded total to verify</p>
            <p className="mt-1 text-3xl font-bold tabular-nums text-[#0c355a]">{score ?? '—'} <span className="text-base font-medium text-slate-600">/ 100</span></p>
            <p className="mt-1 text-xs text-slate-500">Session V (2026) · Original entry is immutable · No OMR scan is claimed</p>
          </div>
        </div>
        <p role="note" className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950">
          <AlertTriangle size={17} className="mt-0.5 shrink-0" />
          This verifies the existing manually entered score. Review the original signed marks register, registration identity and attendance before proceeding. A signed audit will be appended without changing any marks.
        </p>

        {confirming ? (
          <div className="space-y-3 rounded-lg border-2 border-[#185b9d] bg-blue-50 p-4 text-xs leading-5 text-slate-800">
            <h3 className="flex items-center gap-2 font-bold text-[#0c355a]"><ShieldCheck size={17} /> Final confirmation</h3>
            <p>You are verifying <strong>{score} / 100</strong> for <strong>{student.fullName}</strong> against independently reviewed manual examination evidence.</p>
            <p><strong>Verification evidence:</strong> {evidenceReference.trim()}</p>
            <p><strong>Findings:</strong> {reason.trim()}</p>
            <p><strong>Checks:</strong> Identity, examination attendance and original manual-score evidence all reviewed.</p>
            <p className="font-semibold text-rose-800">Verification is an immutable audit event. It does not edit marks or issue the regional Official / Original DMC.</p>
          </div>
        ) : (
          <>
            <fieldset className="space-y-2">
              <legend className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-800"><ClipboardCheck size={16} /> Confirm each examination check</legend>
              {([
                ['Student registration, roll number, class and identity match the signed examination record.', identityReviewed, setIdentityReviewed],
                ['Examination attendance and student eligibility have been checked against the register.', attendanceReviewed, setAttendanceReviewed],
                ['The manual score and original signed mark sheet have been checked independently and match exactly.', marksEvidenceReviewed, setMarksEvidenceReviewed],
              ] as const).map(([label, checked, setChecked]) => (
                <label key={label} className="flex cursor-pointer items-start gap-2 rounded-md border border-slate-200 p-3 text-xs leading-5 text-slate-700">
                  <input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)}
                    disabled={busy} className="mt-0.5 h-4 w-4 shrink-0 accent-[#18723e]" />
                  <span>{label}</span>
                </label>
              ))}
            </fieldset>
            <label className="block text-xs font-semibold text-slate-800">
              Supporting evidence reference (10–500 characters)
              <input data-autofocus type="text" minLength={10} maxLength={500} required
                className={attendanceField + ' mt-1.5'} value={evidenceReference}
                placeholder="Signed mark register or examination officer review reference"
                onChange={e => { setEvidenceReference(e.target.value); setError(''); }} disabled={busy} />
            </label>
            <label className="block text-xs font-semibold text-slate-800">
              Verification reason and findings (30–1000 characters)
              <textarea rows={4} minLength={30} maxLength={1000} required
                className={attendanceField + ' mt-1.5 resize-y'} value={reason}
                placeholder="Describe how the student, exam attendance, and original marked score were independently confirmed."
                onChange={e => { setReason(e.target.value); setError(''); }} disabled={busy} />
            </label>
          </>
        )}
        {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">{error}</p>}
        <p className="flex items-center gap-1.5 text-xs text-slate-600"><ShieldCheck size={15} /> Active Super Admin authorization and identity snapshots are rechecked by the database.</p>
      </div>
    </AttendanceDialog>
  );
}
