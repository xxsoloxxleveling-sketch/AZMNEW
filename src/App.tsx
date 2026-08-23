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

// Lazy-load non-home route chunks for hyper-fast initial payload and instant First Contentful Paint
const AboutView = lazy(() => import('./components/about/AboutView').then(m => ({ default: m.AboutView })));
const ScholarshipView = lazy(() => import('./components/scholarship/ScholarshipView').then(m => ({ default: m.ScholarshipView })));
const ApplicationPortal = lazy(() => import('./components/apply/ApplicationPortal').then(m => ({ default: m.ApplicationPortal })));
const RollNumberSlipView = lazy(() => import('./components/rollnumber/RollNumberSlipView').then(m => ({ default: m.RollNumberSlipView })));
const ResultsDeskView = lazy(() => import('./components/results/ResultsDeskView').then(m => ({ default: m.ResultsDeskView })));
const PartnerDirectoryView = lazy(() => import('./components/partners/PartnerDirectoryView').then(m => ({ default: m.PartnerDirectoryView })));
const GalleryView = lazy(() => import('./components/gallery/GalleryView').then(m => ({ default: m.GalleryView })));
const ContactView = lazy(() => import('./components/contact/ContactView').then(m => ({ default: m.ContactView })));
const MockExamModal = lazy(() => import('./components/practice/MockExamModal').then(m => ({ default: m.MockExamModal })));

// Ultra lightweight Suspense fallback
const ViewLoadingFallback = () => (
  <div className="py-24 flex flex-col items-center justify-center min-h-[50vh] text-slate-500 space-y-3">
    <Loader2 className="w-8 h-8 text-[#185b9d] animate-spin" />
    <span className="text-xs font-semibold tracking-wider uppercase text-slate-400">Loading Portal Section...</span>
  </div>
);

export default function App() {
  const [activeTab, setActiveTab] = useState<PageTab>('home');
  const [prefillClass, setPrefillClass] = useState<string>('');
  const [isMockModalOpen, setIsMockModalOpen] = useState<boolean>(false);
  const [isAlertModalOpen, setIsAlertModalOpen] = useState<boolean>(false);
  const [language, setLanguage] = useState<'en' | 'ur'>('en');

  const toggleLanguage = () => {
    setLanguage(prev => (prev === 'en' ? 'ur' : 'en'));
  };

  // Check and trigger registration alert popup on initial visit (if not dismissed today)
  useEffect(() => {
    try {
      const dismissedDate = localStorage.getItem('AZM_DISMISS_REG_ALERT');
      const today = new Date().toDateString();
      if (dismissedDate !== today) {
        const timer = setTimeout(() => {
          setIsAlertModalOpen(true);
        }, 900);
        return () => clearTimeout(timer);
      }
    } catch (e) {
      setIsAlertModalOpen(true);
    }
  }, []);

  // Handle Tab Switch with smooth window scroll to top
  const handleSelectTab = (tab: PageTab, customClass?: string) => {
    if (customClass) {
      setPrefillClass(customClass);
    }
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Synchronize hash routing if any user enters via hash URL
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '') as PageTab;
      if (['home', 'about', 'scholarship', 'apply', 'roll-number', 'results', 'partners', 'gallery', 'contact'].includes(hash)) {
        setActiveTab(hash);
      }
    };
    if (window.location.hash) {
      handleHashChange();
    }
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  return (
    <div className={`min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans selection:bg-[#185b9d] selection:text-white ${language === 'ur' ? 'font-urdu' : ''}`}>
      {/* Top Header Navigation */}
      <Header
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        onOpenMockExam={() => setIsMockModalOpen(true)}
        onOpenAlerts={() => setIsAlertModalOpen(true)}
        language={language}
        onToggleLanguage={toggleLanguage}
      />

      {/* Main Page Body View Switcher */}
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
              {/* Official Notices & Live Alerts Section */}
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

      {/* Global Interactive Mock Exam Question Bank Simulator Modal */}
      <Suspense fallback={null}>
        {isMockModalOpen && (
          <MockExamModal
            isOpen={isMockModalOpen}
            onClose={() => setIsMockModalOpen(false)}
          />
        )}
      </Suspense>

      {/* Session V Upcoming Test Registration Announcement Modal */}
      <RegistrationAlertModal
        isOpen={isAlertModalOpen}
        onClose={() => setIsAlertModalOpen(false)}
        onSelectTab={handleSelectTab}
      />

      {/* Floating Direct WhatsApp Support Button */}
      <WhatsAppButton />

      {/* Institutional Footer */}
      <Footer onSelectTab={handleSelectTab} language={language} />
    </div>
  );
}
