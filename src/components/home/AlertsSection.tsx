import React, { useState, useEffect } from 'react';
import { AlertItem, AlertType, PageTab } from '../../types';
import { fetchLiveAlerts } from '../../services/api';
import { 
  BellRing, 
  AlertTriangle, 
  Sparkles, 
  ArrowRight, 
  Calendar, 
  BookOpen, 
  ShieldCheck, 
  FileText, 
  Clock,
  ChevronRight,
  Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AlertsSectionProps {
  onSelectTab: (tab: PageTab, prefillClass?: string) => void;
  onOpenAlertModal?: () => void;
}

export const AlertsSection: React.FC<AlertsSectionProps> = ({ onSelectTab, onOpenAlertModal }) => {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [activeFilter, setActiveFilter] = useState<'all' | AlertType>('all');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetchLiveAlerts().then((res) => {
      if (res.data) {
        setAlerts(res.data);
      }
      setLoading(false);
    });
  }, []);

  const filteredAlerts = alerts.filter(
    (a) => activeFilter === 'all' || a.type === activeFilter
  );

  const getAlertIcon = (type: AlertType) => {
    switch (type) {
      case 'urgent':
      case 'registration':
        return <BellRing className="w-4 h-4 text-amber-500 animate-pulse" />;
      case 'exam':
        return <BookOpen className="w-4 h-4 text-[#185b9d]" />;
      case 'info':
      default:
        return <ShieldCheck className="w-4 h-4 text-emerald-600" />;
    }
  };

  const getBadgeStyle = (type: AlertType) => {
    switch (type) {
      case 'urgent':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'registration':
        return 'bg-amber-100 text-amber-900 border-amber-300 font-bold';
      case 'exam':
        return 'bg-blue-100 text-blue-800 border-blue-200 font-semibold';
      case 'info':
      default:
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    }
  };

  return (
    <section className="py-14 bg-gradient-to-b from-white via-slate-50 to-slate-100/70 border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 mb-2">
              <BellRing className="w-3.5 h-3.5 text-amber-600 animate-bounce" />
              <span>Official Notices & Live Alerts</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-display font-extrabold text-slate-900 tracking-tight">
              Admissions & Testing Noticeboard
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl">
              Stay updated with real-time official bulletins regarding Session V registration schedules, syllabus publications, and regional examination center assignments.
            </p>
          </div>

          {/* Quick Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 self-start md:self-auto">
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                activeFilter === 'all'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border-slate-200'
              }`}
            >
              All Notices ({alerts.length})
            </button>
            <button
              onClick={() => setActiveFilter('registration')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                activeFilter === 'registration'
                  ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border-slate-200'
              }`}
            >
              Registration
            </button>
            <button
              onClick={() => setActiveFilter('exam')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                activeFilter === 'exam'
                  ? 'bg-[#185b9d] text-white border-[#185b9d] shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border-slate-200'
              }`}
            >
              Exams & Syllabus
            </button>
            <button
              onClick={() => setActiveFilter('info')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                activeFilter === 'info'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border-slate-200'
              }`}
            >
              General Hubs
            </button>
          </div>
        </div>

        {/* Alerts Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {filteredAlerts.map((alert) => (
            <motion.div
              key={alert.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-5 sm:p-6 rounded-3xl border transition-all flex flex-col justify-between relative overflow-hidden ${
                alert.isPinned
                  ? 'bg-gradient-to-br from-amber-50/70 via-white to-blue-50/30 border-amber-300 shadow-md ring-1 ring-amber-300/40'
                  : 'bg-white border-slate-200/90 shadow-2xs hover:shadow-md hover:border-slate-300'
              }`}
            >
              {/* Pinned Accent Glow Indicator */}
              {alert.isPinned && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 to-[#185b9d]" />
              )}

              <div className="space-y-3">
                {/* Top Badge & Date Row */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${getBadgeStyle(alert.type)}`}>
                      {alert.badge}
                    </span>
                    {alert.isPinned && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-900 text-amber-300">
                        ★ Highlight
                      </span>
                    )}
                  </div>

                  <span className="text-[11px] font-mono text-slate-500 font-medium flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    {alert.date}
                  </span>
                </div>

                {/* Alert Title & Subtitle */}
                <div>
                  <h3 className="text-base font-bold font-display text-slate-900 leading-snug flex items-center gap-2">
                    {getAlertIcon(alert.type)}
                    <span>{alert.title}</span>
                  </h3>
                  {alert.subtitle && (
                    <p className="text-xs font-semibold text-[#185b9d] mt-0.5">
                      {alert.subtitle}
                    </p>
                  )}
                </div>

                {/* Alert Body Text */}
                <p className="text-xs text-slate-600 leading-relaxed">
                  {alert.message}
                </p>
              </div>

              {/* Action Button Strip */}
              {alert.actionText && (
                <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between">
                  <button
                    onClick={() => {
                      if (alert.actionTab) {
                        onSelectTab(alert.actionTab);
                      } else if (onOpenAlertModal) {
                        onOpenAlertModal();
                      }
                    }}
                    className={`inline-flex items-center gap-1.5 text-xs font-bold transition-all ${
                      alert.isPinned
                        ? 'px-4 py-2 rounded-xl bg-[#185b9d] hover:bg-[#13497e] text-white shadow-xs'
                        : 'text-[#185b9d] hover:text-slate-900 hover:translate-x-0.5'
                    }`}
                  >
                    <span>{alert.actionText}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>

                  <span className="text-[10px] text-slate-400 font-mono">
                    AZM.AIO Central Testing
                  </span>
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* Fast Action Banner at Bottom of Section */}
        <div className="mt-8 p-4 sm:p-5 rounded-2xl bg-slate-900 text-white flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm border border-slate-800">
          <div className="flex items-center gap-3 text-center sm:text-left">
            <div className="w-10 h-10 rounded-xl bg-[#185b9d]/30 border border-[#38bdf8]/30 flex items-center justify-center text-[#38bdf8] flex-shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs sm:text-sm font-bold">Have queries regarding registration or exam dates?</div>
              <div className="text-[11px] text-slate-400">Direct candidate helpline: 0344-0197194 (9 AM to 5 PM PST)</div>
            </div>
          </div>

          <button
            onClick={() => onSelectTab('contact')}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition-colors whitespace-nowrap"
          >
            Contact Grievance Desk
          </button>
        </div>

      </div>
    </section>
  );
};
