import React from 'react';
import { useAuth } from '../../../lib/authContext';

interface TeacherScanViewProps {
  onBackToDashboard?: () => void;
}

export const TeacherScanView: React.FC<TeacherScanViewProps> = ({ onBackToDashboard }) => {
  const { user, role, logout } = useAuth();

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <header className="h-14 px-4 border-b border-slate-200 flex items-center justify-between">
        <h1 className="text-sm font-semibold">AZM Examiner Attendance</h1>
        <div className="flex items-center gap-3">
          {onBackToDashboard && role !== 'TEACHER' && <button onClick={onBackToDashboard} className="text-xs font-medium text-[#185b9d]">Dashboard</button>}
          <button onClick={logout} className="text-xs font-medium text-slate-600">Sign out</button>
        </div>
      </header>
      <section className="m-auto px-4 py-8 text-center" aria-live="polite">
        <h2 className="text-sm font-semibold">Attendance scanning is deferred</h2>
        <p className="mt-1 text-sm text-slate-600">Scanning will be available when an examination hall session is open.</p>
      </section>
      <footer className="py-3 text-center text-xs text-slate-500 border-t border-slate-200">Signed in as {user?.name} ({role})</footer>
    </main>
  );
};
