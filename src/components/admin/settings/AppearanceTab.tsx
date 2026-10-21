import React from 'react';
import { Check, Moon, Palette, Sun } from 'lucide-react';
import { DashboardTheme, useDashboardTheme } from '../../../lib/dashboardTheme';

const themes = [
  {
    value: 'light',
    title: 'Light',
    description: 'Bright panels with the classic AZMAIO dashboard palette.',
    Icon: Sun,
  },
  {
    value: 'dark',
    title: 'Dark',
    description: 'Comfortable dark surfaces with readable text and controls.',
    Icon: Moon,
  },
] as const;

export const AppearanceTab: React.FC = () => {
  const { theme, setTheme } = useDashboardTheme();

  return (
    <section aria-labelledby="dashboard-appearance-title" className="max-w-4xl rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs sm:p-6">
      <div className="mb-5 flex items-start gap-3 border-b border-slate-100 pb-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#185b9d]">
          <Palette size={20} aria-hidden="true" />
        </div>
        <div>
          <h2 id="dashboard-appearance-title" className="text-base font-bold text-slate-900">Dashboard appearance</h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            Choose how your AZMAIO management dashboard looks.
          </p>
        </div>
      </div>

      <fieldset>
        <legend className="mb-3 text-xs font-bold text-slate-700">Color theme</legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {themes.map(({ value, title, description, Icon }) => (
            <label
              key={value}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors focus-within:ring-2 focus-within:ring-[#185b9d] focus-within:ring-offset-2 ${
                theme === value
                  ? 'border-[#185b9d] bg-blue-50/60'
                  : 'border-slate-200 bg-slate-50/70 hover:border-slate-300'
              }`}
            >
              <input
                type="radio"
                name="dashboard-color-theme"
                value={value}
                checked={theme === value}
                onChange={() => setTheme(value as DashboardTheme)}
                className="mt-1 h-4 w-4 shrink-0 accent-[#185b9d]"
              />
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-[#185b9d]">
                <Icon size={20} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2 text-sm font-bold text-slate-900">
                  {title}
                  {theme === value && <Check className="h-4 w-4 text-[#185b9d]" aria-hidden="true" />}
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-slate-600">{description}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <p role="status" className="mt-5 rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-xs leading-relaxed text-slate-600">
        {theme === 'dark' ? 'Dark mode is active.' : 'Light mode is active.'}
        {' '}This preference is saved for your account on this browser and applies only to the staff dashboard.
        Public pages, candidate slips, OMR sheets, and Study Notes retain their normal appearance.
      </p>
    </section>
  );
};
