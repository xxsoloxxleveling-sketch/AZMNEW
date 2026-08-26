import React, { useState } from 'react';
import { REGISTRATION_HUBS, OFFICIAL_DATA } from '../../data/scholarshipData';
import { submitGrievanceTicket } from '../../services/api';
import { PageTab } from '../../types';
import { 
  Phone, 
  Mail, 
  MapPin, 
  Send, 
  CheckCircle2, 
  HelpCircle, 
  Clock, 
  ShieldCheck, 
  Building2,
  FileQuestion,
  MessageSquare
} from 'lucide-react';

interface ContactViewProps {
  onSelectTab: (tab: PageTab) => void;
}

export const ContactView: React.FC<ContactViewProps> = ({ onSelectTab }) => {
  const [ticketSubmitted, setTicketSubmitted] = useState(false);
  const [ticketId, setTicketId] = useState('');
  const [formData, setFormData] = useState<{
    fullName: string;
    phone: string;
    email: string;
    category: 'Roll Number Slip' | 'Registration Correction' | 'Result Inquiry' | 'Payment/Fee' | 'General Query';
    rollOrAppNo: string;
    message: string;
  }>({
    fullName: '',
    phone: '',
    email: '',
    category: 'Roll Number Slip',
    rollOrAppNo: '',
    message: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await submitGrievanceTicket({
      name: formData.fullName,
      email: formData.email,
      phone: formData.phone,
      category: formData.category,
      cnicOrRollNo: formData.rollOrAppNo,
      subject: `Inquiry regarding ${formData.category}`,
      message: formData.message
    });

    const newTicket = res.data?.ticketId || `TKT-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    setTicketId(newTicket);
    setTicketSubmitted(true);
    try {
      const confettiModule = await import('canvas-confetti');
      const confetti = confettiModule.default || confettiModule;
      confetti({ particleCount: 70, spread: 50, origin: { y: 0.6 } });
    } catch (e) {}
  };


  const faqs = [
    {
      q: 'Can students from private schools apply for Session V?',
      a: 'Yes! Both Government and Private school/college students across Khyber Pakhtunkhwa are eligible to compete on 100% merit.'
    },
    {
      q: 'What is the registration and examination fee?',
      a: 'A nominal standardized testing fee of PKR 300 is charged per candidate to cover printed test material, customized OMR bubble sheet processing, and official result certification. Candidate selection is 100% merit-based.'
    },
    {
      q: 'What is the syllabus for the 100 MCQs test?',
      a: '100% of questions are selected from the official ~1,000 MCQs Question Bank published by AZM for each grade level.'
    },
    {
      q: 'How are candidates evaluated during the 6-member interview?',
      a: 'Final selection combines 70% OMR test score, 15% interview evaluation, 10% past academic records, and 5% socioeconomic criteria.'
    }
  ];

  return (
    <div className="py-10 max-w-7xl mx-auto px-4 sm:px-6 space-y-12">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#185b9d]/10 text-[#185b9d] border border-[#185b9d]/20">
          <Phone className="w-3.5 h-3.5" />
          Official Grievance Desk & Helplines
        </span>
        <h1 className="text-3xl sm:text-5xl font-display font-extrabold text-slate-900 tracking-tight">
          Candidate Support & Head Office Coordinates
        </h1>
        <p className="text-sm text-slate-600">
          Reach our administrative officers, visit the 3 Mansehra registration hubs, or log an official grievance ticket.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Form: Grievance Desk (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 shadow-xl p-6 sm:p-8 space-y-6">
          <div className="border-b border-slate-200 pb-3">
            <h2 className="text-xl font-bold font-display text-slate-900 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-[#185b9d]" />
              Official Grievance & Query Ticket Portal
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              All tickets are assigned to a grievance officer and resolved within 24 hours.
            </p>
          </div>

          {!ticketSubmitted ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Candidate / Guardian Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Asad Mehmood"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-300 focus:bg-white focus:border-[#185b9d] focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    WhatsApp Contact Number *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="0300-1234567"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-xs font-mono rounded-xl bg-slate-50 border border-slate-300 focus:bg-white focus:border-[#185b9d] focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Query Category *
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-300 focus:bg-white focus:border-[#185b9d] focus:outline-hidden"
                  >
                    <option value="Roll Number Slip Issue">Roll Number Slip Retrieval</option>
                    <option value="Application Correction">Application Data Correction</option>
                    <option value="Exam Center Change">Examination Center Query</option>
                    <option value="Question Bank Assistance">Question Bank Syllabus Request</option>
                    <option value="General Grievance">Other Administrative Query</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Roll No / Application ID (If applicable)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. AZM-2026-61042"
                    value={formData.rollOrAppNo}
                    onChange={(e) => setFormData({ ...formData, rollOrAppNo: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-xs font-mono rounded-xl bg-slate-50 border border-slate-300 focus:bg-white focus:border-[#185b9d] focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Detailed Query / Grievance Statement *
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Describe your issue or query clearly with candidate details..."
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-300 focus:bg-white focus:border-[#185b9d] focus:outline-hidden"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-[#185b9d] hover:bg-[#13497e] text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                <span>Submit Grievance Ticket</span>
              </button>
            </form>
          ) : (
            <div className="text-center py-8 space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold font-display text-slate-900">
                Ticket Registered Successfully!
              </h3>
              <p className="text-xs text-slate-600 max-w-md mx-auto">
                Your tracking ID is <strong className="font-mono text-[#185b9d]">{ticketId}</strong>. Our admissions officer will contact your WhatsApp at <strong>{formData.phone}</strong>.
              </p>
              <button
                onClick={() => {
                  setTicketSubmitted(false);
                  setFormData({ fullName: '', phone: '', email: '', category: 'Roll Number Slip Issue', rollOrAppNo: '', message: '' });
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-xs font-semibold rounded-xl"
              >
                Submit Another Inquiry
              </button>
            </div>
          )}
        </div>

        {/* Right Info: Registration Hubs & Direct Lines (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="p-6 rounded-3xl bg-slate-900 text-white space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <Building2 className="w-5 h-5 text-amber-300" />
              <h3 className="text-sm font-bold font-display uppercase tracking-wider text-amber-300">
                Head Office & Central Secretariat
              </h3>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-white block">AZM.AIO (Pvt.) Ltd. Central Office</span>
                  <span>AZM Secretariat, Karakoram Highway, Gandhian, Mansehra, KP, Pakistan</span>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>Helpline: <strong className="text-white font-mono">{OFFICIAL_DATA.helpline}</strong></span>
              </div>

              <div className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span>Office Hours: <strong>{OFFICIAL_DATA.helplineHours}</strong></span>
              </div>

              <div className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                <span>Email: <strong className="text-white font-mono">{OFFICIAL_DATA.email}</strong></span>
              </div>
            </div>
          </div>

          {/* 3 Physical Hubs Card List */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              In-Person Registration Centres (Mansehra):
            </h3>

            <div className="space-y-3 text-xs">
              {REGISTRATION_HUBS.map((h) => (
                <div key={h.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">{h.name}</span>
                    <span className="text-[10px] font-mono text-[#185b9d] font-bold">{h.contact}</span>
                  </div>
                  <p className="text-[11px] text-slate-600">{h.address}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Frequently Asked Questions Accordion */}
      <div className="pt-8 border-t border-slate-200 max-w-4xl mx-auto space-y-4">
        <div className="text-center space-y-1">
          <span className="text-xs font-bold text-[#185b9d] uppercase tracking-widest">
            Admissions Knowledge Base
          </span>
          <h2 className="text-2xl font-bold font-display text-slate-900">
            Frequently Asked Questions
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {faqs.map((f, idx) => (
            <div key={idx} className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2">
              <h3 className="text-xs font-bold text-slate-900 flex items-start gap-2">
                <HelpCircle className="w-4 h-4 text-[#185b9d] flex-shrink-0 mt-0.5" />
                <span>{f.q}</span>
              </h3>
              <p className="text-xs text-slate-600 pl-6 leading-relaxed">
                {f.a}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
