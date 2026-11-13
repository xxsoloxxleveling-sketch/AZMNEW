import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, FilePlus2, Loader2, RefreshCw } from 'lucide-react';
import { useAuth } from '../../lib/authContext';
import {
  createOfficialDraftResult,
  getOfficialExaminations,
  getStudentOfficialResults,
} from './ResultsApi';
import type { OfficialExaminationOption, OfficialResultSummary } from './ResultsApi';
import { OfficialResultDetailPanel } from './OfficialResultDetailPanel';

interface Props {
  studentId: string;
  studentName: string;
  rollNumber: string | null;
  applicationNo: string;
  classGroup: string;
  initialResultId?: string;
  onReturnToResultsDashboard?: (context: { studentId: string; resultId: string; examinationId: string }) => void;
}

const fieldClass = 'mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal focus:border-[#185b9d] focus:outline-none focus:ring-2 focus:ring-blue-100';

export function OfficialResultsProfileSection({ studentId, studentName, rollNumber, applicationNo, classGroup, initialResultId, onReturnToResultsDashboard }: Props) {
  const { role } = useAuth();
  const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';
  const canEdit = role === 'SUPER_ADMIN';
  const [history, setHistory] = useState<OfficialResultSummary[]>([]);
  const [exams, setExams] = useState<OfficialExaminationOption[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showEntry, setShowEntry] = useState(false);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [resultReference, setResultReference] = useState('');
  const [paperVersion, setPaperVersion] = useState('');
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (preferredId?: string) => {
    if (!isAdmin) {
      setHistory([]);
      setSelectedId('');
      setLoading(false);
      return;
    }
    if (!studentId) {
      setHistory([]);
      setError('This profile does not have a valid immutable student ID.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await getStudentOfficialResults(studentId);
      setHistory(data);
      setSelectedId((current) => {
        const next = preferredId || current;
        return next && data.some((item) => item.id === next) ? next : data[0]?.id ?? '';
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load the student’s examination history.');
    } finally { setLoading(false); }
  }, [studentId, isAdmin]);

  useEffect(() => { void load(initialResultId); }, [load, initialResultId]);

  useEffect(() => {
    if (!showEntry || !canEdit) return;
    let cancelled = false;
    getOfficialExaminations().then((data) => {
      if (cancelled) return;
      setExams(data);
      const matchingExams = data.filter((item) => item.classGroup === classGroup && item.publicationStatus !== 'WITHHELD');
      setSelectedExamId((current) => current && matchingExams.some((item) => item.id === current) ? current : matchingExams[0]?.id ?? '');
    }).catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : 'Could not load examination options.'); });
    return () => { cancelled = true; };
  }, [showEntry, canEdit, classGroup]);

  const createDraft = async () => {
    if (!selectedExamId || resultReference.trim().length < 3 || saving) return;
    if (!/^[A-Za-z0-9_-]{2,64}$/.test(resultReference.trim())) {
      setError('Use 2–64 letters, numbers, dashes, or underscores for the result reference.');
      return;
    }
    setSaving(true); setError('');
    try {
      const created = await createOfficialDraftResult(selectedExamId, {
        studentId,
        resultReference: resultReference.trim(),
        paperVersion: paperVersion.trim() || null,
        administrativeRemarks: remarks.trim() || null,
      });
      setShowEntry(false); setResultReference(''); setPaperVersion(''); setRemarks('');
      await load(created.id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Draft result could not be recorded.'); }
    finally { setSaving(false); }
  };

  const selectedResult = history.find((row) => row.id === selectedId) ?? null;

  return (
    <section id="student-examination-results" tabIndex={-1} aria-labelledby="student-examination-results-heading" className="scroll-mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Official, exam-specific records</p>
          <h3 id="student-examination-results-heading" className="mt-1 text-base font-bold text-slate-900">Examination Results</h3>
          <p className="mt-1 text-xs text-slate-600">{studentName} · {rollNumber || applicationNo} · {classGroup}</p>
        </div>
        <div className="flex gap-2">
          {initialResultId && onReturnToResultsDashboard && <button type="button" onClick={() => {
            const result = history.find((item) => item.id === selectedId);
            if (result) onReturnToResultsDashboard({ studentId, resultId: result.id, examinationId: result.examinationId });
          }} disabled={!history.some((item) => item.id === selectedId)} className="rounded-md border border-blue-300 bg-blue-50 px-2.5 py-2 text-xs font-semibold text-[#185b9d] disabled:opacity-40">Return to Results</button>}
          <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2.5 py-2 text-xs font-semibold text-slate-700 disabled:opacity-40"><RefreshCw size={13} /> Refresh</button>
          {canEdit && <button type="button" onClick={() => { setShowEntry((value) => !value); setError(''); }} className="inline-flex items-center gap-1.5 rounded-md bg-[#185b9d] px-3 py-2 text-xs font-semibold text-white"><FilePlus2 size={14} /> Enter draft result</button>}
        </div>
      </header>

      {!isAdmin && <p className="mt-3 border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950">Your account does not have an explicitly assigned examination-results scope. No result details are shown.</p>}

      {showEntry && canEdit && <section className="mt-4 rounded-md border border-blue-200 bg-blue-50/40 p-3" aria-label="Enter draft examination result">
        <div className="flex items-start justify-between gap-3"><div><h4 className="text-sm font-semibold text-slate-900">Enter draft result</h4><p className="mt-1 text-xs text-slate-600">Creates an unpublished result linked by this immutable student ID and an exact examination ID. It does not calculate marks or change student records.</p></div><button type="button" onClick={() => setShowEntry(false)} className="rounded border border-slate-300 px-2 py-1 text-xs">Close</button></div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold text-slate-700">Examination
            <select value={selectedExamId} onChange={(event) => { setSelectedExamId(event.target.value); setPaperVersion(''); }} className={fieldClass} disabled={!exams.some((exam) => exam.classGroup === classGroup && exam.publicationStatus !== 'WITHHELD')}>
              {!exams.some((exam) => exam.classGroup === classGroup && exam.publicationStatus !== 'WITHHELD') && <option value="">No matching examination metadata available</option>}
              {exams.filter((exam) => exam.classGroup === classGroup && exam.publicationStatus !== 'WITHHELD').map((exam) => <option value={exam.id} key={exam.id}>{exam.reference} · {exam.title} · {exam.classGroup} · Versions {exam.paperVersions.join('/')}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-700">Result reference
            <input className={fieldClass} maxLength={64} value={resultReference} onChange={(event) => setResultReference(event.target.value)} placeholder="Unique official reference" />
          </label>
          <label className="text-xs font-semibold text-slate-700">Paper version (optional)
            <select className={fieldClass} value={paperVersion} onChange={(event) => setPaperVersion(event.target.value)} disabled={!selectedExamId}>
              <option value="">Unrecorded</option>
              {(exams.find((exam) => exam.id === selectedExamId)?.paperVersions ?? []).map((version) => <option key={version} value={version}>{version}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-700">Administrative remarks (optional)
            <input className={fieldClass} maxLength={1000} value={remarks} onChange={(event) => setRemarks(event.target.value)} placeholder="Result-specific note" />
          </label>
        </div>
        <div className="mt-3 flex justify-end"><button type="button" disabled={saving || !selectedExamId || resultReference.trim().length < 3} onClick={() => void createDraft()} className="rounded-md bg-[#185b9d] px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">{saving ? 'Creating…' : 'Create unpublished draft'}</button></div>
      </section>}

      {loading ? <div className="flex items-center gap-2 py-5 text-sm text-slate-600"><Loader2 size={16} className="animate-spin" />Loading examination history…</div> : error && !history.length ? <div role="alert" className="mt-3 flex items-start gap-2 border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900"><AlertCircle size={14} className="mt-0.5 shrink-0" /><p>{error}</p></div> : !history.length ? <p className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-5 text-center text-sm text-slate-700">No examination result has been recorded for this student.</p> : <>
        <div className="mt-4 overflow-x-auto rounded-md border border-slate-200">
          <table className="w-full min-w-[780px] text-left text-xs"><thead className="bg-slate-50 text-slate-600"><tr><th className="px-3 py-2.5">Examination / session</th><th className="px-3 py-2.5">Exam date</th><th className="px-3 py-2.5">Marks</th><th className="px-3 py-2.5">Identity / verification</th><th className="px-3 py-2.5">Publication</th><th className="px-3 py-2.5">Documents</th></tr></thead><tbody className="divide-y divide-slate-100">
            {history.map((item) => <tr key={item.id} className={selectedId === item.id ? 'bg-blue-50/60' : 'hover:bg-slate-50'}>
              <td className="px-3 py-2.5"><button type="button" onClick={() => setSelectedId(item.id)} className="font-semibold text-[#185b9d] underline-offset-2 hover:underline">{item.examination.title}</button><p className="mt-0.5 text-[11px] text-slate-500">{item.examination.reference} · revision {item.resultRevision}</p></td>
              <td className="px-3 py-2.5">{item.examination.examDate || 'Unavailable'}</td>
              <td className="px-3 py-2.5 font-semibold">{item.obtainedMarks === null ? 'Unavailable' : `${item.obtainedMarks} / ${item.maximumMarks}`}</td>
              <td className="px-3 py-2.5">{item.identityStatus} · {item.verificationStatus}</td>
              <td className="px-3 py-2.5">{item.publicationStatus === 'PUBLISHED' ? 'Published' : item.publicationStatus === 'WITHHELD' ? 'Withheld' : 'Awaiting verification or publication'}</td>
              <td className="px-3 py-2.5">{item.documents.latestOfficialIssuanceStatus === 'ISSUED' ? 'Official DMC issued' : item.documents.latestOfficialIssuanceStatus === 'SUPERSEDED' ? 'Previous DMC superseded' : 'Official DMC not issued'}</td>
            </tr>)}
          </tbody></table>
        </div>
        {selectedResult && <div className="mt-4"><OfficialResultDetailPanel resultId={selectedResult.id} source="STUDENT_PROFILE" canEdit={canEdit} onResultChanged={() => void load(selectedResult.id)} /></div>}
      </>}
      {error && history.length > 0 && <p role="alert" className="mt-3 text-xs text-red-800">{error}</p>}
    </section>
  );
}
