import React, { useState } from 'react';
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
  ChevronRight
} from 'lucide-react';

interface HeroSectionProps {
  onSelectTab: (tab: PageTab) => void;
  onOpenMockExam?: () => void;
  onOpenAlerts?: () => void;
  language?: 'en' | 'ur';
}

const RegistrationClosedBanner: React.FC = React.memo(() => {
  return (
    <div className="mt-6 p-4 rounded-2xl bg-amber-400/10 backdrop-blur-md border border-amber-300/50 shadow-lg inline-flex items-center gap-3 text-left">
      <Clock className="w-5 h-5 text-amber-300 shrink-0" />
      <div>
        <strong className="block text-sm text-amber-200">Session V registration is closed</strong>
        <span className="block mt-0.5 text-xs text-slate-300">Contact Khaqan Afridi at 0305-1755551 for registration assistance. Pending dues must be paid before 5:00 PM.</span>
      </div>
    </div>
  );
});

export const HeroSection: React.FC<HeroSectionProps> = React.memo(({ 
  onSelectTab, 
  onOpenAlerts,
  language = 'en'
}) => {
  // Fast Candidate Lookup State
  const [quickQuery, setQuickQuery] = useState('');
  const [searchFeedback, setSearchFeedback] = useState<string | null>(null);

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
        
        {/* Top announcements */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 mb-6">
          <a
            href="https://notes.azmaio.com"
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-300/60 hover:border-emerald-200 shadow-[0_0_20px_rgba(52,211,153,0.18)] backdrop-blur-md transition-all cursor-pointer group focus:outline-hidden"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-300 animate-ping" />
            <span className="text-xs sm:text-sm font-semibold text-emerald-100 group-hover:text-white">
              Free Session 5 Notes are now available by Director Sumama Khan
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-emerald-200 group-hover:translate-x-0.5 transition-transform" />
          </a>
          <button
            type="button"
            onClick={() => onOpenAlerts?.()}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/90 hover:bg-slate-800/95 border border-amber-400/40 hover:border-amber-400 backdrop-blur-md transition-all cursor-pointer group focus:outline-hidden"
          >
            <span className="text-xs font-semibold text-amber-300">Registration closed</span>
          </button>
        </div>

        {/* Centered Hero Title */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-display font-extrabold tracking-tight leading-[1.15] sm:leading-[1.12]">
          <span className="bg-gradient-to-r from-[#60a5fa] via-[#38bdf8] to-[#93c5fd] bg-clip-text text-transparent drop-shadow-[0_0_35px_rgba(56,189,248,0.3)]">
            Self-Funded Scholarships
          </span>{' '}
          <span className="text-white">for</span>
          <div className="text-white mt-1">Deserving Students</div>
        </h1>

        {/* Subtitle Description */}
        <p className="mt-6 text-base sm:text-lg lg:text-xl text-slate-300/90 max-w-2xl font-normal leading-relaxed text-balance">
          No favoritism, no hidden scoring — just a test, an optical scan, and a verified interview. Merit-based testing conducted across schools and colleges in Khyber Pakhtunkhwa.
        </p>

        <RegistrationClosedBanner />

        {/* Primary CTA Buttons */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5">
          <button
            id="hero-register-test-btn"
            onClick={() => onSelectTab('apply')}
            className="px-7 py-3.5 text-sm font-bold text-white bg-gradient-to-r from-[#185b9d] via-[#1d63a8] to-[#0f4477] hover:from-[#1d6bb8] hover:to-[#124d85] rounded-xl border border-[#3b82f6]/40 shadow-[0_0_25px_rgba(24,91,157,0.45)] hover:shadow-[0_0_35px_rgba(56,189,248,0.6)] transition-all transform hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-2 focus:outline-hidden cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-sky-300" />
            <span>View Registration Notice</span>
            <ArrowRight className="w-4 h-4 text-sky-200" />
          </button>

          <button
            id="hero-view-syllabus-btn"
            onClick={() => onSelectTab('scholarship')}
            className="px-6 py-3.5 text-sm font-semibold text-slate-200 bg-slate-900/90 hover:bg-slate-800/90 hover:text-white rounded-xl border border-slate-700/80 shadow-md backdrop-blur-md transition-all flex items-center gap-2 focus:outline-hidden"
          >
            <span>View 100 MCQs Syllabus</span>
          </button>

          <a
            id="hero-access-free-notes-btn"
            href="https://notes.azmaio.com"
            className="px-6 py-3.5 text-sm font-bold text-emerald-50 bg-emerald-600/90 hover:bg-emerald-500 rounded-xl border border-emerald-300/50 shadow-[0_0_24px_rgba(16,185,129,0.28)] transition-all transform hover:-translate-y-0.5 flex items-center gap-2 focus:outline-hidden"
          >
            <BookOpen className="w-4 h-4" />
            <span>Access Free Notes</span>
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>

        {/* Fast Candidate Lookup Input */}
        <div className="mt-8 w-full max-w-xl">
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
        </div>

      </div>

      {/* 3 Key Metrics Cards on Dark Glass Floor */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 w-full">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {keyStats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
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
              </div>
            );
          })}
        </div>
      </div>

    </section>
  );
});
