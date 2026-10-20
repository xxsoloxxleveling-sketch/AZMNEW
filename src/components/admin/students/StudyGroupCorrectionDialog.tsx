import React, { useEffect, useRef, useState } from 'react';
import { mockApi, MockStudent } from '../../../lib/mockApi';
import { HSSC_GROUP_OPTIONS, getStudyClassLabel, resolveHsscGroup, STUDY_GROUP_REQUIRED } from '../../../utils/hsscGroup';

export function StudyGroupCorrectionDialog({ student, authorized, onClose, onSaved }: {
  student: MockStudent; authorized: boolean; onClose: () => void; onSaved: (student: MockStudent) => void;
}) {
  const [current, setCurrent] = useState<MockStudent | null>(null);
  const [group, setGroup] = useState('');
  const [basis, setBasis] = useState('');
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [error, setError] = useState('');
  const [field, setField] = useState('');
  const dialog = useRef<HTMLDivElement>(null);
  const load = async () => {
    setBusy(true); setError('');
    try {
      const saved = await mockApi.getStudentById(student.id);
      setCurrent(saved); setGroup(resolveHsscGroup(saved).group || ''); setConflict(false);
    } catch (err: any) { setError(err.message || 'Could not reload this student.'); }
    finally { setBusy(false); }
  };
  useEffect(() => { if (authorized) void load(); }, [student.id, authorized]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    return () => previous?.focus();
  }, []);
  if (!authorized) return null;
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || !current || conflict) return;
    if (!group) { setField('hsscGroup'); setError(STUDY_GROUP_REQUIRED); return; }
    if (basis.trim().length < 3) { setField('correctionBasis'); setError('Enter the confirmation or documentary source for this correction.'); return; }
    setBusy(true); setError(''); setField('');
    try {
      await mockApi.updateStudent(current.id, { hsscGroup: group, expectedUpdatedAt: current.updatedAt, correctionBasis: basis.trim() });
      const rechecked = await mockApi.getStudentById(current.id);
      if (resolveHsscGroup(rechecked).group !== group) throw new Error('The saved group could not be confirmed. Reload and recheck this record.');
      window.dispatchEvent(new Event('students-updated'));
      onSaved(rechecked); onClose();
    } catch (err: any) {
      setError(err.details?.hsscGroup?.join(' ') || err.details?.correctionBasis?.join(' ') || err.message || 'The correction could not be saved. Your selection is retained.');
      setField(err.details?.hsscGroup ? 'hsscGroup' : err.details?.correctionBasis ? 'correctionBasis' : '');
      if (err.code === 'STUDENT_EDIT_CONFLICT') setConflict(true);
    } finally { setBusy(false); }
  };
  return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 p-3">
    <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="study-group-title" tabIndex={-1}
      className="max-h-[94dvh] w-full max-w-lg overflow-y-auto rounded-lg border border-slate-300 bg-white p-5 text-sm text-slate-900"
      onKeyDown={event => {
        if (event.key === 'Escape' && !busy) onClose();
        if (event.key === 'Tab') {
          const nodes = Array.from(dialog.current?.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled)') || []) as HTMLElement[];
          const first = nodes[0], last = nodes.at(-1);
          if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
      }}>
      <h2 id="study-group-title" className="text-base font-semibold">Update study group</h2>
      <dl className="my-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-xs">
        <dt className="text-slate-500">Application / roll</dt><dd>{student.applicationNo} / {student.rollNumber || 'Not issued'}</dd>
        <dt className="text-slate-500">Class</dt><dd>{getStudyClassLabel(current?.currentClass || student.currentClass)}</dd>
        <dt className="text-slate-500">Saved raw value</dt><dd className="break-words">{current ? current.hsscGroup || '(empty)' : 'Loading…'}</dd>
        <dt className="text-slate-500">Review status</dt><dd>{current ? resolveHsscGroup(current).status : 'Loading…'}</dd>
      </dl>
      <form onSubmit={save} noValidate>
        <label htmlFor="correction-group" className="mb-1 block text-xs font-semibold">Study group *</label>
        <select id="correction-group" required value={group} disabled={busy || !current || conflict}
          aria-invalid={field === 'hsscGroup'} aria-describedby={field === 'hsscGroup' ? 'correction-error' : undefined}
          onChange={e => setGroup(e.target.value)} className="mb-3 h-9 w-full rounded-lg border border-slate-300 bg-white px-2 focus:outline-none focus:ring-2 focus:ring-[#185b9d]">
          <option value="">Select study group</option>
          {HSSC_GROUP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <label htmlFor="correction-basis" className="mb-1 block text-xs font-semibold">Confirmation / documentary source *</label>
        <input id="correction-basis" required value={basis} maxLength={500} disabled={busy || conflict}
          aria-invalid={field === 'correctionBasis'} aria-describedby="correction-source-help correction-error"
          onChange={e => setBasis(e.target.value)} className="h-9 w-full rounded-lg border border-slate-300 px-2 focus:outline-none focus:ring-2 focus:ring-[#185b9d]" />
        <p id="correction-source-help" className="mt-1 text-xs text-slate-500">Record how staff verified the current group. Do not enter CNIC numbers or private document contents.</p>
        {error && <p id="correction-error" role="alert" className="mt-3 text-xs text-red-700">{error}</p>}
        {(conflict || (!current && !busy)) && <button type="button" onClick={load} className="mt-2 text-xs font-semibold text-[#185b9d] underline">Reload current record</button>}
        <div className="mt-5 flex justify-end gap-2 border-t border-slate-200 pt-3">
          <button type="button" disabled={busy} onClick={onClose} className="rounded-lg border border-slate-300 px-3 py-2 text-xs hover:bg-slate-50 focus:ring-2 focus:ring-[#185b9d]">Cancel</button>
          <button type="submit" disabled={busy || !current || conflict} className="rounded-lg bg-[#185b9d] px-3 py-2 text-xs font-semibold text-white hover:bg-[#13497d] focus:ring-2 focus:ring-[#185b9d] disabled:opacity-50">{busy ? 'Checking…' : 'Save and recheck'}</button>
        </div>
      </form>
    </div>
  </div>;
}
