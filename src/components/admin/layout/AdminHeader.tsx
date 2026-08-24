import React from 'react';
import {
  Menu,
  Bell,
  Search,
  Plus,
  QrCode,
  GraduationCap,
  Receipt,
  UserPlus,
} from 'lucide-react';
import { useAuth } from '../../../lib/authContext';

interface AdminHeaderProps {
  title: string;
  subtitle?: string;
  onOpenMobileSidebar: () => void;
  onOpenAddStudent?: () => void;
  onOpenMarkAttendance?: () => void;
  onOpenGenerateFee?: () => void;
  actions?: React.ReactNode;
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({
  title,
  subtitle,
  onOpenMobileSidebar,
  onOpenAddStudent,
  onOpenMarkAttendance,
  onOpenGenerateFee,
  actions,
}) => {
  const { user, role } = useAuth();

  return (
    <header className="h-16 bg-white border-b border-slate-200/80 sticky top-0 z-30 px-4 sm:px-6 flex items-center justify-between gap-4">
      {/* Left Title & Mobile Toggle */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileSidebar}
          className="lg:hidden p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-none">{title}</h1>
          {subtitle && (
            <p className="text-xs text-slate-400 font-medium mt-1 hidden sm:block">{subtitle}</p>
          )}
        </div>
      </div>

      {/* Right Controls: Quick Actions + Notifications + Profile Info */}
      <div className="flex items-center gap-2.5">
        {actions}

        {/* Global Quick Action Modals */}
        {onOpenAddStudent && (role === 'SUPER_ADMIN' || role === 'ADMIN') && (
          <button
            onClick={onOpenAddStudent}
            className="hidden md:flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-[#185b9d] hover:bg-[#13497d] text-white rounded-xl shadow-xs transition"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add Student</span>
          </button>
        )}

        {onOpenMarkAttendance && (
          <button
            onClick={onOpenMarkAttendance}
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Mark Attendance</span>
          </button>
        )}

        {onOpenGenerateFee && (role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'ACCOUNTANT') && (
          <button
            onClick={onOpenGenerateFee}
            className="hidden lg:flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs transition"
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>Generate Challan</span>
          </button>
        )}

        {/* Notification Bell */}
        <div className="relative">
          <button className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition relative">
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white" />
          </button>
        </div>

        {/* User Pill */}
        <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-slate-200">
          <img
            src={
              user?.avatarUrl ||
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&auto=format&fit=crop&q=80'
            }
            alt="User"
            className="w-7 h-7 rounded-lg object-cover border border-slate-200"
          />
          <div className="text-left leading-none">
            <span className="text-xs font-bold text-slate-800 block truncate max-w-[120px]">
              {user?.name || 'Admin'}
            </span>
            <span className="text-[10px] font-semibold text-[#185b9d] uppercase tracking-wider">
              {role}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
