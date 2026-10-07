import React from 'react';
import {
  Menu as IconMenu,
  Bell as IconBell,
  UserPlus as IconAddStudent,
  QrCode as IconMarkAttendance,
  Receipt as IconGenerateChallan,
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
          aria-label="Toggle mobile navigation"
          className="lg:hidden p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
        >
          <IconMenu size={20} />
        </button>
        <div>
          <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-none">{title}</h1>
          {subtitle && (
            <p className="text-xs text-slate-500 font-medium mt-1 hidden sm:block">{subtitle}</p>
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
            <IconAddStudent size={16} />
            <span>Add Student</span>
          </button>
        )}

        {onOpenMarkAttendance && (
          <button
            onClick={onOpenMarkAttendance}
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl transition"
          >
            <IconMarkAttendance size={16} className="text-slate-600" />
            <span>Mark Attendance</span>
          </button>
        )}

        {onOpenGenerateFee && (role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'ACCOUNTANT') && (
          <button
            onClick={onOpenGenerateFee}
            className="hidden lg:flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl transition"
          >
            <IconGenerateChallan size={16} className="text-slate-600" />
            <span>Generate Challan</span>
          </button>
        )}

        {/* Notification Bell */}
        <div className="relative">
          <button
            aria-label="Notifications unavailable"
            disabled
            className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition relative"
          >
            <IconBell size={18} />

          </button>
        </div>

        {/* User Pill */}
        <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-slate-200">
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt="" className="w-7 h-7 rounded-lg object-cover border border-slate-200" />
          ) : (
            <span aria-hidden="true" className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">{user?.name?.charAt(0) || 'A'}</span>
          )}
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
