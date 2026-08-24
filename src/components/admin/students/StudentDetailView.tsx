import React, { useState } from 'react';
import {
  ArrowLeft,
  Download,
  QrCode,
  CheckCircle2,
  XCircle,
  FileText,
  User,
  Phone,
  BookOpen,
  Award,
  ShieldCheck,
  Building,
  Printer,
} from 'lucide-react';
import { MockStudent, mockApi } from '../../../lib/mockApi';
import { StatusBadge } from '../shared/StatusBadge';

interface StudentDetailViewProps {
  student: MockStudent;
  onBack: () => void;
}

export const StudentDetailView: React.FC<StudentDetailViewProps> = ({ student, onBack }) => {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownloadPdf = async () => {
    setIsDownloading(true);
    try {
      await mockApi.downloadStudentPdf(student.id, student.rollNumber);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/70 px-3.5 py-2 rounded-xl transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Students List</span>
        </button>

        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
          <button
            onClick={() => window.print()}
            className="px-3.5 py-2 text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl transition flex items-center gap-1.5 shadow-xs"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span>Print View</span>
          </button>

          <button
            onClick={handleDownloadPdf}
            disabled={isDownloading}
            className="px-4 py-2 text-xs font-bold bg-[#185b9d] hover:bg-[#13497d] text-white rounded-xl shadow-md transition flex items-center gap-2 disabled:opacity-60"
          >
            <Download className="w-4 h-4" />
            <span>{isDownloading ? 'Generating PDF...' : 'Download Registration PDF'}</span>
          </button>
        </div>
      </div>

      {/* Header Profile Card with Biometric QR */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center md:items-start justify-between gap-6">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-left">
          <img
            src={
              student.photoUrl ||
              'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80'
            }
            alt={student.fullName}
            className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover border-2 border-white shadow-md ring-4 ring-slate-100"
          />
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                {student.fullName}
              </h2>
              <StatusBadge status={student.status} size="sm" />
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Father Name: <strong className="text-slate-800 font-semibold">{student.fatherName}</strong>
            </p>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 text-xs text-slate-600 pt-1">
              <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-[#185b9d] font-bold border border-blue-100">
                Roll No: {student.rollNumber}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-bold border border-slate-200">
                App No: {student.applicationNo}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-bold border border-emerald-100">
                {student.currentClass}
              </span>
            </div>
          </div>
        </div>

        {/* Biometric QR Card */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center shrink-0 flex flex-col items-center shadow-xs">
          <img
            src={
              student.qrImageUrl ||
              `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${student.rollNumber}`
            }
            alt="Student QR Token"
            className="w-28 h-28 rounded-xl bg-white p-1 border border-slate-200"
          />
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-2 flex items-center gap-1">
            <QrCode className="w-3 h-3 text-[#185b9d]" /> Signed Biometric QR
          </span>
        </div>
      </div>

      {/* Grid of Parts A to L */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Part A & B: Personal & Contact */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 text-slate-900 font-bold text-sm">
            <User className="w-4 h-4 text-[#185b9d]" />
            <h3>Parts A & B: Personal & Contact Details</h3>
          </div>

          <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-xs">
            <div>
              <span className="text-slate-400 block font-medium">CNIC / B-Form</span>
              <span className="font-bold text-slate-800">{student.cnicOrBForm}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Gender / Age</span>
              <span className="font-bold text-slate-800">
                {student.gender} ({student.age} years)
              </span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Date of Birth</span>
              <span className="font-bold text-slate-800">{student.dateOfBirth}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Nationality / Religion</span>
              <span className="font-bold text-slate-800">{student.nationality} / {student.religion}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Parent / Guardian Mobile</span>
              <span className="font-bold text-slate-800">{student.parentMobile}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Student Mobile / WhatsApp</span>
              <span className="font-bold text-slate-800">{student.studentMobile || student.whatsapp || 'N/A'}</span>
            </div>
            <div className="col-span-2">
              <span className="text-slate-400 block font-medium">Permanent Address</span>
              <span className="font-bold text-slate-800">
                {student.address}, {student.district}, {student.province}
              </span>
            </div>
          </div>
        </div>

        {/* Part C & D: Educational & Scholarship Category */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 text-slate-900 font-bold text-sm">
            <BookOpen className="w-4 h-4 text-[#185b9d]" />
            <h3>Parts C & D: Academic & Scholarship Category</h3>
          </div>

          <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-xs">
            <div>
              <span className="text-slate-400 block font-medium">Current Class</span>
              <span className="font-bold text-slate-800">{student.currentClass}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Group / Discipline</span>
              <span className="font-bold text-slate-800">{student.hsscGroup || 'General Science'}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">School / Institute</span>
              <span className="font-bold text-slate-800">{student.schoolName}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Board / University</span>
              <span className="font-bold text-slate-800">{student.boardOrUniversity}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Scholarship Applied</span>
              <span className="font-bold text-[#185b9d]">{student.scholarshipCategory.replace(/_/g, ' ')}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Referral Source (Part I)</span>
              <span className="font-bold text-slate-800">{student.referralSource || 'School Administration'}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Emergency Contact</span>
              <span className="font-bold text-slate-800">
                {student.emergencyContact} ({student.emergencyRelation})
              </span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Monthly Household Income</span>
              <span className="font-bold text-slate-800">
                PKR {student.guardianMonthlyIncome?.toLocaleString() || 'N/A'}
              </span>
            </div>
          </div>
        </div>

        {/* Part G: Academic Examination Records Table */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 text-slate-900 font-bold text-sm">
            <Award className="w-4 h-4 text-[#185b9d]" />
            <h3>Part G: Academic Examination Records</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                  <th className="py-2 px-3">Examination / Level</th>
                  <th className="py-2 px-3">Board / Institute</th>
                  <th className="py-2 px-3">Year</th>
                  <th className="py-2 px-3">Total</th>
                  <th className="py-2 px-3">Obtained</th>
                  <th className="py-2 px-3">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {student.academicRecords && student.academicRecords.length > 0 ? (
                  student.academicRecords.map((rec, idx) => (
                    <tr key={idx}>
                      <td className="py-2.5 px-3 font-semibold text-slate-800">{rec.examLevel}</td>
                      <td className="py-2.5 px-3 text-slate-600">{rec.boardOrUni || '-'}</td>
                      <td className="py-2.5 px-3 text-slate-600">{rec.yearOfPassing || '-'}</td>
                      <td className="py-2.5 px-3 text-slate-600">{rec.totalMarks || '-'}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">{rec.obtainedMarks || '-'}</td>
                      <td className="py-2.5 px-3 font-bold text-emerald-600">{rec.percentage ? `${rec.percentage}%` : '-'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-400">
                      No previous academic examination transcripts logged.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Part H: Document Checklist & Part L: Office Use Record */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 text-slate-900 font-bold text-sm">
            <ShieldCheck className="w-4 h-4 text-[#185b9d]" />
            <h3>Part H: Documents & Part L: Office Verification</h3>
          </div>

          <div className="space-y-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
              Verified Physical Credentials
            </span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-100">
                {student.documents?.bformCnicCopy ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-slate-400 shrink-0" />
                )}
                <span>Student CNIC / B-Form</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-100">
                {student.documents?.fatherCnicCopy ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-slate-400 shrink-0" />
                )}
                <span>Father / Guardian CNIC</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-100">
                {student.documents?.previousResultCard ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-slate-400 shrink-0" />
                )}
                <span>Previous Result Transcript</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-100">
                {student.documents?.domicileCertificate ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-slate-400 shrink-0" />
                )}
                <span>Domicile Certificate</span>
              </div>
            </div>

            {/* Part L Box */}
            <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200/80 space-y-2 mt-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[#185b9d]">Part L: Official Review & Allocation</span>
                <StatusBadge status={student.officeUse?.finalStatus || 'SHORTLISTED'} size="sm" />
              </div>
              <p className="text-xs text-slate-600">
                Verified By: <strong>{student.officeUse?.documentVerifiedBy || 'Senior Registrar'}</strong>
              </p>
              <p className="text-xs text-slate-600">
                Test Centre: <strong>{student.officeUse?.testCentre || 'Main Campus Examination Hall'}</strong>
              </p>
              {student.officeUse?.officeRemarks && (
                <p className="text-xs text-slate-700 bg-white p-2.5 rounded-lg border border-blue-100">
                  <em>"{student.officeUse.officeRemarks}"</em>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
