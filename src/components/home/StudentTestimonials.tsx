import React from 'react';
import { Quote, Award, Sparkles, MapPin, CheckCircle2 } from 'lucide-react';
import { PageTab } from '../../types';

interface StudentTestimonialsProps {
  onSelectTab: (tab: PageTab) => void;
}

export const StudentTestimonials: React.FC<StudentTestimonialsProps> = ({ onSelectTab }) => {
  const testimonials = [
    {
      id: 't-1',
      name: 'Hamza Tariq',
      grade: 'Class 10th (SSC-II)',
      school: 'Government High School Gandhian, Mansehra',
      sessionWon: 'Session IV Overall 1st Position',
      award: 'Holy Umrah Air Ticket + Gold Medal + Laptop',
      photo: '/pictures/Winter Session 3 and ceremony/WhatsApp Image 2026-07-14 at 2.48.24 PM.jpeg',
      quote: 'Preparing from the published 1,000 MCQs course book gave me complete clarity. When the OMR sheet was scanned, my score of 94/100 was displayed immediately. Winning the Umrah ticket was a dream come true for my parents.'
    },
    {
      id: 't-2',
      name: 'Ayesha Bibi',
      grade: 'F.Sc Pre-Medical (HSSC-I)',
      school: 'Dubai International Public College, Mansehra',
      sessionWon: 'Session IV Category A Winner',
      award: 'Brand-New Laptop + Full 2-Year Tuition Coverage',
      photo: '/pictures/Winter Session 3 and ceremony/WhatsApp Image 2026-07-14 at 2.48.28 PM.jpeg',
      quote: 'As an orphan student, education felt financially uncertain. AZM evaluated my OMR paper and verified my academic records with pure respect. My college tuition is now completely covered.'
    },
    {
      id: 't-3',
      name: 'Muhammad Shahzaib',
      grade: 'Class 9th (SSC-I)',
      school: 'Khyber Public School & College, Mansehra',
      sessionWon: 'Session III Top Merit Holder',
      award: 'Annual Cash Educational Stipend + Merit Shield',
      photo: '/pictures/Winter Session 3 and ceremony/WhatsApp Image 2026-07-14 at 2.48.33 PM (1).jpeg',
      quote: 'The testing environment was so strict and fair. No one could pass through connections. That transparency gave every student from ordinary backgrounds the confidence to compete.'
    }
  ];

  return (
    <section className="py-16 bg-slate-900 text-white relative overflow-hidden">
      {/* Background Subtle Gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(24,91,157,0.18),transparent_50%)] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10 space-y-12">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-2">
          <span className="text-xs font-bold text-amber-300 uppercase tracking-widest">
            Real Impact Across Sessions I – IV
          </span>
          <h2 className="text-2xl sm:text-4xl font-display font-extrabold text-white tracking-tight">
            Scholars Who Proved Merit Works
          </h2>
          <p className="text-xs sm:text-sm text-slate-300">
            Hear from past position holders whose education was sponsored through AZM's standardized optical examinations and merit grants.
          </p>
        </div>

        {/* Testimonials 3-Column Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((item) => (
            <div
              key={item.id}
              className="p-6 sm:p-7 rounded-3xl bg-slate-800/80 border border-slate-700/80 shadow-md flex flex-col justify-between hover:border-slate-600 transition-all group"
            >
              <div className="space-y-4">
                {/* Top Quote Icon & Award Badge */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {item.sessionWon}
                  </span>
                  <Quote className="w-6 h-6 text-slate-600 group-hover:text-amber-400/60 transition-colors" />
                </div>

                {/* Quote Text */}
                <p className="text-xs sm:text-sm text-slate-200 leading-relaxed italic">
                  "{item.quote}"
                </p>

                {/* Award Won Strip */}
                <div className="p-3 rounded-2xl bg-slate-900/90 border border-slate-700/60 text-xs flex items-start gap-2">
                  <Award className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Award Received:</span>
                    <span className="font-bold text-white text-[11px]">{item.award}</span>
                  </div>
                </div>
              </div>

              {/* Scholar Profile Footer */}
              <div className="flex items-center gap-3.5 pt-5 mt-5 border-t border-slate-700/70">
                <div className="relative w-12 h-12 rounded-xl overflow-hidden shadow-xs border border-slate-600 flex-shrink-0 bg-slate-950">
                  <img
                    src={item.photo}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-sm font-bold text-white truncate">{item.name}</h3>
                  <p className="text-[11px] text-sky-300 font-medium truncate">{item.grade}</p>
                  <p className="text-[10px] text-slate-400 truncate">{item.school}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Fast Action */}
        <div className="p-6 rounded-3xl bg-gradient-to-r from-blue-950/60 via-slate-900 to-blue-950/60 border border-blue-800/40 text-center flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-center sm:text-left">
            <h3 className="text-sm font-bold text-white">Want to see all 68 ceremony & exam hall photographs?</h3>
            <p className="text-xs text-slate-400">Browse real archives from past testing sessions in Mansehra & KP.</p>
          </div>
          <button
            onClick={() => onSelectTab('gallery')}
            className="px-5 py-2.5 bg-[#185b9d] hover:bg-[#13497e] text-white font-bold text-xs rounded-xl shadow-md transition-colors whitespace-nowrap"
          >
            Open Media Gallery Archives
          </button>
        </div>
      </div>
    </section>
  );
};
