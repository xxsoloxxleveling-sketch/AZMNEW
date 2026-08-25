import React from 'react';
import { PageTab } from '../../types';
import { Logo } from './Logo';
import { OFFICIAL_DATA } from '../../data/scholarshipData';
import { 
  MapPin, 
  Phone, 
  Mail, 
  Clock, 
  ShieldCheck, 
  MessageCircle,
  CheckCircle2
} from 'lucide-react';

interface FooterProps {
  onSelectTab: (tab: PageTab) => void;
  language?: 'en' | 'ur';
}

export const Footer: React.FC<FooterProps> = ({ onSelectTab, language = 'en' }) => {
  return (
    <footer className="mt-20 bg-gradient-to-b from-slate-900 to-[#071a2e] text-white border-t border-slate-800">
      {/* Top Banner with Trust Mandate */}
      <div className="border-b border-slate-800/80 bg-slate-950/60 py-6 px-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 flex-shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Public Trust & Funding Mandate</p>
              <p className="text-sm font-semibold text-slate-200">
                100% self-funded scholarships, standardized OMR tests, and direct educational grants across Khyber Pakhtunkhwa.
              </p>
            </div>
          </div>
        </div>
      </div>


      {/* Main Footer Body */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand Col */}
          <div className="space-y-4">
            <Logo size="md" variant="dark" />
            
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-950/80 text-sky-300 border border-blue-800/60 text-[11px] font-bold">
              <span>SECP Registered Corporate Entity: AZM.AIO (Pvt.) Ltd. • CUIN: 0321467</span>
            </div>


            <p className="text-xs text-slate-300 leading-relaxed">
              Conducting standardized optical merit examinations and distributing verified academic stipends, laptops, and fee subsidies to deserving students from Grade 6th to BS level.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4 border-l-2 border-[#70a9db] pl-2">
              Scholarship Portal
            </h4>
            <ul className="space-y-2.5 text-xs text-slate-300">
              <li>
                <button
                  onClick={() => onSelectTab('scholarship')}
                  className="hover:text-emerald-400 transition-colors flex items-center gap-1.5"
                >
                  <span className="text-[#70a9db]">›</span> Category A to F Rewards
                </button>
              </li>
              <li>
                <button
                  onClick={() => onSelectTab('apply')}
                  className="hover:text-emerald-400 transition-colors flex items-center gap-1.5"
                >
                  <span className="text-[#70a9db]">›</span> Online Student Registration
                </button>
              </li>
              <li>
                <button
                  onClick={() => onSelectTab('roll-number')}
                  className="hover:text-emerald-400 transition-colors flex items-center gap-1.5"
                >
                  <span className="text-[#70a9db]">›</span> Download Roll Number Slip
                </button>
              </li>
              <li>
                <button
                  onClick={() => onSelectTab('results')}
                  className="hover:text-emerald-400 transition-colors flex items-center gap-1.5"
                >
                  <span className="text-[#70a9db]">›</span> Results & Merit Ledger
                </button>
              </li>
              <li>
                <button
                  onClick={() => onSelectTab('gallery')}
                  className="hover:text-emerald-400 transition-colors flex items-center gap-1.5"
                >
                  <span className="text-[#70a9db]">›</span> Real Photo Archives (68 Photos)
                </button>
              </li>
              <li>
                <button
                  onClick={() => onSelectTab('about')}
                  className="hover:text-emerald-400 transition-colors flex items-center gap-1.5"
                >
                  <span className="text-[#70a9db]">›</span> 6-Member Interview Protocol
                </button>
              </li>
            </ul>
          </div>

          {/* Registration Hubs */}
          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4 border-l-2 border-emerald-400 pl-2">
              Mansehra Regional Hubs
            </h4>
            <ul className="space-y-3 text-xs text-slate-300">
              <li className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
                <strong className="text-white block font-medium">1. Jadoon Public High School & College</strong>
                <span className="text-slate-400 text-[11px] block">Gandhian, Karakoram Highway (Head Office)</span>
                <span className="text-emerald-400 text-[11px] font-mono font-semibold">0305-1755551</span>
              </li>
              <li className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
                <strong className="text-white block font-medium">2. Dubai International School & College</strong>
                <span className="text-slate-400 text-[11px] block">Kashmir Road • Pervez (Principal)</span>
                <a href="tel:+923005643177" className="text-emerald-400 hover:underline text-[11px] font-mono font-semibold">+92 300 5643177</a>
              </li>
              <li className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
                <strong className="text-white block font-medium">3. Khyber Public School & College</strong>
                <span className="text-slate-400 text-[11px] block">College Chowk • Asfandyar (Vice Principal)</span>
                <a href="tel:+923315014441" className="text-emerald-400 hover:underline text-[11px] font-mono font-semibold">+92 331 5014441</a>
              </li>

            </ul>
          </div>

          {/* Official Contact */}
          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4 border-l-2 border-amber-400 pl-2">
              Candidate Helpline & Office
            </h4>
            <div className="space-y-3 text-xs text-slate-300">
              <div className="flex items-start gap-2.5">
                <Phone className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[11px] text-slate-400">Direct Candidate Phone</p>
                  <a href="tel:03051755551" className="text-sm font-mono font-bold text-emerald-300 hover:underline">
                    0305-1755551
                  </a>
                  <p className="text-[10px] text-slate-400 mt-0.5">9:00 AM – 5:00 PM PST (Mon – Sat)</p>
                </div>
              </div>


              <div className="flex items-start gap-2.5">
                <Mail className="w-4 h-4 text-[#70a9db] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[11px] text-slate-400">Official Correspondence</p>
                  <a href={`mailto:${OFFICIAL_DATA.email}`} className="text-xs font-mono text-slate-200 hover:text-white">
                    {OFFICIAL_DATA.email}
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[11px] text-slate-400">Main Office Location</p>
                  <p className="text-xs text-slate-300 leading-snug">
                    Gandhian, Karakoram Highway, Mansehra, KP, Pakistan
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <p>© 2026 AZM.AIO (Pvt.) Ltd. — Session V Scholarships. All Rights Reserved.</p>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1 text-emerald-400 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              SECP Registered Company (CUIN Verified)
            </span>
            <button
              onClick={() => onSelectTab('contact')}
              className="hover:text-white transition-colors"
            >
              Submit Grievance / Inquiries
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};
