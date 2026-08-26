import React, { useState } from 'react';
import { 
  MessageCircle, 
  Users, 
  BellRing, 
  FileText, 
  CheckCircle2, 
  ExternalLink, 
  Copy, 
  Check, 
  Sparkles, 
  ShieldCheck, 
  ArrowRight
} from 'lucide-react';

const WHATSAPP_GROUP_URL = 'https://chat.whatsapp.com/DEDabWqTVVOIhNd0oqOCqO?s=cl&p=i&mlu=4';

export const WhatsAppCommunitySection: React.FC = () => {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(WHATSAPP_GROUP_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      console.warn('Clipboard write failed');
    }
  };

  return (
    <section className="py-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-slate-900 via-emerald-950 to-slate-900 text-white border border-emerald-500/30 shadow-2xl p-6 sm:p-10 lg:p-12">
        {/* Glow & Radial Background Decorative Accents */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full bg-emerald-500/15 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 rounded-full bg-teal-500/15 blur-3xl pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left Column: Heading, Info, and Feature Badges */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold tracking-wide">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <span>Official Candidate Community</span>
              <span className="text-emerald-400/60">•</span>
              <span className="text-emerald-200">2,400+ Members</span>
            </div>

            <div className="space-y-3">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white leading-tight">
                Join Our Official WhatsApp Group for{' '}
                <span className="bg-linear-to-r from-emerald-400 via-teal-300 to-emerald-200 bg-clip-text text-transparent">
                  Future Updates
                </span>
              </h2>
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl">
                Stay instantly informed with official announcements, exam roll number slip releases, test center schedules, syllabus guides, and scholarship merit list declarations directly on WhatsApp.
              </p>
            </div>

            {/* Benefit Bullets */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {[
                { icon: BellRing, text: 'Instant Exam & Roll No Alerts' },
                { icon: FileText, text: 'Session V Syllabus & Sample Papers' },
                { icon: Sparkles, text: 'Merit Lists & Result Updates' },
                { icon: ShieldCheck, text: 'Official Support & Guidance' }
              ].map((item, idx) => (
                <div 
                  key={idx}
                  className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-slate-200 backdrop-blur-xs"
                >
                  <item.icon className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{item.text}</span>
                </div>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
              <a
                href={WHATSAPP_GROUP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-2xl bg-[#25D366] hover:bg-[#20bd5a] text-slate-950 font-black text-sm transition-all duration-300 shadow-[0_0_25px_rgba(37,211,102,0.4)] hover:shadow-[0_0_35px_rgba(37,211,102,0.6)] transform hover:-translate-y-0.5 active:translate-y-0 text-center cursor-pointer group"
              >
                <MessageCircle className="w-5 h-5 fill-slate-950 text-slate-950 group-hover:rotate-12 transition-transform" />
                <span>Join Official WhatsApp Group</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </a>

              <button
                type="button"
                onClick={handleCopyLink}
                className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs border border-white/20 transition backdrop-blur-xs cursor-pointer active:scale-95"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-300">Link Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-slate-300" />
                    <span>Copy Group Link</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Column: Visual Group Card Preview */}
          <div className="lg:col-span-5">
            <div className="relative mx-auto max-w-md bg-slate-950/80 rounded-2xl border border-emerald-500/30 p-5 shadow-2xl backdrop-blur-md space-y-4">
              {/* WhatsApp Mock Header */}
              <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
                <div className="relative w-12 h-12 rounded-full bg-linear-to-br from-emerald-500 to-teal-700 flex items-center justify-center shadow-md shrink-0">
                  <MessageCircle className="w-6 h-6 text-white fill-white" />
                  <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-slate-950" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-bold text-sm text-white truncate">AZM.AIO Session V Official</h3>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  </div>
                  <p className="text-[11px] text-emerald-300/80 font-mono truncate">
                    WhatsApp Group • Active Updates
                  </p>
                </div>
              </div>

              {/* Chat Bubble Simulation */}
              <div className="space-y-2.5 py-1 text-xs">
                <div className="p-3 rounded-2xl rounded-tl-xs bg-slate-800/90 text-slate-200 border border-slate-700/60 space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-emerald-400 font-bold">
                    <span>Admin • AZM Scholarship Desk</span>
                    <span className="text-slate-400 font-normal">Just now</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-100">
                    📢 <strong>Session V Registrations Live:</strong> Over 500 scholarship seats across KP & Hazara. Apply online & download your roll number slip!
                  </p>
                </div>

                <div className="p-3 rounded-2xl rounded-tl-xs bg-emerald-950/40 text-emerald-100 border border-emerald-500/20 space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-teal-300 font-bold">
                    <span>Updates Desk</span>
                    <span className="text-slate-400 font-normal">10:00 AM</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-emerald-200">
                    📄 Official Question Banks & Past Examination Papers will be distributed directly to this group.
                  </p>
                </div>
              </div>

              {/* Card Footer CTA */}
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-emerald-400" />
                  Free & Open to All Candidates
                </span>
                <a
                  href={WHATSAPP_GROUP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition"
                >
                  <span>Click to Join</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
