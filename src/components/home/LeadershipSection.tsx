import React from 'react';
import { OFFICIAL_DATA } from '../../data/scholarshipData';
import { Quote, ShieldCheck, CheckCircle2, HeartHandshake, Award, Landmark, Building2, Sparkles } from 'lucide-react';

export const LeadershipSection: React.FC = () => {
  const leaders = [
    {
      id: 'founder',
      name: OFFICIAL_DATA.founder.name,
      role: OFFICIAL_DATA.founder.role,
      organization: OFFICIAL_DATA.founder.organization,
      photo: '/pictures/sumama_khan.jpeg',

      badge: 'Founder & DG',
      badgeColor: 'bg-blue-50 text-[#185b9d] border-blue-200/80',
      ringColor: 'ring-[#185b9d]/20 group-hover:ring-[#185b9d]/40',
      borderColor: 'border-[#185b9d]',
      quoteType: 'Director General\'s Note on Merit & Ethics:',
      quote: OFFICIAL_DATA.founder.quote,
      mandates: [
        'Standardized optical OMR evaluation with digital answer-sheet archiving',
        '100% self-funded scholarships with zero third-party or political influence'
      ],
      icon: ShieldCheck
    },
    {
      id: 'cofounder',
      name: OFFICIAL_DATA.coFounder.name,
      role: OFFICIAL_DATA.coFounder.role,
      organization: OFFICIAL_DATA.coFounder.organization,
      photo: '/pictures/iram_zeb.jpeg',
      badge: 'Co-Founder & ED',
      badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200/80',
      ringColor: 'ring-emerald-500/20 group-hover:ring-emerald-500/40',
      borderColor: 'border-emerald-600',
      quoteType: 'Executive Director\'s Note on Student Welfare:',
      quote: OFFICIAL_DATA.coFounder.quote,
      mandates: [
        'Dedicated orphan quota & comprehensive monthly school fee coverage',
        'Annual laptops, textbook bundles, and one-on-one academic counseling'
      ],
      icon: HeartHandshake
    },
    {
      id: 'chief-guest-ac',
      name: 'Assistant Commissioner Peshawar',
      role: 'Chief Guest & Keynote Patron',
      organization: 'District Administration / Government of Khyber Pakhtunkhwa',
      photo: '/pictures/leadership/assistant_commissioner_peshawar.jpg',
      badge: 'Chief Guest',
      badgeColor: 'bg-purple-50 text-purple-800 border-purple-200/80',
      ringColor: 'ring-purple-500/20 group-hover:ring-purple-500/40',
      borderColor: 'border-purple-600',
      quoteType: 'Chief Guest Keynote Address at Merit Distribution:',
      quote: 'The AZM.AIO scholarship platform exemplifies the highest standards of public integrity and civic responsibility. By combining standardized optical mark scoring with zero financial barriers, this initiative provides our youth in Khyber Pakhtunkhwa an authentic ladder for social mobility, higher education, and academic distinction.',
      mandates: [
        'Commending transparent testing and equitable educational opportunities',
        'Fostering youth empowerment and merit culture across Khyber Pakhtunkhwa'
      ],
      icon: Landmark
    },
    {
      id: 'chief-guest-psra',
      name: 'Assistant Director PSRA',
      role: 'Chief Guest & Institutional Patron',
      organization: 'Private Schools Regulatory Authority (PSRA), Khyber Pakhtunkhwa',
      photo: '/pictures/leadership/assistant_director_psra.jpg',
      badge: 'Chief Guest',
      badgeColor: 'bg-amber-50 text-amber-800 border-amber-200/80',
      ringColor: 'ring-amber-500/20 group-hover:ring-amber-500/40',
      borderColor: 'border-amber-500',
      quoteType: 'Guest of Honor Address on Educational Standards:',
      quote: 'Standardized testing coupled with 100% self-funded scholarship grants is a remarkable milestone for private and public education alike. AZM\'s optical examination system ensures that excellence within our partner schools is objectively measured and celebrated, inspiring institutions across the province to champion academic rigor.',
      mandates: [
        'Institutional regulatory coordination and test center standardization',
        'Promoting syllabus-aligned competition across private and public schools'
      ],
      icon: Building2
    }
  ];

  return (
    <section className="py-20 bg-gradient-to-b from-slate-50 to-white border-t border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-2">
          <span className="text-xs font-extrabold text-[#185b9d] uppercase tracking-widest bg-blue-50 px-3.5 py-1 rounded-full border border-blue-200/60 inline-block">
            Executive Stewardship & Distinguished Patrons
          </span>
          <h2 className="text-3xl sm:text-5xl font-display font-extrabold text-slate-900 tracking-tight">
            Leadership Behind Session V
          </h2>
          <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto leading-relaxed">
            AZM Group of Companies finances, standardizes, and guarantees every testing round in collaboration with esteemed public administrators and educational regulators.
          </p>
        </div>

        {/* 4-Card Leadership & Patron Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {leaders.map((leader) => {
            const Icon = leader.icon;
            return (
              <div
                key={leader.id}
                className="p-7 sm:p-9 rounded-3xl bg-white border border-slate-200 shadow-lg shadow-slate-200/50 relative overflow-hidden flex flex-col justify-between group hover:border-blue-300 transition-all duration-300"
              >
                <div className="absolute top-0 right-0 p-6 text-slate-100 pointer-events-none">
                  <Quote className="w-20 h-20 opacity-25 text-slate-400" />
                </div>

                <div className="space-y-5 relative z-10">
                  {/* Portrait & Profile Header */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 pb-5 border-b border-slate-100">
                    <div className={`relative w-28 h-36 sm:w-36 sm:h-44 rounded-2xl overflow-hidden shadow-md border-2 border-white flex-shrink-0 bg-slate-900 ring-4 ${leader.ringColor} transition-all`}>
                      <img
                        src={leader.photo}
                        alt={leader.name}
                        width={144}
                        height={176}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                      />
                      <span className="absolute bottom-2 left-2 right-2 px-2 py-0.5 bg-slate-950/85 backdrop-blur-xs text-[10px] font-bold text-center text-white rounded-md border border-white/20">
                        {leader.badge}
                      </span>
                    </div>

                    <div className="space-y-1 min-w-0">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold border ${leader.badgeColor}`}>
                        <Icon className="w-3.5 h-3.5" />
                        {leader.role}
                      </span>
                      <h3 className="text-lg sm:text-xl font-extrabold font-display text-slate-900 leading-tight">
                        {leader.name}
                      </h3>
                      <p className="text-xs text-slate-500 font-medium leading-snug">
                        {leader.organization}
                      </p>
                    </div>
                  </div>

                  {/* Leadership / Address Note */}
                  <div className="space-y-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                      {leader.quoteType}
                    </span>
                    <blockquote className={`text-xs sm:text-sm text-slate-700 leading-relaxed italic bg-slate-50/90 p-4 rounded-2xl border-l-4 ${leader.borderColor}`}>
                      "{leader.quote}"
                    </blockquote>
                  </div>
                </div>

                {/* Key Mandates Strip */}
                <div className="mt-6 pt-4 border-t border-slate-100 space-y-1.5">
                  {leader.mandates.map((m, mIdx) => (
                    <div key={mIdx} className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                      <span>{m}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};
