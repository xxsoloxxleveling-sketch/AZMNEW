import React, { useState } from 'react';
import { X, Printer, Download, Users, FileText, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { mockApi, MockStudent } from '../../../lib/mockApi';

interface BulkPrintModalProps {
  students: MockStudent[];
  type: 'OMR' | 'ROLL_SLIP';
  isOpen: boolean;
  onClose: () => void;
}

export const BulkPrintModal: React.FC<BulkPrintModalProps> = ({
  students,
  type,
  isOpen,
  onClose,
}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || students.length === 0) return null;

  const isOmr = type === 'OMR';
  const title = isOmr ? 'Batch Print OMR Answer Sheets' : 'Batch Print Roll Number Slips';
  const studentIds = students.map((s) => s.id);

  const handleDownloadBulkPdf = async () => {
    setIsDownloading(true);
    setErrorMsg(null);
    try {
      if (isOmr) {
        await mockApi.downloadBulkOmrPdf(studentIds);
      } else {
        await mockApi.downloadBulkRollSlipsPdf(studentIds);
      }
    } catch (err: any) {
      setErrorMsg(err.message || `Failed to download bulk ${isOmr ? 'OMR' : 'Roll Slip'} PDF.`);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleBrowserPrint = () => {
    window.print();
  };

  const unissuedCount = students.filter(
    (s) => !s.rollNumber || s.rollNumberStatus === 'PROVISIONAL'
  ).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 p-3 sm:p-5 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 border border-blue-400/30 text-blue-300 rounded-xl font-bold">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white leading-tight">
                {title}
              </h2>
              <p className="text-xs text-slate-400">
                {students.length} candidates selected for batch generation
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
              {errorMsg}
            </div>
          )}

          {unissuedCount > 0 && (
            <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900 leading-relaxed font-medium">
                <strong className="font-bold">
                  {unissuedCount} candidate{unissuedCount > 1 ? 's do' : ' does'} not have an official roll number yet.
                </strong>{' '}
                Their sheets will include the pre-issue warning banner (
                <em>PRE-ISSUE COPY — OFFICIAL ROLL NUMBER NOT YET ISSUED</em>) and provisional identifier (
                <code>PROV-&lt;appNo&gt;</code>).
              </div>
            </div>
          )}

          {/* Selected candidates list summary */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700 border-b border-slate-200 flex justify-between">
              <span>Selected Candidates ({students.length})</span>
              <span>Status</span>
            </div>
            <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 text-xs">
              {students.map((student, idx) => {
                const isProv = !student.rollNumber || student.rollNumberStatus === 'PROVISIONAL';
                const rollDisplay = student.displayRollNumber || (student.rollNumber ? student.rollNumber : `PROV-${student.applicationNo}`);
                return (
                  <div key={student.id} className="px-4 py-2 flex items-center justify-between hover:bg-slate-50">
                    <div className="flex items-center gap-2.5">
                      <span className="text-slate-400 font-mono w-5">{idx + 1}.</span>
                      <div>
                        <div className="font-bold text-slate-900">{student.fullName}</div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {rollDisplay} • {student.currentClass}
                        </div>
                      </div>
                    </div>
                    <div>
                      {isProv ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          Provisional
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          Official
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="text-xs text-slate-600 bg-blue-50/60 border border-blue-200/80 rounded-xl p-3.5 space-y-1">
            <div className="font-bold text-blue-900">Batch Printing Instructions:</div>
            <div>
              • Click <strong>Download Unified PDF</strong> to obtain a single consolidated, multi-page document with each candidate on their own page.
            </div>
            <div>
              • High-speed thermal or laser printing ready with precise A4 margins.
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200/60 rounded-xl transition cursor-pointer"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleDownloadBulkPdf}
              disabled={isDownloading}
              className="px-4 py-2 text-xs font-bold bg-[#185b9d] hover:bg-[#13497d] text-white rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {isDownloading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>Download Consolidated PDF ({students.length})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
