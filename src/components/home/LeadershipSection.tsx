import React from 'react';
import { OFFICIAL_DATA } from '../../data/scholarshipData';
import { Quote, ShieldCheck, CheckCircle2 } from 'lucide-react';

export const LeadershipSection: React.FC = () => {
  return (
    <section className="py-16 bg-white border-t border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="text-xs font-bold text-[#185b9d] uppercase tracking-widest">
            Executive Stewardship
          </span>
          <h2 className="text-2xl sm:text-4xl font-display font-extrabold text-slate-900 tracking-tight mt-1">
            Leadership Behind Session V
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-2">
            AZM Group of Companies finances and oversees every testing round directly, ensuring fair scoring and zero reliance on external charities.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* Founder Card */}
          <div className="p-7 sm:p-8 rounded-3xl bg-slate-50 border border-slate-200/90 shadow-2xs relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 right-0 p-6 text-slate-200 pointer-events-none">
              <Quote className="w-16 h-16 opacity-20 text-[#185b9d]" />
            </div>

            <div>
              <div className="flex items-center gap-4 mb-5">
                <div className="relative w-16 h-16 sm:w-18 sm:h-18 rounded-2xl overflow-hidden shadow-md border-2 border-white flex-shrink-0 bg-slate-800 ring-2 ring-[#185b9d]/20">
                  <img
                    src="/pictures/Sumama Khan.jpeg"
                    alt={OFFICIAL_DATA.founder.name}
                    className="w-full h-full object-cover object-top"
                  />
                </div>

                <div>
                  <h3 className="text-base sm:text-lg font-bold font-display text-slate-900">
                    {OFFICIAL_DATA.founder.name}
                  </h3>
                  <p className="text-xs font-bold text-[#185b9d]">
                    {OFFICIAL_DATA.founder.role}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {OFFICIAL_DATA.founder.organization}
                  </p>
                </div>
              </div>

              <blockquote className="text-xs sm:text-sm text-slate-700 leading-relaxed italic relative z-10">
                "{OFFICIAL_DATA.founder.quote}"
              </blockquote>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-200 flex items-center gap-2 text-xs text-slate-500">
              <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>Direct oversight of standardized optical test integrity</span>
            </div>
          </div>

          {/* Co-Founder Card */}
          <div className="p-7 sm:p-8 rounded-3xl bg-slate-50 border border-slate-200/90 shadow-2xs relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 right-0 p-6 text-slate-200 pointer-events-none">
              <Quote className="w-16 h-16 opacity-20 text-emerald-600" />
            </div>

            <div>
              <div className="flex items-center gap-4 mb-5">
                <div className="relative w-16 h-16 sm:w-18 sm:h-18 rounded-2xl overflow-hidden shadow-md border-2 border-white flex-shrink-0 bg-slate-800 ring-2 ring-emerald-500/20">
                  <img
                    src="/pictures/iram_zeb.jpeg"
                    alt={OFFICIAL_DATA.coFounder.name}
                    className="w-full h-full object-cover object-top"
                  />
                </div>

                <div>
                  <h3 className="text-base sm:text-lg font-bold font-display text-slate-900">
                    {OFFICIAL_DATA.coFounder.name}
                  </h3>
                  <p className="text-xs font-bold text-[#299b46]">
                    {OFFICIAL_DATA.coFounder.role}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {OFFICIAL_DATA.coFounder.organization}
                  </p>
                </div>
              </div>

              <blockquote className="text-xs sm:text-sm text-slate-700 leading-relaxed italic relative z-10">
                "{OFFICIAL_DATA.coFounder.quote}"
              </blockquote>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-200 flex items-center gap-2 text-xs text-slate-500">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>Overseeing orphan quotas, tuition support, and student welfare</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
