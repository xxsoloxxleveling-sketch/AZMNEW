import React from 'react';
import { SIX_PILLARS, EVALUATION_WEIGHTS } from '../../data/scholarshipData';
import { 
  ShieldCheck, 
  Users, 
  Award, 
  BookCheck, 
  ScanLine, 
  Gift, 
  CheckCircle2, 
  ArrowRight,
  Sparkles,
  Calendar,
  Lock,
  GraduationCap
} from 'lucide-react';
import { PageTab } from '../../types';

interface AboutViewProps {
  onSelectTab?: (tab: PageTab) => void;
}

export const AboutView: React.FC<AboutViewProps> = ({ onSelectTab }) => {
  const roadmapMilestones = [
    {
      year: 'Early 2025',
      session: 'Session I',
      seats: '50 Seats',
      candidates: '450 Candidates',
      headline: 'Inaugural Testing in Mansehra',
      detail: 'Launched the first standardized written test to identify high-potential students from underprivileged backgrounds.'
    },
    {
      year: 'Mid 2025',
      session: 'Session II',
      seats: '120 Seats',
      candidates: '980 Candidates',
      headline: 'Electronic OMR Optical Grading',
      detail: 'Eliminated manual paper checking by introducing optical mark recognition (OMR) scanners and direct fee stipends.'
    },
    {
      year: 'Late 2025',
      session: 'Session III',
      seats: '250 Seats',
      candidates: '1,750 Candidates',
      headline: 'Regional Expansion & Laptops',
      detail: 'Expanded test hubs to Abbottabad and Haripur; awarded high-spec laptops and annual school fee coverage.'
    },
    {
      year: 'Early 2026',
      session: 'Session IV',
      seats: '380 Seats',
      candidates: '2,400 Candidates',
      headline: 'Holy Umrah Air Tickets & Cash Grants',
      detail: 'Conferred Umrah packages to overall position holders alongside university BS semester grants.'
    },
    {
      year: '2026 (Current)',
      session: 'Session V',
      seats: '500 Seats',
      candidates: '3,500+ Expected',
      headline: 'Published 1,000 MCQs Question Bank',
      detail: '100% test questions derived from published grade course books. Over PKR 5.2M in self-funded grants.',
      isCurrent: true
    }
  ];


  const boardMembers = [
    {
      role: 'Lead Science & Math Academician',
      focus: 'Evaluates analytical reasoning, problem-solving logic, and scientific fundamentals',
      badge: 'Sciences & Math',
      image: '/pictures/panelists/panelist_1_science_math.jpg'
    },
    {
      role: 'Language & Humanities Specialist',
      focus: 'Assesses English reading comprehension, articulate expression, and critical thinking',
      badge: 'Humanities',
      image: '/pictures/panelists/panelist_2_humanities.jpg'
    },
    {
      role: 'Senior Institutional Principal',
      focus: 'Reviews academic discipline, school track record, and co-curricular achievements',
      badge: 'Institutional',
      image: '/pictures/panelists/panelist_3_principal.jpg'
    },
    {
      role: 'Executive Welfare Director',
      focus: 'Verifies orphan certificates, family income declarations, and financial need criteria',
      badge: 'Need Scrutiny',
      image: '/pictures/panelists/panelist_4_welfare_director.jpg'
    },
    {
      role: 'Independent Ethics Observer',
      focus: 'Ensures strict scoring equity, non-conflict of interest, and transparent protocol',
      badge: 'Integrity',
      image: '/pictures/panelists/panelist_5_ethics_observer.jpg'
    },
    {
      role: 'Academic & Career Counselor',
      focus: 'Analyzes long-term educational vision, emotional resilience, and career ambition',
      badge: 'Counseling',
      image: '/pictures/panelists/panelist_6_career_counselor.jpg'
    }
  ];

  return (
    <div className="py-10 space-y-16 max-w-7xl mx-auto px-4 sm:px-6">
      
      {/* 1. Page Header & Real Archive Photographic Banner */}
      <div className="space-y-6">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <span className="text-xs font-bold text-[#185b9d] uppercase tracking-widest">
            Institutional Background
          </span>
          <h1 className="text-3xl sm:text-5xl font-display font-extrabold text-slate-900 tracking-tight">
            Fair Testing, Direct Scholarships
          </h1>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
            No favoritism, no hidden scoring — just a test, an optical scan, and a verified interview. AZM.AIO (Pvt.) Ltd. operates a transparent examination system where hard work alone decides the outcome.
          </p>
        </div>

        {/* Real Authentic Photos Strip from Sessions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
          <div className="relative h-56 rounded-3xl overflow-hidden shadow-xs border border-slate-200 group bg-slate-900">
            <img
              src="/pictures/Session 4/WhatsApp Image 2026-07-14 at 2.49.46 PM.jpeg"
              alt="Session IV OMR Examination Center Hall"
              width={400}
              height={224}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
            <div className="absolute bottom-3 left-3 right-3 text-white">
              <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider block">Real Examination Center</span>
              <p className="text-xs font-bold leading-tight">OMR Testing at Jadoon Campus (Session IV)</p>
            </div>
          </div>

          <div className="relative h-56 rounded-3xl overflow-hidden shadow-xs border border-slate-200 group bg-slate-900">
            <img
              src="/pictures/Winter Session 3 and ceremony/WhatsApp Image 2026-07-14 at 2.48.17 PM (1).jpeg"
              alt="Grand Award Distribution Ceremony"
              width={400}
              height={224}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
            <div className="absolute bottom-3 left-3 right-3 text-white">
              <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider block">Merit Award Stage</span>
              <p className="text-xs font-bold leading-tight">Umrah & Laptop Conferment Ceremony</p>
            </div>
          </div>

          <div className="relative h-56 rounded-3xl overflow-hidden shadow-xs border border-slate-200 group bg-slate-900">
            <img
              src="/pictures/Winter Session 3 and ceremony/WhatsApp Image 2026-07-14 at 2.48.33 PM (2).jpeg"
              alt="High Achievers Felicitation"
              width={400}
              height={224}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
            <div className="absolute bottom-3 left-3 right-3 text-white">
              <span className="text-[10px] font-bold text-sky-300 uppercase tracking-wider block">Verified Beneficiaries</span>
              <p className="text-xs font-bold leading-tight">Top Merit Students Across Hazara & KP</p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Self-Funded Independence Callout */}
      <div className="p-8 rounded-3xl bg-slate-900 text-white shadow-xl border border-slate-800">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-8 space-y-3">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">
              Corporate Social Responsibility
            </span>
            <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-white">
              100% Self-Funded Independence
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Every rupee disbursed, every laptop conferred, and every fee stipend is financed directly by the AZM Group of Companies. We do not collect public charity or solicit third-party donations.
            </p>
          </div>

          <div className="lg:col-span-4 p-6 rounded-2xl bg-slate-800/80 border border-slate-700/80 text-center space-y-1">
            <span className="text-xs text-slate-400 font-medium">Session V Allocation</span>
            <div className="text-3xl font-mono font-extrabold text-amber-300">500 Seats</div>
            <div className="text-xs text-emerald-400 font-bold">PKR 5.2M+ Direct Grants</div>
          </div>
        </div>
      </div>

      {/* 3. The 6 Pillars of AZM.AIO */}
      <div className="space-y-8 pt-4">
        <div className="text-center max-w-2xl mx-auto space-y-1">
          <span className="text-xs font-bold text-[#185b9d] uppercase tracking-widest">
            Operating Principles
          </span>
          <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-slate-900">
            The 6 Pillars of AZM.AIO
          </h2>
          <p className="text-xs text-slate-500">
            How we protect test integrity and ensure awards go strictly to deserving scholars.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8 max-w-5xl mx-auto">
          {SIX_PILLARS.map((pillar, idx) => (
            <div key={pillar.title} className="flex items-start gap-4 pb-6 border-b border-slate-100">
              <span className="text-2xl font-display font-extrabold text-slate-300 font-mono flex-shrink-0">
                0{idx + 1}
              </span>
              <div className="space-y-1">
                <h3 className="text-base font-bold font-display text-slate-900">
                  {pillar.title}
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {pillar.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. The 6-Member Interview Board (6 Distinct Evaluator Portraits) */}
      <div className="p-8 sm:p-10 rounded-3xl bg-slate-50 border border-slate-200/90 space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1">
            <span className="text-xs font-bold text-purple-700 uppercase tracking-widest">
              Stage 3 Scrutiny
            </span>
            <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-slate-900">
              The 6-Member Independent Interview Board
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 max-w-2xl">
              Following the written OMR test, shortlisted candidates appear before a balanced 6-member committee to evaluate understanding and verify financial background.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-bold text-purple-800 bg-purple-100 px-3.5 py-1.5 rounded-xl border border-purple-200 self-start md:self-auto">
            <span>15% Merit Weighting</span>
          </div>
        </div>

        {/* Board Panelists Grid with Distinct Evaluator Portraits */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {boardMembers.map((member, mIdx) => (
            <div
              key={mIdx}
              className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs hover:shadow-md transition-all flex items-start gap-3.5 group"
            >
              <div className="relative w-14 h-14 rounded-2xl overflow-hidden shadow-xs border border-slate-200 flex-shrink-0 bg-slate-900 ring-2 ring-purple-500/20 group-hover:scale-105 transition-transform">
                <img
                  src={member.image}
                  alt={member.role}
                  className="w-full h-full object-cover object-top"
                />
              </div>

              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-100">
                    Panel Seat #{mIdx + 1}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400">
                    {member.badge}
                  </span>
                </div>
                <h4 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">
                  {member.role}
                </h4>
                <p className="text-[11px] text-slate-500 leading-snug">
                  {member.focus}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Merit Weighting Breakdown Visual */}
        <div className="pt-4 border-t border-slate-200">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
            Total Evaluation Scoring Breakdown:
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {EVALUATION_WEIGHTS.map((item) => (
              <div key={item.label} className="p-3 rounded-xl bg-white border border-slate-200">
                <div className="text-lg font-mono font-extrabold text-slate-900">{item.percentage}%</div>
                <div className="text-xs font-semibold text-slate-700 leading-tight mt-0.5">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 5. Session I to Session V Evolution */}
      <div className="space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-1">
          <span className="text-xs font-bold text-emerald-700 uppercase tracking-widest">
            Track Record
          </span>
          <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-slate-900">
            Session I to Session V Evolution
          </h2>
          <p className="text-xs text-slate-600">
            How AZM.AIO expanded from its inaugural 50-seat initiative in 2025 to a region-wide 500-seat scholarship platform in 2026.
          </p>

        </div>

        {/* Continuous Horizontal Milestone Timeline */}
        <div className="relative border-l-2 md:border-l-0 md:border-t-2 border-blue-200 ml-4 md:ml-0 pt-0 md:pt-8 space-y-8 md:space-y-0 md:grid md:grid-cols-5 md:gap-4">
          {roadmapMilestones.map((m, idx) => (
            <div key={m.session} className="relative pl-6 md:pl-0">
              {/* Timeline Connector Dot */}
              <div className={`absolute -left-[17px] md:left-0 md:-top-[41px] w-8 h-8 rounded-full border-4 border-white flex items-center justify-center text-[10px] font-bold shadow-sm ${
                m.isCurrent
                  ? 'bg-emerald-600 text-white ring-4 ring-emerald-100'
                  : 'bg-[#185b9d] text-white'
              }`}>
                {idx + 1}
              </div>

              {/* Milestone Content */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-xs font-bold text-[#185b9d]">{m.year}</span>
                  {m.isCurrent && (
                    <span className="px-2 py-0.2 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                      Current
                    </span>
                  )}
                </div>
                <h3 className="text-sm font-bold font-display text-slate-900 leading-snug">
                  {m.session}
                </h3>
                <div className="text-xs font-bold text-emerald-700">
                  {m.seats}
                </div>
                <div className="text-[11px] font-mono text-slate-400">{m.candidates}</div>
                <p className="text-xs text-slate-600 leading-relaxed pt-1">
                  {m.detail}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
