import React, { useState, useEffect, useRef } from 'react';
import { X, Printer, Download, AlertTriangle, ShieldCheck, User, Calendar, MapPin, CheckCircle2, Loader2 } from 'lucide-react';
import QRCode from 'qrcode';
import { mockApi, MockStudent } from '../../../lib/mockApi';
import { apiFetchProtectedObjectUrl, apiFetch } from '../../../lib/apiClient';

interface RollSlipPreviewModalProps {
  student: MockStudent | null;
  isOpen: boolean;
  onClose: () => void;
}

export const RollSlipPreviewModal: React.FC<RollSlipPreviewModalProps> = ({
  student: initialStudent,
  isOpen,
  onClose,
}) => {
  const [prepared, setPrepared] = useState<MockStudent | null>(null);
  const student = prepared?.id === initialStudent?.id ? prepared : initialStudent;
  useEffect(() => {
    if (!isOpen || !initialStudent) return;
    let active = true;
    setPrepared(null);
    apiFetch<MockStudent>(`/api/students/${initialStudent.id}/prepare-print`, { method: 'POST' })
      .then(value => { if (active) setPrepared(value); })
      .catch(error => { if (active) alert(error.message || 'Unable to reserve roll number.'); });
    return () => { active = false; };
  }, [initialStudent?.id, isOpen]);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const isProvisional = !student?.rollNumber || student?.rollNumberStatus === 'PROVISIONAL';
  const displayRoll = prepared?.displayRollNumber || student?.rollNumber || 'Reserving…';

  // Load photo
  useEffect(() => {
    if (!student || !isOpen) {
      setPhotoUrl(null);
      return;
    }
    let active = true;
    let createdUrl: string | null = null;

    const loadPhoto = async () => {
      try {
        let url: string;
        try {
          url = await apiFetchProtectedObjectUrl(`/api/students/${student.id}/document/photo`);
        } catch {
          url = await apiFetchProtectedObjectUrl(`/api/students/${student.id}/document/photoThumbnail`);
        }
        if (active) {
          createdUrl = url;
          setPhotoUrl(url);
        } else {
          URL.revokeObjectURL(url);
        }
      } catch {
        if (active) setPhotoUrl(null);
      }
    };

    loadPhoto();
    return () => {
      active = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [student, isOpen]);

  // Generate verification QR code
  useEffect(() => {
    if (!student || !isOpen || !prepared) return;

    const qrPayload = JSON.stringify({
      type: 'AZM_SLIP',
      session: '2026-V',
      studentId: student.id,
      applicationNo: student.applicationNo,
      rollNumber: displayRoll,
      status: isProvisional ? 'PROVISIONAL' : 'OFFICIAL',
      timestamp: new Date().toISOString(),
    });

    QRCode.toDataURL(qrPayload, {
      width: 140,
      margin: 1,
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(''));
  }, [student, isOpen, displayRoll, isProvisional, prepared]);

  if (!isOpen || !student) return null;

  const handlePrint = async () => {
    try { await mockApi.printStudentRollSlipPdf(student.id); }
    catch (error: any) { alert(error.message || 'Unable to print document.'); }
  };

  const handleDownloadPdf = async () => {
    setIsDownloadingPdf(true);
    try {
      await mockApi.downloadStudentRollSlipPdf(student.id, displayRoll);
    } catch (err: any) {
      alert(err.message || 'Failed to download roll number slip PDF.');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const examDate = ((student.officeUse as any)?.testDate ? new Date((student.officeUse as any).testDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : (student as any).testDate || 'To be announced');
  const reportingTime = (student.officeUse as any)?.testReportingTime || (student as any).reportingTime || 'To be announced';
  const startTime = (student as any).examStartTime || 'To be announced';
  const testCenter = student.officeUse?.testCentre || student.testCenterName || 'To be assigned';
  const hall = student.assignedHall || 'To be assigned';
  const room = student.assignedRoom || 'To be assigned';
  const seat = student.seatNo || 'To be assigned';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-2 sm:p-4 backdrop-blur-xs overflow-y-auto">
      {/* Container */}
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[96vh]">
        {/* Modal Top Header (Screen Only) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 print:hidden">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 text-[#185b9d] rounded-xl font-bold">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                Roll Number Slip Overview & Print
              </h2>
              <p className="text-xs text-slate-500">
                {isProvisional ? 'Pre-issue verification pass' : 'Official standardized entry slip'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#185b9d] hover:bg-[#13497d] text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print Pass</span>
            </button>

            <button
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-60"
            >
              {isDownloadingPdf ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>PDF</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Printable Slip Container */}
        <div className="overflow-y-auto p-4 sm:p-6 bg-slate-100 flex justify-center">
          <div
            ref={printRef}
            id="azm-printable-roll-slip"
            className="w-full max-w-[760px] bg-white border-2 border-[#185b9d] rounded-xl p-6 sm:p-8 shadow-sm print:border-none print:shadow-none print:p-0 print:m-0"
          >
            {/* Slip Header */}
            <div className="border-b-2 border-[#185b9d] pb-4 mb-4 flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="bg-[#185b9d] text-white text-[10px] font-black tracking-widest px-2.5 py-0.5 rounded-sm uppercase">
                    Session 2026-V
                  </span>
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Government Registered Scholarship Program
                  </span>
                </div>
                <h1 className="text-xl sm:text-2xl font-black text-[#185b9d] mt-1 tracking-tight">
                  AZM.AIO SCHOLARSHIP & TALENT HUNT
                </h1>
                <p className="text-xs font-semibold text-slate-600">
                  Standardized Aptitude & Merit Evaluation Examination Entry Pass
                </p>
              </div>

              <div className="hidden sm:block text-right">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Verification System</div>
                <div className="text-xs font-mono font-bold text-slate-700">AZM-SEC-V2</div>
              </div>
            </div>

            {/* Amber Alert Banner if Provisional */}
            {isProvisional && (
              <div className="mb-4 bg-amber-50 border-2 border-amber-400 rounded-xl p-3.5 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-black text-amber-900 tracking-wide uppercase">
                    PRE-ISSUE COPY — OFFICIAL ROLL NUMBER NOT YET ISSUED
                  </div>
                  <div className="text-[11px] text-amber-800 mt-0.5 leading-relaxed font-medium">
                    This document is a provisional pre-issue admit copy generated for verification and preliminary hall arrangement.
                    The reserved roll number will remain the same when officially released.
                  </div>
                </div>
              </div>
            )}

            {/* Candidate Identity & Photo Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4 w-full sm:w-auto">
                {/* Photo Frame */}
                <div className="w-24 h-28 bg-white border-2 border-slate-300 rounded-lg overflow-hidden flex items-center justify-center shrink-0 shadow-2xs">
                  {photoUrl ? (
                    <img src={photoUrl} alt={student.fullName} className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-400 text-xs font-bold p-2 text-center">
                      <User className="w-8 h-8 mb-1 opacity-50" />
                      <span>No Photo</span>
                    </div>
                  )}
                </div>

                {/* Name & Basic Info */}
                <div>
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wide">Candidate Name</div>
                  <div className="text-lg font-black text-slate-900 leading-tight">{student.fullName}</div>
                  <div className="text-xs text-slate-600 mt-0.5">S/D/O {student.fatherName}</div>
                  <div className="text-xs font-mono text-slate-500 mt-1">CNIC: {student.cnicOrBForm}</div>
                  <div className="mt-1.5 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-100 text-blue-900 text-[11px] font-bold">
                    <span>Class:</span> {student.currentClass}
                  </div>
                </div>
              </div>

              {/* Roll Number & QR Block */}
              <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-200">
                <div className="text-left sm:text-right">
                  <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    {isProvisional ? 'Reserved Roll Number' : 'Examination Roll No.'}
                  </div>
                  <div className="text-xl font-black font-mono text-[#185b9d] tracking-wide">
                    {displayRoll}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">App #{student.applicationNo}</div>
                </div>

                {qrDataUrl && (
                  <div className="sm:mt-2 shrink-0">
                    <img src={qrDataUrl} alt="Candidate QR" className="w-18 h-18 border border-slate-200 rounded-md p-0.5 bg-white" />
                  </div>
                )}
              </div>
            </div>

            {/* Examination Center & Schedule Block */}
            <div className="border border-[#185b9d]/30 bg-blue-50/40 rounded-xl p-4 mb-4">
              <div className="text-xs font-black text-[#185b9d] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                <span>Examination Schedule & Venue</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Examination Date</div>
                  <div className="font-bold text-slate-800 mt-0.5">{examDate}</div>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Timings</div>
                  <div className="font-bold text-slate-800 mt-0.5">
                    Reporting: <span className="text-emerald-700">{reportingTime}</span> | Exam: {startTime}
                  </div>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-slate-200 sm:col-span-2">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Assigned Examination Center</div>
                  <div className="font-bold text-slate-800 mt-0.5">{testCenter}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Hall: <strong className="text-slate-800">{hall}</strong> | Room: <strong className="text-slate-800">{room}</strong> | Seat: <strong className="text-[#185b9d]">{seat}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Examination Instructions */}
            <div className="border-t border-slate-200 pt-3 text-[10px] text-slate-600 leading-relaxed">
              <div className="font-black text-slate-800 uppercase tracking-wide mb-1">
                Mandatory Candidate Instructions:
              </div>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>Candidates must bring this printed Slip along with Original CNIC / B-Form to the examination center.</li>
                <li>Report to the assigned hall at least 45 minutes prior to the examination start time.</li>
                <li>Mobile phones, smart watches, calculators, and study materials are strictly prohibited inside the hall.</li>
                <li>Use only Blue or Black ballpoint pens to fill the MCQs OMR bubble sheet.</li>
              </ul>
            </div>

            {/* Signatures Row */}
            <div className="mt-8 pt-4 border-t border-slate-200 flex items-center justify-between text-center text-[10px] font-bold text-slate-500">
              <div className="w-40 border-t border-slate-400 pt-1">
                Candidate Signature
              </div>
              <div className="w-40 border-t border-slate-400 pt-1">
                Invigilator Signature
              </div>
              <div className="w-40 border-t border-slate-400 pt-1 text-[#185b9d]">
                Controller of Examinations
              </div>
            </div>
          </div>
        </div>

        {/* Modal Bottom Footer (Screen Only) */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200 bg-white print:hidden">
          <div className="text-xs text-slate-500 font-medium">
            Standard A4 size printout ready.
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              Close
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-2 text-xs font-bold bg-[#185b9d] hover:bg-[#13497d] text-white rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print Roll Slip</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
