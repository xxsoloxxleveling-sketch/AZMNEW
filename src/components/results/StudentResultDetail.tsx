import { useMemo } from 'react';
import { Download, Printer, X } from 'lucide-react';
import { DEMO_EXAMINATIONS, buildDemoQuestionRows } from './ResultsDemoData';
import type { DemoStudentResult } from './ResultsTypes';

interface StudentResultDetailProps {
  result: DemoStudentResult;
  onClose: () => void;
  onStatusChange: (result: DemoStudentResult, status: 'Published' | 'Withheld') => void;
}

export function StudentResultDetail({ result, onClose, onStatusChange }: StudentResultDetailProps) {
  const exam = DEMO_EXAMINATIONS.find((item) => item.id === result.examinationId)!;
  const questions = useMemo(() => buildDemoQuestionRows(result), [result]);
  const canPublish = result.status === 'Verified';
  const canWithhold = result.status === 'Verified' || result.status === 'Published';

  return (
    <div role="presentation" className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-slate-950/45 p-3 sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="demo-result-detail-title" className="my-3 w-full max-w-5xl rounded-lg border border-slate-200 bg-white shadow-xl printable-document printable-result">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-6">
          <div><p className="text-[11px] font-bold uppercase tracking-wide text-amber-800">Demonstration record · not official</p><h2 id="demo-result-detail-title" className="mt-1 text-lg font-bold text-slate-900">{result.studentName}</h2><p className="mt-1 font-mono text-xs text-slate-500">{result.rollNumber} · {result.className}</p></div>
          <button type="button" aria-label="Close result details" onClick={onClose} className="rounded p-2 text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400 no-print"><X size={18} /></button>
        </div>
        <div className="space-y-5 px-4 py-4 sm:px-6">
          <dl className="grid grid-cols-2 gap-x-5 gap-y-3 border-b border-slate-200 pb-4 text-xs sm:grid-cols-4">
            <div><dt className="text-slate-500">Examination</dt><dd className="mt-1 font-semibold text-slate-900">{exam.name}</dd></div>
            <div><dt className="text-slate-500">Subject · date</dt><dd className="mt-1 font-semibold text-slate-900">{exam.subject} · {exam.date}</dd></div>
            <div><dt className="text-slate-500">Marks</dt><dd className="mt-1 font-semibold text-slate-900">{result.obtainedMarks === null ? 'Pending / not verified' : `${result.obtainedMarks} / ${result.maximumMarks}`}</dd></div>
            <div><dt className="text-slate-500">Status · review</dt><dd className="mt-1 font-semibold text-slate-900">{result.status}{result.reviewReason ? ` · ${result.reviewReason}` : ''}</dd></div>
          </dl>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs"><span><b>{result.correct}</b> correct · 1 mark</span><span><b>{result.wrong}</b> wrong · 0 marks</span><span><b>{result.multiple}</b> confirmed multiple · 0 marks</span><span><b>{result.blank}</b> blank · 0 marks</span><span><b>{result.uncertain}</b> uncertain · pending review</span></div>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-900">Question review</h3>
            <div className="max-h-[48vh] overflow-auto rounded-md border border-slate-200">
              <table className="w-full min-w-[560px] text-left text-xs"><thead className="sticky top-0 bg-slate-50"><tr className="border-b text-slate-500"><th className="px-3 py-2">Q#</th><th className="px-3 py-2">Detected</th><th className="px-3 py-2">Correct answer</th><th className="px-3 py-2">Result</th><th className="px-3 py-2 text-right">Marks</th></tr></thead><tbody className="divide-y divide-slate-100">{questions.map((question) => <tr key={question.questionNumber}><td className="px-3 py-2">{question.questionNumber}</td><td className="px-3 py-2">{question.detected}</td><td className="px-3 py-2">{question.correct}</td><td className="px-3 py-2">{question.classification}</td><td className="px-3 py-2 text-right">{question.marks === null ? 'Pending' : question.marks}</td></tr>)}</tbody></table>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">Question answers shown here are synthetic demo examples. They are not connected to an official answer key.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-4 py-3 sm:px-6 no-print">
          <div className="flex flex-wrap gap-2"><button type="button" disabled={!canPublish} onClick={() => onStatusChange(result, 'Published')} className="rounded-md bg-[#185b9d] px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">Publish demo result</button><button type="button" disabled={!canWithhold} onClick={() => onStatusChange(result, 'Withheld')} className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40">Withhold demo result</button></div>
          <div className="flex gap-2"><button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold"><Printer size={14} /> Print</button><button type="button" onClick={() => downloadDetail(result, exam.name)} className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold"><Download size={14} /> Download</button></div>
        </div>
      </section>
    </div>
  );
}

function downloadDetail(result: DemoStudentResult, examination: string) {
  const text = [
    'DEMO / NOT OFFICIAL', `Student: ${result.studentName}`, `Roll number: ${result.rollNumber}`,
    `Class: ${result.className}`, `Examination: ${examination}`, `Marks: ${result.obtainedMarks === null ? 'Pending' : `${result.obtainedMarks} / ${result.maximumMarks}`}`,
    `Correct: ${result.correct}`, `Wrong: ${result.wrong}`, `Multiple: ${result.multiple}`, `Blank: ${result.blank}`, `Uncertain: ${result.uncertain}`, `Status: ${result.status}`,
  ].join('\n');
  const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' })); link.download = `${result.rollNumber}-DEMO.txt`; link.click(); window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}
