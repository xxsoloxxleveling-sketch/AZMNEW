import React, { useState } from 'react';
import { User, Users, MapPin, Calendar, BellRing } from 'lucide-react';
import { useAuth } from '../../../lib/authContext';
import { MyAccountTab } from './MyAccountTab';
import { UserManagementTab } from './UserManagementTab';
import { TestCentersTab } from './TestCentersTab';
import { RollNumberScheduleTab } from './RollNumberScheduleTab';
import { AnnouncementsTab } from './AnnouncementsTab';

type SettingsTab = 'my-account' | 'users' | 'schedule' | 'centers' | 'announcements';

export const SettingsView: React.FC = () => {
  const { role } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>('my-account');

  // Authoritative permission helpers
  const canAccessUsers = role === 'SUPER_ADMIN';
  const canAccessSchedule = role === 'SUPER_ADMIN' || role === 'ADMIN';
  const canAccessCenters = role === 'SUPER_ADMIN' || role === 'ADMIN';
  const canAccessAnnouncements = role === 'SUPER_ADMIN';

  // Ensure current activeTab is permitted; fallback to 'my-account' if unauthorized
  const resolvedTab: SettingsTab =
    activeTab === 'users' && !canAccessUsers
      ? 'my-account'
      : activeTab === 'schedule' && !canAccessSchedule
      ? 'my-account'
      : activeTab === 'centers' && !canAccessCenters
      ? 'my-account'
      : activeTab === 'announcements' && !canAccessAnnouncements
      ? 'my-account'
      : activeTab;

  return (
    <div className="space-y-6">
      {/* Settings Navigation Bar */}
      <div
        className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-white border border-slate-200/80 shadow-xs max-w-4xl"
        role="tablist"
        aria-label="Settings navigation"
      >
        {/* My Account — Visible to all authenticated roles */}
        <button
          role="tab"
          aria-selected={resolvedTab === 'my-account'}
          onClick={() => setActiveTab('my-account')}
          className={`flex-1 min-w-[130px] py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
            resolvedTab === 'my-account'
              ? 'bg-[#185b9d] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <User className="w-3.5 h-3.5" />
          <span>My Account</span>
        </button>

        {/* User Accounts — SUPER_ADMIN only */}
        {canAccessUsers && (
          <button
            role="tab"
            aria-selected={resolvedTab === 'users'}
            onClick={() => setActiveTab('users')}
            className={`flex-1 min-w-[130px] py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
              resolvedTab === 'users'
                ? 'bg-[#185b9d] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>User Accounts</span>
          </button>
        )}

        {/* Roll No. Schedule — SUPER_ADMIN and ADMIN only */}
        {canAccessSchedule && (
          <button
            role="tab"
            aria-selected={resolvedTab === 'schedule'}
            onClick={() => setActiveTab('schedule')}
            className={`flex-1 min-w-[140px] py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
              resolvedTab === 'schedule'
                ? 'bg-[#185b9d] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Roll No. Schedule</span>
          </button>
        )}

        {/* Test Centers — SUPER_ADMIN and ADMIN only */}
        {canAccessCenters && (
          <button
            role="tab"
            aria-selected={resolvedTab === 'centers'}
            onClick={() => setActiveTab('centers')}
            className={`flex-1 min-w-[130px] py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
              resolvedTab === 'centers'
                ? 'bg-[#185b9d] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Test Centers</span>
          </button>
        )}

        {/* Announcements — SUPER_ADMIN only */}
        {canAccessAnnouncements && (
          <button
            role="tab"
            aria-selected={resolvedTab === 'announcements'}
            onClick={() => setActiveTab('announcements')}
            className={`flex-1 min-w-[130px] py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
              resolvedTab === 'announcements'
                ? 'bg-[#185b9d] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <BellRing className="w-3.5 h-3.5" />
            <span>Announcements</span>
          </button>
        )}
      </div>

      {/* Tab Panels */}
      <div role="tabpanel">
        {resolvedTab === 'my-account' && <MyAccountTab />}
        {resolvedTab === 'users' && canAccessUsers && <UserManagementTab />}
        {resolvedTab === 'schedule' && canAccessSchedule && <RollNumberScheduleTab />}
        {resolvedTab === 'centers' && canAccessCenters && <TestCentersTab />}
        {resolvedTab === 'announcements' && canAccessAnnouncements && <AnnouncementsTab />}
      </div>
    </div>
  );
};
