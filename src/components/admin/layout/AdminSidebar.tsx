import React from 'react';
import {
  LayoutDashboard,
  GraduationCap,
  CalendarCheck,
  Receipt,
  Users,
  Banknote,
  History,
  Settings,
  QrCode,
  LogOut,
  ChevronRight,
  ExternalLink,
  Shield,
  UserCheck,
  School,
  Building2,
  FolderArchive,
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
  const { user, role, logout, switchRole } = useAuth();

  const navItems = [
    {
      id: 'dashboard' as AdminTab,
      label: 'Dashboard',
      icon: LayoutDashboard,
      roles: ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'],
    },
    {
      id: 'students' as AdminTab,
      label: 'Students',
      icon: GraduationCap,
      roles: ['SUPER_ADMIN', 'ADMIN'],
    },
    {
      id: 'partners' as AdminTab,
      label: 'Partner Institutions',
      icon: School,
      roles: ['SUPER_ADMIN', 'ADMIN'],
    },
    {
      id: 'halls' as AdminTab,
      label: 'Exam Halls & Seating',
      icon: Building2,
      roles: ['SUPER_ADMIN', 'ADMIN', 'TEACHER'],
    },
    {
      id: 'storage' as AdminTab,
      label: 'Document Storage Vault',
      icon: FolderArchive,
      roles: ['SUPER_ADMIN', 'ADMIN'],
    },
    {
      id: 'attendance' as AdminTab,
      label: 'Attendance & QR',
      icon: CalendarCheck,
      roles: ['SUPER_ADMIN', 'ADMIN', 'TEACHER'],
    },
    {
      id: 'fees' as AdminTab,
      label: 'Fee Challans',
      icon: Receipt,
      roles: ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'],
    },
    {
      id: 'staff' as AdminTab,
      label: 'Staff Directory',
      icon: Users,
      roles: ['SUPER_ADMIN', 'ADMIN'],
    },
    {
      id: 'payroll' as AdminTab,
      label: 'Payroll & Salaries',
      icon: Banknote,
      roles: ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'],
    },
    {
      id: 'transactions' as AdminTab,
      label: 'General Ledger',
      icon: History,
      roles: ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'],
    },
    {
      id: 'settings' as AdminTab,
      label: 'Settings & Security',
      icon: Settings,
      roles: ['SUPER_ADMIN', 'ADMIN'],
    },
  ];


  const filteredNavItems = navItems.filter((item) => item.roles.includes(role));

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    switchRole(e.target.value as Role);
  };

  const getRoleBadgeStyle = (r: Role) => {
    switch (r) {
      case 'SUPER_ADMIN':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'ADMIN':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'ACCOUNTANT':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'TEACHER':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
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
        className={`fixed top-0 left-0 bottom-0 w-64 bg-white border-r border-slate-200/80 z-50 flex flex-col justify-between transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Logo & Title */}
        <div>
          <div className="h-16 px-5 border-b border-slate-100 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#185b9d] to-[#2563eb] flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <School className="w-5 h-5" />
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

          {/* Role Indicator & Test Switcher */}
          <div className="p-3.5 mx-3 my-2.5 rounded-xl bg-slate-50 border border-slate-200/70">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-slate-500 font-medium flex items-center gap-1">
                <Shield className="w-3.5 h-3.5 text-[#185b9d]" /> Active Role:
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getRoleBadgeStyle(
                  role
                )}`}
              >
                {role}
              </span>
            </div>
            <select
              value={role}
              onChange={handleRoleChange}
              className="w-full text-xs font-semibold bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#185b9d]"
            >
              <option value="SUPER_ADMIN">Switch to SUPER_ADMIN</option>
              <option value="ADMIN">Switch to ADMIN</option>
              <option value="ACCOUNTANT">Switch to ACCOUNTANT</option>
              <option value="TEACHER">Switch to TEACHER</option>
            </select>
          </div>

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
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-[#185b9d] text-white shadow-md shadow-blue-500/20'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 transition-colors ${
                      isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'
                    }`}
                  />
                  <span className="flex-1 text-left">{item.label}</span>
                  {isActive && <ChevronRight className="w-3.5 h-3.5 opacity-80" />}
                </button>
              );
            })}

            {/* Quick Standalone Examiner Scanner link for teachers or mobile access */}
            <div className="pt-3">
              <div className="px-3 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Direct Portals
              </div>
              <button
                onClick={() => {
                  onSelectTab('scan');
                  if (onCloseMobile) onCloseMobile();
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  currentTab === 'scan'
                    ? 'bg-[#185b9d] text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <QrCode className="w-4 h-4 text-emerald-600" />
                <span className="flex-1 text-left">Mobile Scanner (/scan)</span>
              </button>

              {onNavigatePublic && (
                <>
                  <button
                    onClick={() => onNavigatePublic('/register')}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition"
                  >
                    <span>Public Registration</span>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                  <button
                    onClick={() => onNavigatePublic('/partner-registration')}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition"
                  >
                    <span>Partner Registration</span>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                  <button
                    onClick={() => onNavigatePublic('/')}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition"
                  >
                    <span>Public Website</span>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                </>
              )}
            </div>
          </nav>
        </div>

        {/* User Profile Card & Logout */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5 p-2 rounded-xl bg-white border border-slate-200/80 shadow-xs mb-2">
            <img
              src={
                user?.avatarUrl ||
                'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'
              }
              alt="Avatar"
              className="w-8 h-8 rounded-lg object-cover border border-slate-200"
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-900 truncate">{user?.name || 'Admin User'}</p>
              <p className="text-[10px] text-slate-400 truncate">{user?.email || 'chief.admin@azmaio.com'}</p>
            </div>
          </div>

          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100 transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
};
