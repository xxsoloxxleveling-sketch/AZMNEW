import React, { useState, useEffect, useRef } from 'react';
import { PageTab } from '../../types';
import { Logo } from './Logo';
import { 
  Menu, 
  X, 
  Sparkles,
  ArrowRight, 
  Phone,
  ChevronDown,
  BellRing,
  MessageCircle,
  Globe
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface HeaderProps {
  activeTab: PageTab;
  onSelectTab: (tab: PageTab) => void;
  onOpenMockExam?: () => void;
  onOpenAlerts?: () => void;
  language?: 'en' | 'ur';
  onToggleLanguage?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ 
  activeTab, 
  onSelectTab, 
  onOpenAlerts,
  language = 'en',
  onToggleLanguage
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const moreDropdownRef = useRef<HTMLDivElement | null>(null);

  // Close "More" dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moreDropdownRef.current && !moreDropdownRef.current.contains(event.target as Node)) {
        setMoreMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Primary Essential Nav Items (Clean Text-only)
  const primaryNavItems: { id: PageTab; label: string; labelUr: string }[] = [
    { id: 'home', label: 'Home', labelUr: 'صفحۂ اول' },
    { id: 'about', label: 'About AZM', labelUr: 'ہمارے بارے میں' },
    { id: 'scholarship', label: 'Scholarships', labelUr: 'وظائف کی تفصیل' },
    { id: 'apply', label: 'Apply Portal', labelUr: 'آن لائن داخلہ' },
    { id: 'roll-number', label: 'Roll No Slip', labelUr: 'رول نمبر سلپ' },
    { id: 'results', label: 'Results & Merit', labelUr: 'نتائج اور میرٹ' },
  ];

  // Secondary items in the "More" dropdown
  const secondaryNavItems: { id: PageTab; label: string; labelUr: string; description: string }[] = [
    { id: 'partners', label: 'Partner Schools', labelUr: 'شراکت دار تعلیمی ادارے', description: 'Accredited test centers & institutions' },
    { id: 'gallery', label: 'Media Gallery', labelUr: 'تصویری گیلری', description: '68 real photos from Sessions I-IV' },
    { id: 'contact', label: 'Contact & Support', labelUr: 'رابطہ اور شکایات', description: 'Helpline, offices, & FAQ desk' },
  ];

  const isSecondaryActive = secondaryNavItems.some(item => item.id === activeTab);

  return (
    <header className="sticky top-0 z-50 w-full transition-all duration-300">
      {/* 1. Trimmed Top Utility Bar: Registration status + Helpline + WhatsApp + Urdu Toggle */}
      <div 
        className={`w-full bg-[#020617] border-b border-blue-900/40 text-slate-300 transition-all duration-300 overflow-hidden ${
          isScrolled ? 'max-h-0 opacity-0 py-0 border-transparent' : 'max-h-11 opacity-100 py-1.5'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-emerald-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{language === 'ur' ? 'سیشن 5 (2026) رجسٹریشن جاری ہے • فیس 300 روپے' : 'Session V (2026) Registration Open • PKR 300 Fee'}</span>

          </div>
          
          <div className="flex items-center gap-3 sm:gap-4 text-slate-300">
            {/* WhatsApp Link */}
            <a 
              href="https://wa.me/923051755551?text=Hello%20AZM.AIO%20Scholarship%20Desk%2C%20I%20have%20an%20inquiry%20regarding%20Session%20V%20Scholarship%20Test."
              target="_blank" 
              rel="noreferrer"
              className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
              title="Chat with Candidate Support on WhatsApp"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">WhatsApp</span>
            </a>

            {/* Helpline */}
            <div className="flex items-center gap-1.5 text-slate-300">
              <Phone className="w-3.5 h-3.5 text-[#38bdf8]" />
              <span className="hidden md:inline">Helpline:</span>
              <a href="tel:03051755551" className="text-white font-mono font-semibold hover:text-[#38bdf8] transition-colors">
                0305-1755551
              </a>
            </div>
          </div>
        </div>
      </div>


      {/* 2. Main Navigation Bar with clean floating glass on scroll */}
      <div 
        className={`w-full transition-all duration-300 ease-in-out ${
          isScrolled 
            ? 'py-2 px-3 sm:px-6 lg:px-8 max-w-7xl mx-auto' 
            : 'py-3 px-4 sm:px-6 lg:px-8 bg-[#030712]/95 border-b border-blue-900/40 shadow-lg'
        }`}
      >
        <div 
          className={`flex items-center justify-between transition-all duration-300 ${
            isScrolled 
              ? 'rounded-2xl px-4 sm:px-6 py-2.5 bg-[#030712]/85 backdrop-blur-xl border border-blue-500/30 shadow-[0_8px_32px_rgba(2,6,23,0.7),0_0_20px_rgba(56,189,248,0.15)]' 
              : 'max-w-7xl mx-auto'
          }`}
        >
          {/* Simplified Brand / Logo Block */}
          <button
            onClick={() => {
              onSelectTab('home');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="focus:outline-hidden text-left group flex-shrink-0"
            id="btn-logo-home"
          >
            <Logo size="md" variant="dark" showSubtitle={true} />
          </button>

          {/* Clean Primary Navigation with Generous Spacing */}
          <nav className="hidden lg:flex items-center gap-1.5 xl:gap-2">
            {primaryNavItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  id={`nav-${item.id}`}
                  onClick={() => onSelectTab(item.id)}
                  className={`relative px-3.5 py-2 text-xs xl:text-sm font-semibold rounded-xl transition-all whitespace-nowrap focus:outline-hidden ${
                    isActive
                      ? 'text-white'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeNavPill"
                      className="absolute inset-0 bg-blue-600/30 border border-[#38bdf8]/40 rounded-xl shadow-xs"
                      transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                    />
                  )}
                  <span className="relative z-10">{language === 'ur' ? item.labelUr : item.label}</span>
                </button>
              );
            })}

            {/* "More" Dropdown Menu */}
            <div className="relative" ref={moreDropdownRef}>
              <button
                id="btn-nav-more"
                onClick={() => setMoreMenuOpen(!moreMenuOpen)}
                className={`px-3 py-2 text-xs xl:text-sm font-semibold rounded-xl transition-all flex items-center gap-1.5 focus:outline-hidden ${
                  isSecondaryActive || moreMenuOpen
                    ? 'text-white bg-blue-950/60 border border-blue-800/70'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <span>{language === 'ur' ? 'مزید' : 'More'}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${moreMenuOpen ? 'rotate-180 text-[#38bdf8]' : 'text-slate-400'}`} />
              </button>

              <AnimatePresence>
                {moreMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2 w-64 p-2 bg-[#030712]/95 backdrop-blur-xl border border-blue-900/60 rounded-2xl shadow-2xl z-50 divide-y divide-slate-800/60"
                  >
                    <div className="space-y-1">
                      {secondaryNavItems.map((secItem) => {
                        const isSecActive = activeTab === secItem.id;
                        return (
                          <button
                            key={secItem.id}
                            id={`dropdown-nav-${secItem.id}`}
                            onClick={() => {
                              onSelectTab(secItem.id);
                              setMoreMenuOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2.5 rounded-xl transition-all flex flex-col ${
                              isSecActive
                                ? 'bg-gradient-to-r from-blue-900/60 to-blue-950/80 text-white border border-blue-700/50'
                                : 'text-slate-200 hover:bg-slate-800/70 hover:text-white'
                            }`}
                          >
                            <span className="text-xs font-semibold">{language === 'ur' ? secItem.labelUr : secItem.label}</span>
                            <span className="text-[10px] text-slate-400 font-normal mt-0.5">{secItem.description}</span>
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </nav>

          {/* Right Action: Live Alerts Bell & High-Contrast Apply Online Button */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Live Alerts Bell Button */}
            <button
              id="btn-header-alerts"
              onClick={() => {
                if (onOpenAlerts) onOpenAlerts();
              }}
              className="relative p-2 sm:p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-amber-300 border border-slate-700/80 hover:border-amber-400/50 shadow-xs transition-all flex items-center justify-center focus:outline-hidden group"
              title="View Live Official Alerts & Registration Updates"
              aria-label="View Live Alerts"
            >
              <BellRing className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-amber-400 group-hover:scale-110 transition-transform animate-pulse" />
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500 border border-slate-950 text-[8px] font-bold text-slate-950 items-center justify-center">1</span>
              </span>
            </button>

            {/* Primary CTA Button: Clear Visual Anchor */}
            <div className="hidden sm:flex items-center">
              <button
                id="btn-header-apply"
                onClick={() => onSelectTab('apply')}
                className="relative group overflow-hidden px-5 py-2.5 text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-[#185b9d] via-[#1d63a8] to-[#0f4477] hover:from-[#1d6bb8] hover:to-[#124d85] rounded-xl border border-[#38bdf8]/50 shadow-[0_0_20px_rgba(24,91,157,0.5)] hover:shadow-[0_0_30px_rgba(56,189,248,0.7)] transition-all transform hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-2 focus:outline-hidden"
              >
                <Sparkles className="w-4 h-4 text-sky-300 animate-pulse" />
                <span>{language === 'ur' ? 'آن لائن درخواست دیں' : 'Apply Online'}</span>
                <ArrowRight className="w-4 h-4 text-sky-200 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>

            {/* Mobile Controls */}
            <div className="flex lg:hidden items-center gap-1.5">
              <button
                id="btn-mobile-apply-quick"
                onClick={() => onSelectTab('apply')}
                className="sm:hidden px-3.5 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-[#185b9d] to-[#0f4477] rounded-lg border border-blue-500/40 shadow-xs"
              >
                Apply
              </button>
              <button
                id="btn-mobile-menu-toggle"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-xl text-slate-200 hover:bg-slate-800 border border-slate-700/80 transition-colors focus:outline-hidden"
                aria-label="Toggle navigation menu"
              >
                {mobileMenuOpen ? <X className="w-5 h-5 text-white" /> : <Menu className="w-5 h-5 text-white" />}
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Responsive Mobile Drawer Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="lg:hidden px-4 py-3 bg-[#030712]/95 backdrop-blur-2xl border-b border-blue-900/60 shadow-2xl max-w-7xl mx-auto space-y-3"
          >
            {/* Primary Links */}
            <div className="grid grid-cols-2 gap-1.5 pb-3 border-b border-slate-800/80">
              {primaryNavItems.map((item) => (
                <button
                  key={item.id}
                  id={`mobile-nav-${item.id}`}
                  onClick={() => {
                    onSelectTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`px-3.5 py-2.5 text-xs font-semibold rounded-xl text-left transition-colors ${
                    activeTab === item.id
                      ? 'bg-blue-600 text-white border border-[#38bdf8]/40 shadow-xs'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  {language === 'ur' ? item.labelUr : item.label}
                </button>
              ))}
            </div>

            {/* Secondary Links from "More" */}
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-1 mb-1.5">
                More Pages
              </div>
              <div className="grid grid-cols-1 gap-1">
                {secondaryNavItems.map((item) => (
                  <button
                    key={item.id}
                    id={`mobile-nav-sec-${item.id}`}
                    onClick={() => {
                      onSelectTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`flex items-center justify-between px-3 py-2 text-xs font-medium rounded-lg text-left transition-colors ${
                      activeTab === item.id
                        ? 'bg-slate-800 text-[#38bdf8]'
                        : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                    }`}
                  >
                    <span>{language === 'ur' ? item.labelUr : item.label}</span>
                    <span className="text-[10px] text-slate-500">{item.description}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Mobile Language Switcher & WhatsApp Link */}
            <div className="pt-2 flex items-center justify-between text-xs border-t border-slate-800">
              <a
                href="https://wa.me/923051755551?text=Hello%20AZM.AIO%20Scholarship%20Desk"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-emerald-400 font-semibold py-1.5"
              >
                <MessageCircle className="w-4 h-4" />
                <span>WhatsApp Helpline</span>
              </a>

              {onToggleLanguage && (
                <button
                  onClick={onToggleLanguage}
                  className="flex items-center gap-1 px-3 py-1 rounded-lg bg-slate-800 text-slate-200 font-bold border border-slate-700"
                >
                  <Globe className="w-3.5 h-3.5 text-[#38bdf8]" />
                  <span>{language === 'en' ? 'اردو میں دیکھیں' : 'Switch to English'}</span>
                </button>
              )}
            </div>

            {/* Full-width Primary CTA Button */}
            <div className="pt-1">
              <button
                onClick={() => {
                  onSelectTab('apply');
                  setMobileMenuOpen(false);
                }}
                className="w-full flex items-center justify-center gap-2 py-3 text-xs sm:text-sm font-bold bg-gradient-to-r from-[#185b9d] via-[#1d63a8] to-[#0f4477] text-white rounded-xl shadow-lg border border-[#38bdf8]/50"
              >
                <Sparkles className="w-4 h-4 text-sky-300 animate-pulse" />
                <span>Apply Online (Session V 2026)</span>
                <ArrowRight className="w-4 h-4 text-sky-200" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};
