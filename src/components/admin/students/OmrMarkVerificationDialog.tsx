import React, { useState } from 'react';
import { AlertTriangle, BadgeCheck, ClipboardCheck, ShieldCheck } from 'lucide-react';
import { AttendanceDialog, attendanceField, attendancePrimary, attendanceSecondary } from '../attendance/AttendanceDialog';
import { mockApi, type MockStudent } from '../../../lib/mockApi';

export function OmrMarkVerificationDialog({
  student, onClose, onVerified,
}: {
  student: MockStudent;
  onClose: () => void;
  onVerified: () => void | Promise<void>;
}) {
  const [evidenceReference, setEvidenceReference] = useState('');
  const [reason, setReason] = useState('');
  const [identityReviewed, setIdentityReviewed] = useState(false);
  const [paperVersionReviewed, setPaperVersionReviewed] = useState(false);
  const [printedClassReviewed, setPrintedClassReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const mark = student.provisionalOmr;
  const score = student.testScore;
  const canSubmit = Boolean(mark && !mark.verified && score !== null && score !== undefined
    && Number.isInteger(score) && score >= 0 && score <= 100
    && evidenceReference.trim().length >= 10 && evidenceReference.trim().length <= 500
    && reason.trim().length >= 30 && reason.trim().length <= 1000
    && identityReviewed && paperVersionReviewed && printedClassReviewed && !busy);

  const verify = async () => {
    if (!canSubmit || score === null || score === undefined) return;
    setBusy(true); setError('');
    try {
      await mockApi.verifyOmrMark(student.id, {
        expectedCurrentMarks: score,
        evidenceReference: evidenceReference.trim(),
        reason: reason.trim(),
        identityReviewed: true,
        paperVersionReviewed: true,
        printedClassReviewed: true,
      });
      await onVerified();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not verify this score. Refresh and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AttendanceDialog
      title="Verify final examination marks"
      busy={busy}
      onClose={onClose}
      footer={<>
        <button type="button" className={attendanceSecondary} disabled={busy} onClick={onClose}>Cancel</button>
        <button type="button" className={attendancePrimary} disabled={!canSubmit} onClick={() => { void verify(); }}>
          <BadgeCheck size={15} className="mr-1 inline" /> {busy ? 'Verifying…' : 'Verify final marks'}
        </button>
      </>}
    >
      <div className="space-y-4 text-sm">
        <p className="font-semibold text-slate-900">{student.fullName}
          <span className="ml-2 font-mono text-xs font-normal text-slate-600">
            {student.rollNumber || student.applicationNo}
          </span>
        </p>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Final marks to verify</p>
          <p className="mt-1 text-3xl font-bold tabular-nums text-[#0c355a]">{score ?? '—'} <span className="text-base font-medium text-slate-600">/ 100</span></p>
          <p className="mt-1 text-xs text-slate-600">Original scanned score: {mark?.originalScannedMarks ?? '—'} / 100{mark?.manuallyCorrected ? ' · Administratively corrected' : ''}</p>
        </div>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs leading-5 text-amber-950" role="note">
          <div className="flex items-start gap-2"><AlertTriangle size={17} className="mt-0.5 shrink-0" />
            <div>
              <strong>Examination evidence must be checked before verification.</strong>
              <p className="mt-1">Review category: {mark?.reviewCategory ?? 'Unspecified'} · Identity: {mark?.identityStatus ?? 'Unspecified'} · Paper version: {mark?.paperVersionStatus ?? 'Unspecified'}{mark?.printedClassDisagrees ? ' · Printed class disagreement' : ''}</p>
              <p className="mt-1">A verification is a signed audit event. It does not erase the scanner evidence, change the original score, or issue an Official / Original DMC.</p>
            </div>
          </div>
        </div>
        <fieldset className="space-y-3">
          <legend className="flex items-center gap-2 text-xs font-bold text-slate-800"><ClipboardCheck size={16} /> Required examination checks</legend>
          {([
            ['Identity and roll number checked against the actual OMR sheet and student file.', identityReviewed, setIdentityReviewed],
            ['Correct paper version and marking key checked against the answer sheet.', paperVersionReviewed, setPaperVersionReviewed],
            ['Printed class / examination level checked and any disagreement resolved.', printedClassReviewed, setPrintedClassReviewed],
          ] as const).map(([label, checked, setChecked]) => (
            <label key={label} className="flex cursor-pointer items-start gap-2 rounded-md border border-slate-200 p-2 text-xs leading-5 text-slate-700">
              <input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} disabled={busy}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[#18723e]" />
              <span>{label}</span>
            </label>
          ))}
        </fieldset>
        <label className="block text-xs font-semibold text-slate-800">
          Supporting evidence reference (required, 10–500 characters)
          <input data-autofocus className={attendanceField + ' mt-1.5'} type="text" maxLength={500} value={evidenceReference}
            onChange={e => setEvidenceReference(e.target.value)} disabled={busy}
            placeholder="Original sheet or documented regional review reference" />
        </label>
        <label className="block text-xs font-semibold text-slate-800">
          Verification reason / findings (required, 30–1000 characters)
          <textarea className={attendanceField + ' mt-1.5 resize-y'} rows={4} maxLength={1000} value={reason}
            onChange={e => setReason(e.target.value)} disabled={busy}
            placeholder="Describe the reviewed student identity, answer-sheet version, printed class and why this total is final." />
        </label>
        <p className="flex items-center gap-1.5 text-xs text-slate-600"><ShieldCheck size={15} /> Only an active Super Admin can complete this audit.</p>
        {error && <p className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800" role="alert">{error}</p>}
      </div>
    </AttendanceDialog>
  );
}
