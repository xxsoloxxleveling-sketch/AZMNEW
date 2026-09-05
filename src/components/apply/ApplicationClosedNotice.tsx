import React from 'react';
import {
  ArrowLeft,
  CalendarX2,
  Clock3,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Search,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { OFFICIAL_DATA } from '../../data/scholarshipData';
import { PageTab } from '../../types';

interface ApplicationClosedNoticeProps {
  onSelectTab: (tab: PageTab) => void;
}

export const ApplicationClosedNotice: React.FC<ApplicationClosedNoticeProps> = ({ onSelectTab }) => {
  const whatsappNumber = OFFICIAL_DATA.helpline.replace(/\D/g, '').replace(/^0/, '92');
  const whatsappMessage = encodeURIComponent(
    'Assalam-o-Alaikum Khaqan Afridi, Session V online registration is closed, but I would still like to register. Please guide me through the registration process.'
  );

  return (
    <section className="bg-slate-50 px-4 sm:px-6 py-10 sm:py-16">
      <div className="max-w-4xl mx-auto overflow-hidden rounded-3xl bg-white border border-slate-200 shadow-xl shadow-slate-200/60">
        <div className="relative overflow-hidden bg-gradient-to-br from-[#071426] via-[#0f3f70] to-[#185b9d] px-6 sm:px-12 py-10 sm:py-12 text-center text-white">
          <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-sky-400/10 blur-2xl" />
          <div className="relative">
            <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center">
              <CalendarX2 className="w-8 h-8 text-amber-300" />
            </div>
            <span className="inline-flex px-3 py-1 mb-4 rounded-full bg-amber-300 text-amber-950 text-[11px] font-black uppercase tracking-wider">
              Registration Closed
            </span>
            <h1 className="text-3xl sm:text-4xl font-black font-display tracking-tight">
              Session V online registration has closed
            </h1>
            <p className="mt-3 max-w-2xl mx-auto text-sm sm:text-base leading-relaxed text-blue-100">
              The online application form is no longer accepting submissions. If you still want to register, contact Khaqan Afridi directly for assistance.
            </p>
          </div>
        </div>

        <div className="p-6 sm:p-10 space-y-7">
          <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-5 sm:p-6">
            <div className="flex items-start gap-4">
              <span className="w-12 h-12 shrink-0 rounded-xl bg-[#185b9d] text-white flex items-center justify-center shadow-sm">
                <UserRound className="w-6 h-6" />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-[#185b9d]">Registration Assistance</p>
                <h2 className="mt-1 text-xl font-black text-slate-900">Khaqan Afridi</h2>
                <p className="text-sm text-slate-600">Personal Assistant to Deputy Director and Public Relations Head, AZM</p>
              </div>
            </div>

            <div className="mt-6 grid sm:grid-cols-2 gap-3">
              <a href={`tel:${OFFICIAL_DATA.helpline}`} className="flex items-center gap-3 rounded-xl bg-white border border-slate-200 px-4 py-3 text-sm font-bold text-slate-800 hover:border-blue-300 hover:text-[#185b9d] transition">
                <Phone className="w-4 h-4 text-[#185b9d]" />
                {OFFICIAL_DATA.helpline}
              </a>
              <a href={`mailto:${OFFICIAL_DATA.email}`} className="flex items-center gap-3 rounded-xl bg-white border border-slate-200 px-4 py-3 text-sm font-bold text-slate-800 hover:border-blue-300 hover:text-[#185b9d] transition">
                <Mail className="w-4 h-4 text-[#185b9d]" />
                {OFFICIAL_DATA.email}
              </a>
              <div className="sm:col-span-2 flex items-start gap-3 rounded-xl bg-white border border-slate-200 px-4 py-3 text-sm text-slate-700">
                <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-[#185b9d]" />
                {OFFICIAL_DATA.headOffice}
              </div>
              <div className="sm:col-span-2 flex items-center gap-3 px-1 pt-1 text-xs text-slate-500">
                <Clock3 className="w-4 h-4 text-[#185b9d]" />
                Contact hours: {OFFICIAL_DATA.helplineHours}
              </div>
            </div>
          </div>

          <a href={`https://wa.me/${whatsappNumber}?text=${whatsappMessage}`} target="_blank" rel="noreferrer" className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-5 py-4 text-sm font-black text-white shadow-lg shadow-emerald-600/20 transition">
            <MessageCircle className="w-5 h-5" />
            Contact Khaqan Afridi on WhatsApp
          </a>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
            <Clock3 className="w-5 h-5 mt-0.5 shrink-0 text-amber-600" />
            <p className="text-xs sm:text-sm leading-relaxed text-slate-800">
              Candidates whose fees are still due must pay before 5:00 PM. If payment is not completed by then, the registration may be cancelled.
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 mt-0.5 shrink-0 text-emerald-600" />
            <p className="text-xs sm:text-sm leading-relaxed text-slate-700">
              Already registered? Your submitted application remains safely recorded and you can continue checking your roll number slip.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button type="button" onClick={() => onSelectTab('roll-number')} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[#185b9d] hover:bg-[#13497d] px-5 py-3 text-sm font-bold text-white transition">
              <Search className="w-4 h-4" />
              Search Roll Number Slip
            </button>
            <button type="button" onClick={() => onSelectTab('home')} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-100 hover:bg-slate-200 px-5 py-3 text-sm font-bold text-slate-700 transition">
              <ArrowLeft className="w-4 h-4" />
              Return to Homepage
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
