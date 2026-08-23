import React, { useState, useEffect } from 'react';
import { PageTab } from '../../types';
import { CosmicBackground } from './CosmicBackground';
import { 
  Sparkles, 
  ArrowRight, 
  Search, 
  Award, 
  Users, 
  BookOpen, 
  Clock, 
  ChevronRight, 
  Calendar
} from 'lucide-react';
import { motion } from 'motion/react';

interface HeroSectionProps {
  onSelectTab: (tab: PageTab) => void;
  onOpenMockExam?: () => void;
  onOpenAlerts?: () => void;
  language?: 'en' | 'ur';
}

export const HeroSection: React.FC<HeroSectionProps> = ({ 
  onSelectTab, 
  onOpenMockExam, 
  onOpenAlerts,
  language = 'en'
}) => {
  // Live countdown timer to 30 Aug 2026 23:59:59 PST
  const [timeLeft, setTimeLeft] = useState({
    days: 6,
    hours: 21,
    minutes: 48,
    seconds: 15
  });

  // Fast Candidate Lookup State
  const [quickQuery, setQuickQuery] = useState('');
  const [searchFeedback, setSearchFeedback] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev.seconds > 0) {
          return { ...prev, seconds: prev.seconds - 1 };
        } else if (prev.minutes > 0) {
          return { ...prev, minutes: 59, seconds: 59 };
        } else if (prev.hours > 0) {
          return { ...prev, hours: prev.hours - 1, minutes: 59, seconds: 59 };
        } else if (prev.days > 0) {
          return { ...prev, days: prev.days - 1, hours: 23, minutes: 59, seconds: 59 };
        }
        return prev;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleQuickLookup = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = quickQuery.trim();
    if (!clean) {
      setSearchFeedback('Please enter your CNIC (e.g. 13501-...) or Roll Number');
      return;
    }
    onSelectTab('roll-number');
  };

  const keyStats = [
    {
      label: 'Session V Scholarships',
      value: '500 Seats',
      sub: 'Grade 6th to University BS',
      icon: Award,
      badge: 'Zero Public Funds'
    },
    {
      label: 'Accredited Testing Centers',
      value: '150+ Institutes',
      sub: 'Hazara Division & KP Schools',
      icon: Users,
      badge: 'Transparent Halls'
    },
    {
      label: 'Published Course Books',
      value: '1,000 MCQs',
      sub: '100% Questions from Syllabus',
      icon: BookOpen,
      badge: 'Optical OMR'
    }
  ];

  return (
    <section className="relative w-full min-h-[85vh] lg:min-h-[92vh] flex flex-col justify-between pt-8 pb-16 lg:pt-14 lg:pb-20 overflow-hidden text-white bg-[#030712]">
      {/* Background with Cosmic Planetary Globe & Constellation Particles */}
      <CosmicBackground />

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center flex-1 flex flex-col justify-center items-center">
        
        {/* Top Feature Pill Badge (Interactive Live Alert Trigger) */}
        <motion.button
          type="button"
          onClick={() => {
            if (onOpenAlerts) onOpenAlerts();
          }}
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/90 hover:bg-slate-800/95 border border-amber-400/40 hover:border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.15)] backdrop-blur-md mb-6 transition-all cursor-pointer group focus:outline-hidden"
        >
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          <span className="text-xs sm:text-sm font-semibold text-amber-300 group-hover:text-amber-200">
            {language === 'ur' ? 'سیشن 5 ٹیسٹ رجسٹریشن جاری ہے • مفت داخلہ' : 'Session V Scholarship Test Registration is Open (PKR 0 Fee)'}
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-amber-400 group-hover:translate-x-0.5 transition-transform" />
        </motion.button>

        {/* Centered Hero Title */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-4xl sm:text-6xl lg:text-7xl font-display font-extrabold tracking-tight leading-[1.15] sm:leading-[1.12]"
        >
          <span className="bg-gradient-to-r from-[#60a5fa] via-[#38bdf8] to-[#93c5fd] bg-clip-text text-transparent drop-shadow-[0_0_35px_rgba(56,189,248,0.3)]">
            Self-Funded Scholarships
          </span>{' '}
          <span className="text-white">for</span>
          <div className="text-white mt-1">Deserving Students</div>
        </motion.h1>

        {/* Subtitle Description */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-6 text-base sm:text-lg lg:text-xl text-slate-300/90 max-w-2xl font-normal leading-relaxed text-balance"
        >
          No favoritism, no hidden scoring — just a test, an optical scan, and a verified interview. Merit-based testing conducted across schools and colleges in Khyber Pakhtunkhwa.
        </motion.p>

        {/* Prominent Live Urgency Countdown Timer */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.25 }}
          className="mt-6 p-3 sm:p-4 rounded-2xl bg-slate-900/80 backdrop-blur-md border border-slate-700/80 shadow-lg inline-flex flex-col sm:flex-row items-center gap-3 sm:gap-4"
        >
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
            <span>Registration Closes: <strong className="text-white">30 August 2026</strong></span>
          </div>

          <div className="flex items-center gap-1.5 font-mono text-xs">
            <div className="bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800 text-center">
              <span className="font-bold text-amber-300 text-sm">{timeLeft.days}</span>
              <span className="text-[10px] text-slate-400 block font-sans">Days</span>
            </div>
            <span className="text-slate-500 font-bold">:</span>
            <div className="bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800 text-center">
              <span className="font-bold text-white text-sm">{timeLeft.hours}</span>
              <span className="text-[10px] text-slate-400 block font-sans">Hours</span>
            </div>
            <span className="text-slate-500 font-bold">:</span>
            <div className="bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800 text-center">
              <span className="font-bold text-white text-sm">{timeLeft.minutes}</span>
              <span className="text-[10px] text-slate-400 block font-sans">Mins</span>
            </div>
            <span className="text-slate-500 font-bold">:</span>
            <div className="bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800 text-center">
              <span className="font-bold text-emerald-400 text-sm">{timeLeft.seconds}</span>
              <span className="text-[10px] text-slate-400 block font-sans">Secs</span>
            </div>
          </div>
        </motion.div>

        {/* Primary CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-8 flex flex-wrap items-center justify-center gap-3.5"
        >
          <button
            id="hero-register-test-btn"
            onClick={() => onSelectTab('apply')}
            className="px-7 py-3.5 text-sm font-bold text-white bg-gradient-to-r from-[#185b9d] via-[#1d63a8] to-[#0f4477] hover:from-[#1d6bb8] hover:to-[#124d85] rounded-xl border border-[#3b82f6]/40 shadow-[0_0_25px_rgba(24,91,157,0.45)] hover:shadow-[0_0_35px_rgba(56,189,248,0.6)] transition-all transform hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-2 focus:outline-hidden cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-sky-300" />
            <span>Apply Online for Test</span>
            <ArrowRight className="w-4 h-4 text-sky-200" />
          </button>

          <button
            id="hero-view-syllabus-btn"
            onClick={() => onSelectTab('scholarship')}
            className="px-6 py-3.5 text-sm font-semibold text-slate-200 bg-slate-900/90 hover:bg-slate-800/90 hover:text-white rounded-xl border border-slate-700/80 shadow-md backdrop-blur-md transition-all flex items-center gap-2 focus:outline-hidden"
          >
            <span>View 100 MCQs Syllabus</span>
          </button>
        </motion.div>

        {/* Fast Candidate Lookup Input */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-8 w-full max-w-xl"
        >
          <form 
            onSubmit={handleQuickLookup}
            className="p-1.5 bg-slate-900/90 backdrop-blur-xl border border-slate-700/80 rounded-2xl shadow-xl hover:border-slate-500/80 transition-all flex items-center gap-2"
          >
            <div className="pl-3 text-slate-400">
              <Search className="w-4 h-4 text-[#38bdf8]" />
            </div>
            <input
              type="text"
              value={quickQuery}
              onChange={(e) => {
                setQuickQuery(e.target.value);
                if (searchFeedback) setSearchFeedback(null);
              }}
              placeholder="Candidate Check: Enter CNIC / B-Form or Roll No..."
              className="flex-1 bg-transparent border-none text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-hidden font-mono"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-gradient-to-r from-[#185b9d] to-[#0f4477] hover:from-[#1d6bb8] hover:to-[#124d85] text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1 flex-shrink-0 border border-blue-500/30 cursor-pointer"
            >
              <span>Search Slip</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </form>

          {searchFeedback && (
            <p className="text-xs text-amber-300 mt-2 font-medium">{searchFeedback}</p>
          )}
        </motion.div>

      </div>

      {/* 3 Key Metrics Cards on Dark Glass Floor */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 w-full">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {keyStats.map((stat, idx) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.45 + idx * 0.08 }}
                className="p-5 rounded-2xl bg-slate-900/80 backdrop-blur-md border border-slate-800/90 shadow-md hover:border-slate-700 hover:bg-slate-900/95 transition-all text-left"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 rounded-xl bg-slate-800 text-[#38bdf8] border border-slate-700">
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-400 px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700/50">
                    {stat.badge}
                  </span>
                </div>
                <div className="text-2xl font-bold font-display text-white tracking-tight">
                  {stat.value}
                </div>
                <div className="text-xs font-semibold text-slate-300 mt-0.5">
                  {stat.label}
                </div>
                <div className="text-[11px] text-slate-500 truncate mt-0.5">
                  {stat.sub}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

    </section>
  );
};
