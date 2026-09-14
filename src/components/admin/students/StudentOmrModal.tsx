import React, { useState, useEffect, useRef } from 'react';
import { X, Printer, Download, AlertTriangle, User, Loader2, CheckCircle2 } from 'lucide-react';
import QRCode from 'qrcode';
import { mockApi, MockStudent } from '../../../lib/mockApi';
import { apiFetchProtectedObjectUrl, apiFetch } from '../../../lib/apiClient';

interface StudentOmrModalProps {
  student: MockStudent | null;
  isOpen: boolean;
  onClose: () => void;
}

export const StudentOmrModal: React.FC<StudentOmrModalProps> = ({
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
  const sheetRef = useRef<HTMLDivElement>(null);

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

  // Generate structured OMR candidate verification QR code
  useEffect(() => {
    if (!student || !isOpen || !prepared) return;

    const omrPayload = JSON.stringify({
      type: 'AZM_OMR',
      session: '2026-V',
      studentId: student.id,
      applicationNo: student.applicationNo,
      rollNumber: displayRoll,
      rollType: isProvisional ? 'PROVISIONAL' : 'OFFICIAL',
      sheetVersion: 1,
    });

    QRCode.toDataURL(omrPayload, {
      width: 130,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' },
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(''));
  }, [student, isOpen, displayRoll, isProvisional, prepared]);

  if (!isOpen || !student) return null;

  const handlePrint = async () => {
    try { await mockApi.printStudentOmrPdf(student.id); }
    catch (error: any) { alert(error.message || 'Unable to print document.'); }
  };

  const handleDownloadPdf = async () => {
    setIsDownloadingPdf(true);
    try {
      await mockApi.downloadStudentOmrPdf(student.id, displayRoll);
    } catch (err: any) {
      alert(err.message || 'Failed to download OMR answer sheet PDF.');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const testCenter = student.testCenterName || (student as any).registrationCentre || 'AZM Regional Center';
  const hall = student.assignedHall || 'Hall A';
  const room = student.assignedRoom || 'Room 101';
  const seat = student.seatNo || 'Allocated';

  // Helper to render columns of questions
  const renderQuestionColumn = (start: number, count: number) => {
    const rows = [];
    for (let i = start; i < start + count; i++) {
      const qNum = i < 10 ? `0${i}` : `${i}`;
      rows.push(
        <div
          key={i}
          className={`flex items-center justify-between py-[2px] px-1 text-[10px] font-mono border-b border-slate-100 ${
            i % 5 === 0 ? 'border-b-2 border-slate-300' : ''
          }`}
        >
          <span className="font-bold text-slate-700 w-5 text-right mr-1.5">{qNum}</span>
          <div className="flex items-center gap-1.5">
            {['A', 'B', 'C', 'D'].map((opt) => (
              <span
                key={opt}
                className="w-4 h-4 rounded-full border border-slate-800 flex items-center justify-center text-[9px] font-black text-slate-900 leading-none bg-white hover:bg-slate-200 transition select-none"
              >
                {opt}
              </span>
            ))}
          </div>
        </div>
      );
    }
    return rows;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 p-2 sm:p-4 backdrop-blur-xs overflow-y-auto">
      {/* Modal Card */}
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[96vh]">
        {/* Top Action Bar (Screen Only) */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-200 bg-slate-900 text-white print:hidden">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 border border-blue-400/30 text-blue-300 rounded-xl font-bold">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight leading-tight text-white">
                MCQs OMR Bubble Sheet (100 Questions)
              </h2>
              <p className="text-xs text-slate-400">
                A4 Exact Geometry • Candidate Photo • QR Identity • Optical Marks
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print OMR (A4)</span>
            </button>

            <button
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-60"
            >
              {isDownloadingPdf ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>Download PDF</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Printable A4 Sheet Preview */}
        <div className="overflow-y-auto p-4 sm:p-6 bg-slate-200 flex justify-center print:p-0 print:bg-white">
          <div
            ref={sheetRef}
            id="azm-printable-omr-sheet"
            className="w-full max-w-[780px] bg-white border border-slate-300 shadow-md p-6 sm:p-7 relative print:border-none print:shadow-none print:p-0 print:m-0 print:max-w-none print:w-[210mm]"
            style={{ minHeight: '280mm' }}
          >
            {/* OMR Alignment Corner Marks */}
            <div className="absolute top-2 left-2 w-4 h-4 bg-black" />
            <div className="absolute top-2 right-2 w-4 h-4 bg-black" />
            <div className="absolute bottom-2 left-2 w-4 h-4 bg-black" />
            <div className="absolute bottom-2 right-2 w-4 h-4 bg-black" />

            {/* OMR Header */}
            <div className="text-center border-b-2 border-slate-900 pb-2 mb-3">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                AZM EDUCATIONAL & SCHOLARSHIP EXAMINATION AUTHORITY
              </div>
              <h1 className="text-lg sm:text-xl font-black text-slate-900 uppercase tracking-tight mt-0.5">
                SESSION 2026-V STANDARDIZED SCHOLARSHIP MERIT TEST
              </h1>
              <div className="inline-block bg-slate-900 text-white text-[11px] font-black px-4 py-0.5 mt-1 tracking-wider uppercase">
                OFFICIAL MCQS OMR RESPONSE SHEET (100 QUESTIONS)
              </div>
            </div>

            {/* Amber Alert Banner if Provisional */}
            {isProvisional && (
              <div className="mb-3 bg-amber-50 border-2 border-amber-400 rounded-lg p-2.5 flex items-center gap-2 text-left">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                <div className="text-[10px] text-amber-900 font-bold leading-tight">
                  <span className="uppercase font-black text-amber-950">
                    PRE-ISSUE COPY — OFFICIAL ROLL NUMBER NOT YET ISSUED.
                  </span>{' '}
                  Candidate ID: {displayRoll}. This provisional answer sheet is verified for preliminary seat allocation.
                </div>
              </div>
            )}

            {/* Candidate Info Grid with Photo & QR */}
            <div className="border border-slate-900 p-2.5 mb-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs bg-slate-50/50">
              {/* Photo Box */}
              <div className="w-20 h-24 bg-white border border-slate-900 overflow-hidden flex items-center justify-center shrink-0">
                {photoUrl ? (
                  <img src={photoUrl} alt={student.fullName} className="w-full h-full object-cover" />
                ) : (
                  <div className="text-[10px] font-bold text-slate-400 text-center p-1">
                    <User className="w-6 h-6 mx-auto mb-1 opacity-40" />
                    PHOTO
                  </div>
                )}
              </div>

              {/* Identity Details */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] flex-1">
                <div>
                  <span className="font-bold text-slate-500 uppercase text-[9px] block">Candidate Name</span>
                  <span className="font-black text-slate-900 text-sm block leading-tight">{student.fullName}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-500 uppercase text-[9px] block">Father / Guardian Name</span>
                  <span className="font-bold text-slate-800 block">{student.fatherName}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-500 uppercase text-[9px] block">CNIC / B-Form</span>
                  <span className="font-mono font-bold text-slate-800">{student.cnicOrBForm}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-500 uppercase text-[9px] block">Class / Category</span>
                  <span className="font-bold text-slate-800">{student.currentClass}</span>
                </div>
                <div className="col-span-2 pt-1 border-t border-slate-200">
                  <span className="font-bold text-slate-500 uppercase text-[9px] block">
                    Assigned Center, Hall & Seat
                  </span>
                  <span className="text-slate-800 text-[10px]">
                    <strong>{testCenter}</strong> | Hall: {hall} | Room: {room} | Seat: <strong className="text-blue-900">{seat}</strong>
                  </span>
                </div>
              </div>

              {/* Roll Number Box & QR */}
              <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto shrink-0 pl-2 sm:border-l border-slate-200">
                <div className="text-left sm:text-right">
                  <span className="text-[9px] font-black uppercase text-slate-500 block">
                    {isProvisional ? 'Provisional Roll' : 'Roll Number'}
                  </span>
                  <span className="font-mono font-black text-base sm:text-lg text-blue-950 block">
                    {displayRoll}
                  </span>
                  <span className="text-[9px] text-slate-400 font-mono block">App #{student.applicationNo}</span>
                </div>
                {qrDataUrl && (
                  <div className="mt-1 shrink-0">
                    <img src={qrDataUrl} alt="Candidate QR" className="w-16 h-16 border border-slate-300 p-0.5 bg-white" />
                  </div>
                )}
              </div>
            </div>

            {/* Instructions Bar */}
            <div className="border border-slate-300 bg-slate-100/80 p-2 mb-3 text-[9px] text-slate-700 leading-tight">
              <div className="flex items-center justify-between font-bold text-slate-900 uppercase mb-1">
                <span>Instructions for Candidate:</span>
                <span className="text-[8px] text-slate-500 lowercase">use blue/black ballpoint only</span>
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div className="flex-1 space-y-0.5">
                  <div>1. Fill one bubble completely for each question: [A] [B] [C] [D].</div>
                  <div>2. Erasing, white-fluid, crossing (✕), or multiple marks will score 0 marks.</div>
                  <div>3. Do NOT fold, staple, tear, or write outside designated areas.</div>
                </div>
                <div className="flex items-center gap-2 border-l border-slate-300 pl-3 shrink-0">
                  <div className="text-center">
                    <span className="w-4 h-4 rounded-full bg-slate-900 text-white flex items-center justify-center text-[8px] font-bold mx-auto mb-0.5">
                      ✓
                    </span>
                    <span className="text-[8px] text-emerald-800 font-bold">Correct</span>
                  </div>
                  <div className="text-center">
                    <span className="w-4 h-4 rounded-full border border-slate-800 text-slate-800 flex items-center justify-center text-[8px] font-bold mx-auto mb-0.5">
                      ✕
                    </span>
                    <span className="text-[8px] text-rose-800 font-bold">Wrong</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 100 Questions Grid (4 Columns x 25 Rows) */}
            <div className="border-2 border-slate-900 rounded-sm p-2 mb-3 bg-white">
              <div className="grid grid-cols-4 gap-2 text-center text-[9px] font-black uppercase border-b-2 border-slate-900 pb-1 mb-1 text-slate-900 bg-slate-50">
                <div>Q 01 – 25</div>
                <div>Q 26 – 50</div>
                <div>Q 51 – 75</div>
                <div>Q 76 – 100</div>
              </div>

              <div className="grid grid-cols-4 gap-2">
                <div className="border-r border-slate-300 pr-1">{renderQuestionColumn(1, 25)}</div>
                <div className="border-r border-slate-300 pr-1">{renderQuestionColumn(26, 25)}</div>
                <div className="border-r border-slate-300 pr-1">{renderQuestionColumn(51, 25)}</div>
                <div>{renderQuestionColumn(76, 25)}</div>
              </div>
            </div>

            {/* Signatures & Security Verification Box */}
            <div className="border border-slate-900 p-2.5 grid grid-cols-3 gap-4 text-center text-[9px]">
              <div className="border-b border-slate-400 pb-1 mt-6">
                <span className="font-bold text-slate-700 uppercase">Candidate Signature & Thumb</span>
              </div>
              <div className="border-b border-slate-400 pb-1 mt-6">
                <span className="font-bold text-slate-700 uppercase">Invigilator Signature & Stamp</span>
              </div>
              <div className="border-b border-slate-400 pb-1 mt-6">
                <span className="font-bold text-slate-700 uppercase">Center Superintendent Stamp</span>
              </div>
            </div>

            {/* Timing Marks along the bottom */}
            <div className="mt-2 flex items-center justify-between px-1">
              <span className="text-[8px] font-mono text-slate-400">FORM OMR-100-AZM-2026</span>
              <div className="flex gap-1.5">
                {Array.from({ length: 18 }).map((_, idx) => (
                  <span key={idx} className="w-2.5 h-1 bg-black inline-block" />
                ))}
              </div>
              <span className="text-[8px] font-mono text-slate-400">SESSION-V-REG</span>
            </div>
          </div>
        </div>

        {/* Bottom Footer (Screen Only) */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200 bg-white print:hidden">
          <div className="text-xs text-slate-500 font-medium">
            Candidate #{student.applicationNo} • OMR 100-Questions Template
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
              className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print OMR Sheet</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
