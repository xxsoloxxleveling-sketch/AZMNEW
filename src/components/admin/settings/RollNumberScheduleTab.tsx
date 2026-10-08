import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  CheckCircle2,
  Save,
  Lock,
  Globe,
  Zap,
  Loader2,
} from 'lucide-react';
import {
  mockApi,
  RollNumberReleaseConfig,
  getRollNumberReleaseConfig,
  saveRollNumberReleaseConfig,
  fetchRollNumberReleaseConfig,
  isRollNumberReleased,
  isReleaseConfigReleased,
  releaseDateTimeToPakistanInput,
  formatReleaseDateTime,
} from '../../../lib/mockApi';

export const RollNumberScheduleTab: React.FC = () => {
  const [config, setConfig] = useState<RollNumberReleaseConfig>(getRollNumberReleaseConfig());
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLiveNow, setIsLiveNow] = useState(isRollNumberReleased());

  useEffect(() => {
    let isMounted = true;
    (async () => {
      const current = await fetchRollNumberReleaseConfig();
      if (isMounted) {
        setConfig(current);
        setIsLiveNow(isReleaseConfigReleased(current));
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const updated = await saveRollNumberReleaseConfig(config);
      setConfig(updated);
      setIsLiveNow(isReleaseConfigReleased(updated));
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch (err: any) {
      alert(err?.message || 'Failed to save schedule configuration.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublishImmediately = async () => {
    if (
      confirm(
        'Are you sure you want to PUBLISH all Roll Number Slips immediately to the public? Candidates will be able to search and print their slips right now.'
      )
    ) {
      setIsSaving(true);
      try {
        const updated = await saveRollNumberReleaseConfig({
          ...config,
          isScheduled: false,
        });
        setConfig(updated);
        setIsLiveNow(true);
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 3000);
      } catch (err: any) {
        alert(err?.message || 'Failed to publish immediately.');
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleScheduleForDate = async () => {
    setIsSaving(true);
    try {
      const updated = await saveRollNumberReleaseConfig({
        ...config,
        isScheduled: true,
      });
      setConfig(updated);
      setIsLiveNow(isReleaseConfigReleased(updated));
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch (err: any) {
      alert(err?.message || 'Failed to set scheduled date.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-100 text-[#185b9d]">
              Super Admin Examination Control
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold flex items-center gap-1 ${
                isLiveNow
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isLiveNow ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              {isLiveNow ? 'Roll Number Slips LIVE' : 'Slips Scheduled & Locked'}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900">
            Roll Number Slips Official Release Schedule
          </h2>
          <p className="text-xs text-slate-500 max-w-2xl">
            Control the exact date and time when candidate Roll Number Slips, assigned test centres, and hall seating plans become publicly searchable and downloadable.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isLiveNow ? (
            <button
              onClick={handleScheduleForDate}
              type="button"
              className="px-4 py-2.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <Lock className="w-4 h-4 text-amber-700" />
              <span>Lock Slips to Scheduled Date</span>
            </button>
          ) : (
            <button
              onClick={handlePublishImmediately}
              type="button"
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-md shadow-emerald-600/20"
            >
              <Zap className="w-4 h-4" />
              <span>Publish All Slips Live Now</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Configuration Form */}
      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Schedule Settings */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-xs space-y-6">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#185b9d]" />
              <span>Release Mode &amp; Target Date</span>
            </h3>

            {/* Mode Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label
                className={`p-4 rounded-2xl border-2 cursor-pointer transition flex items-start gap-3 ${
                  config.isScheduled
                    ? 'border-blue-500 bg-blue-50/50'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="releaseMode"
                  checked={config.isScheduled}
                  onChange={() => setConfig((prev) => ({ ...prev, isScheduled: true }))}
                  className="mt-1 text-[#185b9d]"
                />
                <div>
                  <span className="font-bold text-xs text-slate-900 block">
                    Scheduled Official Release Date
                  </span>
                  <span className="text-[11px] text-slate-500 leading-relaxed block mt-0.5">
                    Slips will remain locked until the configured date and time. Searching candidates will see verified confirmation with release countdown.
                  </span>
                </div>
              </label>

              <label
                className={`p-4 rounded-2xl border-2 cursor-pointer transition flex items-start gap-3 ${
                  !config.isScheduled
                    ? 'border-emerald-500 bg-emerald-50/50'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="releaseMode"
                  checked={!config.isScheduled}
                  onChange={() => setConfig((prev) => ({ ...prev, isScheduled: false }))}
                  className="mt-1 text-emerald-600"
                />
                <div>
                  <span className="font-bold text-xs text-slate-900 block">
                    Immediate Release Mode
                  </span>
                  <span className="text-[11px] text-slate-500 leading-relaxed block mt-0.5">
                    Roll number slips and test centers are instantly visible as soon as the candidate registration payment (PKR 300) is verified.
                  </span>
                </div>
              </label>
            </div>

            {/* Date & Time Picker */}
            {config.isScheduled && (
              <div className="space-y-2 p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
                <label htmlFor="release-date-time" className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-[#185b9d]" />
                  <span>Official Release Date &amp; Time (Pakistan Time — PKT)</span>
                </label>
                <input
                  id="release-date-time"
                  type="datetime-local"
                  value={releaseDateTimeToPakistanInput(config.releaseDateTime)}
                  onChange={(e) => setConfig((prev) => ({ ...prev, releaseDateTime: e.target.value }))}
                  required
                  className="w-full sm:w-80 px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-[#185b9d] outline-none"
                />
                <p className="text-[11px] text-slate-500">
                  Times are saved and released according to Asia/Karachi (UTC+05:00).
                </p>
              </div>
            )}

            {config.isScheduled && /\b(immediate|live|active)\b/i.test(`${config.announcementTitle} ${config.announcementMessage}`) && (
              <p role="alert" className="text-xs text-amber-900 bg-amber-50 border border-amber-200 p-3 rounded-lg">
                Scheduled release is enabled, but the announcement describes an immediate or live release. Review the announcement before saving; its text has not been changed automatically.
              </p>
            )}

            {/* Candidate Public Notice */}
            <div className="space-y-4 pt-2 border-t border-slate-100">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Announcement Heading for Candidates
                </label>
                <input
                  type="text"
                  value={config.announcementTitle}
                  onChange={(e) => setConfig((prev) => ({ ...prev, announcementTitle: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-[#185b9d] outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Notice Message (Displayed on Roll Number Slip Search Page)
                </label>
                <textarea
                  rows={3}
                  value={config.announcementMessage}
                  onChange={(e) => setConfig((prev) => ({ ...prev, announcementMessage: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-xs text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-[#185b9d] outline-none resize-none"
                />
              </div>
            </div>

            <p className="text-xs text-slate-600 pt-4 border-t border-slate-100">
              Candidate examination Center, Hall, room, seat, exam date and reporting time are managed from Examination Centers &amp; Halls. They are not controlled by the Roll Number Release Schedule.
            </p>

            <div className="flex flex-wrap gap-3 items-center justify-between pt-4 border-t border-slate-100">
              {isSaved ? (
                <span className="text-xs font-bold text-emerald-600 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Settings saved and applied live!</span>
                </span>
              ) : (
                <span className="text-[11px] text-slate-400">
                  Last updated: {new Date(config.updatedAt).toLocaleString()}
                </span>
              )}

              <button
                type="submit"
                className="px-5 py-2.5 bg-[#185b9d] hover:bg-[#13497d] text-white rounded-xl text-xs font-bold shadow-md transition flex items-center gap-2 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Save Schedule Configuration</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Live Status Card */}
        <div className="space-y-6">
          <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-md space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">
                Live Status
              </span>
              <Globe className="w-4 h-4 text-blue-400" />
            </div>

            <div className="space-y-1">
              <h4 className="text-lg font-black">
                {isLiveNow ? '🟢 Active & Searchable' : '⏳ Scheduled Release'}
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                {isLiveNow
                  ? 'All verified candidates can currently search and print their Roll Number Slips.'
                  : `Slips will automatically become available on ${formatReleaseDateTime(config.releaseDateTime)}.`}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/60 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Release Mode:</span>
                <span className="font-bold text-white">
                  {config.isScheduled ? 'Scheduled Date' : 'Immediate'}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-slate-400">Target Time:</span>
                <span className="font-bold text-blue-300 font-mono">
                  {formatReleaseDateTime(config.releaseDateTime)}
                </span>
              </div>
            </div>

            <button
              type="button"
              disabled={isGenerating || isSaving}
              onClick={async () => {
                if (confirm('Assign and generate official Roll Numbers (AZMVS-2026-XXXX) for ALL registered candidates who have completed PKR 300 fee payment?')) {
                  setIsGenerating(true);
                  try {
                    const res = await mockApi.issueRollNumbers(config.releaseDateTime);
                    alert(res.message || `Successfully assigned and activated Roll Numbers for ${res.count} candidate(s).`);
                    setIsLiveNow(isRollNumberReleased());
                  } catch (err: any) {
                    alert(err?.message || 'Failed to issue roll numbers.');
                  } finally {
                    setIsGenerating(false);
                  }
                }
              }}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              <span>{isGenerating ? 'Generating Roll Numbers...' : 'Generate Roll Numbers for Paid Students'}</span>
            </button>
          </div>
        </div>

      </form>
    </div>
  );
};
