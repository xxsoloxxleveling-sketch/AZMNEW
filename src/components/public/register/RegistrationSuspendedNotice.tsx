import React from 'react';
import { ArrowLeft, Clock3, Mail, MapPin, MessageCircle, Phone, School, UserRound } from 'lucide-react';
import { OFFICIAL_DATA } from '../../../data/scholarshipData';

interface RegistrationSuspendedNoticeProps {
  onNavigateHome: () => void;
  onNavigateLogin: () => void;
}

export const RegistrationSuspendedNotice: React.FC<RegistrationSuspendedNoticeProps> = ({
  onNavigateHome,
  onNavigateLogin,
}) => {
  const whatsappNumber = OFFICIAL_DATA.helpline.replace(/\D/g, '').replace(/^0/, '92');
  const whatsappMessage = encodeURIComponent(
    'Assalam-o-Alaikum Sumama Khan, I would like to register for the AZM.AIO Scholarship Examination. Please guide me through the registration process.'
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="h-16 bg-white border-b border-slate-200/80 px-4 sm:px-8 flex items-center justify-between">
        <button type="button" className="flex items-center gap-3 text-left" onClick={onNavigateHome}>
          <span className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#185b9d] to-[#2563eb] flex items-center justify-center text-white shadow-sm">
            <School className="w-5 h-5" />
          </span>
          <span>
            <span className="block text-sm font-extrabold text-slate-900">AZM.AIO Portal</span>
            <span className="block text-[10px] text-slate-400 font-medium">Candidate Registration</span>
          </span>
        </button>

        <button
          type="button"
          onClick={onNavigateLogin}
          className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-[#185b9d] hover:bg-slate-50 rounded-lg transition"
        >
          Admin Sign-in
        </button>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        <section className="overflow-hidden rounded-3xl bg-white border border-slate-200 shadow-xl shadow-slate-200/50">
          <div className="bg-gradient-to-br from-[#0f3f70] via-[#185b9d] to-[#2563eb] px-6 sm:px-10 py-10 text-center text-white">
            <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center backdrop-blur-sm">
              <Clock3 className="w-8 h-8" />
            </div>
            <span className="inline-flex px-3 py-1 mb-4 rounded-full bg-amber-300 text-amber-950 text-[11px] font-extrabold uppercase tracking-wider">
              Registration Suspended
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold">Online registration is currently unavailable</h1>
            <p className="mt-3 text-sm sm:text-base text-blue-100 max-w-xl mx-auto leading-relaxed">
              If you want to register for the AZM.AIO Scholarship Examination, please contact Sumama Khan directly for assistance.
            </p>
          </div>

          <div className="p-6 sm:p-10">
            <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-5 sm:p-6">
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 shrink-0 rounded-xl bg-[#185b9d] text-white flex items-center justify-center">
                  <UserRound className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-[#185b9d]">Registration Contact</p>
                  <h2 className="mt-1 text-xl font-extrabold text-slate-900">Sumama Khan</h2>
                  <p className="text-sm text-slate-600">Founder &amp; Director General, AZM Group of Companies (Pvt.) Ltd.</p>
                </div>
              </div>

              <div className="mt-6 grid gap-3">
                <a
                  href={`tel:${OFFICIAL_DATA.helpline}`}
                  className="flex items-center gap-3 rounded-xl bg-white border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800 hover:border-blue-300 hover:text-[#185b9d] transition"
                >
                  <Phone className="w-4 h-4 text-[#185b9d]" />
                  <span>{OFFICIAL_DATA.helpline}</span>
                </a>
                <a
                  href={`mailto:${OFFICIAL_DATA.email}`}
                  className="flex items-center gap-3 rounded-xl bg-white border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800 hover:border-blue-300 hover:text-[#185b9d] transition"
                >
                  <Mail className="w-4 h-4 text-[#185b9d]" />
                  <span>{OFFICIAL_DATA.email}</span>
                </a>
                <div className="flex items-start gap-3 rounded-xl bg-white border border-slate-200 px-4 py-3 text-sm text-slate-700">
                  <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-[#185b9d]" />
                  <span>{OFFICIAL_DATA.headOffice}</span>
                </div>
                <div className="flex items-center gap-3 px-1 pt-1 text-xs text-slate-500">
                  <Clock3 className="w-4 h-4 text-[#185b9d]" />
                  <span>Contact hours: {OFFICIAL_DATA.helplineHours}</span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <a
                href={`https://wa.me/${whatsappNumber}?text=${whatsappMessage}`}
                target="_blank"
                rel="noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 transition"
              >
                <MessageCircle className="w-5 h-5" />
                Contact on WhatsApp
              </a>
              <button
                type="button"
                onClick={onNavigateHome}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-100 hover:bg-slate-200 px-5 py-3.5 text-sm font-bold text-slate-700 transition"
              >
                <ArrowLeft className="w-4 h-4" />
                Return to Homepage
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};
