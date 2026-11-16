import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, FileText, ShieldCheck } from 'lucide-react';
import { AttendanceDialog, attendanceField, attendancePrimary, attendanceSecondary } from '../attendance/AttendanceDialog';
import { mockApi, type MockStudent } from '../../../lib/mockApi';

export function ManualExamMarksDialog({
  student, onClose, onSaved,
}: {
  student: MockStudent;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [marks, setMarks] = useState('');
  const [evidenceReference, setEvidenceReference] = useState('');
  const [reason, setReason] = useState('');
  const [identityReviewed, setIdentityReviewed] = useState(false);
  const [attendanceReviewed, setAttendanceReviewed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const noExistingMark = !student.provisionalOmr && !student.manualExamMark
    && (student.testScore === null || student.testScore === undefined);
  const validMark = /^(100|[1-9]?\d)$/.test(marks);
  const canReview = noExistingMark && Boolean(student.rollNumber) && Boolean(student.applicationNo)
    && validMark && evidenceReference.trim().length >= 10
    && evidenceReference.trim().length <= 500
    && reason.trim().length >= 30 && reason.trim().length <= 1000
    && identityReviewed && attendanceReviewed && !busy;

  const save = async () => {
    if (!canReview || !confirming) return;
    setError(''); setBusy(true);
    try {
      await mockApi.addManualExamMark(student.id, {
        obtainedMarks: Number(marks),
        evidenceReference: evidenceReference.trim(),
        reason: reason.trim(),
        identityReviewed: true,
        attendanceReviewed: true,
      });
      await onSaved();
      onClose();
    } catch (cause) {
      setConfirming(false);
      setError(cause instanceof Error ? cause.message : 'The mark could not be recorded. Refresh the student roster and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AttendanceDialog
      title={confirming ? 'Confirm new examination marks' : 'Add missing examination marks'}
      busy={busy}
      onClose={onClose}
      footer={<>
        <button type="button" className={attendanceSecondary} disabled={busy}
          onClick={confirming ? () => setConfirming(false) : onClose}>
          {confirming ? 'Back to edit' : 'Cancel'}
        </button>
        <button type="button" className={attendancePrimary} disabled={!canReview}
          onClick={() => confirming ? void save() : setConfirming(true)}>
          {busy ? 'Recording marks…' : confirming ? 'Confirm & record marks' : 'Review manual entry'}
        </button>
      </>}
    >
      <div className="space-y-4 text-sm">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-sm font-bold text-slate-900">{student.fullName}</p>
          <div className="mt-1 grid gap-x-3 gap-y-1 text-xs text-slate-600 sm:grid-cols-2">
            <span>Father: <strong>{student.fatherName || 'Not recorded'}</strong></span>
            <span>Roll: <strong className="font-mono">{student.rollNumber || 'Not issued'}</strong></span>
            <span>Application: <strong className="font-mono">{student.applicationNo || 'Not recorded'}</strong></span>
            <span>Class: <strong>{student.currentClass}</strong></span>
            <span className="sm:col-span-2">School: <strong>{student.schoolName || 'Not recorded'}</strong></span>
            <span className="sm:col-span-2">Examination session: <strong>Session V 2026</strong></span>
          </div>
        </div>

        <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950">
          <AlertTriangle size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
          <p>This creates a <strong>new, immutable manual score record</strong> for a student without imported marks. It will appear in public current results as <strong>Review pending</strong>, not a verified E-DMC. It never overwrites an existing score or invents an OMR scan.</p>
        </div>

        {confirming ? (
          <div className="space-y-3 rounded-lg border-2 border-[#185b9d] bg-blue-50 p-4">
            <h3 className="flex items-center gap-2 font-bold text-[#0c355a]"><ShieldCheck size={17} /> Final confirmation</h3>
            <p className="text-xs text-slate-700">You are recording <strong>{marks} / 100</strong> for <strong>{student.fullName}</strong> as an independently documented manual entry.</p>
            <div className="grid gap-2 text-xs text-slate-700">
              <p><strong>Evidence:</strong> {evidenceReference.trim()}</p>
              <p><strong>Reason:</strong> {reason.trim()}</p>
              <p><strong>Review:</strong> Registration identity and attendance/evidence confirmed.</p>
            </div>
            <p className="text-xs font-semibold text-rose-800">This action is append-only. You cannot use it to change a previously awarded score.</p>
          </div>
        ) : (
          <>
            <label className="block text-xs font-semibold text-slate-700">
              Obtained marks (out of 100)
              <input type="number" inputMode="numeric" min={0} max={100} step={1}
                required data-autofocus value={marks}
                onChange={event => { setMarks(event.target.value); setError(''); }}
                placeholder="Enter 0–100" className={attendanceField + ' mt-1.5'} />
              <span className="mt-1 block text-[11px] font-normal text-slate-500">Enter a whole number. Below 60 = Fail; 60 or above = Pass.</span>
            </label>
            <label className="block text-xs font-semibold text-slate-700">
              Evidence reference (required)
              <input type="text" minLength={10} maxLength={500} required
                value={evidenceReference} onChange={event => { setEvidenceReference(event.target.value); setError(''); }}
                placeholder="Signed mark sheet, examiner register or approved record ID"
                className={attendanceField + ' mt-1.5'} />
              <span className="mt-1 block text-[11px] font-normal text-slate-500">Record where the examination evidence can be checked; do not include confidential credentials.</span>
            </label>
            <label className="block text-xs font-semibold text-slate-700">
              Detailed reason (required, 30–1000 characters)
              <textarea rows={4} minLength={30} maxLength={1000} required
                value={reason} onChange={event => { setReason(event.target.value); setError(''); }}
                placeholder="Explain why no OMR score exists, who checked the result and which evidence supports the manual score."
                className={attendanceField + ' mt-1.5 resize-y'} />
              <span className="mt-1 block text-[11px] font-normal text-slate-500">{reason.trim().length}/1000 characters</span>
            </label>
            <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 p-3 text-xs text-slate-700">
              <input type="checkbox" checked={identityReviewed} onChange={e => setIdentityReviewed(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[#18723e]" />
              <span><CheckCircle2 size={13} className="mr-1 inline text-[#18723e]" /> I have matched the student name, application and official roll number against the examination register.</span>
            </label>
            <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 p-3 text-xs text-slate-700">
              <input type="checkbox" checked={attendanceReviewed} onChange={e => setAttendanceReviewed(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[#18723e]" />
              <span><FileText size={13} className="mr-1 inline text-[#18723e]" /> I have reviewed the examination attendance and supporting result evidence before entering this score.</span>
            </label>
          </>
        )}

        {!noExistingMark && (
          <p role="alert" className="rounded-lg bg-rose-50 p-3 text-xs font-semibold text-rose-700">
            This student already has recorded examination marks. Use the existing audited correction workflow rather than Add Marks.
          </p>
        )}
        {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-xs font-semibold text-rose-700">{error}</p>}
        <p className="text-xs text-slate-500"><ShieldCheck size={14} className="mr-1 inline" /> Only an active Super Admin can record this entry. The database saves your identity, time, evidence and reason.</p>
      </div>
    </AttendanceDialog>
  );
}
