import React from 'react';
import {
  LayoutDashboard as IconDashboard,
  GraduationCap as IconStudents,
  School as IconPartners,
  Building2 as IconHalls,
  FolderArchive as IconStorage,
  CalendarCheck as IconAttendance,
  Receipt as IconFees,
  Users as IconStaff,
  Banknote as IconPayroll,
  History as IconLedger,
  Settings as IconSettings,
  School as IconBrandCrest,
  ChevronRight as IconChevronRight,
  ExternalLink as IconExternalLink,
  LogOut as IconLogOut,
  Shield as IconShield,
  QrCode as IconScanner,
} from 'lucide-react';
import { useAuth } from '../../../lib/authContext';
import { Role } from '../../../lib/mockApi';

export type AdminTab =
  | 'dashboard'
  | 'students'
  | 'partners'
  | 'halls'
  | 'storage'
  | 'attendance'
  | 'fees'
  | 'staff'
  | 'payroll'
  | 'transactions'
  | 'settings'
  | 'scan';

interface AdminSidebarProps {
  currentTab: AdminTab;
  onSelectTab: (tab: AdminTab) => void;
  onNavigatePublic?: (route: string) => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  currentTab,
  onSelectTab,
  onNavigatePublic,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const { user, role, logout } = useAuth();

  const navItems = [
    {
      id: 'dashboard' as AdminTab,
      label: 'Dashboard',
      icon: IconDashboard,
      roles: ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'],
    },
    {
      id: 'students' as AdminTab,
      label: 'Students',
      icon: IconStudents,
      roles: ['SUPER_ADMIN', 'ADMIN'],
    },
    {
      id: 'partners' as AdminTab,
      label: 'Partner Institutions',
      icon: IconPartners,
      roles: ['SUPER_ADMIN', 'ADMIN'],
    },
    {
      id: 'halls' as AdminTab,
      label: 'Exam Halls',
      icon: IconHalls,
      roles: ['SUPER_ADMIN', 'ADMIN'],
    },
    {
      id: 'storage' as AdminTab,
      label: 'Document Vault',
      icon: IconStorage,
      roles: ['SUPER_ADMIN', 'ADMIN'],
    },
    {
      id: 'attendance' as AdminTab,
      label: 'Examination Attendance',
      icon: IconAttendance,
      roles: ['SUPER_ADMIN', 'ADMIN', 'TEACHER'],
    },
    {
      id: 'scan' as AdminTab,
      label: 'Mobile Scanner',
      icon: IconScanner,
      roles: ['SUPER_ADMIN', 'ADMIN', 'TEACHER'],
    },
    {
      id: 'transactions' as AdminTab,
      label: 'Financial Ledger',
      icon: IconLedger,
      roles: ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'],
    },
    {
      id: 'staff' as AdminTab,
      label: 'Staff Directory',
      icon: IconStaff,
      roles: ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'],
    },
    {
      id: 'settings' as AdminTab,
      label: 'Settings & Security',
      icon: IconSettings,
      roles: ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT', 'TEACHER'],
    },
  ];

  const filteredNavItems = navItems.filter((item) => role !== null && item.roles.includes(role));

  const getRoleBadgeStyle = (r: Role | null) => {
    switch (r) {
      case 'SUPER_ADMIN':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'ADMIN':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'ACCOUNTANT':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'TEACHER':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-slate-900/40 z-40 lg:hidden backdrop-blur-xs transition-opacity"
        />
      )}

      <aside
        className={`fixed top-0 left-0 bottom-0 w-64 bg-white border-r border-slate-200/80 z-50 flex flex-col justify-between overflow-y-auto transition-transform duration-150 ease-in-out lg:translate-x-0 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Logo & Title */}
        {/* Brand Logo & Title */}
        <div>
          <div className="h-16 px-5 border-b border-slate-100 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#185b9d] flex items-center justify-center text-white shadow-2xs">
              <IconBrandCrest size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-sm font-extrabold text-slate-900 truncate tracking-tight">
                AZMAIO Portal
              </h1>
              <p className="text-[11px] font-medium text-slate-400 truncate">
                Admin Management Portal
              </p>
            </div>
          </div>

          {/* Active Role Indicator */}
          {role && (
            <div className="px-3.5 py-2.5 mx-3 my-2 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium flex items-center gap-1.5">
                <IconShield size={14} className="text-[#185b9d]" /> System Role:
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getRoleBadgeStyle(
                  role
                )}`}
              >
                {role}
              </span>
            </div>
          )}

          {/* Navigation Items */}
          <nav className="px-3 space-y-1 mt-1">
            <div className="px-3 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Main Menu
            </div>
            {filteredNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onSelectTab(item.id);
                    if (onCloseMobile) onCloseMobile();
                  }}
                  className={`group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors duration-150 ${
                    isActive
                      ? 'bg-[#185b9d] text-white shadow-md shadow-blue-500/20'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Icon
                    size={18}
                    className={`transition-colors shrink-0 ${
                      isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-800'
                    }`}
                  />
                  <span className="flex-1 text-left truncate">{item.label}</span>
                  {isActive && <IconChevronRight size={14} className="opacity-80 shrink-0" />}
                </button>
              );
            })}

            <div className="pt-3">
              {onNavigatePublic && (
                <>
                  <button
                    onClick={() => onNavigatePublic('/register')}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-colors"
                  >
                    <span>Public Registration</span>
                    <IconExternalLink size={14} className="text-slate-400" />
                  </button>
                  <button
                    onClick={() => onNavigatePublic('/partner-registration')}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-colors"
                  >
                    <span>Partner Registration</span>
                    <IconExternalLink size={14} className="text-slate-400" />
                  </button>
                  <button
                    onClick={() => onNavigatePublic('/')}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-colors"
                  >
                    <span>Public Website</span>
                    <IconExternalLink size={14} className="text-slate-400" />
                  </button>
                </>
              )}
            </div>
          </nav>
        </div>

        {/* User Profile Card & Logout */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5 p-2 rounded-xl bg-white border border-slate-200/80 shadow-2xs mb-2">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="w-8 h-8 rounded-lg object-cover border border-slate-200" />
            ) : (
              <span aria-hidden="true" className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">{user?.name?.charAt(0) || 'A'}</span>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-900 truncate">{user?.name || 'Account'}</p>
              <p className="text-[10px] text-slate-400 truncate">{user?.email || ''}</p>
            </div>
          </div>

          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100 transition-colors"
          >
            <IconLogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
};
