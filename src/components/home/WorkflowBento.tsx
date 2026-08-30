import React, { useState } from 'react';
import { PageTab } from '../../types';
import { 
  FileCheck2, 
  ScanLine, 
  Users2, 
  Trophy, 
  ArrowRight, 
  CheckCircle2, 
  Clock,
  ChevronRight
} from 'lucide-react';
import { motion } from 'motion/react';

interface WorkflowBentoProps {
  onSelectTab: (tab: PageTab) => void;
}

export const WorkflowBento: React.FC<WorkflowBentoProps> = ({ onSelectTab }) => {
  const [activeStep, setActiveStep] = useState<number>(1);

  const steps = [
    {
      step: 1,
      tag: 'Stage 1',
      title: 'Online or Hub Registration',
      duration: '16 Aug – 05 Sep 2026',
      icon: FileCheck2,
      summary: 'Register online in 3 minutes or visit any of our 3 Mansehra hubs with your B-Form/CNIC.',
      bullets: [
        'Nominal PKR 300 registration & processing fee',

        'Immediate Application Tracking ID',
        'Official ~1,000 MCQs course book download'
      ],
      actionLabel: 'Register for Test',
      tabTarget: 'apply' as PageTab
    },
    {
      step: 2,
      tag: 'Stage 2',
      title: '100 MCQs Standardized Exam',
      duration: '10 Nov – 15 Nov 2026',
      icon: ScanLine,
      summary: '100% of questions are drawn from published grade books. Zero negative marking on optical bubble sheets.',
      bullets: [
        '30 Science, 20 English, 20 Math, 20 GK, 10 Isl/Pak',
        'Timed 120-minute regional hall sitting',
        'Standardized 2B/HB pencil darkened bubble sheet'
      ],
      actionLabel: 'View Exam Syllabus',
      tabTarget: 'scholarship' as PageTab
    },
    {
      step: 3,
      tag: 'Stage 3',
      title: 'Optical Scan & Panel Interview',
      duration: '20 Nov – 13 Dec 2026',
      icon: Users2,
      summary: 'Optical scanning produces verified scores, followed by qualitative assessment by a 6-member board.',
      bullets: [
        '70% Written Exam + 15% Interview + 10% DMC + 5% Need',
        'Transparent verification of orphan & income records',
        'Zero manual tampering in OMR score tabulation'
      ],
      actionLabel: 'Read Interview Protocol',
      tabTarget: 'about' as PageTab
    },
    {
      step: 4,
      tag: 'Stage 4',
      title: 'Public Merit List & Awards',
      duration: '26 Dec 2026',
      icon: Trophy,
      summary: 'Ranked merit lists are published publicly, and awards are conferred onstage at the grand ceremony.',
      bullets: [
        'Category A: Holy Umrah Air Tickets & Full Tuition Grants',
        'Category D: 150 High-Performance Laptops',
        'Category F: Direct cash grants to 200 achievers'
      ],
      actionLabel: 'View Merit Index',
      tabTarget: 'results' as PageTab
    }
  ];

  return (
    <section className="py-16 bg-white border-b border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-12">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-2">
          <span className="text-xs font-bold text-[#185b9d] uppercase tracking-widest">
            Standardized 4-Step Selection Process
          </span>
          <h2 className="text-2xl sm:text-4xl font-display font-extrabold text-slate-900 tracking-tight">
            How the AZM Merit Engine Works
          </h2>
          <p className="text-sm sm:text-base text-slate-600">
            No favoritism, no hidden scoring — just a test, an optical scan, and an interview.
          </p>
        </div>

        {/* Step-by-Step Flowchart Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative">
          {steps.map((item, idx) => {
            const Icon = item.icon;
            const isHovered = activeStep === item.step;

            return (
              <div
                key={item.step}
                onMouseEnter={() => setActiveStep(item.step)}
                className={`relative rounded-3xl p-6 transition-all duration-300 flex flex-col justify-between border ${
                  isHovered
                    ? 'bg-slate-900 text-white shadow-xl scale-[1.02] border-slate-700 ring-2 ring-[#185b9d]/30'
                    : 'bg-slate-50/80 text-slate-800 border-slate-200/90 hover:border-slate-300'
                }`}
              >
                <div>
                  {/* Step Header */}
                  <div className="flex items-center justify-between mb-4">
                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                        isHovered
                          ? 'bg-white/10 text-emerald-300 border border-white/20'
                          : 'bg-blue-50 text-[#185b9d] border border-blue-200'
                      }`}
                    >
                      Step 0{item.step}
                    </span>
                    <span className="text-[11px] font-mono opacity-75 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {item.duration}
                    </span>
                  </div>

                  {/* Icon */}
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-all ${
                      isHovered
                        ? 'bg-gradient-to-br from-[#185b9d] to-emerald-500 text-white shadow-md'
                        : 'bg-white text-[#185b9d] border border-slate-200 shadow-xs'
                    }`}
                  >
                    <Icon className="w-6 h-6" />
                  </div>

                  {/* Title & Summary */}
                  <h3 className={`text-base sm:text-lg font-bold font-display mb-2 ${isHovered ? 'text-white' : 'text-slate-900'}`}>
                    {item.title}
                  </h3>
                  <p className={`text-xs leading-relaxed mb-4 ${isHovered ? 'text-slate-300' : 'text-slate-600'}`}>
                    {item.summary}
                  </p>

                  {/* Bullets */}
                  <ul className="space-y-2 mb-6 text-xs">
                    {item.bullets.map((bullet, bIdx) => (
                      <li key={bIdx} className="flex items-start gap-2">
                        <CheckCircle2
                          className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${
                            isHovered ? 'text-emerald-400' : 'text-emerald-600'
                          }`}
                        />
                        <span className={isHovered ? 'text-slate-200' : 'text-slate-700'}>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Action Link */}
                <button
                  onClick={() => onSelectTab(item.tabTarget)}
                  className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 focus:outline-hidden ${
                    isHovered
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md'
                      : 'bg-white hover:bg-slate-100 text-slate-800 border border-slate-300'
                  }`}
                >
                  <span>{item.actionLabel}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
