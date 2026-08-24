import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  CheckCircle2,
  Save,
  Lock,
  Globe,
  Zap,
} from 'lucide-react';
import {
  RollNumberReleaseConfig,
  getRollNumberReleaseConfig,
  saveRollNumberReleaseConfig,
  isRollNumberReleased,
} from '../../../lib/mockApi';

export const RollNumberScheduleTab: React.FC = () => {
  const [config, setConfig] = useState<RollNumberReleaseConfig>(getRollNumberReleaseConfig());
  const [isSaved, setIsSaved] = useState(false);
  const [isLiveNow, setIsLiveNow] = useState(isRollNumberReleased());

  useEffect(() => {
    const current = getRollNumberReleaseConfig();
    setConfig(current);
    setIsLiveNow(isRollNumberReleased());
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = saveRollNumberReleaseConfig(config);
    setConfig(updated);
    setIsLiveNow(isRollNumberReleased());
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handlePublishImmediately = () => {
    if (
      confirm(
        'Are you sure you want to PUBLISH all Roll Number Slips immediately to the public? Candidates will be able to search and print their slips right now.'
      )
    ) {
      const updated = saveRollNumberReleaseConfig({
        isScheduled: false,
      });
      setConfig(updated);
      setIsLiveNow(true);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    }
  };

  const handleScheduleForDate = () => {
    const updated = saveRollNumberReleaseConfig({
      isScheduled: true,
    });
    setConfig(updated);
    setIsLiveNow(isRollNumberReleased());
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
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
                <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-[#185b9d]" />
                  <span>Official Release Date &amp; Time (PST)</span>
                </label>
                <input
                  type="datetime-local"
                  value={config.releaseDateTime}
                  onChange={(e) => setConfig((prev) => ({ ...prev, releaseDateTime: e.target.value }))}
                  required
                  className="w-full sm:w-80 px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-[#185b9d] outline-none"
                />
                <p className="text-[11px] text-slate-500">
                  Select the exact date and hour when the testing organization releases the roll numbers.
                </p>
              </div>
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

            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
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
                  : `Slips will automatically become available on ${new Date(
                      config.releaseDateTime
                    ).toLocaleDateString()} at ${new Date(config.releaseDateTime).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}.`}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/60 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Release Mode:</span>
                <span className="font-bold text-white">
                  {config.isScheduled ? 'Scheduled Date' : 'Immediate'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Target Time:</span>
                <span className="font-bold text-blue-300 font-mono">
                  {new Date(config.releaseDateTime).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
