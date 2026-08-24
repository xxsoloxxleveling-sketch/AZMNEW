import React, { useState, useEffect, lazy, Suspense } from 'react';
import { PageTab } from './types';
import { Header } from './components/common/Header';
import { Footer } from './components/common/Footer';
import { WhatsAppButton } from './components/common/WhatsAppButton';
import { HeroSection } from './components/home/HeroSection';
import { AlertsSection } from './components/home/AlertsSection';
import { RegistrationAlertModal } from './components/home/RegistrationAlertModal';
import { PartnerMarquee } from './components/home/PartnerMarquee';
import { WorkflowBento } from './components/home/WorkflowBento';
import { FeeCalculator } from './components/home/FeeCalculator';
import { LeadershipSection } from './components/home/LeadershipSection';
import { StudentTestimonials } from './components/home/StudentTestimonials';
import { FaqSection } from './components/home/FaqSection';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2 } from 'lucide-react';

import { AuthProvider, useAuth } from './lib/authContext';
import { AdminTab } from './components/admin/layout/AdminSidebar';
import { AdminLayout } from './components/admin/layout/AdminLayout';
import { DashboardView } from './components/admin/dashboard/DashboardView';
import { StudentsListView } from './components/admin/students/StudentsListView';
import { AttendanceHubView } from './components/admin/attendance/AttendanceHubView';
import { TeacherScanView } from './components/admin/attendance/TeacherScanView';
import { FeesListView } from './components/admin/fees/FeesListView';
import { StaffListView } from './components/admin/staff/StaffListView';
import { PayrollListView } from './components/admin/payroll/PayrollListView';
import { TransactionsListView } from './components/admin/transactions/TransactionsListView';
import { SettingsView } from './components/admin/settings/SettingsView';
import { AdminWalkInModal } from './components/admin/students/AdminWalkInModal';
import { GenerateChallanModal } from './components/admin/fees/GenerateChallanModal';
import { mockApi, MockStudent } from './lib/mockApi';

// Public Lazy Views
const LoginPage = lazy(() =>
  import('./components/public/auth/LoginPage').then((m) => ({ default: m.LoginPage }))
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

type AppRoute = 'public' | 'login' | 'register' | 'partner-registration' | 'scan' | 'admin';

function AppContent() {
  const { user, role, isAuthenticated } = useAuth();
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

  // Hash-based route listener for browser URLs (e.g. #dashboard, #login, #register, #scan)
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace('#', '').toLowerCase();
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
      } else if (
        ['dashboard', 'students', 'attendance', 'fees', 'staff', 'payroll', 'transactions', 'settings'].includes(
          hash
        )
      ) {
        setCurrentRoute('admin');
        setAdminTab(hash as AdminTab);
      } else if (
        ['about', 'scholarship', 'apply', 'roll-number', 'results', 'partners', 'gallery', 'contact'].includes(
          hash
        )
      ) {
        setCurrentRoute('public');
        setActiveTab(hash as PageTab);
      }
    };

    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const navigateTo = (route: AppRoute, tab?: AdminTab) => {
    setCurrentRoute(route);
    if (tab) setAdminTab(tab);
    window.location.hash = route === 'admin' ? tab || 'dashboard' : route === 'public' ? activeTab : route;
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

  // Route 2: Public Candidate 8-Stage Registration Wizard
  if (currentRoute === 'register') {
    return (
      <Suspense fallback={<ViewLoadingFallback />}>
        <PublicCandidateRegistrationWizard
          onNavigateHome={() => navigateTo('public')}
          onNavigateLogin={() => navigateTo('login')}
        />
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

  // Route 4: Standalone Teacher QR Scanner (/scan)
  if (currentRoute === 'scan') {
    if (!isAuthenticated) {
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
    return <TeacherScanView onBackToDashboard={() => navigateTo('admin', 'dashboard')} />;
  }

  // Route 5: Admin Management Panel (Protected)
  if (currentRoute === 'admin') {
    if (!isAuthenticated) {
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
    const getTabMeta = () => {

      switch (adminTab) {
        case 'dashboard':
          return { title: 'Executive Overview Dashboard', subtitle: 'Academic Session 2026-2027 Analytics' };
        case 'students':
          return { title: 'Student Management & Admissions', subtitle: 'Candidate profiles, biometric QR tokens, and transcripts' };
        case 'attendance':
          return { title: 'Attendance & QR Verification Hub', subtitle: 'Biometric scanning & daily roll registry' };
        case 'fees':
          return { title: 'Fee Challans & Collections', subtitle: 'Automated billing, receipt generation, and income ledger' };
        case 'staff':
          return { title: 'Staff & Faculty Directory', subtitle: 'Teacher profiles, CNIC records, and roles' };
        case 'payroll':
          return { title: 'Payroll & Salary Disbursements', subtitle: 'Monthly voucher generation & expense settlement' };
        case 'transactions':
          return { title: 'General Financial Ledger', subtitle: 'Double-entry cash flow records & audit trails' };
        case 'settings':
          return { title: 'System Settings & User RBAC', subtitle: 'School preferences and administrative access accounts' };
        default:
          return { title: 'Admin Management', subtitle: '' };
      }
    };

    const meta = getTabMeta();

    return (
      <AdminLayout
        currentTab={adminTab}
        onSelectTab={(tab) => {
          if (tab === 'scan') {
            navigateTo('scan');
          } else {
            setAdminTab(tab);
            window.location.hash = tab;
          }
        }}
        title={meta.title}
        subtitle={meta.subtitle}
        onOpenAddStudent={() => setIsGlobalAddStudentOpen(true)}
        onOpenMarkAttendance={() => {
          setAdminTab('attendance');
          window.location.hash = 'attendance';
        }}
        onOpenGenerateFee={openGlobalFeeChallanModal}
        onNavigatePublic={(path) => {
          if (path === '/') navigateTo('public');
          else if (path === '/register') navigateTo('register');
          else if (path === '/partner-registration') navigateTo('partner-registration');
        }}
      >
        {adminTab === 'dashboard' && (
          <DashboardView
            onNavigate={(tab) => {
              setAdminTab(tab);
              window.location.hash = tab;
            }}
            onOpenAddStudent={() => setIsGlobalAddStudentOpen(true)}
            onOpenMarkAttendance={() => {
              setAdminTab('attendance');
              window.location.hash = 'attendance';
            }}
            onOpenGenerateFee={openGlobalFeeChallanModal}
          />
        )}
        {adminTab === 'students' && <StudentsListView />}
        {adminTab === 'attendance' && <AttendanceHubView />}
        {adminTab === 'fees' && <FeesListView />}
        {adminTab === 'staff' && <StaffListView />}
        {adminTab === 'payroll' && <PayrollListView />}
        {adminTab === 'transactions' && <TransactionsListView />}
        {adminTab === 'settings' && <SettingsView />}

        {/* Global Action Modals */}
        <AdminWalkInModal
          isOpen={isGlobalAddStudentOpen}
          onClose={() => setIsGlobalAddStudentOpen(false)}
          onSuccess={() => {
            alert('Student walk-in admission enrolled successfully.');
            if (adminTab === 'students') {
              window.location.reload();
            }
          }}
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
        <AnimatePresence mode="wait">
          {activeTab === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <HeroSection
                onSelectTab={handleSelectTab}
                onOpenMockExam={() => setIsMockModalOpen(true)}
                onOpenAlerts={() => setIsAlertModalOpen(true)}
                language={language}
              />
              <AlertsSection
                onSelectTab={handleSelectTab}
                onOpenAlertModal={() => setIsAlertModalOpen(true)}
              />
              <PartnerMarquee />
              <WorkflowBento onSelectTab={handleSelectTab} />
              <StudentTestimonials onSelectTab={handleSelectTab} />
              <FeeCalculator onSelectTab={handleSelectTab} />
              <LeadershipSection />
              <FaqSection onSelectTab={handleSelectTab} />
            </motion.div>
          )}

          {activeTab === 'about' && (
            <motion.div
              key="about"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <Suspense fallback={<ViewLoadingFallback />}>
                <AboutView onSelectTab={handleSelectTab} />
              </Suspense>
            </motion.div>
          )}

          {activeTab === 'scholarship' && (
            <motion.div
              key="scholarship"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <Suspense fallback={<ViewLoadingFallback />}>
                <ScholarshipView
                  onSelectTab={handleSelectTab}
                  onOpenMockExam={() => setIsMockModalOpen(true)}
                />
              </Suspense>
            </motion.div>
          )}

          {activeTab === 'apply' && (
            <motion.div
              key="apply"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <Suspense fallback={<ViewLoadingFallback />}>
                <ApplicationPortal
                  initialClass={prefillClass}
                  onSelectTab={handleSelectTab}
                />
              </Suspense>
            </motion.div>
          )}

          {activeTab === 'roll-number' && (
            <motion.div
              key="roll-number"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <Suspense fallback={<ViewLoadingFallback />}>
                <RollNumberSlipView onSelectTab={handleSelectTab} />
              </Suspense>
            </motion.div>
          )}

          {activeTab === 'results' && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <Suspense fallback={<ViewLoadingFallback />}>
                <ResultsDeskView onSelectTab={handleSelectTab} />
              </Suspense>
            </motion.div>
          )}

          {activeTab === 'partners' && (
            <motion.div
              key="partners"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <Suspense fallback={<ViewLoadingFallback />}>
                <PartnerDirectoryView onSelectTab={handleSelectTab} />
              </Suspense>
            </motion.div>
          )}

          {activeTab === 'gallery' && (
            <motion.div
              key="gallery"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <Suspense fallback={<ViewLoadingFallback />}>
                <GalleryView onSelectTab={handleSelectTab} />
              </Suspense>
            </motion.div>
          )}

          {activeTab === 'contact' && (
            <motion.div
              key="contact"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <Suspense fallback={<ViewLoadingFallback />}>
                <ContactView onSelectTab={handleSelectTab} />
              </Suspense>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <Suspense fallback={null}>
        {isMockModalOpen && (
          <MockExamModal isOpen={isMockModalOpen} onClose={() => setIsMockModalOpen(false)} />
        )}
      </Suspense>

      <RegistrationAlertModal
        isOpen={isAlertModalOpen}
        onClose={() => setIsAlertModalOpen(false)}
        onSelectTab={handleSelectTab}
      />

      <WhatsAppButton />

      <Footer onSelectTab={handleSelectTab} language={language} />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
