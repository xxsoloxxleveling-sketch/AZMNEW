import React, { useState } from 'react';
import {
  QrCode,
  Camera,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Sparkles,
  Zap,
} from 'lucide-react';
import { mockApi, MockStudent, MockAttendance } from '../../../lib/mockApi';

interface QrScannerTabProps {
  onAttendanceMarked?: () => void;
}

export const QrScannerTab: React.FC<QrScannerTabProps> = ({ onAttendanceMarked }) => {
  const [tokenInput, setTokenInput] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [lastResult, setLastResult] = useState<{
    attendance: MockAttendance;
    student: MockStudent;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleScanToken = async (token: string) => {
    setIsScanning(true);
    setErrorMessage(null);

    try {
      const res = await mockApi.scanAttendance({
        qrToken: token,
        status: 'PRESENT',
      });
      setLastResult(res);
      if (onAttendanceMarked) onAttendanceMarked();
    } catch (err: any) {
      setErrorMessage(err.message || 'Scan failed or student already marked today.');
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left: Camera Scanner Viewport */}
      <div className="lg:col-span-7 bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Biometric QR Scanner</h3>
            <p className="text-xs text-slate-400">Position candidate QR slip inside camera viewfinder</p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            Live Camera Ready
          </span>
        </div>

        {/* Viewport Frame */}
        <div className="relative aspect-4/3 bg-slate-900 rounded-2xl overflow-hidden flex flex-col items-center justify-center p-6 text-center text-white border-4 border-slate-800 shadow-inner">
          <div className="absolute inset-0 bg-radial from-transparent via-slate-900/40 to-slate-950/80" />

          {/* High-tech Scanning Reticle */}
          <div className="w-56 h-56 sm:w-64 sm:h-64 border-2 border-emerald-400/70 rounded-2xl relative flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
            <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
            <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
            <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />

            {/* Scanning Laser Animation */}
            <div className="absolute left-2 right-2 h-0.5 bg-emerald-400 shadow-md shadow-emerald-400 animate-bounce" />

            <QrCode className="w-16 h-16 text-white/20" />
          </div>

          <p className="text-xs font-medium text-slate-300 mt-4 z-10">
            Align QR barcode to automatically mark Present
          </p>
        </div>

        {/* Quick Demo Simulator Buttons */}
        <div className="space-y-2 pt-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
            Simulate Student QR Scan:
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <button
              onClick={() => handleScanToken('qr_AZMVS-2026-0001_signed_token_991823')}
              disabled={isScanning}
              className="p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white text-left font-semibold text-slate-800 transition flex items-center justify-between"
            >
              <span>Scan AZMVS-2026-0001 (Hamza Tariq)</span>
              <Zap className="w-3.5 h-3.5 text-amber-500" />
            </button>
            <button
              onClick={() => handleScanToken('qr_AZMVS-2026-0003_signed_token_776123')}
              disabled={isScanning}
              className="p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white text-left font-semibold text-slate-800 transition flex items-center justify-between"
            >
              <span>Scan AZMVS-2026-0003 (Bilal Ahmed)</span>
              <Zap className="w-3.5 h-3.5 text-amber-500" />
            </button>

          </div>
        </div>

        {/* Manual Token String Input fallback */}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Paste raw QR token string here..."
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            className="flex-1 px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#185b9d]/20"
          />
          <button
            onClick={() => handleScanToken(tokenInput)}
            disabled={isScanning || !tokenInput.trim()}
            className="px-4 py-2 bg-[#185b9d] text-white rounded-xl text-xs font-bold shadow-xs hover:bg-[#13497d] transition disabled:opacity-50"
          >
            {isScanning ? 'Verifying...' : 'Verify Token'}
          </button>
        </div>
      </div>

      {/* Right: Instant Scan Confirmation Card & Verification Result */}
      <div className="lg:col-span-5 space-y-4">
        {errorMessage && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs space-y-1 animate-in fade-in">
            <div className="flex items-center gap-2 font-bold text-rose-900">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              <span>Attendance Verification Error</span>
            </div>
            <p className="leading-relaxed">{errorMessage}</p>
          </div>
        )}

        {lastResult ? (
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-emerald-200 shadow-lg shadow-emerald-500/10 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500 text-white text-xs font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" /> Marked Present ✓
              </span>
              <span className="text-[11px] font-semibold text-slate-400">
                {new Date(lastResult.attendance.createdAt).toLocaleTimeString()}
              </span>
            </div>

            <div className="flex items-center gap-4">
              <img
                src={
                  lastResult.student.photoUrl ||
                  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'
                }
                alt="Student"
                className="w-16 h-16 rounded-2xl object-cover border-2 border-emerald-500 shadow-md"
              />
              <div className="min-w-0">
                <h4 className="text-base font-extrabold text-slate-900 truncate">
                  {lastResult.student.fullName}
                </h4>
                <p className="text-xs text-slate-500 font-medium truncate">
                  S/D/O {lastResult.student.fatherName}
                </p>
                <div className="flex items-center gap-2 mt-1 text-xs">
                  <span className="font-bold text-[#185b9d]">{lastResult.student.rollNumber}</span>
                  <span className="text-slate-300">•</span>
                  <span className="font-semibold text-slate-600">{lastResult.student.currentClass}</span>
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5 text-slate-600">
              <div className="flex justify-between">
                <span>Method:</span>
                <strong className="text-slate-800">{lastResult.attendance.method}</strong>
              </div>
              <div className="flex justify-between">
                <span>Examiner / Officer:</span>
                <strong className="text-slate-800">{lastResult.attendance.markedByName}</strong>
              </div>
              <div className="flex justify-between">
                <span>Scholarship Stream:</span>
                <strong className="text-[#185b9d]">{lastResult.student.scholarshipCategory}</strong>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-3xl p-8 border border-dashed border-slate-200 text-center space-y-3 text-slate-400">
            <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto text-slate-400">
              <QrCode className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-700">Awaiting Scan</h4>
            <p className="text-xs text-slate-400 max-w-xs mx-auto">
              Scan candidate QR code or use the quick test buttons on the left to see live verification.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
