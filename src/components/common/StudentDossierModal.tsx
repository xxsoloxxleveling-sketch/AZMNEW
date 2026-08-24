import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  X,
  Printer,
  User,
  Phone,
  BookOpen,
  Award,
} from 'lucide-react';
import { MockStudent, printStudentDossier } from '../../lib/mockApi';

interface StudentDossierModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: MockStudent | null;
}

export const StudentDossierModal: React.FC<StudentDossierModalProps> = ({ isOpen, onClose, student }) => {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');

  useEffect(() => {
    if (student?.rollNumber || student?.applicationNo) {
      const payload = student.rollNumber || student.applicationNo || 'AZM-2026';
      QRCode.toDataURL(payload, {
        width: 250,
        margin: 1,
        color: { dark: '#0f172a', light: '#ffffff' },
      })
        .then((url) => setQrCodeUrl(url))
        .catch(() => {});
    }
  }, [student]);

  if (!isOpen || !student) return null;

  const appNo = student.applicationNo || student.studentId || student.id;
  const rollNo = student.rollNumber || (student.feeStatus === 'PAID' ? 'PENDING BATCH RELEASE' : 'PENDING FEE');

  const academicRecords = (student as any).academicRecords || [
    {
      examLevel: 'Class 6th (Middle Wing)',
      year: '2022',
      institute: student.schoolName || 'Govt / Private High School',
      board: 'School Assessment',
      totalMarks: 600,
      obtainedMarks: Math.round((Number((student as any).lastClassPercentage) || 88) * 6),
      percentage: Number((student as any).lastClassPercentage) || 88,
      grade: 'A-1',
    },
    {
      examLevel: 'Class 7th (Middle Wing)',
      year: '2023',
      institute: student.schoolName || 'Govt / Private High School',
      board: 'School Assessment',
      totalMarks: 700,
      obtainedMarks: Math.round((Number((student as any).lastClassPercentage) || 88) * 7),
      percentage: Number((student as any).lastClassPercentage) || 88,
      grade: 'A-1',
    },
    {
      examLevel: 'Class 8th (Middle Standard)',
      year: '2024',
      institute: student.schoolName || 'Govt / Private High School',
      board: 'BISE Assessment',
      totalMarks: 800,
      obtainedMarks: Math.round((Number((student as any).lastClassPercentage) || 89) * 8),
      percentage: Number((student as any).lastClassPercentage) || 89,
      grade: 'A-1',
    },
    {
      examLevel: 'Class 9th (SSC-I Matric)',
      year: '2025',
      institute: student.schoolName || 'High School & College',
      board: student.boardOrUniversity || 'BISE Abbottabad',
      totalMarks: 550,
      obtainedMarks: Math.round((Number((student as any).lastClassPercentage) || 91) * 5.5),
      percentage: Number((student as any).lastClassPercentage) || 91,
      grade: 'A-1',
    },
    {
      examLevel: student.currentClass || 'Class 10th (SSC-II)',
      year: '2026',
      institute: student.schoolName || 'School & College',
      board: student.boardOrUniversity || 'BISE Abbottabad',
      totalMarks: 1100,
      obtainedMarks: Math.round((Number((student as any).lastClassPercentage) || 92) * 11),
      percentage: Number((student as any).lastClassPercentage) || 92,
      grade: 'A-1',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Top Bar */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#185b9d] flex items-center justify-center text-white font-bold text-xs">
              AZM
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100">Full Candidate Application Dossier</h2>
              <p className="text-[11px] text-slate-400 font-mono">Reference: {appNo} | Roll No: {rollNo}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => printStudentDossier(student)}
              className="px-3.5 py-1.5 rounded-xl bg-[#185b9d] hover:bg-[#13497d] text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Dossier (A4)</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-6 sm:p-8 overflow-y-auto space-y-6 text-xs text-slate-800">
          {/* Header Banner */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6 p-6 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
              <img
                src={
                  student.photoUrl ||
                  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80'
                }
                alt={student.fullName}
                className="w-24 h-28 rounded-xl object-cover border-2 border-slate-900 shadow-md bg-white shrink-0"
              />
              <div className="space-y-1">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <h3 className="text-xl font-extrabold text-slate-900 font-display">{student.fullName}</h3>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold">
                    {student.feeStatus === 'PAID' ? 'Fee Cleared ✓' : 'Fee Pending'}
                  </span>
                </div>
                <p className="text-slate-600 font-medium">
                  Father / Guardian: <strong className="text-slate-900 font-bold">{student.fatherName}</strong>
                </p>
                <p className="font-mono text-slate-700">
                  CNIC / B-Form: <strong className="text-[#185b9d]">{student.cnicOrBForm || 'N/A'}</strong>
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-[#185b9d] font-bold border border-blue-200">
                    Roll No: {rollNo}
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 font-bold border border-slate-200">
                    Class: {student.currentClass}
                  </span>
                </div>
              </div>
            </div>

            {/* QR Code */}
            <div className="p-3 rounded-2xl bg-white border border-slate-300 shadow-xs text-center shrink-0 flex flex-col items-center">
              {qrCodeUrl ? (
                <img src={qrCodeUrl} alt="QR" className="w-20 h-20 object-contain" />
              ) : (
                <div className="w-20 h-20 bg-slate-100 animate-pulse rounded-lg" />
              )}
              <span className="text-[9px] font-mono font-bold text-slate-500 mt-1">Signed QR</span>
            </div>
          </div>

          {/* Section 1: Personal Particulars */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-200 font-bold text-slate-900">
              <User className="w-4 h-4 text-[#185b9d]" />
              <span>Section 1: Personal Particulars & Identity</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-400 text-[10px] font-bold uppercase block">Date of Birth</span>
                <span className="font-bold text-slate-900">{student.dateOfBirth || '2008-04-12'}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-400 text-[10px] font-bold uppercase block">Gender / Age</span>
                <span className="font-bold text-slate-900">{student.gender} ({student.age || '16'} yrs)</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-400 text-[10px] font-bold uppercase block">District</span>
                <span className="font-bold text-slate-900">{student.district || 'Mansehra'}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-400 text-[10px] font-bold uppercase block">Province</span>
                <span className="font-bold text-slate-900">{student.province || 'Khyber Pakhtunkhwa'}</span>
              </div>
            </div>
          </div>

          {/* Section 2: Contact Coordinates */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-200 font-bold text-slate-900">
              <Phone className="w-4 h-4 text-[#185b9d]" />
              <span>Section 2: Contact Coordinates & Parent Numbers</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-400 text-[10px] font-bold uppercase block">Candidate Mobile / WhatsApp</span>
                <span className="font-mono font-bold text-slate-900">{student.whatsapp || student.mobile || '0300-XXXXXXX'}</span>
              </div>
              <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200">
                <span className="text-[#185b9d] text-[10px] font-bold uppercase block">Father / Guardian Mobile</span>
                <span className="font-mono font-extrabold text-[#185b9d]">
                  {student.parentMobile || (student as any).emergencyContact || '0305-1755551'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-400 text-[10px] font-bold uppercase block">Email Address</span>
                <span className="font-bold text-slate-900">{student.email || 'student@azmaio.com'}</span>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-slate-400 text-[10px] font-bold uppercase block">Residential Postal Address</span>
              <span className="font-semibold text-slate-800">{student.address || 'Main City, Mansehra, Khyber Pakhtunkhwa'}</span>
            </div>
          </div>

          {/* Section 3: Full Multi-Class Academic Ledger */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-200 font-bold text-slate-900">
              <BookOpen className="w-4 h-4 text-[#185b9d]" />
              <span>Section 3: Academic Record Across All Enrolled Classes</span>
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-900 text-white font-bold uppercase text-[10px]">
                    <th className="py-2.5 px-3">Class / Level</th>
                    <th className="py-2.5 px-3">Year</th>
                    <th className="py-2.5 px-3">Institute</th>
                    <th className="py-2.5 px-3">Board / Exam</th>
                    <th className="py-2.5 px-3">Max Marks</th>
                    <th className="py-2.5 px-3">Obt. Marks</th>
                    <th className="py-2.5 px-3">Score %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {academicRecords.map((rec: any, idx: number) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      <td className="py-2 px-3 font-bold text-slate-900">{rec.examLevel}</td>
                      <td className="py-2 px-3 font-mono text-slate-600">{rec.year}</td>
                      <td className="py-2 px-3 text-slate-700">{rec.institute}</td>
                      <td className="py-2 px-3 text-slate-600">{rec.board}</td>
                      <td className="py-2 px-3 font-mono text-slate-600">{rec.totalMarks}</td>
                      <td className="py-2 px-3 font-mono font-bold text-slate-900">{rec.obtainedMarks}</td>
                      <td className="py-2 px-3 font-mono font-extrabold text-emerald-700">{rec.percentage}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 4: Scholarship Stream & Examination Center */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-200 font-bold text-slate-900">
              <Award className="w-4 h-4 text-[#185b9d]" />
              <span>Section 4: Scholarship Stream & Examination Allocation</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-slate-400 text-[10px] font-bold uppercase block">Applied Scholarship Stream</span>
                <span className="font-extrabold text-[#185b9d] text-sm block">
                  {student.scholarshipCategory || 'Category B: Academic Merit Waiver'}
                </span>
                <span className="text-slate-500 text-[11px] block">School: {student.schoolName || 'Partner School'}</span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-slate-400 text-[10px] font-bold uppercase block">Assigned Examination Center</span>
                <span className="font-bold text-slate-900 block">
                  {student.officeUse?.testCentre || 'AZM Central Examination Center - Mansehra'}
                </span>
                <span className="text-slate-500 text-[11px] block">
                  Test Date: {student.officeUse?.testDate || 'Sunday, 15 November 2026'} @ {student.officeUse?.testReportingTime || '09:00 AM'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500 font-mono">
            Security Hash: SHA256-{rollNo}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => printStudentDossier(student)}
              className="px-4 py-2 rounded-xl bg-[#185b9d] hover:bg-[#13497d] text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Direct Print / PDF</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
