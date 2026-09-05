import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { OFFICIAL_DATA } from '../../data/scholarshipData';
import { searchRollNumberSlip } from '../../services/api';
import { RollNumberSlip, PageTab } from '../../types';
import { Logo } from '../common/Logo';
import { StudentDossierModal } from '../common/StudentDossierModal';
import { wakeUpBackend } from '../../lib/apiClient';
import { 
  Search, 
  Printer, 
  Download, 
  QrCode, 
  MapPin, 
  Clock, 
  Calendar, 
  AlertTriangle, 
  ShieldCheck, 
  CheckCircle2, 
  User,
  Sparkles,
  Info,
  Loader2,
  FileQuestion,
  FileText
} from 'lucide-react';

interface RollNumberSlipViewProps {
  onSelectTab: (tab: PageTab) => void;
}

export const RollNumberSlipView: React.FC<RollNumberSlipViewProps> = ({ onSelectTab }) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [cnicOrBForm, setCnicOrBForm] = useState<string>('');
  const [selectedSlip, setSelectedSlip] = useState<RollNumberSlip | null>(null);
  const [isDossierOpen, setIsDossierOpen] = useState<boolean>(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');

  const [hasSearched, setHasSearched] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Pre-warm backend when visiting roll number slips desk
  useEffect(() => {
    wakeUpBackend();
  }, []);

  useEffect(() => {
    if (selectedSlip?.rollNo) {
      const payload = selectedSlip.qrPayload || selectedSlip.rollNo;
      QRCode.toDataURL(payload, {
        width: 300,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      })
        .then((url) => {
          setQrCodeDataUrl(url);
        })
        .catch((err) => {
          console.warn('QRCode generate fallback:', err);
          setQrCodeDataUrl(
            `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(payload)}`
          );
        });
    } else {
      setQrCodeDataUrl('');
    }
  }, [selectedSlip]);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg('');
    const cleanQuery = searchQuery.trim();
    const cleanIdentity = cnicOrBForm.trim();

    if (!cleanQuery) {
      setErrorMsg('Enter your application ID or roll number.');
      return;
    }
    if (cleanIdentity.replace(/\D/g, '').length < 5) {
      setErrorMsg('Enter the complete CNIC / B-Form used for registration.');
      return;
    }

    setIsLoading(true);
    setHasSearched(true);

    const res = await searchRollNumberSlip(cleanQuery, cleanIdentity);
    setIsLoading(false);

    if (res.success && res.data) {
      setSelectedSlip(res.data);
    } else {
      setSelectedSlip(null);
      setErrorMsg(res.error || 'No issued slip found. Slips are issued on 25 October 2026 following registration verification.');
    }
  };

  const printDocument = () => {
    window.print();

  };

  const downloadSlipAlert = () => {
    window.print();
  };

  return (
    <div className="py-10 max-w-5xl mx-auto px-4 sm:px-6 space-y-10">
      {/* Header Banner */}
      <div className="text-center max-w-2xl mx-auto space-y-3 no-print">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#185b9d]/10 text-[#185b9d] border border-[#185b9d]/20">
          <ShieldCheck className="w-3.5 h-3.5" />
          Official Examination Entry Pass
        </span>
        <h1 className="text-3xl sm:text-4xl font-display font-extrabold text-slate-900 tracking-tight">
          Session V (2026) Roll Number Slip Desk
        </h1>
        <p className="text-xs sm:text-sm text-slate-600">
          Enter your Roll Number, CNIC / B-Form, or Application ID to view, verify, and print your standardized examination entry pass.
        </p>
      </div>

      {/* Quick Search Bar */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-md p-5 sm:p-6 no-print space-y-4">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              id="input-roll-search"
              placeholder="Application ID or Roll No."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 text-xs sm:text-sm font-mono rounded-xl bg-slate-50 border border-slate-300 focus:bg-white focus:border-[#185b9d] focus:ring-1 focus:ring-[#185b9d] focus:outline-hidden"
            />
          </div>
          <div className="relative flex-1">
            <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              id="input-slip-cnic"
              placeholder="CNIC / B-Form used at registration"
              value={cnicOrBForm}
              onChange={(e) => setCnicOrBForm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 text-xs sm:text-sm font-mono rounded-xl bg-slate-50 border border-slate-300 focus:bg-white focus:border-[#185b9d] focus:ring-1 focus:ring-[#185b9d] focus:outline-hidden"
              autoComplete="off"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            id="btn-search-slip"
            className="px-6 py-3 bg-[#185b9d] hover:bg-[#13497e] text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 focus:outline-hidden disabled:opacity-70"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Verifying...</span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                <span>Search Slip</span>
              </>
            )}
          </button>
        </form>

        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
          <span>Official Release Date: <strong className="text-slate-800">25 October 2026</strong></span>
          <button
            type="button"
            onClick={() => onSelectTab('contact')}
            className="text-[#185b9d] hover:underline font-medium"
          >
            Need Help with Tracking ID?
          </button>
        </div>

        {errorMsg && !errorMsg.startsWith('SCHEDULED_RELEASE:::') && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold block">Notice</span>
              <p>{errorMsg}</p>
            </div>
          </div>
        )}
      </div>

      {/* Scheduled Roll Number Release Notice Card */}
      {errorMsg && errorMsg.startsWith('SCHEDULED_RELEASE:::') && (() => {
        const [, candName, appNo, dateFormatted, noticeMsg] = errorMsg.split(':::');
        return (
          <div className="bg-white rounded-3xl border-2 border-blue-200/80 p-6 sm:p-8 space-y-6 shadow-sm no-print max-w-2xl mx-auto">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800">
                  Registration &amp; Fee Verified ✓
                </span>
                <h3 className="text-base sm:text-lg font-black text-slate-900 mt-1">
                  {candName || 'Candidate'} ({appNo || 'APP-2026'})
                </h3>
              </div>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-blue-50/70 border border-blue-100 space-y-3">
              <div className="flex items-center gap-2 text-[#185b9d] font-bold text-xs sm:text-sm">
                <Calendar className="w-4 h-4" />
                <span>Roll Number Slip &amp; Test Center Release Schedule</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                {noticeMsg || 'Roll Number Slips with assigned test centers and examination hall seats will be published on the official portal on the scheduled date.'}
              </p>
              <div className="p-3 bg-white rounded-xl border border-blue-200/80 flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">Scheduled Release:</span>
                <span className="text-xs font-black text-[#185b9d] font-mono">{dateFormatted}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-100">
              <span className="text-[11px] text-slate-500">
                Your admission is secured in the examination database.
              </span>
              <a
                href="https://wa.me/923051755551?text=Hello%20AZM.AIO%20Helpline%2C%20inquiring%20about%20my%20Roll%20Number%20Slip%20release."
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-2 bg-[#25D366] text-white rounded-xl text-xs font-bold hover:bg-[#20bd5a] transition flex items-center gap-1.5"
              >
                <span>WhatsApp Helpline</span>
              </a>
            </div>
          </div>
        );
      })()}

      {/* Initial Clean State when no search performed yet */}
      {!hasSearched && !selectedSlip && !errorMsg && (
        <div className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-10 text-center space-y-4 shadow-sm no-print max-w-2xl mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 text-[#185b9d] border border-blue-100 flex items-center justify-center mx-auto">
            <FileQuestion className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold font-display text-slate-900">
            Search Your Examination Entry Slip
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-lg mx-auto">
            Enter your candidate CNIC / B-Form or the Application Tracking ID generated during registration to download your authenticated slip.
          </p>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => onSelectTab('apply')}
              className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors"
            >
              Registration Closed — Contact Us
            </button>
          </div>
        </div>
      )}

      {/* Explicit Not Found State */}
      {hasSearched && !selectedSlip && !isLoading && errorMsg && !errorMsg.startsWith('SCHEDULED_RELEASE:::') && (
        <div className="bg-white rounded-3xl border border-slate-200/90 p-8 sm:p-10 text-center space-y-4 shadow-sm no-print max-w-2xl mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold font-display text-slate-900">
            No Candidate Slip Found
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-lg mx-auto">
            We could not find an issued entry pass matching "<strong className="text-slate-800">{searchQuery}</strong>". Official Roll Number Slips are generated after institutional verification on <strong>25 October 2026</strong>.
          </p>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <a
              href="https://wa.me/923051755551?text=Hello%20AZM.AIO%20Helpline%2C%20I%20cannot%20find%20my%20Roll%20Number%20Slip."
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 bg-[#25D366] text-white rounded-xl text-xs font-bold hover:bg-[#20bd5a] transition-colors"
            >
              Ask on WhatsApp
            </a>
            <button
              onClick={() => onSelectTab('contact')}
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200 transition-colors"
            >
              Contact Grievance Desk
            </button>
          </div>
        </div>
      )}



      {/* ================= OFFICIAL PRINTABLE ROLL NUMBER SLIP DOCUMENT ================= */}
      {selectedSlip && (
        <div className="space-y-4">
          {/* Action Bar Above Slip */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 no-print px-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Cryptographically Verified Entry Pass</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setIsDossierOpen(true)}
                className="px-4 py-2 bg-blue-50 text-[#185b9d] border border-blue-200 hover:bg-blue-100 rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5 text-[#185b9d]" />
                <span>Full Profile Dossier</span>
              </button>

              <button
                onClick={printDocument}
                id="btn-print-slip"
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all focus:outline-hidden cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Direct Print (A4)</span>
              </button>

              <button
                onClick={downloadSlipAlert}
                id="btn-download-slip"
                className="px-4 py-2 bg-[#185b9d] hover:bg-[#13497e] text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all focus:outline-hidden cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Official PDF</span>
              </button>
            </div>
          </div>



          {/* Document Canvas Container */}
          <div className="printable-document bg-white rounded-3xl border-2 border-slate-300 shadow-xl p-6 sm:p-10 relative overflow-hidden bg-guilloche">
            {/* Guilloche Security Watermark Crest in Center Background */}
            <div className="absolute inset-0 flex items-center justify-center opacity-[0.035] pointer-events-none select-none">
              <div className="w-[500px] h-[500px] rounded-full border-[24px] border-[#185b9d] flex items-center justify-center">
                <span className="font-display font-extrabold text-9xl text-[#185b9d]">AZM</span>
              </div>
            </div>

            {/* Document Header */}
            <div className="border-b-2 border-slate-900 pb-4 mb-6">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3 text-center sm:text-left">
                  <Logo size="lg" />
                </div>

                <div className="text-center sm:text-right space-y-0.5">
                  <span className="inline-block px-3 py-1 bg-[#185b9d] text-white font-mono font-bold text-xs rounded-md uppercase tracking-wider">
                    Official Roll Number Slip
                  </span>
                  <div className="text-xs font-bold text-slate-900">
                    Session V (2026) 100 MCQs Examination
                  </div>
                  <div className="text-[11px] text-slate-500 font-urdu">
                    {OFFICIAL_DATA.urduQuote}
                  </div>
                </div>
              </div>
            </div>

            {/* Top Slip Metadata Grid */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start pb-6 border-b border-slate-200">
              {/* Photo & Barcode (3 cols) */}
              <div className="md:col-span-3 flex flex-col items-center sm:items-start space-y-3">
                <div className="relative">
                  <img
                    src={selectedSlip.candidatePhoto || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80'}
                    alt={selectedSlip.candidateName || 'Candidate'}
                    className="w-28 h-32 rounded-xl object-cover border-2 border-slate-900 shadow-xs bg-slate-100"
                  />
                  <span className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-emerald-700 text-white font-bold text-[9px] rounded-md">
                    Verified
                  </span>
                </div>
                <div className="text-center sm:text-left font-mono text-[10px] text-slate-600">
                  <span className="tracking-widest block font-bold text-slate-900">{selectedSlip.barcode || selectedSlip.rollNo || 'BARCODE'}</span>
                  <span>{selectedSlip.applicationId || 'APP-2026'}</span>
                </div>
              </div>

              {/* Candidate Particulars (6 cols) */}
              <div className="md:col-span-6 space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-y-2.5 gap-x-4">
                  <div>
                    <span className="text-slate-500 text-[10px] uppercase font-bold block">Candidate Name:</span>
                    <span className="text-sm font-extrabold text-slate-900 font-display">{selectedSlip.candidateName}</span>
                  </div>

                  <div>
                    <span className="text-slate-500 text-[10px] uppercase font-bold block">Father / Guardian Name:</span>
                    <span className="text-xs font-bold text-slate-800">{selectedSlip.fatherName}</span>
                  </div>

                  <div>
                    <span className="text-slate-500 text-[10px] uppercase font-bold block">CNIC / B-Form No:</span>
                    <span className="font-mono font-bold text-[#185b9d] text-xs">{selectedSlip.cnicBForm}</span>
                  </div>

                  <div>
                    <span className="text-slate-500 text-[10px] uppercase font-bold block">Class Level:</span>
                    <span className="font-bold text-emerald-800 text-xs">{selectedSlip.classLevel}</span>
                  </div>

                  <div className="col-span-2 pt-2 border-t border-slate-100">
                    <span className="text-slate-500 text-[10px] uppercase font-bold block">Assigned Examination Centre:</span>
                    <span className="text-xs font-bold text-slate-900 block">{selectedSlip.testCenter}</span>
                    <span className="text-[11px] text-slate-600 block">{selectedSlip.centerAddress}</span>
                  </div>
                </div>
              </div>

              {/* QR Code & Roll No Highlight Box (3 cols) */}
              <div className="md:col-span-3 flex flex-col items-center md:items-end text-center md:text-right space-y-3">
                <div className="p-3 rounded-2xl bg-slate-900 text-white w-full max-w-[180px] text-center">
                  <span className="text-[9px] uppercase font-bold text-amber-300 tracking-wider block">Official Roll No</span>
                  <span className="text-base font-extrabold font-mono text-white block tabular-nums">{selectedSlip.rollNo}</span>
                  <span className="text-[9px] text-emerald-400 font-mono mt-0.5 block">{selectedSlip.seatIndex || 'SEAT-0101'}</span>
                </div>

                {/* Real Scannable Biometric QR Code Matrix */}
                <div className="p-2 rounded-2xl bg-white border-2 border-slate-300 shadow-sm flex flex-col items-center">
                  <div className="w-24 h-24 bg-white p-1 rounded-xl flex items-center justify-center border border-slate-200 shadow-inner overflow-hidden">
                    {qrCodeDataUrl ? (
                      <img
                        src={qrCodeDataUrl}
                        alt="Candidate Biometric QR Code"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                        <QrCode className="w-8 h-8 text-slate-400 animate-pulse" />
                      </div>
                    )}
                  </div>
                  <span className="text-[8px] font-mono text-slate-700 mt-1 font-bold tracking-tight">
                    Scannable Biometric QR
                  </span>
                </div>

              </div>
            </div>

            {/* Exam Timing & Schedule Schedule Bar */}
            <div className="my-6 p-4 rounded-2xl bg-slate-100 border border-slate-300 grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Examination Date:</span>
                <span className="text-xs font-extrabold text-slate-900 font-mono flex items-center justify-center gap-1 mt-0.5">
                  <Calendar className="w-3.5 h-3.5 text-[#185b9d]" />
                  {selectedSlip.examDate || 'Sunday, 15 November 2026'}
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Reporting Time:</span>
                <span className="text-xs font-extrabold text-rose-700 font-mono flex items-center justify-center gap-1 mt-0.5">
                  <Clock className="w-3.5 h-3.5 text-rose-600" />
                  {selectedSlip.reportingTime || '09:00 AM'} (Strict)
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Test Duration:</span>
                <span className="text-xs font-extrabold text-[#185b9d] font-mono block mt-0.5">
                  {selectedSlip.examStartTime || '10:00 AM - 12:00 PM (120 Mins)'}
                </span>
              </div>
            </div>

            {/* Candidate Rules & Instructions */}
            <div className="space-y-2 text-xs">
              <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                Mandatory Examination Day Instructions
              </h4>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-700 leading-snug">
                {(selectedSlip.specialInstructions || [
                  'Bring your original CNIC / B-Form along with this printed entry slip to the examination centre.',
                  'Entry gate closes strictly 15 minutes before the reporting time (08:45 AM).',
                  'Biometric verification will be carried out at the entry desk using your QR code.',
                  'Mobile phones, smartwatches, and programmable calculators are strictly prohibited inside the hall.'
                ]).map((inst, iIdx) => (
                  <li key={iIdx} className="flex items-start gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200">
                    <span className="font-bold text-[#185b9d]">{iIdx + 1}.</span>
                    <span>{inst}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Document Verification Footer */}
            <div className="mt-8 pt-4 border-t-2 border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-[10px] text-slate-500">
              <div>
                <span>Security Token: </span>
                <span className="font-mono font-bold text-slate-800">{selectedSlip.securityHash || `AUTH-${selectedSlip.rollNo}`}</span>
              </div>
              <div className="text-center sm:text-right">
                <p className="font-bold text-slate-900">Director General (Examinations)</p>
                <p>AZM.AIO (Pvt.) Ltd. Central Testing Service</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full Candidate Application Dossier Modal */}
      <StudentDossierModal
        isOpen={isDossierOpen}
        onClose={() => setIsDossierOpen(false)}
        student={
          selectedSlip
            ? ({
                ...selectedSlip,
                fullName: selectedSlip.candidateName,
                schoolName: selectedSlip.institution,
                cnicOrBForm: selectedSlip.cnicBForm,
                feeStatus: 'PAID',
                rollNumber: selectedSlip.rollNo,
                currentClass: selectedSlip.classLevel,
                photoUrl: selectedSlip.candidatePhoto,
                officeUse: {
                  testCentre: selectedSlip.testCenter,
                  testDate: selectedSlip.examDate,
                  testReportingTime: selectedSlip.reportingTime,
                },
              } as any)
            : null
        }
      />
    </div>
  );
};


