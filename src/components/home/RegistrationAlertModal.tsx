import React, { useEffect, useState } from 'react';
import { BellRing, Pin, Search, FileText, X, Loader2, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { PageTab } from '../../types';
import {
  fetchPublicPriorityNotice,
  priorityNoticeDismissKey,
  type PublicPriorityNotice,
} from '../../services/publicPriorityNotices';

interface RegistrationAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTab: (tab: PageTab, prefillClass?: string) => void;
}

/** React text nodes escape untrusted announcement content automatically. */
export const PriorityNoticeDisplay: React.FC<{ notice: PublicPriorityNotice }> = ({ notice }) => (
  <>
    <div className="mt-5 flex items-center justify-center gap-2 flex-wrap">
      <span className="inline-flex px-3 py-1 rounded-full bg-amber-300 text-amber-950 text-[11px] font-extrabold uppercase tracking-wider">
        {notice.badge}
      </span>
      {notice.isPinned && (
        <span className="inline-flex gap-1 items-center rounded-full px-2.5 py-1 border border-amber-300/30 bg-amber-300/10 text-amber-200 text-[11px] font-bold">
          <Pin size={12} /> Pinned
        </span>
      )}
    </div>
    <h2 id="official-priority-notice-title" className="mt-4 text-2xl sm:text-3xl font-extrabold leading-tight">
      {notice.title}
    </h2>
    {notice.subtitle && <p className="mt-3 text-sm font-medium text-sky-200">{notice.subtitle}</p>}
    <div className="mt-5 rounded-2xl border border-blue-800/60 bg-blue-950/50 p-5 text-left">
      <p className="text-sm leading-relaxed whitespace-pre-line text-slate-200">{notice.message}</p>
    </div>
  </>
);

/**
 * Legacy export name preserved for App's lazy loading.
 * The popup now reflects live pinned/urgent announcements from Settings.
 * A removed or unpublished notice never falls back to the old static notice.
 */
export const RegistrationAlertModal: React.FC<RegistrationAlertModalProps> = ({
  isOpen,
  onClose,
  onSelectTab,
}) => {
  const [notice, setNotice] = useState<PublicPriorityNotice | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();
    setState('loading');
    setDontShowAgain(false);
    setNotice(null);
    fetchPublicPriorityNotice(controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setNotice(result);
        setState('ready');
      })
      .catch(() => {
        if (!controller.signal.aborted) setState('error');
      });
    return () => controller.abort();
  }, [isOpen, retry]);

  const handleClose = () => {
    if (dontShowAgain && notice) {
      try {
        window.localStorage.setItem(priorityNoticeDismissKey(notice.id), new Date().toDateString());
      } catch {
        // Storage may be unavailable; manual dismissal must still work.
      }
    }
    onClose();
  };

  useEffect(() => {
    if (!isOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isOpen, onClose, dontShowAgain, notice]);

  const openTab = (tab: PageTab) => {
    handleClose();
    onSelectTab(tab);
  };

  const openNoticeboard = () => {
    handleClose();
    onSelectTab('home');
    // AlertsSection is lazy-loaded; wait briefly rather than losing the scroll
    // action if its bundle has not mounted yet.
    const scrollWhenReady = (remainingAttempts: number) => {
      const section = document.getElementById('azm-public-noticeboard');
      if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else if (remainingAttempts > 0) {
        window.setTimeout(() => scrollWhenReady(remainingAttempts - 1), 150);
      }
    };
    window.setTimeout(() => scrollWhenReady(12), 120);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div role="dialog" aria-modal="true" aria-labelledby="official-priority-notice-title"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 18 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 18 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-gradient-to-b from-[#0a192f] via-[#051124] to-[#030712] border border-amber-300/40 shadow-[0_0_50px_rgba(245,158,11,0.18)] text-white"
        >
          <div className="h-1.5 bg-gradient-to-r from-amber-500 via-amber-300 to-amber-500" />
          <button type="button" onClick={handleClose} className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-slate-300 hover:text-white hover:bg-white/20 transition"
            aria-label="Close official announcement">
            <X className="w-5 h-5" />
          </button>

          <div className="p-6 sm:p-8 text-center">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-300/10 border border-amber-300/30 flex items-center justify-center text-amber-300">
              <BellRing className="w-8 h-8" />
            </div>

            {state === 'loading' ? (
              <div role="status" className="mt-7 flex flex-col gap-3 items-center text-slate-300">
                <Loader2 size={24} className="animate-spin text-amber-300" />
                <h2 id="official-priority-notice-title" className="font-bold text-lg text-white">Loading official notices</h2>
              </div>
            ) : state === 'error' ? (
              <>
                <h2 id="official-priority-notice-title" className="mt-5 text-xl sm:text-2xl font-bold">
                  Notices temporarily unavailable
                </h2>
                <p role="alert" className="mt-3 text-sm text-slate-300">
                  We couldn’t load the latest announcements. Please try again.
                </p>
                <button type="button" onClick={() => setRetry(value => value + 1)}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl border border-amber-300/30 bg-amber-300/10 px-4 py-2.5 text-sm font-semibold text-amber-100 hover:bg-amber-300/20">
                  <RefreshCw size={16} /> Retry
                </button>
              </>
            ) : notice ? (
              <PriorityNoticeDisplay notice={notice} />
            ) : (
              <>
                <h2 id="official-priority-notice-title" className="mt-5 text-xl sm:text-2xl font-bold">
                  No featured announcements right now
                </h2>
                <p className="mt-3 text-sm text-slate-300">
                  There are no currently published priority notices. Check the public noticeboard for updates.
                </p>
              </>
            )}

            {state !== 'loading' && (
              <div className="mt-6 grid sm:grid-cols-2 gap-3">
                <button type="button" onClick={openNoticeboard}
                  className="inline-flex justify-center items-center gap-2 rounded-xl bg-[#185b9d] hover:bg-[#13497e] px-4 py-3 text-sm font-bold transition">
                  <FileText className="w-4 h-4" /> View Public Notices
                </button>
                <button type="button" onClick={() => openTab('roll-number')}
                  className="inline-flex justify-center items-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-3 text-sm font-bold transition">
                  <Search className="w-4 h-4" /> Search Existing Slip
                </button>
              </div>
            )}

            <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between gap-3 text-[11px] text-slate-400">
              {state === 'ready' && notice ? (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={dontShowAgain} onChange={event => setDontShowAgain(event.target.checked)}
                    className="rounded bg-slate-800 border-slate-700" />
                  Don’t show again today
                </label>
              ) : <span />}
              <button type="button" onClick={handleClose} className="underline hover:text-white">Dismiss</button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
