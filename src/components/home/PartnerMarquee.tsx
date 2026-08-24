import React from 'react';
import { PARTNER_SCHOOLS } from '../../data/scholarshipData';
import { Building2, ShieldCheck, GraduationCap } from 'lucide-react';

export const PartnerMarquee: React.FC = () => {
  // Duplicate for seamless infinite marquee loop
  const list = [...PARTNER_SCHOOLS, ...PARTNER_SCHOOLS];

  return (
    <section className="py-8 bg-slate-100/70 border-y border-slate-200/80 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 mb-4 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <GraduationCap className="w-4 h-4 text-[#185b9d]" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Official Partner Schools & Affiliated Campuses
          </span>
        </div>
        <span className="text-[11px] text-slate-500 font-medium">
          Mansehra • Hazara Division • Khyber Pakhtunkhwa
        </span>

      </div>

      <div className="relative w-full overflow-hidden">
        {/* Soft edge blur masks */}
        <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-slate-100/90 to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-slate-100/90 to-transparent z-10 pointer-events-none" />

        <div className="flex w-max animate-marquee space-x-4">
          {list.map((item, idx) => (
            <div
              key={`${item.id}-${idx}`}
              className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-white border border-slate-200 shadow-xs hover:border-[#185b9d]/40 transition-all flex-shrink-0"
            >
              <div className="w-8 h-8 rounded-lg bg-[#185b9d]/10 text-[#185b9d] flex items-center justify-center font-bold text-xs">
                <Building2 className="w-4 h-4" />
              </div>
              <div className="text-left">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-900">{item.institutionName}</span>
                  {item.isRegistrationHub && (
                    <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[9px] font-bold rounded-full">
                      Hub
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-slate-500 flex items-center gap-1">
                  <span>{item.campus}</span>
                  <span>•</span>
                  <span className="text-slate-600 font-medium">{item.district}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
