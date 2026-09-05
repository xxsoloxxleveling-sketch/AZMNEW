import React, { useState } from 'react';
import { 
  MONTHLY_ASSISTANCE_RATES, 
  BENEFICIARY_CATEGORIES, 
  EXAM_SECTIONS, 
  SESSION_V_CALENDAR,
  OFFICIAL_DATA
} from '../../data/scholarshipData';
import { PageTab } from '../../types';
import { 
  Award, 
  Sparkles, 
  Search, 
  FileText, 
  BookOpen, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Calendar, 
  GraduationCap, 
  ArrowRight, 
  ShieldCheck,
  Trophy,
  Plane,
  Laptop,
  Heart,
  Coins,
  ChevronRight
} from 'lucide-react';
import { motion } from 'motion/react';

interface ScholarshipViewProps {
  onSelectTab: (tab: PageTab, prefillClass?: string) => void;
  onOpenMockExam?: () => void;
}

export const ScholarshipView: React.FC<ScholarshipViewProps> = ({ onSelectTab, onOpenMockExam }) => {
  const [activeCategory, setActiveCategory] = useState<string>('cat-a');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const filteredRates = MONTHLY_ASSISTANCE_RATES.filter(
    (r) =>
      r.classLevel.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const categoryIcons: Record<string, React.ReactNode> = {
    'cat-a': <Plane className="w-5 h-5 text-amber-300" />,
    'cat-b': <Award className="w-5 h-5 text-blue-300" />,
    'cat-c': <Trophy className="w-5 h-5 text-emerald-300" />,
    'cat-d': <Laptop className="w-5 h-5 text-purple-300" />,
    'cat-e': <Heart className="w-5 h-5 text-cyan-300" />,
    'cat-f': <Coins className="w-5 h-5 text-yellow-300" />,
  };

  return (
    <div className="py-10 space-y-16 max-w-7xl mx-auto px-4 sm:px-6">
      {/* Page Header */}
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <span className="text-xs font-bold text-[#185b9d] uppercase tracking-widest">
          Session V (2026) Award Framework
        </span>
        <h1 className="text-3xl sm:text-5xl font-display font-extrabold text-slate-900 tracking-tight">
          Scholarship Categories & Exam Syllabus
        </h1>
        <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
          Review the full scholarship reward hierarchy across Categories A through F, monthly assistance rates by class level, 100 MCQs OMR structure, and official Session V milestones.
        </p>
      </div>

      {/* Category A through F Interactive Visual Deck */}
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <span className="text-xs font-bold text-[#185b9d] uppercase tracking-widest">
              Award Hierarchy
            </span>
            <h2 className="text-2xl font-bold font-display text-slate-900">
              Beneficiary Categories (500 Total Seats)
            </h2>
          </div>
        </div>


        {/* Category Pill Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {BENEFICIARY_CATEGORIES.map((cat) => {
            const isSelected = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                id={`cat-tab-${cat.id}`}
                onClick={() => setActiveCategory(cat.id)}
                className={`p-3 rounded-2xl text-left transition-all border flex flex-col justify-between focus:outline-hidden ${
                  isSelected
                    ? 'bg-[#185b9d] text-white shadow-lg shadow-[#185b9d]/25 border-[#185b9d] scale-[1.02]'
                    : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {cat.code}
                  </span>
                  {categoryIcons[cat.id]}
                </div>
                <div className="font-bold text-xs line-clamp-1">{cat.title}</div>
                <div
                  className={`text-[10px] mt-1 font-mono ${
                    isSelected ? 'text-amber-200 font-bold' : 'text-slate-500'
                  }`}
                >
                  {cat.badge}
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Category Feature Card */}
        {(() => {
          const cat = BENEFICIARY_CATEGORIES.find((c) => c.id === activeCategory)!;
          return (
            <motion.div
              key={cat.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200/90 shadow-lg"
            >
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                <div className="lg:col-span-7 space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-3 py-1 rounded-lg bg-[#185b9d]/10 text-[#185b9d] font-bold text-xs border border-[#185b9d]/20">
                      {cat.code}
                    </span>
                    <span className="px-3 py-1 rounded-lg bg-amber-50 text-amber-800 font-bold text-xs border border-amber-200">
                      {cat.seats} Allocated Seats
                    </span>
                  </div>

                  <h3 className="text-2xl sm:text-3xl font-extrabold font-display text-slate-900">
                    {cat.title}
                  </h3>
                  <p className="text-xs sm:text-sm font-semibold text-[#185b9d]">
                    {cat.headline}
                  </p>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {cat.description}
                  </p>

                  {/* Eligibility Note */}
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                    <strong className="text-slate-800 block mb-1">Merit & Eligibility Criteria:</strong>
                    <p className="text-slate-600">{cat.eligibility}</p>
                  </div>
                </div>

                {/* Right Rewards Breakdown List */}
                <div className="lg:col-span-5 p-6 rounded-2xl bg-gradient-to-br from-slate-900 to-[#0d2a4a] text-white space-y-4">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                      Conferred Rewards & Grants
                    </span>
                    <Sparkles className="w-4 h-4 text-amber-300" />
                  </div>

                  <ul className="space-y-3 text-xs">
                    {cat.rewards.map((reward, rIdx) => (
                      <li key={rIdx} className="flex items-start gap-2.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                        <span className="text-slate-200 leading-relaxed font-medium">
                          {reward}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div className="pt-2">
                    <button
                      onClick={() => onSelectTab('apply')}
                      className="w-full py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 focus:outline-hidden"
                    >
                      <span>Registration Closed — View Notice</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })()}
      </div>

      {/* Monthly Assistance Rates Table */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-widest">
              Financial Schedule
            </span>
            <h2 className="text-2xl font-bold font-display text-slate-900">
              Monthly Assistance Rates by Grade (Class 6th to BS)
            </h2>
          </div>

          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter class level..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white border border-slate-300 focus:border-[#185b9d] focus:ring-1 focus:ring-[#185b9d] focus:outline-hidden"
            />
          </div>
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-hidden bg-white rounded-3xl border border-slate-200 shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 text-xs font-bold uppercase tracking-wider">
                <th className="py-3.5 px-6">Grade / Academic Level</th>
                <th className="py-3.5 px-6">Monthly Stipend</th>
                <th className="py-3.5 px-6">Annual Academic Grant</th>
                <th className="py-3.5 px-6">Included Support</th>
                <th className="py-3.5 px-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredRates.map((row) => (
                <tr key={row.classLevel} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-4 px-6">
                    <div className="font-bold text-slate-900 text-sm">{row.classLevel}</div>
                    <div className="text-slate-500 text-[11px]">{row.name}</div>
                  </td>
                  <td className="py-4 px-6 font-mono font-bold text-[#185b9d] text-sm tabular-nums">
                    PKR {row.monthlyAmount.toLocaleString()}
                    <span className="text-[11px] font-sans font-normal text-slate-400 ml-1">
                      {row.periodLabel}
                    </span>
                  </td>
                  <td className="py-4 px-6 font-mono font-bold text-emerald-700 text-sm tabular-nums">
                    PKR {row.annualAmount.toLocaleString()}
                  </td>
                  <td className="py-4 px-6 text-slate-600 text-xs max-w-xs">
                    {row.notes}
                  </td>
                  <td className="py-4 px-6 text-right">
                    <button
                      onClick={() => onSelectTab('apply', row.classLevel)}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-[#185b9d] hover:text-white text-slate-700 font-semibold text-xs transition-colors"
                    >
                      Apply Now
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Responsive Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:hidden">
          {filteredRates.map((row) => (
            <div
              key={row.classLevel}
              className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-slate-900">{row.classLevel}</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-[#185b9d]">
                  {row.name}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                <div>
                  <span className="text-slate-500 text-[10px] block">Monthly</span>
                  <span className="font-bold font-mono text-[#185b9d] text-sm tabular-nums">
                    PKR {row.monthlyAmount.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">Annual Grant</span>
                  <span className="font-bold font-mono text-emerald-700 text-sm tabular-nums">
                    PKR {row.annualAmount.toLocaleString()}
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-slate-600">{row.notes}</p>

              <button
                onClick={() => onSelectTab('apply', row.classLevel)}
                className="w-full py-2 bg-[#185b9d] text-white rounded-xl text-xs font-bold"
              >
                Apply for {row.classLevel}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 100 MCQs Exam Structure & Standardized OMR Guide */}
      <div className="p-8 rounded-3xl bg-white border border-slate-200/90 shadow-sm space-y-8">
        <div className="max-w-3xl">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200 mb-3">
            <BookOpen className="w-3.5 h-3.5" />
            Standardized Testing Blueprint
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold font-display text-slate-900">
            100 MCQs Examination Pattern & OMR Guidelines
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-2">
            The scholarship examination consists of 100 multiple-choice questions (120 minutes) evaluated by high-speed optical scanners with zero negative marking. Passing baseline: 60/100.
          </p>
        </div>

        {/* Exam Sections Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {EXAM_SECTIONS.map((sec) => (
            <div
              key={sec.subject}
              className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-[#185b9d] bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                    {sec.marks} Marks ({sec.weightPercentage}%)
                  </span>
                  <span className="text-[11px] font-mono text-slate-500 font-bold">
                    {sec.questionsCount} MCQs
                  </span>
                </div>
                <h3 className="text-sm font-bold text-slate-900 leading-snug">
                  {sec.subject}
                </h3>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Core Topics:
                </span>
                <ul className="space-y-1 text-[11px] text-slate-600">
                  {sec.topics.map((t, idx) => (
                    <li key={idx} className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#185b9d]" />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}

          {/* Quick Practice Card */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-[#185b9d] to-[#0a2e52] text-white flex flex-col justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-amber-300 tracking-wider block mb-1">
                Official Prep Guarantee
              </span>
              <h3 className="text-lg font-bold font-display mb-2">
                100% From Official Question Banks
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                All 100 questions are curated straight from our published ~1,000 MCQs Question Bank for each grade level.
              </p>
            </div>

            {onOpenMockExam && (
              <button
                onClick={onOpenMockExam}
                className="mt-4 w-full py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                <span>Test Question Bank Sample</span>
              </button>
            )}
          </div>
        </div>

        {/* Visual OMR Bubble Darkening Guide (Do's and Don'ts) */}
        <div className="p-6 rounded-2xl bg-slate-100/90 border border-slate-200 space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#185b9d]" />
            <h4 className="text-sm font-bold text-slate-900">
              Optical Mark Recognition (OMR) Sheet Filling Protocol
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Correct Example */}
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-800">Correct Method</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="flex items-center justify-center gap-3 py-2 bg-white rounded-lg border border-emerald-200">
                <div className="w-6 h-6 rounded-full border-2 border-slate-300 flex items-center justify-center text-[10px] text-slate-400 font-bold">A</div>
                <div className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-bold shadow-xs">B</div>
                <div className="w-6 h-6 rounded-full border-2 border-slate-300 flex items-center justify-center text-[10px] text-slate-400 font-bold">C</div>
                <div className="w-6 h-6 rounded-full border-2 border-slate-300 flex items-center justify-center text-[10px] text-slate-400 font-bold">D</div>
              </div>
              <p className="text-[11px] text-emerald-900 font-medium">
                Completely fill and darken the bubble using HB Pencil or Black Ballpoint.
              </p>
            </div>

            {/* Incorrect: Tick Mark */}
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-rose-800">Incorrect: Tick Mark</span>
                <XCircle className="w-4 h-4 text-rose-600" />
              </div>
              <div className="flex items-center justify-center gap-3 py-2 bg-white rounded-lg border border-rose-200">
                <div className="w-6 h-6 rounded-full border-2 border-slate-300 flex items-center justify-center text-[10px] text-slate-400 font-bold">A</div>
                <div className="w-6 h-6 rounded-full border-2 border-rose-400 text-rose-600 flex items-center justify-center text-xs font-bold">✓</div>
                <div className="w-6 h-6 rounded-full border-2 border-slate-300 flex items-center justify-center text-[10px] text-slate-400 font-bold">C</div>
                <div className="w-6 h-6 rounded-full border-2 border-slate-300 flex items-center justify-center text-[10px] text-slate-400 font-bold">D</div>
              </div>
              <p className="text-[11px] text-rose-900">
                Ticks or checks cannot be detected by optical sensors.
              </p>
            </div>

            {/* Incorrect: Cross / Multiple Fill */}
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-rose-800">Incorrect: Multiple Bubbles</span>
                <XCircle className="w-4 h-4 text-rose-600" />
              </div>
              <div className="flex items-center justify-center gap-3 py-2 bg-white rounded-lg border border-rose-200">
                <div className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-bold">A</div>
                <div className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-bold">B</div>
                <div className="w-6 h-6 rounded-full border-2 border-slate-300 flex items-center justify-center text-[10px] text-slate-400 font-bold">C</div>
                <div className="w-6 h-6 rounded-full border-2 border-slate-300 flex items-center justify-center text-[10px] text-slate-400 font-bold">D</div>
              </div>
              <p className="text-[11px] text-rose-900">
                Darkening multiple bubbles will invalidate the question (0 marks).
              </p>
            </div>

            {/* Incorrect: Half / Stray Mark */}
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-rose-800">Incorrect: Half Filled</span>
                <XCircle className="w-4 h-4 text-rose-600" />
              </div>
              <div className="flex items-center justify-center gap-3 py-2 bg-white rounded-lg border border-rose-200">
                <div className="w-6 h-6 rounded-full border-2 border-slate-300 flex items-center justify-center text-[10px] text-slate-400 font-bold">A</div>
                <div className="w-6 h-6 rounded-full border-2 border-slate-400 relative overflow-hidden">
                  <div className="w-3 h-6 bg-slate-900" />
                </div>
                <div className="w-6 h-6 rounded-full border-2 border-slate-300 flex items-center justify-center text-[10px] text-slate-400 font-bold">C</div>
                <div className="w-6 h-6 rounded-full border-2 border-slate-300 flex items-center justify-center text-[10px] text-slate-400 font-bold">D</div>
              </div>
              <p className="text-[11px] text-rose-900">
                Faint or partial fills will be skipped by scanner threshold.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Visual Session V (2026) Timeline */}
      <div className="space-y-6">
        <div className="text-center max-w-2xl mx-auto">
          <span className="text-xs font-bold text-[#185b9d] uppercase tracking-widest">
            Session V Roadmap
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold font-display text-slate-900 mt-1">
            Official 2026 Examination & Disbursal Calendar
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {SESSION_V_CALENDAR.map((event, idx) => (
            <div
              key={event.id}
              className={`p-5 rounded-2xl border transition-all ${
                event.status === 'active'
                  ? 'bg-emerald-50/70 border-emerald-400 shadow-md ring-2 ring-emerald-400/20'
                  : 'bg-white border-slate-200 shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono text-xs font-bold text-[#185b9d]">
                  {event.displayDate}
                </span>
                {event.badge && (
                  <span
                    className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${
                      event.status === 'active'
                        ? 'bg-emerald-600 text-white'
                        : event.status === 'completed'
                        ? 'bg-slate-200 text-slate-700'
                        : 'bg-blue-100 text-[#185b9d]'
                    }`}
                  >
                    {event.badge}
                  </span>
                )}
              </div>

              <h3 className="text-sm font-bold font-display text-slate-900 mb-1">
                {event.title}
              </h3>
              <p className="text-xs text-slate-600 leading-snug">
                {event.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
