import React from 'react';
import { Wrench, Clock, Phone, ArrowLeft, Search, MessageCircle, ShieldAlert, Sparkles } from 'lucide-react';
import { PageTab } from '../../types';
import { CandidateSlipRetrievalCard } from './CandidateSlipRetrievalCard';


interface ApplicationClosedNoticeProps {
  onSelectTab: (tab: PageTab) => void;
}

export const ApplicationClosedNotice: React.FC<ApplicationClosedNoticeProps> = ({ onSelectTab }) => {
  return (
    <div className="py-12 sm:py-16 max-w-4xl mx-auto px-4 sm:px-6">
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xl overflow-hidden">
        {/* Top Gradient Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-[#185b9d] to-slate-900 px-6 sm:px-10 py-8 text-white text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
              <Clock className="w-3.5 h-3.5" />
              <span>Online Application Paused for System Upgrades</span>
            </span>
            <h1 className="text-2xl sm:text-3xl font-black font-display tracking-tight">
              Portal Maintenance in Progress
            </h1>
            <p className="text-xs sm:text-sm text-blue-100/80 max-w-xl">
              We are currently upgrading the online candidate registration system for Session V (2026-2027).
            </p>
          </div>

          <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center flex-shrink-0 text-amber-300">
            <Wrench className="w-8 h-8 animate-bounce" />
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-10 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Info Box 1 */}
            <div className="p-5 rounded-2xl bg-blue-50/70 border border-blue-100 space-y-2">
              <div className="flex items-center gap-2 text-[#185b9d] font-bold text-sm">
                <Sparkles className="w-4 h-4" />
                <span>When Will Registrations Reopen?</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Public online candidate submissions will resume shortly once new system enhancements, automated challan generation, and biometric verification workflows are deployed.
              </p>
            </div>

            {/* Info Box 2 */}
            <div className="p-5 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-2">
              <div className="flex items-center gap-2 text-amber-800 font-bold text-sm">
                <ShieldAlert className="w-4 h-4" />
                <span>Already Submitted Your Application?</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                All previously submitted applications and fee receipts are safely recorded in our database. You can track your verification and search your Roll Number Slip anytime.
              </p>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider text-center">
              Quick Assistance &amp; Tracking Options
            </h4>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <a
                href="https://wa.me/923051755551?text=Hello%20AZM.AIO%20Helpline%2C%20I%20want%20to%20inquire%20about%20online%20candidate%20registration."
                target="_blank"
                rel="noreferrer"
                className="px-5 py-3 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white text-xs font-bold shadow-md transition flex items-center gap-2 cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Inquire on WhatsApp (0305-1755551)</span>
              </a>


              <button
                onClick={() => onSelectTab('roll-number')}
                className="px-5 py-3 rounded-xl bg-[#185b9d] hover:bg-[#13497d] text-white text-xs font-bold shadow-md transition flex items-center gap-2 cursor-pointer"
              >
                <Search className="w-4 h-4" />
                <span>Search Roll Number Slip</span>
              </button>

              <button
                onClick={() => onSelectTab('home')}
                className="px-5 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-2 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Return to Home</span>
              </button>
            </div>
          </div>

          {/* Candidate Profile Slip & Fee Voucher Self-Service Re-Download Tool */}
          <div className="pt-2">
            <CandidateSlipRetrievalCard />
          </div>

          {/* Internal Testing Notice */}
          <div className="pt-6 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span>AZM Educational Network • Admissions Directorate</span>
            <button
              onClick={() => onSelectTab('apply-test')}
              className="text-slate-400 hover:text-slate-600 transition underline font-mono"
            >
              Developer Testing Sandbox
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

