import React from 'react';
import { Award, Plane, Laptop, Banknote, ShieldCheck, CheckCircle2, ArrowRight } from 'lucide-react';
import { PageTab } from '../../types';
import { OFFICIAL_DATA } from '../../data/scholarshipData';

interface StudentTestimonialsProps {
  onSelectTab: (tab: PageTab) => void;
}

export const StudentTestimonials: React.FC<StudentTestimonialsProps> = ({ onSelectTab }) => {
  const impactStats = [
    {
      icon: Plane,
      number: '5',
      title: 'Holy Umrah Packages',
      description: 'Conferred to overall 1st position holders via AZM Group Saudi Arabia',
      color: 'text-amber-400 bg-amber-500/10 border-amber-500/30'
    },
    {
      icon: Laptop,
      number: '18',
      title: 'High-Spec Laptops',
      description: 'Awarded to top merit students for digital learning & board preparation',
      color: 'text-[#38bdf8] bg-sky-500/10 border-sky-500/30'
    },
    {
      icon: Banknote,
      number: 'PKR 13 Lac+',
      title: 'Direct Scholarships',
      description: 'Disbursed in tuition grants, fee subsidies, and monthly stipends',
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
    },
    {
      icon: ShieldCheck,
      number: 'CUIN: 0321467',
      title: 'SECP Registered (Pvt.) Ltd.',
      description: 'Corporate Universal Identification Number under SECP Pakistan',
      color: 'text-purple-400 bg-purple-500/10 border-purple-500/30'
    }
  ];

  const achievers = [
    {
      id: 'achiever-1',
      name: 'Syeda Suqaina',
      school: 'Dubai International Public School & College',
      awardTitle: 'Holy Umrah Air Ticket & Travel Package',
      badge: 'Umrah Package Conferred',
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      photo: '/pictures/achievers/syeda_suqaina_umrah.jpg',
      caption: 'Presented by Director General AZM.AIO in collaboration with AZM Group of Companies Saudi Arabia for outstanding academic merit.',
      icon: Plane
    },
    {
      id: 'achiever-2',
      name: 'Anooshay Eman',
      school: 'Khyber Public School & College',
      awardTitle: '1st Position Laptop & Merit Honors Sash',
      badge: 'High-Spec Laptop Award',
      badgeColor: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
      photo: '/pictures/achievers/anooshay_eman_laptop.jpg',
      caption: 'Secured top ranking in the standardized written examination and awarded a high-spec laptop for advanced board exam preparation.',
      icon: Laptop
    },
    {
      id: 'achiever-3',
      name: 'AZM Merit Scholars Cohort',
      school: 'Jadoon, Khyber & Dubai Campuses',
      awardTitle: 'PKR 13 Lacs+ Scholarship Grants & Certificates',
      badge: 'PKR 1.3M+ Grants Disbursed',
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      photo: '/pictures/achievers/scholarship_grants_13lac.jpg',
      caption: 'Direct educational fee subsidies and merit certificates awarded across multiple high schools and colleges in Khyber Pakhtunkhwa.',
      icon: Award
    }
  ];

  return (
    <section className="py-20 bg-slate-950 text-white relative overflow-hidden border-t border-slate-800">
      {/* Background Subtle Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(24,91,157,0.22),transparent_60%)] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10 space-y-16">
        
        {/* 1. Section Header & SECP Corporate Verification */}
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-blue-950/80 border border-blue-700/60 text-sky-300 text-xs font-bold shadow-xs">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Corporate Entity: AZM.AIO (Pvt.) Ltd. • CUIN: {OFFICIAL_DATA.cuin}</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-display font-extrabold text-white tracking-tight">
            Proven Track Record & Real Achievers
          </h2>
          <p className="text-xs sm:text-base text-slate-300 leading-relaxed max-w-2xl mx-auto">
            Transparent awards delivered directly to deserving candidates across Khyber Pakhtunkhwa through verified OMR testing.
          </p>
        </div>

        {/* 2. Top 4-Column Track Record Metrics Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {impactStats.map((stat, sIdx) => {
            const Icon = stat.icon;
            return (
              <div
                key={sIdx}
                className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-lg hover:border-slate-700 transition-all space-y-3 flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border shadow-xs ${stat.color}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest">
                    Verified
                  </span>
                </div>

                <div>
                  <div className="text-2xl sm:text-3xl font-display font-extrabold text-white">
                    {stat.number}
                  </div>
                  <h3 className="text-sm font-bold text-slate-200 mt-0.5">
                    {stat.title}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 leading-snug">
                    {stat.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* 3. Real Student Achievers Spotlight Cards with Authentic Photos */}
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-slate-800 pb-4">
            <div>
              <span className="text-xs font-bold text-amber-300 uppercase tracking-widest block">
                Session Award Ceremonies
              </span>
              <h3 className="text-xl sm:text-2xl font-bold font-display text-white">
                Award Recipients & Position Holders
              </h3>
            </div>
            <p className="text-xs text-slate-400">
              Photographed at grand merit distribution ceremonies in Mansehra
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            {achievers.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.id}
                  className="rounded-3xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl hover:border-blue-500/40 transition-all duration-300 flex flex-col justify-between group"
                >
                  {/* Photo with Badge Overlay */}
                  <div className="relative h-64 sm:h-72 w-full overflow-hidden bg-slate-950">
                    <img
                      src={item.photo}
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
                    
                    {/* Floating Award Pill Badge */}
                    <div className="absolute top-3.5 left-3.5 right-3.5 flex items-center justify-between">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border backdrop-blur-md shadow-md ${item.badgeColor}`}>
                        <Icon className="w-3.5 h-3.5" />
                        {item.badge}
                      </span>
                    </div>

                    {/* Name Overlay at Bottom of Photo */}
                    <div className="absolute bottom-3 left-4 right-4">
                      <h4 className="text-lg sm:text-xl font-extrabold font-display text-white drop-shadow-md">
                        {item.name}
                      </h4>
                      <p className="text-xs font-semibold text-sky-300 drop-shadow-sm">
                        {item.school}
                      </p>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-6 space-y-3 flex-1 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-0.5">
                          Award Conferred:
                        </span>
                        <p className="font-bold text-white leading-snug">
                          {item.awardTitle}
                        </p>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {item.caption}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-slate-800/80 flex items-center gap-2 text-[11px] text-emerald-400 font-medium">
                      <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                      <span>Verified Award by AZM Examination Board</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 4. Bottom Fast Action to Gallery */}
        <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-blue-950/80 via-slate-900 to-emerald-950/80 border border-blue-700/40 text-center flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="text-center sm:text-left space-y-1">
            <div className="inline-flex items-center gap-1 text-xs font-bold text-amber-300">
              <Award className="w-4 h-4" />
              <span>Full Archive of Sessions I, II, III & IV</span>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-white">
              Explore All 68 Real Ceremony & Exam Hall Photographs
            </h3>
            <p className="text-xs text-slate-300">
              Browse authentic pictures of examination halls, OMR testing desks, and trophy distributions across Mansehra.
            </p>
          </div>
          
          <button
            onClick={() => {
              onSelectTab('gallery');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="px-6 py-3 bg-[#185b9d] hover:bg-[#13497e] text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg transition-all flex items-center gap-2 whitespace-nowrap group hover:scale-105"
          >
            <span>Open Media Gallery Archives</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

      </div>
    </section>
  );
};
