import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Download,
  QrCode,
  FileText,
  User,
  BookOpen,
  Award,
  FileCheck,
  Eye,
  Check,
  X,
  Printer,
  Trash2,
  AlertTriangle,
  MapPin,
  Building2,
  Save,
  CheckCircle2,
  Ticket,
  Loader2,
} from 'lucide-react';
import {
  MockStudent,
  MockStudentDocument,
  MockTestCenter,
  mockApi,
  printStudentDossier,
} from '../../../lib/mockApi';
import { StatusBadge } from '../shared/StatusBadge';
import { StudentDossierModal } from '../../common/StudentDossierModal';
import { useAuth } from '../../../lib/authContext';
import { API_BASE_URL } from '../../../lib/apiClient';

interface StudentDetailViewProps {
  student: MockStudent;
  onBack: () => void;
}

export const StudentDetailView: React.FC<StudentDetailViewProps> = ({ student, onBack }) => {
  const { role } = useAuth();
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDownloadingSlip, setIsDownloadingSlip] = useState(false);
  const [isDossierOpen, setIsDossierOpen] = useState(false);
  const [documents, setDocuments] = useState<MockStudentDocument[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<MockStudentDocument | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Test Center & Hall Allocation State
  const [testCenters, setTestCenters] = useState<MockTestCenter[]>([]);
  const [assignedCenter, setAssignedCenter] = useState<string>(
    student.testCenterName || student.officeUse?.testCentre || 'Main Campus Examination Center, Mansehra'
  );
  const [assignedHall, setAssignedHall] = useState<string>(
    student.assignedHall || 'Hall E (Matric SSC-II Main Examination Hall)'
  );
  const [assignedRoom, setAssignedRoom] = useState<string>(student.assignedRoom || 'Hall 301-E');
  const [seatNo, setSeatNo] = useState<string>(student.seatNo || 'Seat #01');
  const [isSavingAllocation, setIsSavingAllocation] = useState<boolean>(false);
  const [allocationSuccess, setAllocationSuccess] = useState<boolean>(false);

  useEffect(() => {
    loadDocuments();
    loadCenters();
  }, [student.id, student.applicationNo]);

  const loadCenters = async () => {
    try {
      const data = await mockApi.getTestCenters();
      setTestCenters(data);
    } catch (e) {}
  };

  const loadDocuments = async () => {
    try {
      const docs = await mockApi.getStudentDocuments(student.id || student.applicationNo || student.cnicOrBForm);
      setDocuments(docs || []);
    } catch (e) {
      console.warn('Failed to load documents:', e);
      setDocuments([]);
    }
  };

  const handleDownloadPdf = async () => {
    setIsDownloading(true);
    try {
      await mockApi.downloadStudentPdf(student.id, student.rollNumber);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadSlipPdf = async () => {
    if (!student.rollNumber) {
      alert('Roll number has not been issued yet for this candidate. Candidate must have a verified fee payment before roll number issuance.');
      return;
    }
    setIsDownloadingSlip(true);
    try {
      await mockApi.downloadRollSlipPdf(student.id, student.rollNumber);
    } catch (err: any) {
      alert(err?.message || 'Failed to download roll number slip PDF.');
    } finally {
      setIsDownloadingSlip(false);
    }
  };

  const handleUpdateStatus = async (docId: string, status: 'VERIFIED' | 'REJECTED') => {
    await mockApi.updateDocumentStatus(docId, status, undefined, student.id);
    loadDocuments();
    if (selectedDoc && selectedDoc.id === docId) {
      setSelectedDoc((prev) => (prev ? { ...prev, status } : null));
    }
  };

  const handleDeleteCandidate = async () => {
    setIsDeleting(true);
    try {
      await mockApi.deleteStudent(student.id);
      setShowDeleteModal(false);
      onBack();
    } catch (err: any) {
      alert(err.message || 'Failed to delete student.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveAllocation = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingAllocation(true);
    try {
      const selectedCenterObj = testCenters.find((tc) => tc.name === assignedCenter);
      const updated = await mockApi.updateStudentAllocation(student.id, {
        testCenterId: selectedCenterObj?.id,
        testCenterName: assignedCenter,
        assignedHall,
        assignedRoom,
        seatNo,
      });
      if (updated) {
        student.testCenterName = assignedCenter;
        student.assignedHall = assignedHall;
        student.assignedRoom = assignedRoom;
        student.seatNo = seatNo;
      }
      setAllocationSuccess(true);
      setTimeout(() => setAllocationSuccess(false), 3500);
      alert(`Exam Center & Hall seating allocation successfully assigned to ${student.fullName}!`);
    } catch (err: any) {
      alert(err.message || 'Failed to update center allocation.');
    } finally {
      setIsSavingAllocation(false);
    }
  };


  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/70 px-3.5 py-2 rounded-xl transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Students List</span>
        </button>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-end">
          {student.feeStatus !== 'PAID' && (
            <button
              onClick={async () => {
                if (confirm(`Approve PKR 300 fee payment and verify registration for ${student.fullName}?`)) {
                  try {
                    setStudent((prev: any) => ({ ...prev, feeStatus: 'PAID' }));
                    await mockApi.approveStudentPayment(student.id, student);
                    alert(`Fee payment verified for ${student.fullName}. Candidate registration confirmed in database!`);
                    fetchStudentData();
                  } catch (err: any) {
                    alert(err.message || 'Failed to approve payment');
                  }
                }
              }}
              className="px-3.5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md shadow-emerald-600/20 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Approve Fee (PKR 300)</span>
            </button>
          )}

          <button
            onClick={() => setIsDossierOpen(true)}
            className="px-3.5 py-2 text-xs font-bold bg-blue-50 border border-blue-200 text-[#185b9d] hover:bg-blue-100 rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <FileText className="w-4 h-4" />
            <span>Full Profile Dossier</span>
          </button>


          <button
            onClick={() => printStudentDossier(student)}
            className="px-3.5 py-2 text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span>Print Dossier (A4)</span>
          </button>

          <button
            onClick={handleDownloadPdf}
            disabled={isDownloading}
            className="px-4 py-2 text-xs font-bold bg-[#185b9d] hover:bg-[#13497d] text-white rounded-xl shadow-md transition flex items-center gap-2 disabled:opacity-60 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>{isDownloading ? 'Generating PDF...' : 'Download Registration PDF'}</span>
          </button>

          <button
            onClick={handleDownloadSlipPdf}
            disabled={!student.rollNumber || isDownloadingSlip}
            title={
              !student.rollNumber
                ? 'Roll number not issued yet (Fee payment pending verification or batch release)'
                : 'Download Official Examination Entry Pass & Roll Number Slip'
            }
            className={`px-4 py-2 text-xs font-bold rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer ${
              !student.rollNumber
                ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
          >
            {isDownloadingSlip ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : (
              <Ticket className="w-4 h-4 text-white" />
            )}
            <span>{isDownloadingSlip ? 'Generating Slip...' : 'Download Roll No Slip'}</span>
          </button>

          {role === 'SUPER_ADMIN' && (
            <button
              onClick={() => setShowDeleteModal(true)}
              className="px-3.5 py-2 text-xs font-bold bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Trash2 className="w-4 h-4 text-rose-600" />
              <span>Delete Candidate</span>
            </button>
          )}
        </div>
      </div>


      {/* Header Profile Card with Biometric QR */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center md:items-start justify-between gap-6">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-left">
          <img
            src={
              student.uploadedDocuments?.photo?.dataUrl ||
              (student.photoUrl && !student.photoUrl.includes('supabase.co/storage') ? student.photoUrl : null) ||
              `${API_BASE_URL}/api/students/${student.applicationNo || student.id}/document/photo`
            }
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = `data:image/svg+xml;utf8,${encodeURIComponent(
                `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
                  <rect width="200" height="200" fill="#e2e8f0"/>
                  <circle cx="100" cy="80" r="40" fill="#94a3b8"/>
                  <path d="M30 180 C30 130, 170 130, 170 180 Z" fill="#64748b"/>
                </svg>`
              )}`;
            }}
            alt={student.fullName}
            className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover border-2 border-slate-200 shadow-sm"
          />
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h2 className="text-2xl font-black text-slate-900">{student.fullName}</h2>
              <StatusBadge status={student.status} />
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${
                  student.feeStatus === 'PAID'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {student.feeStatus === 'PAID'
                  ? student.rollNumber
                    ? 'Fee Verified & Roll No Issued'
                    : 'Payment Confirmed — Roll Number Pending Release'
                  : 'Pending Fee Verification'}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              S/D of <strong className="text-slate-700">{student.fatherName}</strong> • {student.currentClass}
            </p>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 pt-1 text-xs text-slate-600 font-mono">
              <span className="bg-slate-100 px-2.5 py-1 rounded-lg">App: {student.applicationNo || student.id}</span>
              <span className="bg-blue-50 text-[#185b9d] font-bold px-2.5 py-1 rounded-lg">
                Roll: {student.rollNumber || (student.feeStatus === 'PAID' ? 'PENDING BATCH RELEASE' : 'PENDING FEE')}
              </span>
              <span className="bg-slate-100 px-2.5 py-1 rounded-lg">CNIC: {student.cnicOrBForm || 'N/A'}</span>
            </div>
          </div>
        </div>

        {/* Biometric QR Token Card */}
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 flex flex-col items-center gap-2 text-center min-w-[160px]">
          <div className="p-2 bg-white rounded-xl shadow-2xs border border-slate-200">
            {student.qrImageUrl ? (
              <img src={student.qrImageUrl} alt="QR Matrix" className="w-24 h-24 object-contain" />
            ) : (
              <QrCode className="w-24 h-24 text-slate-800" />
            )}
          </div>
          <span className="text-[10px] font-mono font-bold text-slate-500 max-w-[150px] truncate">
            {student.rollNumber || student.qrToken || student.id}
          </span>
          <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider bg-emerald-50 px-2 py-0.5 rounded-md">
            Biometric Valid
          </span>
        </div>
      </div>

      {/* Grid: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Personal, Contact & Academic */}
        <div className="space-y-6">
          {/* Card 1: Personal & Contact */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
              <User className="w-4 h-4 text-[#185b9d]" />
              <h3 className="text-sm font-bold text-slate-900">Parts A & B: Personal & Contact Information</h3>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">Date of Birth</span>
                <span className="font-semibold text-slate-800">{student.dateOfBirth} (Age: {student.age || 16})</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Gender & Religion</span>
                <span className="font-semibold text-slate-800">{student.gender} • {student.religion || 'Islam'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Father / Parent Mobile</span>
                <span className="font-semibold text-slate-800 font-mono">{student.parentMobile}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Student Mobile / WhatsApp</span>
                <span className="font-semibold text-slate-800 font-mono">{student.studentMobile || student.whatsapp || 'N/A'}</span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-400 block text-[11px]">Permanent Address</span>
                <span className="font-semibold text-slate-800">{student.address}, {student.district}, {student.province}</span>
              </div>
            </div>
          </div>

          {/* Card 2: Academic Record Details */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
              <BookOpen className="w-4 h-4 text-[#185b9d]" />
              <h3 className="text-sm font-bold text-slate-900">Part C: Academic Examination Record</h3>
            </div>

            <div className="space-y-3">
              {student.academicRecords && student.academicRecords.length > 0 ? (
                <div className="border border-slate-100 rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                      <tr>
                        <th className="p-3">Examination Level</th>
                        <th className="p-3">Board / Institute</th>
                        <th className="p-3">Year</th>
                        <th className="p-3 text-right">Marks / %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {student.academicRecords.map((rec, i) => (
                        <tr key={i} className="hover:bg-slate-50/50">
                          <td className="p-3 font-semibold text-slate-800">{rec.examLevel}</td>
                          <td className="p-3 text-slate-600">{rec.boardOrUni || '-'}</td>
                          <td className="p-3 font-mono text-slate-500">{rec.yearOfPassing || '-'}</td>
                          <td className="p-3 text-right font-mono font-bold text-emerald-700">
                            {rec.obtainedMarks}/{rec.totalMarks} ({rec.percentage}%)
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-500 text-center">
                  Enrolled Class: <strong className="text-slate-700">{student.currentClass}</strong> • School:{' '}
                  <strong className="text-slate-700">{student.schoolName}</strong>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Scholarship, Documents, & Inspection */}
        <div className="space-y-6">
          {/* Card 3: Scholarship Category */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
              <Award className="w-4 h-4 text-[#185b9d]" />
              <h3 className="text-sm font-bold text-slate-900">Parts D & E: Scholarship Category & Household</h3>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">Applied Category</span>
                <span className="font-bold text-[#185b9d]">{student.scholarshipCategory}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Guardian Occupation</span>
                <span className="font-semibold text-slate-800">{student.guardianOccupation || 'Self-Employed / Business'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Monthly Household Income</span>
                <span className="font-semibold text-slate-800 font-mono">
                  PKR {Number(student.guardianMonthlyIncome || 75000).toLocaleString()}/month
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Emergency Contact Person</span>
                <span className="font-semibold text-slate-800">
                  {student.emergencyContact} ({student.emergencyRelation || 'Father'})
                </span>
              </div>
            </div>
          </div>

          {/* Card 3.5: Exam Test Center & Room Allocation */}
          <div className="bg-white rounded-3xl p-6 border border-blue-200/80 shadow-sm space-y-4 relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#185b9d] flex items-center justify-center font-bold">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Exam Test Center &amp; Hall Allocation</h3>
                  <p className="text-[11px] text-slate-500">Assign candidate to examination center, hall, and room/desk.</p>
                </div>
              </div>
              {allocationSuccess && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 animate-fade-in">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Saved
                </span>
              )}
            </div>

            <form onSubmit={handleSaveAllocation} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-700">
                  Assigned Test Center
                </label>
                <div className="relative">
                  <select
                    value={assignedCenter}
                    onChange={(e) => setAssignedCenter(e.target.value)}
                    className="w-full pl-3 pr-8 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-[#185b9d] outline-none transition"
                  >
                    {testCenters.length > 0 ? (
                      testCenters.map((tc) => (
                        <option key={tc.id} value={tc.name}>
                          {tc.name} ({tc.district})
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="Main Campus Examination Center, Mansehra">
                          Main Campus Examination Center, Mansehra
                        </option>
                        <option value="Govt Post Graduate College, Abbottabad">
                          Govt Post Graduate College, Abbottabad
                        </option>
                        <option value="Haripur Public School &amp; College">
                          Haripur Public School &amp; College
                        </option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-700">
                    Assigned Hall / Class
                  </label>
                  <select
                    value={assignedHall}
                    onChange={(e) => {
                      setAssignedHall(e.target.value);
                      if (e.target.value.includes('101')) setAssignedRoom('Room 101-A');
                      else if (e.target.value.includes('102')) setAssignedRoom('Room 102-B');
                      else if (e.target.value.includes('201')) setAssignedRoom('Room 201-C');
                      else if (e.target.value.includes('202')) setAssignedRoom('Room 202-D');
                      else if (e.target.value.includes('301')) setAssignedRoom('Hall 301-E');
                      else if (e.target.value.includes('Auditorium')) setAssignedRoom('Auditorium Hall');
                    }}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-[#185b9d] outline-none transition"
                  >
                    <option value="Hall A (Junior Examination Wing)">Hall A (Room 101-A - Class 6th)</option>
                    <option value="Hall B (Middle Standard Wing)">Hall B (Room 102-B - Class 7th)</option>
                    <option value="Hall C (Middle Assessment Hall)">Hall C (Room 201-C - Class 8th)</option>
                    <option value="Hall D (Matric SSC-I Hall)">Hall D (Room 202-D - Class 9th)</option>
                    <option value="Hall E (Matric SSC-II Main Examination Hall)">Hall E (Hall 301-E - Class 10th)</option>
                    <option value="Hall F (Intermediate / College Wing)">Hall F (Auditorium - 1st/2nd Year)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-700">
                    Room Number / Room Tag
                  </label>
                  <input
                    type="text"
                    value={assignedRoom}
                    onChange={(e) => setAssignedRoom(e.target.value)}
                    placeholder="e.g. Room 101-A / Hall 301"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-[#185b9d] outline-none transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-700">
                    Assigned Desk / Seat Number
                  </label>
                  <input
                    type="text"
                    value={seatNo}
                    onChange={(e) => setSeatNo(e.target.value)}
                    placeholder="e.g. Seat #14 / Desk A-02"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white text-xs font-mono font-bold text-[#185b9d] focus:ring-2 focus:ring-blue-500/20 focus:border-[#185b9d] outline-none transition"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSavingAllocation}
                  className="w-full py-2.5 px-4 bg-[#185b9d] hover:bg-[#13487c] text-white rounded-xl font-bold text-xs shadow-md shadow-blue-900/10 transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSavingAllocation ? 'Saving Allocation...' : 'Save Center & Hall'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Card 4: Submitted Candidate Documents & Storage */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <FileCheck className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">Submitted Candidate Documents & Storage</h3>
              </div>
              <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                {documents.length} Attachments
              </span>
            </div>

            {documents.length === 0 ? (
              <div className="p-8 text-center bg-slate-50/80 rounded-2xl border border-dashed border-slate-200 space-y-1.5">
                <FileCheck className="w-7 h-7 text-slate-300 mx-auto" />
                <p className="text-xs font-bold text-slate-600">No Attached Documents</p>
                <p className="text-[11px] text-slate-400">
                  Candidate did not upload additional physical documents during registration.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {documents.map((doc) => {
                const isPdf =
                  doc.fileType === 'application/pdf' ||
                  doc.title.toLowerCase().endsWith('.pdf') ||
                  doc.fileUrl.startsWith('data:application/pdf');

                return (
                  <div
                    key={doc.id}
                    className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/70 hover:bg-white hover:border-blue-200 transition-all flex flex-col justify-between gap-3 shadow-2xs"
                  >
                    <div className="flex items-start gap-3">
                      {/* Document Preview Thumbnail */}
                      <div
                        onClick={() => setSelectedDoc(doc)}
                        className="w-12 h-14 rounded-xl overflow-hidden bg-white border border-slate-200 shadow-2xs flex-shrink-0 cursor-pointer flex items-center justify-center relative group"
                      >
                        {isPdf ? (
                          <div className="flex flex-col items-center justify-center text-[10px] font-black text-rose-600">
                            <FileText className="w-5 h-5 text-rose-500 mb-0.5" />
                            <span>PDF</span>
                          </div>
                        ) : (
                          <img
                            src={doc.fileUrl}
                            alt={doc.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition"
                          />
                        )}
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                          <Eye className="w-4 h-4 text-white" />
                        </div>
                      </div>

                      <div className="min-w-0 flex-1">
                        <h4
                          onClick={() => setSelectedDoc(doc)}
                          className="font-bold text-xs text-slate-900 truncate hover:text-[#185b9d] cursor-pointer"
                          title={doc.title}
                        >
                          {doc.title}
                        </h4>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                          {doc.fileSize} • {isPdf ? 'PDF Document' : 'Scanned Image'}
                        </p>
                        <span
                          className={`inline-block mt-1 px-2 py-0.5 rounded text-[9px] font-extrabold ${
                            doc.status === 'VERIFIED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : doc.status === 'REJECTED'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {doc.status}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <button
                        onClick={() => setSelectedDoc(doc)}
                        className="px-2.5 py-1 text-[11px] font-bold text-[#185b9d] bg-white border border-blue-200 hover:bg-blue-50 rounded-lg shadow-2xs cursor-pointer flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Inspect</span>
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleUpdateStatus(doc.id, 'VERIFIED')}
                          title="Verify Document"
                          className="p-1 rounded-lg text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 cursor-pointer"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(doc.id, 'REJECTED')}
                          title="Reject Document"
                          className="p-1 rounded-lg text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lightbox Preview Modal for Real Submitted Documents */}
      {selectedDoc && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-100">{selectedDoc.title}</h3>
                <p className="text-[11px] text-slate-400">
                  {student.fullName} ({student.rollNumber || student.applicationNo}) • {selectedDoc.fileSize}
                </p>
              </div>
              <button
                onClick={() => setSelectedDoc(null)}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 bg-slate-100 flex items-center justify-center min-h-[350px] overflow-auto">
              {selectedDoc.fileType === 'application/pdf' ||
              selectedDoc.title.toLowerCase().endsWith('.pdf') ||
              selectedDoc.fileUrl.startsWith('data:application/pdf') ? (
                <div className="w-full h-[480px] bg-white rounded-2xl p-4 shadow-md flex flex-col items-center justify-center border border-slate-300">
                  <FileText className="w-16 h-16 text-rose-500 mb-3" />
                  <h4 className="text-sm font-bold text-slate-900">{selectedDoc.title}</h4>
                  <p className="text-xs text-slate-500 mb-4">Official Candidate PDF Attachment</p>
                  <a
                    href={selectedDoc.fileUrl}
                    download={selectedDoc.title}
                    target="_blank"
                    rel="noreferrer"
                    className="px-5 py-2.5 rounded-xl bg-[#185b9d] text-white font-bold text-xs shadow-md hover:bg-[#13497d] transition flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download / Open PDF Document</span>
                  </a>
                </div>
              ) : (
                <img
                  src={selectedDoc.fileUrl}
                  alt={selectedDoc.title}
                  className="max-h-[500px] w-auto max-w-full object-contain rounded-xl shadow-md border border-slate-300 bg-white"
                />
              )}
            </div>

            <div className="px-6 py-4 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500">Document Status:</span>
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-extrabold ${
                    selectedDoc.status === 'VERIFIED'
                      ? 'bg-emerald-100 text-emerald-800'
                      : selectedDoc.status === 'REJECTED'
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {selectedDoc.status}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={selectedDoc.fileUrl}
                  download={selectedDoc.title}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download File</span>
                </a>
                <button
                  onClick={() => setSelectedDoc(null)}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full Candidate Application Dossier Modal */}
      <StudentDossierModal
        isOpen={isDossierOpen}
        onClose={() => setIsDossierOpen(false)}
        student={student}
      />

      {/* Super Admin Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 border border-slate-200 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-base font-black text-slate-900">
                Permanently Delete Candidate?
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                You are about to permanently delete <strong className="text-slate-800">{student.fullName}</strong> (
                <span className="font-mono text-slate-700">{student.applicationNo || student.id}</span>). This will purge all candidate registration details, fees, and uploaded document attachments.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-100 text-[11px] text-rose-800 font-semibold text-center">
              ⚠️ This action is restricted to Super Admin and cannot be undone.
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteCandidate}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isDeleting ? 'Deleting...' : 'Delete Candidate'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

