import React, { useState } from 'react';
import { X, Play, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { mockApi } from '../../../lib/mockApi';

interface RunPayrollModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const RunPayrollModal: React.FC<RunPayrollModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [month, setMonth] = useState('2026-08');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await mockApi.runPayroll(month);
      alert(
        `Payroll run completed for ${month}. Generated ${res.createdCount} new records (${res.skippedCount} already existed).`
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      alert(err.message || 'Failed to run payroll');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-100 relative space-y-5">
        <button
          onClick={onClose}
          className="absolute right-5 top-5 p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100">
            <Play className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Run Monthly Payroll</h3>
            <p className="text-xs text-slate-400">Generate salary liability entries for all active staff</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Target Billing Month *</label>
            <input
              type="text"
              required
              placeholder="YYYY-MM (e.g. 2026-08)"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
            />
            <span className="text-[11px] text-slate-400 mt-1 block">
              Idempotent: automatically skips staff members who already have a payroll record for this month.
            </span>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-500/20 transition flex items-center gap-2 disabled:opacity-60"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  <span>Execute Payroll Run</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
