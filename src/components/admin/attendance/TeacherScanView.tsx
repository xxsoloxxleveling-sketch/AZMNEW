import React from 'react';
import { School, ArrowLeft, LogOut, Shield } from 'lucide-react';
import { QrScannerTab } from './QrScannerTab';
import { useAuth } from '../../../lib/authContext';

interface TeacherScanViewProps {
  onBackToDashboard?: () => void;
}

export const TeacherScanView: React.FC<TeacherScanViewProps> = ({ onBackToDashboard }) => {
  const { user, role, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col justify-between">
      {/* Mobile Top App Bar */}
      <header className="h-16 px-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between sticky top-0 z-20 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#185b9d] flex items-center justify-center text-white">
            <School className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-xs font-bold text-slate-100">AZM Examiner Scanner</h1>

            <p className="text-[10px] text-slate-400 font-medium">Faculty Portal (/scan)</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onBackToDashboard && role !== 'TEACHER' && (
            <button
              onClick={onBackToDashboard}
              className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition"
            >
              Dashboard
            </button>
          )}
          <button
            onClick={logout}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900 text-slate-300 hover:text-rose-200 transition"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Scanner Body */}
      <main className="p-4 sm:p-6 max-w-xl w-full mx-auto flex-1 flex flex-col justify-center">
        <div className="bg-white rounded-3xl p-6 text-slate-900 shadow-2xl">
          <QrScannerTab />
        </div>
      </main>

      {/* Footer Info */}
      <footer className="py-4 text-center text-[11px] text-slate-500 border-t border-slate-800/80">
        Logged in as: <strong className="text-slate-400">{user?.name}</strong> ({role})
      </footer>
    </div>
  );
};
