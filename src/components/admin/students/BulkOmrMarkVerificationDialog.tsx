import React, { useState } from 'react';
import { BadgeCheck, AlertTriangle } from 'lucide-react';
import { AttendanceDialog, attendanceField, attendancePrimary, attendanceSecondary } from '../attendance/AttendanceDialog';
import { mockApi, type MockStudent } from '../../../lib/mockApi';

type Outcome = {
  verified: Array<{ studentId: string; verifiedMarks: number; verificationId: string }>;
  failed: Array<{ studentId: string; message: string }>;
  total: number;
};

export function BulkOmrMarkVerificationDialog({
  students, onClose, onCompleted,
}: {
  students: MockStudent[];
  onClose: () => void;
  onCompleted: (verifiedIds: string[]) => void;
}) {
  const [evidenceReference, setEvidenceReference] = useState('');
  const [reason, setReason] = useState('');
  const [identityReviewed, setIdentityReviewed] = useState(false);
  const [paperVersionReviewed, setPaperVersionReviewed] = useState(false);
  const [printedClassReviewed, setPrintedClassReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const names = new Map(students.map(student => [student.id, student.fullName]));
  const canSubmit = !busy && !outcome && students.length > 0 && students.length <= 100
    && evidenceReference.trim().length >= 10 && evidenceReference.trim().length <= 500
    && reason.trim().length >= 30 && reason.trim().length <= 1000
    && identityReviewed && paperVersionReviewed && printedClassReviewed;

  async function verify() {
    if (!canSubmit) return;
    setBusy(true);
    setError('');
    try {
      const result = await mockApi.verifySelectedOmrMarks({
        students: students.map(student => ({
          studentId: student.id, expectedCurrentMarks: student.testScore as number,
        })),
        evidenceReference: evidenceReference.trim(),
        reason: reason.trim(),
        identityReviewed: true, paperVersionReviewed: true, printedClassReviewed: true,
      });
      setOutcome(result);
      onCompleted(result.verified.map(item => item.studentId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not complete this batch.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AttendanceDialog
      title={outcome ? 'Verification results' : 'Verify selected students (' + students.length + ')'}
      busy={busy}
      onClose={onClose}
      footer={outcome ? (
        <button type="button" className={attendancePrimary} onClick={onClose}>Done</button>
      ) : (
        <>
          <button type="button" className={attendanceSecondary} disabled={busy} onClick={onClose}>Cancel</button>
          <button type="button" className={attendancePrimary} disabled={!canSubmit} onClick={() => void verify()}>
            <BadgeCheck size={15} className="mr-1 inline" />
            {busy ? 'Verifying selected students…' : 'Confirm & verify all (' + students.length + ')'}
          </button>
        </>
      )}
    >
      <div className="space-y-4 text-sm">
        {outcome ? (
          <>
            <p className="font-semibold text-emerald-800">Successfully verified {outcome.verified.length} of {outcome.total} students.</p>
            {outcome.failed.length > 0 && (
              <section className="rounded-lg border border-amber-300 p-3">
                <p className="font-semibold text-amber-900">{outcome.failed.length} student(s) still require review</p>
                <ul className="mt-2 max-h-52 space-y-2 overflow-auto text-xs">
                  {outcome.failed.map(item => (
                    <li key={item.studentId}><strong>{names.get(item.studentId) ?? 'Student'}</strong>: {item.message}</li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-slate-600">These records remain unverified. Refresh the roster and review their evidence individually.</p>
              </section>
            )}
          </>
        ) : (
          <>
            <p className="text-slate-700">Review all selected students below, then submit once. Every successfully verified record receives its own immutable audit. Existing marks are not changed.</p>
            <div className="max-h-48 overflow-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-100">
                  <tr><th className="px-3 py-2">Student</th><th className="px-3 py-2">Roll Number</th><th className="px-3 py-2 text-right">Marks</th></tr>
                </thead>
                <tbody>{students.map(student => (
                  <tr key={student.id} className="border-t border-slate-100">
                    <td className="px-3 py-2">{student.fullName}</td>
                    <td className="px-3 py-2">{student.rollNumber || student.applicationNo}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{student.testScore} / 100</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950">
              <AlertTriangle size={15} className="mr-1 inline" />
              Only confirm after examining the actual OMR and registration evidence for <strong>every selected student</strong>. A common batch statement cannot replace those checks.
            </div>
            <fieldset className="space-y-2">
              <legend className="mb-1 text-xs font-semibold">All three checks completed for every selected student</legend>
              <label className="flex gap-2 text-xs"><input type="checkbox" checked={identityReviewed} disabled={busy} onChange={e => setIdentityReviewed(e.target.checked)} />Each student identity and roll number match the source sheet.</label>
              <label className="flex gap-2 text-xs"><input type="checkbox" checked={paperVersionReviewed} disabled={busy} onChange={e => setPaperVersionReviewed(e.target.checked)} />Each paper version matches the answer key used.</label>
              <label className="flex gap-2 text-xs"><input type="checkbox" checked={printedClassReviewed} disabled={busy} onChange={e => setPrintedClassReviewed(e.target.checked)} />Each printed class was checked and any mismatch resolved.</label>
            </fieldset>
            <label className="block text-xs font-semibold">
              Evidence register / batch reference (10–500 characters)
              <input data-autofocus className={attendanceField + ' mt-1'} maxLength={500} value={evidenceReference} disabled={busy}
                onChange={e => setEvidenceReference(e.target.value)} placeholder="Signed OMR review register or archive reference" />
            </label>
            <label className="block text-xs font-semibold">
              Shared verification findings (30–1000 characters)
              <textarea className={attendanceField + ' mt-1 resize-y'} maxLength={1000} rows={3} value={reason} disabled={busy}
                onChange={e => setReason(e.target.value)} placeholder="Describe the source evidence reviewed for all selected students." />
            </label>
          </>
        )}
        {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">{error}</p>}
      </div>
    </AttendanceDialog>
  );
}
