import React, { useState } from 'react';
import { CalendarX2, MessageCircle, Phone, Search, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PageTab } from '../../types';
import { OFFICIAL_DATA } from '../../data/scholarshipData';

interface RegistrationAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTab: (tab: PageTab, prefillClass?: string) => void;
}

export const RegistrationAlertModal: React.FC<RegistrationAlertModalProps> = ({
  isOpen,
  onClose,
  onSelectTab,
}) => {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const handleClose = () => {
    if (dontShowAgain) {
      try {
        localStorage.setItem('AZM_DISMISS_REG_ALERT', new Date().toDateString());
      } catch {}
    }
    onClose();
  };

  const openTab = (tab: PageTab) => {
    handleClose();
    onSelectTab(tab);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 18 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 18 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-gradient-to-b from-[#0a192f] via-[#051124] to-[#030712] border border-amber-300/40 shadow-[0_0_50px_rgba(245,158,11,0.18)] text-white"
        >
          <div className="h-1.5 bg-gradient-to-r from-amber-500 via-amber-300 to-amber-500" />
          <button onClick={handleClose} className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-slate-300 hover:text-white hover:bg-white/20 transition" aria-label="Close notice">
            <X className="w-5 h-5" />
          </button>

          <div className="p-6 sm:p-8 text-center">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-300/10 border border-amber-300/30 flex items-center justify-center text-amber-300">
              <CalendarX2 className="w-8 h-8" />
            </div>
            <span className="inline-flex mt-5 px-3 py-1 rounded-full bg-amber-300 text-amber-950 text-[11px] font-black uppercase tracking-wider">
              Registration Closed
            </span>
            <h2 className="mt-4 text-2xl sm:text-3xl font-black font-display">Session V registration has closed</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              Online applications are no longer being accepted. If you still want to register, contact <strong className="text-white">Sumama Khan</strong> directly.
            </p>

            <div className="mt-6 rounded-2xl border border-blue-800/60 bg-blue-950/50 p-4 text-left space-y-2">
              <p className="font-bold text-white">Sumama Khan</p>
              <a href={`tel:${OFFICIAL_DATA.helpline}`} className="flex items-center gap-2 text-sm text-blue-100 hover:text-white">
                <Phone className="w-4 h-4 text-amber-300" /> {OFFICIAL_DATA.helpline}
              </a>
              <p className="text-xs text-slate-400">{OFFICIAL_DATA.helplineHours}</p>
            </div>

            <div className="mt-5 grid sm:grid-cols-2 gap-3">
              <a href="https://wa.me/923051755551?text=Assalam-o-Alaikum%20Sumama%20Khan%2C%20I%20would%20still%20like%20to%20register%20for%20Session%20V.%20Please%20guide%20me." target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-3 text-sm font-bold transition">
                <MessageCircle className="w-4 h-4" /> Contact on WhatsApp
              </a>
              <button onClick={() => openTab('roll-number')} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-3 text-sm font-bold transition">
                <Search className="w-4 h-4" /> Search Existing Slip
              </button>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={dontShowAgain} onChange={(event) => setDontShowAgain(event.target.checked)} className="rounded bg-slate-800 border-slate-700" />
                Don't show again today
              </label>
              <button onClick={handleClose} className="underline hover:text-white">Dismiss</button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
