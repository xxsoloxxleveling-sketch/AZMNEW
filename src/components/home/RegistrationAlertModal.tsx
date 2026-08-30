import React, { useState, useEffect } from 'react';
import { PageTab } from '../../types';
import { 
  Sparkles, 
  X, 
  Calendar, 
  Clock, 
  Award, 
  CheckCircle2, 
  ArrowRight, 
  BellRing,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface RegistrationAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTab: (tab: PageTab, prefillClass?: string) => void;
}

const REGISTRATION_DEADLINE = new Date('2026-09-05T23:59:59+05:00').getTime();

const getCountdown = () => {
  const diff = Math.max(0, REGISTRATION_DEADLINE - Date.now());
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60)
  };
};

export const RegistrationAlertModal: React.FC<RegistrationAlertModalProps> = ({
  isOpen,
  onClose,
  onSelectTab
}) => {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const [countdown, setCountdown] = useState(getCountdown);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(getCountdown());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleClose = () => {
    if (dontShowAgain) {
      try {
        localStorage.setItem('AZM_DISMISS_REG_ALERT', new Date().toDateString());
      } catch (e) {}
    }
    onClose();
  };

  const handleRegisterClick = () => {
    handleClose();
    onSelectTab('apply');
  };

  const handleSyllabusClick = () => {
    handleClose();
    onSelectTab('scholarship');
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3.5 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className="relative w-full max-w-lg bg-gradient-to-b from-[#0a192f] via-[#051124] to-[#030712] border-2 border-blue-500/40 rounded-3xl shadow-[0_0_50px_rgba(24,91,157,0.4)] text-white overflow-hidden"
        >
          {/* Top Decorative Glow Band */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-400 via-sky-400 to-emerald-400" />

          {/* Close Button */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-slate-300 hover:text-white hover:bg-white/20 transition-all focus:outline-hidden z-20"
            aria-label="Close Alert"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="p-6 sm:p-7 space-y-5">
            {/* Header Pill & Title */}
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-400/20 text-amber-300 border border-amber-400/40 animate-pulse">
                <BellRing className="w-3.5 h-3.5" />
                Urgent Registration Notice
              </span>
              <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-950/80 px-2.5 py-0.5 rounded-full border border-emerald-800/60">
                Entry Fee: PKR 300
              </span>

            </div>

            <div className="space-y-1.5">
              <h2 className="text-xl sm:text-2xl font-display font-extrabold text-white tracking-tight leading-snug">
                Session V (2026) Scholarship Test Registration is Open!
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Eligible students from <strong className="text-white">Class 6th to BS University Level</strong> across KP & Hazara Division can now apply for 500 self-funded scholarship seats.
              </p>
            </div>

            {/* Micro Live Countdown Strip */}
            <div className="p-3.5 rounded-2xl bg-blue-950/60 border border-blue-800/60 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <Clock className="w-4 h-4 text-amber-400 flex-shrink-0 animate-spin" style={{ animationDuration: '8s' }} />
                <span>Registration Closes: <strong>5 September 2026</strong></span>
              </div>
              <div className="font-mono text-xs font-bold text-amber-300 bg-amber-400/10 px-2.5 py-1 rounded-lg border border-amber-400/30">
                {countdown.days}d {countdown.hours}h {countdown.minutes}m {countdown.seconds}s left
              </div>
            </div>

            {/* Key Scholarship Highlights */}
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-start gap-2">
                <Award className="w-4 h-4 text-amber-300 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-white">500 Total Seats</div>
                  <div className="text-[11px] text-slate-400">Categories A to F</div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-white">PKR 5.2M+ Grants</div>
                  <div className="text-[11px] text-slate-400">Umrah, Laptops & Cash</div>
                </div>
              </div>
            </div>

            {/* Quick Benefits Bullet List */}
            <ul className="space-y-2 text-xs text-slate-300">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                <span>Nominal PKR 300 entry fee covers testing materials and OMR result processing.</span>
              </li>

              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                <span>100% Questions from published ~1,000 MCQs course books per grade.</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                <span>Fast 3-minute online registration or apply at Mansehra hubs.</span>
              </li>
            </ul>

            {/* Primary Action Buttons */}
            <div className="space-y-2.5 pt-1">
              <button
                onClick={handleRegisterClick}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-[#185b9d] via-[#2272be] to-[#0f4477] hover:from-[#1d6bb8] hover:to-[#124d85] text-white font-bold text-sm rounded-xl shadow-[0_0_20px_rgba(24,91,157,0.5)] border border-sky-400/40 flex items-center justify-center gap-2 transition-all transform hover:-translate-y-0.5 active:translate-y-0 focus:outline-hidden"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Register for Test Now</span>
                <ArrowRight className="w-4 h-4 text-sky-200" />
              </button>

              <button
                onClick={handleSyllabusClick}
                className="w-full py-2.5 px-4 bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white font-semibold text-xs rounded-xl border border-slate-700/80 transition-colors flex items-center justify-center gap-1.5 focus:outline-hidden"
              >
                <span>View 100 MCQs Syllabus & Exam Pattern</span>
              </button>
            </div>

            {/* Dismissal Checkbox */}
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={dontShowAgain}
                  onChange={(e) => setDontShowAgain(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-700 text-[#185b9d] focus:ring-0 cursor-pointer"
                />
                <span>Don't show this announcement again today</span>
              </label>

              <button
                onClick={handleClose}
                className="text-slate-400 hover:text-slate-200 underline font-medium"
              >
                Dismiss
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
