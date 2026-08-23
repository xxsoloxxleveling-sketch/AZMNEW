import React, { useState } from 'react';
import { MONTHLY_ASSISTANCE_RATES } from '../../data/scholarshipData';
import { PageTab } from '../../types';
import { 
  Calculator, 
  Sparkles, 
  ArrowRight, 
  CheckCircle2, 
  Wallet, 
  GraduationCap, 
  HelpCircle,
  TrendingUp,
  ShieldCheck
} from 'lucide-react';
import { motion } from 'motion/react';

interface FeeCalculatorProps {
  onSelectTab: (tab: PageTab, prefillClass?: string) => void;
}

export const FeeCalculator: React.FC<FeeCalculatorProps> = ({ onSelectTab }) => {
  const [selectedClassIndex, setSelectedClassIndex] = useState<number>(4); // Default to Class 10th
  const selected = MONTHLY_ASSISTANCE_RATES[selectedClassIndex];

  return (
    <section className="py-16 bg-slate-50 border-b border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-3xl mx-auto mb-10">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 mb-3">
            <Calculator className="w-3.5 h-3.5" />
            Official Session V Assistance Matrix
          </span>
          <h2 className="text-2xl sm:text-4xl font-display font-extrabold text-slate-900 tracking-tight">
            Interactive Assistance & Stipend Calculator
          </h2>
          <p className="text-sm sm:text-base text-slate-600 mt-2">
            Select your academic grade level to view the exact monthly assistance, annual scholarship entitlement, and examination subsidies.
          </p>
        </div>

        {/* Grade Level Selector Tabs */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-10">
          {MONTHLY_ASSISTANCE_RATES.map((item, idx) => {
            const isSelected = selectedClassIndex === idx;
            return (
              <button
                key={item.classLevel}
                id={`calc-grade-${idx}`}
                onClick={() => setSelectedClassIndex(idx)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 focus:outline-hidden ${
                  isSelected
                    ? 'bg-[#185b9d] text-white shadow-md shadow-[#185b9d]/20 scale-105'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5" />
                <span>{item.classLevel}</span>
              </button>
            );
          })}
        </div>

        {/* Interactive Calculation Card */}
        <div className="max-w-4xl mx-auto bg-white rounded-3xl border border-slate-200/90 shadow-xl overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-12">
            {/* Left Result Highlight Panel */}
            <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between space-y-6">
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#185b9d] bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                    {selected.name}
                  </span>
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    Session V 2026 Guaranteed
                  </span>
                </div>

                <h3 className="text-2xl font-bold font-display text-slate-900">
                  {selected.classLevel} Assistance Package
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  {selected.notes}
                </p>
              </div>

              {/* Amount Display Metrics */}
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <div className="text-xs text-slate-500 font-medium">Monthly Direct Stipend</div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-[#185b9d] font-display mt-1 tabular-nums">
                    PKR {selected.monthlyAmount.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{selected.periodLabel}</div>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200">
                  <div className="text-xs text-emerald-800 font-medium">Annual Academic Grant</div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-emerald-700 font-display mt-1 tabular-nums">
                    PKR {selected.annualAmount.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-emerald-800 mt-0.5">1 Full Academic Cycle</div>
                </div>
              </div>

              {/* Included Benefits List */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="text-xs font-bold text-slate-800">Everything Included in this Grant:</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                    <span>Direct bank / cash disbursement</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                    <span>100% Free 1,000 MCQs Notes</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                    <span>Merit Certificate & Medal eligibility</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                    <span>Eligible for Laptop / Umrah Awards</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Action & Comparison Column */}
            <div className="lg:col-span-5 bg-gradient-to-br from-slate-900 via-[#0e2a48] to-[#0a2038] text-white p-6 sm:p-8 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Wallet className="w-5 h-5 text-amber-400" />
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-300">
                    Why AZM Scholarships Matter
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="p-3 rounded-xl bg-white/10 border border-white/15">
                    <div className="text-slate-300 text-[11px]">Cumulative Relief</div>
                    <div className="text-lg font-bold text-amber-300 tabular-nums">
                      Covers up to 100% of Tuition & Study Costs
                    </div>
                    <p className="text-[11px] text-slate-300 mt-1">
                      Designed to eradicate financial barriers and keep Pakistan’s brightest minds enrolled without stress.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-slate-300 text-xs pt-1">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>Funded purely by AZM Group of Companies</span>
                  </div>
                </div>
              </div>

              {/* Direct Apply CTA */}
              <div className="pt-6">
                <button
                  id="calc-apply-now-btn"
                  onClick={() => onSelectTab('apply', selected.classLevel)}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs shadow-lg transition-all flex items-center justify-center gap-2 focus:outline-hidden"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Apply for {selected.classLevel}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <p className="text-[10px] text-center text-slate-400 mt-2">
                  Takes less than 3 minutes • 100% Free Registration
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
