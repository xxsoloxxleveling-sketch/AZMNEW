import React, { useState, useEffect, lazy, Suspense } from 'react';
import { PageTab } from './types';
import { Header } from './components/common/Header';
import { HeroSection } from './components/home/HeroSection';
import { Loader2 } from 'lucide-react';

import { AuthProvider, useAuth } from './lib/authContext';
import { AdminTab } from './components/admin/layout/AdminSidebar';
import type { MockStudent } from './lib/mockApi';
import { wakeUpBackend } from './lib/apiClient';
import { PUBLIC_REGISTRATION_OPEN } from './config/registration';

// Lazy Loaded Below-The-Fold Public Components
const Footer = lazy(() =>
  import('./components/common/Footer').then((m) => ({ default: m.Footer }))
);
const AlertsSection = lazy(() =>
  import('./components/home/AlertsSection').then((m) => ({ default: m.AlertsSection }))
);
const WhatsAppButton = lazy(() =>
  import('./components/common/WhatsAppButton').then((m) => ({ default: m.WhatsAppButton }))
);
const WhatsAppCommunitySection = lazy(() =>
  import('./components/home/WhatsAppCommunitySection').then((m) => ({ default: m.WhatsAppCommunitySection }))
);
const RegistrationAlertModal = lazy(() =>
  import('./components/home/RegistrationAlertModal').then((m) => ({ default: m.RegistrationAlertModal }))
);
const PartnerMarquee = lazy(() =>
  import('./components/home/PartnerMarquee').then((m) => ({ default: m.PartnerMarquee }))
);
const WorkflowBento = lazy(() =>
  import('./components/home/WorkflowBento').then((m) => ({ default: m.WorkflowBento }))
);
const FeeCalculator = lazy(() =>
  import('./components/home/FeeCalculator').then((m) => ({ default: m.FeeCalculator }))
);
const LeadershipSection = lazy(() =>
  import('./components/home/LeadershipSection').then((m) => ({ default: m.LeadershipSection }))
);
const StudentTestimonials = lazy(() =>
  import('./components/home/StudentTestimonials').then((m) => ({ default: m.StudentTestimonials }))
);
const FaqSection = lazy(() =>
  import('./components/home/FaqSection').then((m) => ({ default: m.FaqSection }))
);

// Protected Admin Views (Lazy Loaded strictly on Authenticated access)
const AdminLayout = lazy(() =>
  import('./components/admin/layout/AdminLayout').then((m) => ({ default: m.AdminLayout }))
);
const DashboardView = lazy(() =>
  import('./components/admin/dashboard/DashboardView').then((m) => ({ default: m.DashboardView }))
);
const StudentsListView = lazy(() =>
  import('./components/admin/students/StudentsListView').then((m) => ({ default: m.StudentsListView }))
);
const AttendanceHubView = lazy(() =>
  import('./components/admin/attendance/AttendanceHubView').then((m) => ({ default: m.AttendanceHubView }))
);
const TeacherScanView = lazy(() =>
  import('./components/admin/attendance/TeacherScanView').then((m) => ({ default: m.TeacherScanView }))
);
const FeesListView = lazy(() =>
  import('./components/admin/fees/FeesListView').then((m) => ({ default: m.FeesListView }))
);
const StaffListView = lazy(() =>
  import('./components/admin/staff/StaffListView').then((m) => ({ default: m.StaffListView }))
);
const PayrollListView = lazy(() =>
  import('./components/admin/payroll/PayrollListView').then((m) => ({ default: m.PayrollListView }))
);
const TransactionsListView = lazy(() =>
  import('./components/admin/transactions/TransactionsListView').then((m) => ({ default: m.TransactionsListView }))
);
const SettingsView = lazy(() =>
  import('./components/admin/settings/SettingsView').then((m) => ({ default: m.SettingsView }))
);
const ExamHallsView = lazy(() =>
  import('./components/admin/halls/ExamHallsView').then((m) => ({ default: m.ExamHallsView }))
);
const DocumentVaultView = lazy(() =>
  import('./components/admin/storage/DocumentVaultView').then((m) => ({ default: m.DocumentVaultView }))
);
const AdminPartnersListView = lazy(() =>
  import('./components/admin/partners/AdminPartnersListView').then((m) => ({ default: m.AdminPartnersListView }))
);
const AdminWalkInModal = lazy(() =>
  import('./components/admin/students/AdminWalkInModal').then((m) => ({ default: m.AdminWalkInModal }))
);
const GenerateChallanModal = lazy(() =>
  import('./components/admin/fees/GenerateChallanModal').then((m) => ({ default: m.GenerateChallanModal }))
);

// Public Lazy Views
const LoginPage = lazy(() =>
  import('./components/public/auth/LoginPage').then((m) => ({ default: m.LoginPage }))
);
const RegistrationSuspendedNotice = lazy(() =>
  import('./components/public/register/RegistrationSuspendedNotice').then((m) => ({
    default: m.RegistrationSuspendedNotice,
  }))
);
const PublicCandidateRegistrationWizard = lazy(() =>
  import('./components/public/register/PublicCandidateRegistrationWizard').then((m) => ({
    default: m.PublicCandidateRegistrationWizard,
  }))
);
const PublicPartnerRegistrationPage = lazy(() =>
  import('./components/public/partner/PublicPartnerRegistrationPage').then((m) => ({
    default: m.PublicPartnerRegistrationPage,
  }))
);
const AboutView = lazy(() =>
  import('./components/about/AboutView').then((m) => ({ default: m.AboutView }))
);
const ScholarshipView = lazy(() =>
  import('./components/scholarship/ScholarshipView').then((m) => ({ default: m.ScholarshipView }))
);
const ApplicationPortal = lazy(() =>
  import('./components/apply/ApplicationPortal').then((m) => ({ default: m.ApplicationPortal }))
);
const ApplicationClosedNotice = lazy(() =>
  import('./components/apply/ApplicationClosedNotice').then((m) => ({
    default: m.ApplicationClosedNotice,
  }))
);

const RollNumberSlipView = lazy(() =>
  import('./components/rollnumber/RollNumberSlipView').then((m) => ({
    default: m.RollNumberSlipView,
  }))
);
const ResultsDeskView = lazy(() =>
  import('./components/results/ResultsDeskView').then((m) => ({ default: m.ResultsDeskView }))
);
const PartnerDirectoryView = lazy(() =>
  import('./components/partners/PartnerDirectoryView').then((m) => ({
    default: m.PartnerDirectoryView,
  }))
);
const GalleryView = lazy(() =>
  import('./components/gallery/GalleryView').then((m) => ({ default: m.GalleryView }))
);
const ContactView = lazy(() =>
  import('./components/contact/ContactView').then((m) => ({ default: m.ContactView }))
);
const MockExamModal = lazy(() =>
  import('./components/practice/MockExamModal').then((m) => ({ default: m.MockExamModal }))
);

const ViewLoadingFallback = () => (
  <div className="py-24 flex flex-col items-center justify-center min-h-[50vh] text-slate-500 space-y-3">
    <Loader2 className="w-8 h-8 text-[#185b9d] animate-spin" />
    <span className="text-xs font-semibold tracking-wider uppercase text-slate-400">
      Loading Portal View...
    </span>
  </div>
);

interface TeacherReleaseNoticeProps {
  user: any;
  onLogout: () => void;
  onNavigateHome: () => void;
  onOpenSettings?: () => void;
}

const TeacherReleaseNotice: React.FC<TeacherReleaseNoticeProps> = ({
  user,
  onLogout,
  onNavigateHome,
  onOpenSettings,
}) => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between items-center p-4 sm:p-6 relative font-sans select-none">
      <div className="w-full max-w-md flex items-center justify-between z-10 pt-2 pb-4">
        <button
          onClick={onNavigateHome}
          className="text-xs font-semibold text-slate-500 hover:text-slate-900 transition flex items-center gap-1.5 py-1 px-2.5 rounded-lg hover:bg-slate-200/50 cursor-pointer"
        >
          <span>← Back to Portal Home</span>
        </button>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#185b9d] bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100/80">
          Staff Account
        </span>
      </div>

      <div className="w-full max-w-md my-auto z-10">
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-md p-6 sm:p-8 space-y-6 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-[#185b9d]">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>

          <div className="space-y-2">
            <h1 className="text-lg font-bold text-slate-900">
              Teacher workspace is not enabled in this release.
            </h1>
            <p className="text-xs text-slate-500 leading-relaxed">
              The Attendance & Verification Hub and Mobile QR Scanner modules are scheduled for deployment in a subsequent phase. Your account remains active and in good standing.
            </p>
          </div>

          <div className="bg-slate-50 rounded-xl border border-slate-200/60 p-3.5 text-left text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Logged-in User</span>
              <span className="text-slate-900 font-semibold">{user?.fullName || user?.name || user?.email || 'Teacher Account'}</span>
            </div>
            {user?.email && (
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Email</span>
                <span className="text-slate-700 font-mono text-[11px]">{user.email}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Assigned Role</span>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                TEACHER
              </span>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            {onOpenSettings && (
              <button
                onClick={onOpenSettings}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-[#185b9d] hover:bg-[#13497d] text-white shadow-xs transition cursor-pointer flex items-center justify-center gap-2"
              >
                <span>My Account &amp; Security Settings</span>
              </button>
            )}
            <button
              onClick={onLogout}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold ${
                onOpenSettings ? 'border border-slate-200 text-slate-700 hover:bg-slate-50' : 'bg-[#185b9d] hover:bg-[#13497d] text-white shadow-xs'
              } transition cursor-pointer`}
            >
              Sign Out
            </button>
            <button
              onClick={onNavigateHome}
              className="w-full py-2 px-4 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
            >
              Return to Website
            </button>
          </div>
        </div>
      </div>

      <div className="w-full max-w-md text-center py-4 text-[11px] text-slate-400">
        AZM Educational Platform &copy; 2026
      </div>
    </div>
  );
};

type AppRoute = 'public' | 'login' | 'register' | 'partner-registration' | 'scan' | 'admin';

function AppContent() {
  const { user, role, isAuthenticated, logout } = useAuth();
  const [currentRoute, setCurrentRoute] = useState<AppRoute>('public');
  const [adminTab, setAdminTab] = useState<AdminTab>('dashboard');


  // Public tab states
  const [activeTab, setActiveTab] = useState<PageTab>('home');
  const [prefillClass, setPrefillClass] = useState<string>('');
  const [isMockModalOpen, setIsMockModalOpen] = useState<boolean>(false);
  const [isAlertModalOpen, setIsAlertModalOpen] = useState<boolean>(false);
  const [language, setLanguage] = useState<'en' | 'ur'>('en');

  // Global Admin Modals
  const [isGlobalAddStudentOpen, setIsGlobalAddStudentOpen] = useState(false);
  const [isGlobalFeeOpen, setIsGlobalFeeOpen] = useState(false);
  const [studentsForChallan, setStudentsForChallan] = useState<MockStudent[]>([]);

  // Fire-and-forget backend health ping on initial site load
  useEffect(() => {
    wakeUpBackend();
  }, []);

  // Hash-based route listener for browser URLs (e.g. #dashboard, #login, #register, #scan)
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace('#', '').toLowerCase();
      const deferredTabs = ['storage', 'fees', 'payroll'];

      if (!hash || hash === 'home') {
        setCurrentRoute('public');
        setActiveTab('home');
      } else if (hash === 'login') {
        setCurrentRoute('login');
      } else if (hash === 'register' || hash === 'apply-full') {
        setCurrentRoute('register');
      } else if (hash === 'partner-registration' || hash === 'partner-register') {
        setCurrentRoute('partner-registration');
      } else if (hash === 'scan') {
        setCurrentRoute('scan');
      } else if (deferredTabs.includes(hash)) {
        setCurrentRoute('admin');
        const fallbackTab: AdminTab = role === 'TEACHER' ? 'attendance' : 'dashboard';
        setAdminTab(fallbackTab);
        window.location.hash = fallbackTab;
      } else if (hash === 'admin-partners') {
        setCurrentRoute('admin');
        setAdminTab(role === 'TEACHER' ? 'attendance' : 'partners');
        if (role === 'TEACHER') window.location.hash = 'attendance';
      } else if (
        ['dashboard', 'students', 'partners', 'staff', 'transactions', 'settings', 'halls', 'attendance'].includes(
          hash
        )
      ) {
        setCurrentRoute('admin');
        const canManageHalls = role === 'SUPER_ADMIN' || role === 'ADMIN';
        const canUseAttendance = canManageHalls || role === 'TEACHER';
        const targetTab: AdminTab = role === 'TEACHER' && hash !== 'settings'
          ? 'attendance'
          : (hash === 'halls' && !canManageHalls) || (hash === 'attendance' && !canUseAttendance)
            ? 'dashboard'
            : hash as AdminTab;
        setAdminTab(targetTab);
        if (targetTab !== hash) window.location.hash = targetTab;
      } else if (
        hash === 'apply-test' ||
        hash === 'test-apply' ||
        hash === 'test' ||
        hash === 'apply-sandbox' ||
        hash === 'apply-preview' ||
        window.location.search.includes('test=true') ||
        window.location.search.includes('apply=test')
      ) {
        setCurrentRoute('public');
        setActiveTab('apply-test');
      } else if (
        ['about', 'scholarship', 'apply', 'roll-number', 'results', 'partners', 'gallery', 'contact'].includes(
          hash
        )
      ) {
        if (hash === 'partners' && (window.location.pathname.startsWith('/admin') || currentRoute === 'admin')) {
          setCurrentRoute('admin');
          setAdminTab('partners');
        } else {
          setCurrentRoute('public');
          setActiveTab(hash as PageTab);
        }
      }

    };

    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, [role]);

  const navigateTo = (route: AppRoute, tab?: AdminTab) => {
    let targetRoute = route;
    let targetTab = tab;

    if (targetRoute === 'scan' || targetTab === 'scan') {
      setCurrentRoute('scan');
      window.location.hash = 'scan';
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (targetTab && ['storage', 'fees', 'payroll'].includes(targetTab)) {
      targetTab = role === 'TEACHER' ? 'attendance' : 'dashboard';
    }

    if (targetTab === 'halls' && role !== 'SUPER_ADMIN' && role !== 'ADMIN') targetTab = 'dashboard';
    if (targetTab === 'attendance' && role !== 'SUPER_ADMIN' && role !== 'ADMIN' && role !== 'TEACHER') targetTab = 'dashboard';
    if (targetRoute === 'admin' && role === 'TEACHER' && targetTab !== 'settings') targetTab = 'attendance';
    setCurrentRoute(targetRoute);
    if (targetTab) setAdminTab(targetTab);
    window.location.hash = targetRoute === 'admin' ? targetTab || 'dashboard' : targetRoute === 'public' ? activeTab : targetRoute;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectTab = (tab: PageTab, customClass?: string) => {
    if (customClass) {
      setPrefillClass(customClass);
    }
    setActiveTab(tab);
    setCurrentRoute('public');
    window.location.hash = tab;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openGlobalFeeChallanModal = async () => {
    const { mockApi } = await import('./lib/mockApi');
    const list = await mockApi.getStudents();
    setStudentsForChallan(list);
    setIsGlobalFeeOpen(true);
  };

  // Route 1: Login Page
  if (currentRoute === 'login') {
    return (
      <Suspense fallback={<ViewLoadingFallback />}>
        <LoginPage
          onLoginSuccess={(tab) => {
            if (tab === 'scan') {
              navigateTo('scan');
            } else {
              navigateTo('admin', tab as AdminTab);
            }
          }}
          onNavigateHome={() => navigateTo('public')}
        />
      </Suspense>
    );
  }

  // Route 2: Public candidate registration (temporarily suspended)
  if (currentRoute === 'register') {
    return (
      <Suspense fallback={<ViewLoadingFallback />}>
        {PUBLIC_REGISTRATION_OPEN ? (
          <PublicCandidateRegistrationWizard
            onNavigateHome={() => navigateTo('public')}
            onNavigateLogin={() => navigateTo('login')}
          />
        ) : (
          <RegistrationSuspendedNotice
            onNavigateHome={() => navigateTo('public')}
            onNavigateLogin={() => navigateTo('login')}
          />
        )}
      </Suspense>
    );
  }

  // Route 3: Public Partner Institution Registration
  if (currentRoute === 'partner-registration') {
    return (
      <Suspense fallback={<ViewLoadingFallback />}>
        <PublicPartnerRegistrationPage
          onNavigateHome={() => navigateTo('public')}
          onNavigateLogin={() => navigateTo('login')}
        />
      </Suspense>
    );
  }

  // Route 4: Standalone mobile QR scanner (/scan)
  if (currentRoute === 'scan') {
    if (!isAuthenticated) {
      return (
        <Suspense fallback={<ViewLoadingFallback />}>
          <LoginPage
            onLoginSuccess={() => navigateTo('scan')}
            onNavigateHome={() => navigateTo('public')}
          />
        </Suspense>
      );
    }
    if (role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'TEACHER') {
      return (
        <Suspense fallback={<ViewLoadingFallback />}>
          <TeacherScanView
            onBackToDashboard={() => navigateTo('admin', role === 'TEACHER' ? 'attendance' : 'dashboard')}
          />
        </Suspense>
      );
    }
    return (
      <Suspense fallback={<ViewLoadingFallback />}>
        <DashboardView
          onNavigate={(tab) => navigateTo('admin', tab)}
          onOpenAddStudent={() => setIsGlobalAddStudentOpen(true)}
        />
      </Suspense>
    );
  }

  // Route 5: Admin Management Panel (Protected)
  if (currentRoute === 'admin') {
    if (!isAuthenticated) {
      return (
        <Suspense fallback={<ViewLoadingFallback />}>
          <LoginPage
            onLoginSuccess={() => navigateTo('admin', 'dashboard')}
            onNavigateHome={() => navigateTo('public')}
          />
        </Suspense>
      );
    }

    if (role === 'TEACHER') {
      if (adminTab === 'settings') {
        return (
          <Suspense fallback={<ViewLoadingFallback />}>
            <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
              <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between shadow-xs">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setAdminTab('attendance');
                      window.location.hash = 'attendance';
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition cursor-pointer"
                  >
                    <span>← Back to Attendance</span>
                  </button>
                  <div className="h-4 w-px bg-slate-200" />
                  <span className="text-xs font-bold text-slate-800 tracking-tight">
                    Teacher Account Settings
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="hidden sm:flex items-center gap-2 text-xs">
                    <span className="text-slate-500 font-medium">{user?.fullName || user?.name || user?.email}</span>
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                      TEACHER
                    </span>
                  </div>
                  <button
                    onClick={logout}
                    className="text-xs font-semibold text-slate-600 hover:text-red-600 px-2.5 py-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                  >
                    Sign Out
                  </button>
                </div>
              </header>
              <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8">
                <SettingsView />
              </main>
            </div>
          </Suspense>
        );
      }

      return (
        <Suspense fallback={<ViewLoadingFallback />}>
          <AdminLayout currentTab="attendance" onSelectTab={(tab) => navigateTo('admin', tab)}
            title="Examination Attendance Hub" subtitle="Hall-scoped examination sessions and frozen rosters">
            <AttendanceHubView />
          </AdminLayout>
        </Suspense>
      );
    }

    const getTabMeta = () => {

      switch (adminTab) {
        case 'dashboard':
          return { title: 'Executive Overview Dashboard', subtitle: 'Academic Session 2026-2027 Analytics' };
        case 'students':
          return { title: 'Student Management & Admissions', subtitle: 'Candidate profiles, biometric QR tokens, and transcripts' };
        case 'partners':
          return { title: 'Partner Institutions Directory', subtitle: 'Manage affiliated schools, colleges, academies, and exam venue accreditations' };
        case 'halls':
          return { title: 'Examination Halls & Seating', subtitle: 'Centers, rooms, candidate placement, and seating rosters' };
        case 'storage':
          return { title: 'Candidate Document Storage Vault', subtitle: 'Digital repository of photos, CNIC/B-Forms, DMCs, and payment receipts' };
        case 'attendance':
          return { title: 'Examination Attendance Hub', subtitle: 'Hall-scoped examination sessions and frozen rosters' };
        case 'fees':
          return { title: 'Fee Challans & Collections', subtitle: 'Automated billing, receipt generation, and income ledger' };
        case 'staff':
          return { title: 'Staff & Faculty Directory', subtitle: 'Teacher profiles, CNIC records, and roles' };
        case 'payroll':
          return { title: 'Payroll & Salary Disbursements', subtitle: 'Monthly voucher generation & expense settlement' };
        case 'transactions':
          return { title: 'Financial Ledger', subtitle: 'Double-entry cash flow records & audit trails' };
        case 'settings':
          return { title: 'System Settings & User RBAC', subtitle: 'School preferences and administrative access accounts' };
        default:
          return { title: 'Admin Management', subtitle: '' };
      }
    };

    const meta = getTabMeta();

    return (
      <Suspense fallback={<ViewLoadingFallback />}>
        <AdminLayout
          currentTab={adminTab}
          onSelectTab={(tab) => {
            if (tab === 'scan') {
              navigateTo('scan');
            } else if (['storage', 'fees', 'payroll'].includes(tab) || (tab === 'halls' && role !== 'SUPER_ADMIN' && role !== 'ADMIN') || (tab === 'attendance' && role !== 'SUPER_ADMIN' && role !== 'ADMIN')) {
              setAdminTab('dashboard');
              window.location.hash = 'dashboard';
            } else {
              setAdminTab(tab);
              window.location.hash = tab;
            }
          }}
          title={meta.title}
          subtitle={meta.subtitle}
          onOpenAddStudent={() => setIsGlobalAddStudentOpen(true)}
          onNavigatePublic={(path) => {
            if (path === '/') navigateTo('public');
            else if (path === '/register') navigateTo('register');
            else if (path === '/partner-registration') navigateTo('partner-registration');
          }}
        >
          {adminTab === 'dashboard' && (
            <DashboardView
              onNavigate={(tab) => {
                if (tab === 'scan') {
                  navigateTo('scan');
                } else if (['storage', 'fees', 'payroll'].includes(tab) || (tab === 'halls' && role !== 'SUPER_ADMIN' && role !== 'ADMIN') || (tab === 'attendance' && role !== 'SUPER_ADMIN' && role !== 'ADMIN')) {
                  setAdminTab('dashboard');
                  window.location.hash = 'dashboard';
                } else {
                  setAdminTab(tab);
                  window.location.hash = tab;
                }
              }}
              onOpenAddStudent={() => setIsGlobalAddStudentOpen(true)}
            />
          )}
          {adminTab === 'students' && <StudentsListView />}
          {adminTab === 'partners' && <AdminPartnersListView />}
          {adminTab === 'staff' && <StaffListView />}
          {adminTab === 'transactions' && <TransactionsListView />}
          {adminTab === 'settings' && <SettingsView />}
          {adminTab === 'halls' && (role === 'SUPER_ADMIN' || role === 'ADMIN') && <ExamHallsView />}
          {adminTab === 'attendance' && (role === 'SUPER_ADMIN' || role === 'ADMIN') && <AttendanceHubView />}
          {['storage', 'fees', 'payroll'].includes(adminTab) && (
            <DashboardView
              onNavigate={(tab) => {
                setAdminTab(tab);
                window.location.hash = tab;
              }}
              onOpenAddStudent={() => setIsGlobalAddStudentOpen(true)}
            />
          )}


          {/* Global Action Modals */}
          <AdminWalkInModal
            isOpen={isGlobalAddStudentOpen}
            onClose={() => setIsGlobalAddStudentOpen(false)}
            onSuccess={() => { /* The form shows confirmation and refreshes the roster. */ }}
          />

          <GenerateChallanModal
            isOpen={isGlobalFeeOpen}
            onClose={() => setIsGlobalFeeOpen(false)}
            onSuccess={() => {
              alert('Fee challans issued successfully.');
            }}
            students={studentsForChallan}
          />
        </AdminLayout>
      </Suspense>
    );
  }

  // Route 6: Public Website Portal (Home, About, Scholarship, Results, etc.)
  return (
    <div
      className={`min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans selection:bg-[#185b9d] selection:text-white ${
        language === 'ur' ? 'font-urdu' : ''
      }`}
    >
      <Header
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        onOpenMockExam={() => setIsMockModalOpen(true)}
        onOpenAlerts={() => setIsAlertModalOpen(true)}
        language={language}
        onToggleLanguage={() => setLanguage((l) => (l === 'en' ? 'ur' : 'en'))}
      />

      <main className="flex-1">
        {activeTab === 'home' && (
          <div key="home" className="animate-in fade-in duration-200">
            <HeroSection
              onSelectTab={handleSelectTab}
              onOpenMockExam={() => setIsMockModalOpen(true)}
              onOpenAlerts={() => setIsAlertModalOpen(true)}
              language={language}
            />
            <Suspense fallback={<div className="h-24" />}>
              <AlertsSection
                onSelectTab={handleSelectTab}
                onOpenAlertModal={() => setIsAlertModalOpen(true)}
              />
              <WhatsAppCommunitySection />
              <PartnerMarquee />
              <WorkflowBento onSelectTab={handleSelectTab} />
              <StudentTestimonials onSelectTab={handleSelectTab} />
              <FeeCalculator onSelectTab={handleSelectTab} />
              <LeadershipSection />
              <FaqSection onSelectTab={handleSelectTab} />
            </Suspense>
          </div>
        )}

        {activeTab === 'about' && (
          <div key="about" className="animate-in fade-in duration-200">
            <Suspense fallback={<ViewLoadingFallback />}>
              <AboutView onSelectTab={handleSelectTab} />
            </Suspense>
          </div>
        )}

        {activeTab === 'scholarship' && (
          <div key="scholarship" className="animate-in fade-in duration-200">
            <Suspense fallback={<ViewLoadingFallback />}>
              <ScholarshipView
                onSelectTab={handleSelectTab}
                onOpenMockExam={() => setIsMockModalOpen(true)}
              />
            </Suspense>
          </div>
        )}

        {activeTab === 'apply' && (
          <div key="apply" className="animate-in fade-in duration-200">
            <Suspense fallback={<ViewLoadingFallback />}>
              {PUBLIC_REGISTRATION_OPEN ? (
                <ApplicationPortal
                  initialClass={prefillClass}
                  onSelectTab={handleSelectTab}
                />
              ) : (
                <ApplicationClosedNotice onSelectTab={handleSelectTab} />
              )}
            </Suspense>
          </div>
        )}

        {activeTab === 'apply-test' && (
          <div key="apply-test" className="animate-in fade-in duration-200">
            <Suspense fallback={<ViewLoadingFallback />}>
              {PUBLIC_REGISTRATION_OPEN ? (
                <>
                  <div className="bg-amber-400 text-slate-950 px-4 py-2.5 text-xs font-black text-center border-b border-amber-500 shadow-xs">
                    Internal registration testing sandbox
                  </div>
                  <ApplicationPortal
                    initialClass={prefillClass}
                    onSelectTab={handleSelectTab}
                  />
                </>
              ) : (
                <ApplicationClosedNotice onSelectTab={handleSelectTab} />
              )}
            </Suspense>
          </div>
        )}

        {activeTab === 'roll-number' && (
          <div key="roll-number" className="animate-in fade-in duration-200">
            <Suspense fallback={<ViewLoadingFallback />}>
              <RollNumberSlipView onSelectTab={handleSelectTab} />
            </Suspense>
          </div>
        )}

        {activeTab === 'results' && (
          <div key="results" className="animate-in fade-in duration-200">
            <Suspense fallback={<ViewLoadingFallback />}>
              <ResultsDeskView onSelectTab={handleSelectTab} />
            </Suspense>
          </div>
        )}

        {activeTab === 'partners' && (
          <div key="partners" className="animate-in fade-in duration-200">
            <Suspense fallback={<ViewLoadingFallback />}>
              <PartnerDirectoryView onSelectTab={handleSelectTab} />
            </Suspense>
          </div>
        )}

        {activeTab === 'gallery' && (
          <div key="gallery" className="animate-in fade-in duration-200">
            <Suspense fallback={<ViewLoadingFallback />}>
              <GalleryView onSelectTab={handleSelectTab} />
            </Suspense>
          </div>
        )}

        {activeTab === 'contact' && (
          <div key="contact" className="animate-in fade-in duration-200">
            <Suspense fallback={<ViewLoadingFallback />}>
              <ContactView onSelectTab={handleSelectTab} />
            </Suspense>
          </div>
        )}
      </main>

      <Suspense fallback={null}>
        {isMockModalOpen && (
          <MockExamModal isOpen={isMockModalOpen} onClose={() => setIsMockModalOpen(false)} />
        )}
        {isAlertModalOpen && (
          <RegistrationAlertModal
            isOpen={isAlertModalOpen}
            onClose={() => setIsAlertModalOpen(false)}
            onSelectTab={handleSelectTab}
          />
        )}
        <WhatsAppButton />
      </Suspense>

      <Suspense fallback={<div className="h-32" />}>
        <Footer onSelectTab={handleSelectTab} language={language} />
      </Suspense>
    </div>
  );
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('App Uncaught Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#030712] text-white flex flex-col items-center justify-center p-6 text-center">
          <div className="max-w-md p-8 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl">
            <h2 className="text-xl font-bold text-red-400 mb-2">Portal Encountered an Issue</h2>
            <p className="text-xs text-slate-400 mb-6">
              A temporary issue occurred while loading this view. Please refresh or return to the home page.
            </p>
            <button
              onClick={() => {
                window.location.hash = '';
                window.location.reload();
              }}
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all"
            >
              Refresh Portal
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}
