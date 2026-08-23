import React from 'react';
import { OFFICIAL_DATA } from '../../data/scholarshipData';
import { Quote, ShieldCheck, CheckCircle2, Award, HeartHandshake } from 'lucide-react';

export const LeadershipSection: React.FC = () => {
  return (
    <section className="py-20 bg-gradient-to-b from-slate-50 to-white border-t border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-2">
          <span className="text-xs font-extrabold text-[#185b9d] uppercase tracking-widest bg-blue-50 px-3.5 py-1 rounded-full border border-blue-200/60 inline-block">
            Executive Stewardship
          </span>
          <h2 className="text-3xl sm:text-5xl font-display font-extrabold text-slate-900 tracking-tight">
            Leadership Behind Session V
          </h2>
          <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto leading-relaxed">
            AZM Group of Companies directly finances, standardizes, and guarantees every testing round — upholding pure merit with zero reliance on public donations.
          </p>
        </div>

        {/* Leadership Grid - Enlarged & Expanded */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
          
          {/* 1. Founder & Director General Card */}
          <div className="p-8 sm:p-10 rounded-3xl bg-white border border-slate-200 shadow-lg shadow-slate-200/50 relative overflow-hidden flex flex-col justify-between group hover:border-blue-300 transition-all duration-300">
            <div className="absolute top-0 right-0 p-6 text-slate-100 pointer-events-none">
              <Quote className="w-24 h-24 opacity-30 text-[#185b9d]" />
            </div>

            <div className="space-y-6 relative z-10">
              {/* Portrait & Profile Header */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 pb-6 border-b border-slate-100">
                <div className="relative w-28 h-36 sm:w-36 sm:h-44 md:w-40 md:h-48 rounded-2xl overflow-hidden shadow-md border-2 border-white flex-shrink-0 bg-slate-900 ring-4 ring-[#185b9d]/20 group-hover:ring-[#185b9d]/40 transition-all">
                  <img
                    src="/pictures/Sumama Khan.jpeg"
                    alt={OFFICIAL_DATA.founder.name}
                    className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                  />
                  <span className="absolute bottom-2 left-2 right-2 px-2 py-1 bg-slate-950/80 backdrop-blur-xs text-[10px] font-bold text-center text-amber-300 rounded-md border border-amber-400/30">
                    Founder
                  </span>
                </div>

                <div className="space-y-1.5 min-w-0">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-blue-50 text-[#185b9d] text-xs font-bold border border-blue-200/80">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Managing Director
                  </span>
                  <h3 className="text-xl sm:text-2xl font-extrabold font-display text-slate-900 leading-tight">
                    {OFFICIAL_DATA.founder.name}
                  </h3>
                  <p className="text-xs sm:text-sm font-bold text-[#185b9d]">
                    {OFFICIAL_DATA.founder.role}
                  </p>
                  <p className="text-xs text-slate-500 font-medium">
                    {OFFICIAL_DATA.founder.organization}
                  </p>
                </div>
              </div>

              {/* Extended Founder's Vision Statement */}
              <div className="space-y-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  Director General's Note on Merit & Ethics:
                </span>
                <blockquote className="text-xs sm:text-sm text-slate-700 leading-relaxed italic bg-slate-50/80 p-4 rounded-2xl border-l-4 border-[#185b9d]">
                  "{OFFICIAL_DATA.founder.quote}"
                </blockquote>
              </div>
            </div>

            {/* Key Governance Mandates */}
            <div className="mt-8 pt-4 border-t border-slate-100 space-y-2">
              <div className="flex items-center gap-2.5 text-xs text-slate-600 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>Standardized optical OMR evaluation with digital answer-sheet archiving</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs text-slate-600 font-medium">
                <CheckCircle2 className="w-4 h-4 text-[#185b9d] flex-shrink-0" />
                <span>100% self-funded scholarships with zero third-party or political influence</span>
              </div>
            </div>
          </div>

          {/* 2. Co-Founder & Executive Director Card */}
          <div className="p-8 sm:p-10 rounded-3xl bg-white border border-slate-200 shadow-lg shadow-slate-200/50 relative overflow-hidden flex flex-col justify-between group hover:border-emerald-300 transition-all duration-300">
            <div className="absolute top-0 right-0 p-6 text-slate-100 pointer-events-none">
              <Quote className="w-24 h-24 opacity-30 text-[#299b46]" />
            </div>

            <div className="space-y-6 relative z-10">
              {/* Portrait & Profile Header */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 pb-6 border-b border-slate-100">
                <div className="relative w-28 h-36 sm:w-36 sm:h-44 md:w-40 md:h-48 rounded-2xl overflow-hidden shadow-md border-2 border-white flex-shrink-0 bg-slate-900 ring-4 ring-emerald-500/20 group-hover:ring-emerald-500/40 transition-all">
                  <img
                    src="/pictures/iram_zeb.jpeg"
                    alt={OFFICIAL_DATA.coFounder.name}
                    className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                  />
                  <span className="absolute bottom-2 left-2 right-2 px-2 py-1 bg-slate-950/80 backdrop-blur-xs text-[10px] font-bold text-center text-emerald-300 rounded-md border border-emerald-400/30">
                    Co-Founder
                  </span>
                </div>

                <div className="space-y-1.5 min-w-0">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200/80">
                    <HeartHandshake className="w-3.5 h-3.5" />
                    Executive Director
                  </span>
                  <h3 className="text-xl sm:text-2xl font-extrabold font-display text-slate-900 leading-tight">
                    {OFFICIAL_DATA.coFounder.name}
                  </h3>
                  <p className="text-xs sm:text-sm font-bold text-[#299b46]">
                    {OFFICIAL_DATA.coFounder.role}
                  </p>
                  <p className="text-xs text-slate-500 font-medium">
                    {OFFICIAL_DATA.coFounder.organization}
                  </p>
                </div>
              </div>

              {/* Extended Co-Founder's Welfare Statement */}
              <div className="space-y-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  Executive Director's Note on Student Welfare:
                </span>
                <blockquote className="text-xs sm:text-sm text-slate-700 leading-relaxed italic bg-slate-50/80 p-4 rounded-2xl border-l-4 border-[#299b46]">
                  "{OFFICIAL_DATA.coFounder.quote}"
                </blockquote>
              </div>
            </div>

            {/* Key Welfare & Mentorship Mandates */}
            <div className="mt-8 pt-4 border-t border-slate-100 space-y-2">
              <div className="flex items-center gap-2.5 text-xs text-slate-600 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>Dedicated orphan quota & comprehensive monthly school fee coverage</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs text-slate-600 font-medium">
                <CheckCircle2 className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <span>Annual laptops, textbook bundles, and one-on-one academic counseling</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};
