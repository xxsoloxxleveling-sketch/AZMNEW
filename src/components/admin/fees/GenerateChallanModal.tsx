import React, { useState } from 'react';
import { X, Receipt, Loader2, CheckCircle, Users } from 'lucide-react';
import { mockApi, MockStudent } from '../../../lib/mockApi';

interface GenerateChallanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  students: MockStudent[];
}

export const GenerateChallanModal: React.FC<GenerateChallanModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  students,
}) => {
  const [mode, setMode] = useState<'single' | 'bulk'>('single');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedClass, setSelectedClass] = useState('SSC-I (Class 9th)');
  const [month, setMonth] = useState('2026-08');
  const [amountDue, setAmountDue] = useState(6500);
  const [dueDate, setDueDate] = useState('2026-08-28');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (mode === 'single' && !selectedStudentId) {
        throw new Error('Please select a student.');
      }

      await mockApi.generateChallans({
        studentId: mode === 'single' ? selectedStudentId : undefined,
        currentClass: mode === 'bulk' ? selectedClass : undefined,
        month,
        amountDue: Number(amountDue),
        dueDate,
      });

      alert('Fee challans generated successfully.');
      onSuccess();
      onClose();
    } catch (err: any) {
      alert(err.message || 'Failed to generate challans');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-100 relative space-y-6">
        <button
          onClick={onClose}
          className="absolute right-5 top-5 p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Generate Fee Challans</h3>
            <p className="text-xs text-slate-400">Issue official fee invoice slips for candidates</p>
          </div>
        </div>

        {/* Mode Selector */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
          <button
            type="button"
            onClick={() => setMode('single')}
            className={`py-2 text-xs font-bold rounded-lg transition ${
              mode === 'single' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
            }`}
          >
            Single Student
          </button>
          <button
            type="button"
            onClick={() => setMode('bulk')}
            className={`py-2 text-xs font-bold rounded-lg transition ${
              mode === 'bulk' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
            }`}
          >
            Bulk Entire Class
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'single' ? (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Select Student *</label>
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
              >
                <option value="">-- Choose Candidate --</option>
                {students.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.rollNumber} - {st.fullName} ({st.currentClass})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Target Class *</label>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
              >
                <option value="Class 6th">Class 6th</option>
                <option value="Class 7th">Class 7th</option>
                <option value="Class 8th">Class 8th</option>
                <option value="SSC-I (Class 9th)">SSC-I (Class 9th)</option>
                <option value="SSC-II (Class 10th)">SSC-II (Class 10th)</option>
                <option value="HSSC">HSSC College</option>
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Billing Month *</label>
              <input
                type="text"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                placeholder="YYYY-MM"
                required
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Due Date *</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Tuition / Fee Amount (PKR) *</label>
            <input
              type="number"
              value={amountDue}
              onChange={(e) => setAmountDue(Number(e.target.value))}
              required
              className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
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
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>Generate Challans</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
