import type { AssessmentTotals, WrittenMarkSource } from './assessmentApi';
import { formatAssessmentScore } from './assessmentViewModel';

export const assessmentUi = {
  button: 'inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#185b9d]/30 disabled:cursor-not-allowed disabled:opacity-50',
  primary: 'inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md border border-[#185b9d] bg-[#185b9d] px-3 text-sm font-medium text-white hover:bg-[#144d85] focus:outline-none focus:ring-2 focus:ring-[#185b9d]/30 disabled:cursor-not-allowed disabled:opacity-50',
  input: 'min-h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-[#185b9d] focus:ring-2 focus:ring-[#185b9d]/20 disabled:opacity-60',
  label: 'mb-1 block text-xs font-semibold text-slate-600',
  th: 'border-b border-slate-200 px-3 py-2 text-left text-xs font-semibold text-slate-500',
  td: 'border-b border-slate-100 px-3 py-2 text-sm text-slate-700',
  error: 'border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800',
  notice: 'border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800',
};

export function writtenMarkLabel(source: WrittenMarkSource): string {
  if (!source.isFinal) return 'Written mark needs review';
  if (source.sourceType === 'VERIFIED_MANUAL') return 'Manually verified · Final';
  if (source.sourceType === 'VERIFIED_OMR') return 'Verified OMR · Final';
  return 'Verified final written mark';
}

export function AssessmentTotalsStrip({ totals, label }: { totals: AssessmentTotals; label: string }) {
  const fields: Array<{ key: keyof AssessmentTotals; label: string; maximum: number }> = [
    { key: 'written', label: 'Written exam', maximum: 60 },
    { key: 'interview', label: 'Interview average', maximum: 20 },
    { key: 'extracurricular', label: 'Activities', maximum: 10 },
    { key: 'academic', label: 'Academics', maximum: 5 },
    { key: 'personality', label: 'Personality average', maximum: 5 },
    { key: 'total', label: 'Total', maximum: 100 },
  ];
  return <div aria-label={label}>
    <p className="mb-2 text-xs font-medium text-slate-500">{label}</p>
    <dl className="grid grid-cols-2 gap-3 border-y border-slate-200 py-3 sm:grid-cols-3 xl:grid-cols-6">
      {fields.map(field => <div key={field.key}>
        <dt className="text-xs text-slate-500">{field.label}</dt>
        <dd className="mt-1 font-semibold tabular-nums text-slate-900">{formatAssessmentScore(totals[field.key])}<span className="ml-1 text-xs font-normal text-slate-500">/ {field.maximum}</span></dd>
      </div>)}
    </dl>
  </div>;
}
