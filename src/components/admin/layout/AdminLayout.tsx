import React, { useState } from 'react';
import { AdminSidebar, AdminTab } from './AdminSidebar';
import { AdminHeader } from './AdminHeader';
import { useAuth } from '../../../lib/authContext';
import { Loader2 } from 'lucide-react';

interface AdminLayoutProps {
  children: React.ReactNode;
  currentTab: AdminTab;
  onSelectTab: (tab: AdminTab) => void;
  title: string;
  subtitle?: string;
  onOpenAddStudent?: () => void;
  onOpenMarkAttendance?: () => void;
  onOpenGenerateFee?: () => void;
  headerActions?: React.ReactNode;
  onNavigatePublic?: (route: string) => void;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  children,
  currentTab,
  onSelectTab,
  title,
  subtitle,
  onOpenAddStudent,
  onOpenMarkAttendance,
  onOpenGenerateFee,
  headerActions,
  onNavigatePublic,
}) => {
  const { isLoading: authLoading } = useAuth();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 text-[#185b9d] animate-spin" />
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Initializing administrative credentials & security session...
        </span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex text-slate-900 font-sans">
      {/* Fixed Left Sidebar */}
      <AdminSidebar
        currentTab={currentTab}
        onSelectTab={onSelectTab}
        onNavigatePublic={onNavigatePublic}
        isMobileOpen={isMobileOpen}
        onCloseMobile={() => setIsMobileOpen(false)}
      />

      {/* Main Content Area with Header */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <AdminHeader
          title={title}
          subtitle={subtitle}
          onOpenMobileSidebar={() => setIsMobileOpen(true)}
          onOpenAddStudent={onOpenAddStudent}
          onOpenMarkAttendance={onOpenMarkAttendance}
          onOpenGenerateFee={onOpenGenerateFee}
          actions={headerActions}
        />

        <main className="p-4 sm:p-6 lg:p-8 flex-1 max-w-7xl w-full mx-auto space-y-6">
          {children}
        </main>
      </div>
    </div>
  );
};
