import React, { useEffect, useRef, useState } from 'react';
import { X, Download, Loader2, Printer } from 'lucide-react';
import { apiFetch, apiOpenPdfForPrint } from '../../../lib/apiClient';
import { mockApi, MockStudent } from '../../../lib/mockApi';
import { useAuth } from '../../../lib/authContext';
import { StudyGroupCorrectionDialog } from './StudyGroupCorrectionDialog';
import { getStudyClassLabel } from '../../../utils/hsscGroup';

type Readiness = { readyIds: string[]; unresolved: Array<{ id: string; applicationNo: string; status: string }> };
interface BulkPrintModalProps {
  students: MockStudent[]; type: 'OMR' | 'ROLL_SLIP'; isOpen: boolean; onClose: () => void;
}
export const BulkPrintModal: React.FC<BulkPrintModalProps> = ({ students, type, isOpen, onClose }) => {
  const { role } = useAuth();
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [readyOnly, setReadyOnly] = useState(false);
  const [review, setReview] = useState(false);
  const [correcting, setCorrecting] = useState<MockStudent | null>(null);
  const [revision, setRevision] = useState(0);
  const dialog = useRef<HTMLDivElement>(null);
  const ids = students.map(s => s.id);
  useEffect(() => {
    if (!isOpen || !ids.length) return;
    let active = true;
    setChecking(true); setReadiness(null); setReadyOnly(false);
    apiFetch<Readiness>('/api/students/print-readiness', { method: 'POST', body: JSON.stringify({ studentIds: ids }) })
      .then(value => { if (active) setReadiness(value); })
      .catch(err => { if (active) setError(err.message || 'Could not check study groups.'); })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, [isOpen, ids.join('|'), revision]);
  useEffect(() => { setError(''); }, [isOpen, ids.join('|')]);
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.focus(); return () => previous?.focus();
  }, [isOpen]);
  if (!isOpen || !students.length) return null;
  const unresolved = readiness?.unresolved || [];
  const printIds = readyOnly ? readiness?.readyIds || [] : ids;
  const disabled = busy || checking || !readiness || !printIds.length || (!!unresolved.length && !readyOnly);
  const isOmr = type === 'OMR';
  const generate = async (print: boolean) => {
    if (disabled) return;
    setBusy(true); setError('');
    try {
      if (print) await apiOpenPdfForPrint(isOmr ? '/api/students/bulk-omr-pdf' : '/api/students/bulk-roll-slips-pdf', { method: 'POST', body: { studentIds: printIds } });
      else if (isOmr) await mockApi.downloadBulkOmrPdf(printIds);
      else await mockApi.downloadBulkRollSlipsPdf(printIds);
    } catch (err: any) { setRevision(value => value + 1); setError(err.message || 'Could not generate documents. Recheck the selected students.'); }
    finally { setBusy(false); }
  };
  const unissued = students.filter(s => !s.rollNumber || s.rollNumberStatus === 'PROVISIONAL').length;
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3">
    {correcting && <StudyGroupCorrectionDialog student={correcting} authorized={role === 'ADMIN' || role === 'SUPER_ADMIN'} onClose={() => setCorrecting(null)} onSaved={() => setRevision(value => value + 1)} />}
    <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="bulk-print-title" className="max-h-[94dvh] w-full max-w-2xl overflow-y-auto rounded-lg border border-slate-300 bg-white text-slate-900"
      onKeyDown={event => {
        if (event.key === 'Escape' && !busy && !correcting) onClose();
        if (event.key === 'Tab' && !correcting) {
          const nodes = Array.from(dialog.current?.querySelectorAll('button:not(:disabled)') || []) as HTMLElement[];
          if (event.shiftKey && (document.activeElement === nodes[0] || document.activeElement === dialog.current)) { event.preventDefault(); nodes.at(-1)?.focus(); }
          else if (!event.shiftKey && document.activeElement === nodes.at(-1)) { event.preventDefault(); nodes[0]?.focus(); }
        }
      }}>
      <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
        <h2 id="bulk-print-title" className="text-base font-semibold">{isOmr ? 'Print OMR sheets' : 'Print roll number slips'} · {students.length} selected</h2>
        <button type="button" disabled={busy} aria-label="Close batch printing" onClick={onClose} className="rounded p-1.5 hover:bg-slate-100 focus:ring-2 focus:ring-[#185b9d]"><X size={18} /></button>
      </header>
      <div className="space-y-3 p-5 text-xs">
        {error && <p role="alert" className="text-red-700">{error}</p>}
        {checking && <p role="status">Checking selected students…</p>}
        {!readiness && !checking && <button type="button" onClick={() => setRevision(value => value + 1)} className="font-semibold text-[#185b9d] underline">Recheck groups</button>}
        {readiness && <div aria-live="polite" className="border-b border-slate-200 pb-3">
          <strong>{readiness.readyIds.length} ready to print. {unresolved.length} students need a study group.</strong>
          {!!unresolved.length && <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={() => setReview(value => !value)} className="rounded-lg border border-slate-300 px-3 py-1.5 font-semibold text-[#185b9d] hover:bg-slate-50">Review groups</button>
            {!!readiness.readyIds.length && !readyOnly && <button type="button" onClick={() => setReadyOnly(true)} className="rounded-lg border border-slate-300 px-3 py-1.5 font-semibold text-[#185b9d] hover:bg-slate-50">Print {readiness.readyIds.length} ready students</button>}
          </div>}
          {readyOnly && <p role="status" className="mt-2 text-amber-800">Only {printIds.length} ready students will be included. Excluded: {unresolved.map(s => s.applicationNo).join(', ')}. <button type="button" onClick={() => setReadyOnly(false)} className="underline">Restore full selection</button></p>}
        </div>}
        {unissued > 0 && <p className="border-l-2 border-amber-400 pl-3 text-amber-900">{unissued} candidates have no official roll number. Their sheets retain the pre-issue warning and stable reserved candidate number.</p>}
        <div className="max-h-64 overflow-y-auto divide-y divide-slate-200 border-y border-slate-200" aria-label="Selected candidates and exclusions">
          {students.map((student, index) => {
            const missing = unresolved.find(s => s.id === student.id);
            return <div key={student.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div><strong>{index + 1}. {student.fullName}</strong><br /><span className="text-slate-500">{student.applicationNo} · {getStudyClassLabel(student.currentClass)}</span></div>
              <div className={missing ? 'text-amber-800' : 'text-slate-600'}>{checking || !readiness ? 'Checking' : missing ? readyOnly ? 'Excluded: group needs review' : 'Group needs review' : 'Ready'}
                {review && missing && (role === 'ADMIN' || role === 'SUPER_ADMIN') && <button type="button" onClick={() => setCorrecting(student)} className="ml-3 font-semibold text-[#185b9d] underline">Update study group</button>}
              </div>
            </div>;
          })}
        </div>
        <p className="text-slate-500">Each selected candidate receives one A4 page. Group readiness is checked again when generating the PDF.</p>
      </div>
      <footer className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-5 py-3">
        <button type="button" onClick={onClose} disabled={busy} className="rounded-lg border border-slate-300 px-3 py-2 text-xs hover:bg-slate-50">Cancel</button>
        <button type="button" onClick={() => generate(true)} disabled={disabled} className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs hover:bg-slate-50 disabled:opacity-50"><Printer size={14} />Print ({printIds.length})</button>
        <button type="button" onClick={() => generate(false)} disabled={disabled} className="flex items-center gap-2 rounded-lg bg-[#185b9d] px-3 py-2 text-xs font-semibold text-white hover:bg-[#13497d] disabled:opacity-50">{busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}Download PDF ({printIds.length})</button>
      </footer>
    </div>
  </div>;
};
