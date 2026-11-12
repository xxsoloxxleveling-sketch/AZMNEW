import type { ResultFilters as FiltersState, ResultStatus } from './ResultsTypes';

const statusOptions: Array<'All statuses' | ResultStatus> = ['All statuses', 'Draft', 'Processing', 'Review Required', 'Verified', 'Published', 'Withheld'];

interface ResultsFiltersProps {
  value: FiltersState;
  classes: string[];
  onChange: (next: FiltersState) => void;
}

export function ResultsFilters({ value, classes, onChange }: ResultsFiltersProps) {
  const update = (key: keyof FiltersState, fieldValue: string) => onChange({ ...value, [key]: fieldValue } as FiltersState);
  return (
    <section aria-label="Filter examination results" className="grid grid-cols-1 gap-3 border-y border-slate-200 py-3 sm:grid-cols-2 xl:grid-cols-5">
      <label className="text-xs font-semibold text-slate-700 sm:col-span-2 xl:col-span-2">
        Search student or roll number
        <input value={value.query} onChange={(event) => update('query', event.target.value)} placeholder="Name or roll number" className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-[#185b9d] focus:ring-2 focus:ring-blue-100" />
      </label>
      <label className="text-xs font-semibold text-slate-700">
        Class
        <select value={value.className} onChange={(event) => update('className', event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-[#185b9d]">
          <option value="All classes">All classes</option>
          {classes.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </label>
      <label className="text-xs font-semibold text-slate-700">
        Status
        <select value={value.status} onChange={(event) => update('status', event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-[#185b9d]">
          {statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs font-semibold text-slate-700">
          Min marks
          <input type="number" min="0" max="100" value={value.minimumMarks} onChange={(event) => update('minimumMarks', event.target.value)} placeholder="0" className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-[#185b9d]" />
        </label>
        <label className="text-xs font-semibold text-slate-700">
          Max marks
          <input type="number" min="0" max="100" value={value.maximumMarks} onChange={(event) => update('maximumMarks', event.target.value)} placeholder="100" className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-[#185b9d]" />
        </label>
      </div>
    </section>
  );
}
