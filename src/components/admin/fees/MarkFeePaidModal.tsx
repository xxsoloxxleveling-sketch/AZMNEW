import React, { useState } from 'react';
import { X, CheckCircle, Loader2, Banknote } from 'lucide-react';
import { mockApi, MockFeeChallan } from '../../../lib/mockApi';

interface MarkFeePaidModalProps {
  isOpen: boolean;
  onClose: () => void;
  challan: MockFeeChallan | null;
  onSuccess: () => void;
}

export const MarkFeePaidModal: React.FC<MarkFeePaidModalProps> = ({
  isOpen,
  onClose,
  challan,
  onSuccess,
}) => {
  if (!isOpen || !challan) return null;

  const remaining = challan.amountDue - challan.amountPaid;
  const [amountPaid, setAmountPaid] = useState(remaining);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await mockApi.markFeePaid(challan.id, {
        amountPaid: Number(amountPaid),
        paymentMethod,
      });
      alert(`Payment of PKR ${amountPaid} recorded. Transaction added to General Ledger.`);
      onSuccess();
      onClose();
    } catch (err: any) {
      alert(err.message || 'Failed to record payment');
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
          <div className="p-2.5 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100">
            <Banknote className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Record Fee Payment</h3>
            <p className="text-xs text-slate-400">Challan #{challan.challanNumber}</p>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5 text-slate-600">
          <div className="flex justify-between">
            <span>Student:</span>
            <strong className="text-slate-900">{challan.studentName} ({challan.rollNumber})</strong>
          </div>
          <div className="flex justify-between">
            <span>Total Billed:</span>
            <strong>PKR {challan.amountDue.toLocaleString()}</strong>
          </div>
          <div className="flex justify-between">
            <span>Already Paid:</span>
            <strong className="text-emerald-700">PKR {challan.amountPaid.toLocaleString()}</strong>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-1.5 font-bold text-slate-900">
            <span>Remaining Due:</span>
            <span className="text-rose-600">PKR {remaining.toLocaleString()}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Payment Amount (PKR) *</label>
            <input
              type="number"
              max={remaining}
              min={1}
              required
              value={amountPaid}
              onChange={(e) => setAmountPaid(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Payment Method *</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
            >
              <option value="CASH">Cash Deposit (Accounts Desk)</option>
              <option value="BANK_TRANSFER">Direct Bank Transfer / 1Link</option>
              <option value="ONLINE">Easypaisa / JazzCash</option>
            </select>
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
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-500/20 transition flex items-center gap-2 disabled:opacity-60"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Recording...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>Mark Paid & Post Ledger</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
