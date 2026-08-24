import React, { useState } from 'react';
import {
  School,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  Download,
  QrCode,
  FileCheck,
  User,
  Phone,
  BookOpen,
  Award,
  ShieldCheck,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { mockApi, MockStudent } from '../../../lib/mockApi';

interface PublicCandidateRegistrationWizardProps {
  onNavigateHome: () => void;
  onNavigateLogin: () => void;
}

export const PublicCandidateRegistrationWizard: React.FC<PublicCandidateRegistrationWizardProps> = ({
  onNavigateHome,
  onNavigateLogin,
}) => {
  const [currentStage, setCurrentStage] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registeredStudent, setRegisteredStudent] = useState<MockStudent | null>(null);

  const [formData, setFormData] = useState({
    // Stage 1: Personal
    fullName: '',
    fatherName: '',
    gender: 'MALE' as 'MALE' | 'FEMALE',
    dateOfBirth: '2009-08-14',
    age: 17,
    cnicOrBForm: '',
    nationality: 'Pakistani',
    religion: 'Islam',

    // Stage 2: Contact
    address: '',
    district: 'Abbottabad',
    province: 'Khyber Pakhtunkhwa',
    parentMobile: '',
    studentMobile: '',
    whatsapp: '',
    email: '',

    // Stage 3: Educational
    currentClass: 'SSC-II (Class 10th)',
    hsscGroup: 'Science / Pre-Medical',
    schoolName: '',
    boardOrUniversity: 'BISE Abbottabad',
    currentRollNo: '',

    // Stage 4: Scholarship
    scholarshipCategory: 'GENERAL_MERIT' as any,

    // Stage 5: Emergency & Family
    guardianOccupation: '',
    guardianMonthlyIncome: 75000,
    emergencyContact: '',
    emergencyRelation: 'Father',

    // Stage 6: Academic Records
    academicRecords: [
      {
        examLevel: 'SSC-I (Class 9th Board Exam)',
        boardOrUni: 'BISE Abbottabad',
        yearOfPassing: '2025',
        totalMarks: 550,
        obtainedMarks: 495,
        percentage: 90.0,
      },
    ],

    // Stage 7: Document Checklist
    documents: {
      bformCnicCopy: true,
      fatherCnicCopy: true,
      passportPhotos: true,
      previousResultCard: true,
      domicileCertificate: true,
      incomeCertificate: false,
    },

    // Stage 8: Referral & Declarations
    referralSource: 'School Principal & Social Media Campaign',
    agreedToApplicantDeclaration: true,
    agreedToParentDeclaration: true,
    signatureName: '',
  });

  const totalStages = 8;

  const stageTitles = [
    'Personal Information',
    'Contact & Address',
    'Educational Information',
    'Scholarship Category',
    'Family & Financials',
    'Academic Examination Record',
    'Document Checklist',
    'Declarations & Submission',
  ];

  const handleNext = () => {
    if (currentStage < totalStages) {
      setCurrentStage((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrev = () => {
    if (currentStage > 1) {
      setCurrentStage((prev) => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const student = await mockApi.createStudent({
        ...formData,
        guardianMonthlyIncome: Number(formData.guardianMonthlyIncome),
        age: Number(formData.age),
      });
      setRegisteredStudent(student);
    } catch (err: any) {
      alert(err.message || 'Failed to submit registration');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Confirmation View upon completion
  if (registeredStudent) {
    return (
      <div className="min-h-screen bg-slate-50 py-12 px-4 flex items-center justify-center">
        <div className="max-w-xl w-full bg-white rounded-3xl p-8 sm:p-10 border border-slate-200 shadow-xl text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center mx-auto shadow-sm">
            <CheckCircle className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-extrabold text-slate-900">Registration Submitted Successfully!</h2>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              Your candidate registration for the Jadoon PS Scholarship Examination has been received. Please download and print your official registration slip.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-blue-50/70 border border-blue-100 text-left space-y-3">
            <div className="flex items-center justify-between border-b border-blue-200/60 pb-2.5">
              <span className="text-xs text-slate-500 font-medium">Application Number:</span>
              <span className="text-sm font-extrabold text-[#185b9d]">{registeredStudent.applicationNo}</span>
            </div>
            <div className="flex items-center justify-between border-b border-blue-200/60 pb-2.5">
              <span className="text-xs text-slate-500 font-medium">Test Roll Number:</span>
              <span className="text-sm font-extrabold text-slate-900">{registeredStudent.rollNumber}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">Candidate Name:</span>
              <span className="text-xs font-bold text-slate-800">{registeredStudent.fullName}</span>
            </div>
          </div>

          {/* QR Code */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 inline-block">
            <img
              src={
                registeredStudent.qrImageUrl ||
                `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${registeredStudent.rollNumber}`
              }
              alt="QR Code"
              className="w-32 h-32 rounded-xl bg-white p-1 border border-slate-200 mx-auto"
            />
            <span className="text-[11px] font-bold text-slate-500 mt-2 block">
              Candidate Biometric Exam QR Code
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              onClick={() => mockApi.downloadStudentPdf(registeredStudent.id, registeredStudent.rollNumber)}
              className="w-full sm:w-auto px-6 py-3 bg-[#185b9d] hover:bg-[#13497d] text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-500/20 transition flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>Download Registration Slip (PDF)</span>
            </button>
            <button
              onClick={onNavigateHome}
              className="w-full sm:w-auto px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
            >
              Return to Homepage
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top Navbar */}
      <nav className="h-16 bg-white border-b border-slate-200/80 px-4 sm:px-8 flex items-center justify-between">
        <div className="flex items-center gap-3 cursor-pointer" onClick={onNavigateHome}>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#185b9d] to-[#2563eb] flex items-center justify-center text-white shadow-sm">
            <School className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-extrabold text-slate-900">Jadoon Public School</h1>
            <p className="text-[10px] text-slate-400 font-medium">Candidate Online Registration Form</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onNavigateLogin}
            className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-[#185b9d] hover:bg-slate-50 rounded-lg transition"
          >
            Admin Sign-in
          </button>
          <button
            onClick={onNavigateHome}
            className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
          >
            Exit to Home
          </button>
        </div>
      </nav>

      {/* Main Container */}
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6">
        {/* Progress Bar & Stage Indicator */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs mb-6">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-bold text-[#185b9d]">
              Stage {currentStage} of {totalStages}: {stageTitles[currentStage - 1]}
            </span>
            <span className="font-semibold text-slate-400">
              {Math.round((currentStage / totalStages) * 100)}% Complete
            </span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
            <div
              style={{ width: `${(currentStage / totalStages) * 100}%` }}
              className="h-full bg-gradient-to-r from-[#185b9d] to-[#2563eb] transition-all duration-300 rounded-full"
            />
          </div>
        </div>

        {/* Wizard Form Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200/80 shadow-md space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Stage 1: Personal Information */}
            {currentStage === 1 && (
              <div className="space-y-4">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="text-base font-bold text-slate-900">Part A: Candidate Personal Information</h3>
                  <p className="text-xs text-slate-400">Fill in exact details matching your B-Form or CNIC.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Candidate Full Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Hamza Tariq Jadoon"
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#185b9d]/20 focus:border-[#185b9d]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Father Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Tariq Mehmood"
                      value={formData.fatherName}
                      onChange={(e) => setFormData({ ...formData, fatherName: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#185b9d]/20 focus:border-[#185b9d]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Gender *</label>
                    <select
                      value={formData.gender}
                      onChange={(e) => setFormData({ ...formData, gender: e.target.value as any })}
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                    >
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">CNIC or B-Form Number *</label>
                    <input
                      type="text"
                      required
                      placeholder="13101-9876543-1"
                      value={formData.cnicOrBForm}
                      onChange={(e) => setFormData({ ...formData, cnicOrBForm: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#185b9d]/20 focus:border-[#185b9d]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Date of Birth *</label>
                    <input
                      type="date"
                      required
                      value={formData.dateOfBirth}
                      onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Nationality</label>
                    <input
                      type="text"
                      value={formData.nationality}
                      onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Stage 2: Contact & Address */}
            {currentStage === 2 && (
              <div className="space-y-4">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="text-base font-bold text-slate-900">Part B: Contact Details & Residence</h3>
                  <p className="text-xs text-slate-400">Provide verified phone numbers for SMS alerts and Roll Number delivery.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Parent / Guardian Mobile *</label>
                    <input
                      type="text"
                      required
                      placeholder="0300-1234567"
                      value={formData.parentMobile}
                      onChange={(e) => setFormData({ ...formData, parentMobile: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#185b9d]/20 focus:border-[#185b9d]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">WhatsApp Number</label>
                    <input
                      type="text"
                      placeholder="0300-1234567"
                      value={formData.whatsapp}
                      onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">District *</label>
                    <input
                      type="text"
                      required
                      value={formData.district}
                      onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Province *</label>
                    <input
                      type="text"
                      required
                      value={formData.province}
                      onChange={(e) => setFormData({ ...formData, province: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">Permanent Residential Address *</label>
                    <input
                      type="text"
                      required
                      placeholder="House #, Street, Mohallah / Sector"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Stage 3: Educational Information */}
            {currentStage === 3 && (
              <div className="space-y-4">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="text-base font-bold text-slate-900">Part C: Educational Information</h3>
                  <p className="text-xs text-slate-400">Class and school you are applying from or seeking admission into.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Admission Class Level *</label>
                    <select
                      value={formData.currentClass}
                      onChange={(e) => setFormData({ ...formData, currentClass: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                    >
                      <option value="Class 6th">Class 6th</option>
                      <option value="Class 7th">Class 7th</option>
                      <option value="Class 8th">Class 8th</option>
                      <option value="SSC-I (Class 9th)">SSC-I (Class 9th)</option>
                      <option value="SSC-II (Class 10th)">SSC-II (Class 10th)</option>
                      <option value="HSSC-I (Class 11th)">HSSC-I (Class 11th)</option>
                      <option value="HSSC-II (Class 12th)">HSSC-II (Class 12th)</option>
                      <option value="BS Computer Science">BS Computer Science</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Current School / College Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Jadoon Public School"
                      value={formData.schoolName}
                      onChange={(e) => setFormData({ ...formData, schoolName: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Board / University</label>
                    <input
                      type="text"
                      value={formData.boardOrUniversity}
                      onChange={(e) => setFormData({ ...formData, boardOrUniversity: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">School Roll No</label>
                    <input
                      type="text"
                      placeholder="e.g. 45892"
                      value={formData.currentRollNo}
                      onChange={(e) => setFormData({ ...formData, currentRollNo: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Stage 4: Scholarship Category */}
            {currentStage === 4 && (
              <div className="space-y-4">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="text-base font-bold text-slate-900">Part D: Scholarship Category</h3>
                  <p className="text-xs text-slate-400">Select the quota or merit stream you are applying for.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {[
                    { id: 'GENERAL_MERIT', title: 'General Merit', desc: '100% / 50% tuition waiver for top scoring students' },
                    { id: 'FINANCIALLY_NEEDY', title: 'Financially Needy / Need-Based', desc: 'Financial assistance for low-income families' },
                    { id: 'ORPHAN', title: 'Orphan Student Quota', desc: 'Full fee waiver and educational support' },
                    { id: 'PERSON_WITH_DISABILITY', title: 'Special Needs / Disability Quota', desc: 'Inclusive academic support' },
                  ].map((cat) => (
                    <label
                      key={cat.id}
                      className={`p-4 rounded-2xl border-2 cursor-pointer transition flex flex-col justify-between ${
                        formData.scholarshipCategory === cat.id
                          ? 'border-[#185b9d] bg-blue-50/50 ring-2 ring-blue-500/10'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <span className="font-bold text-sm text-slate-900">{cat.title}</span>
                        <input
                          type="radio"
                          name="scholarshipCategory"
                          value={cat.id}
                          checked={formData.scholarshipCategory === cat.id}
                          onChange={() => setFormData({ ...formData, scholarshipCategory: cat.id as any })}
                          className="mt-1 text-[#185b9d]"
                        />
                      </div>
                      <p className="text-xs text-slate-500 mt-2">{cat.desc}</p>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Stage 5: Emergency & Family */}
            {currentStage === 5 && (
              <div className="space-y-4">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="text-base font-bold text-slate-900">Part E: Emergency Contact & Family Income</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Guardian Occupation *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Government Officer / Business"
                      value={formData.guardianOccupation}
                      onChange={(e) => setFormData({ ...formData, guardianOccupation: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Monthly Household Income (PKR) *</label>
                    <input
                      type="number"
                      required
                      value={formData.guardianMonthlyIncome}
                      onChange={(e) => setFormData({ ...formData, guardianMonthlyIncome: Number(e.target.value) })}
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Emergency Contact Number *</label>
                    <input
                      type="text"
                      required
                      placeholder="0300-1234567"
                      value={formData.emergencyContact}
                      onChange={(e) => setFormData({ ...formData, emergencyContact: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Relationship with Candidate *</label>
                    <input
                      type="text"
                      required
                      placeholder="Father / Mother / Uncle"
                      value={formData.emergencyRelation}
                      onChange={(e) => setFormData({ ...formData, emergencyRelation: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Stage 6: Academic Records */}
            {currentStage === 6 && (
              <div className="space-y-4">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="text-base font-bold text-slate-900">Part G: Academic History Record</h3>
                  <p className="text-xs text-slate-400">Previous annual exam scores and passing board.</p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Exam Level</label>
                      <input
                        type="text"
                        value={formData.academicRecords[0].examLevel}
                        onChange={(e) => {
                          const updated = [...formData.academicRecords];
                          updated[0].examLevel = e.target.value;
                          setFormData({ ...formData, academicRecords: updated });
                        }}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Total Marks</label>
                      <input
                        type="number"
                        value={formData.academicRecords[0].totalMarks}
                        onChange={(e) => {
                          const updated = [...formData.academicRecords];
                          updated[0].totalMarks = Number(e.target.value);
                          setFormData({ ...formData, academicRecords: updated });
                        }}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Obtained Marks</label>
                      <input
                        type="number"
                        value={formData.academicRecords[0].obtainedMarks}
                        onChange={(e) => {
                          const updated = [...formData.academicRecords];
                          updated[0].obtainedMarks = Number(e.target.value);
                          setFormData({ ...formData, academicRecords: updated });
                        }}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Stage 7: Document Checklist */}
            {currentStage === 7 && (
              <div className="space-y-4">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="text-base font-bold text-slate-900">Part H: Document Verification Checklist</h3>
                  <p className="text-xs text-slate-400">Confirm physical copies you will present at the test centre.</p>
                </div>

                <div className="space-y-2.5">
                  {[
                    { key: 'bformCnicCopy', label: 'Candidate B-Form / CNIC Copy' },
                    { key: 'fatherCnicCopy', label: 'Father / Guardian CNIC Copy' },
                    { key: 'passportPhotos', label: '2 Passport Size Photographs' },
                    { key: 'previousResultCard', label: 'Previous Class Annual Examination Result Card' },
                    { key: 'domicileCertificate', label: 'District Domicile Certificate' },
                  ].map((doc) => (
                    <label
                      key={doc.key}
                      className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white cursor-pointer transition"
                    >
                      <input
                        type="checkbox"
                        checked={(formData.documents as any)[doc.key]}
                        onChange={(e) => {
                          setFormData({
                            ...formData,
                            documents: {
                              ...formData.documents,
                              [doc.key]: e.target.checked,
                            },
                          });
                        }}
                        className="w-4 h-4 rounded border-slate-300 text-[#185b9d]"
                      />
                      <span className="text-xs font-semibold text-slate-800">{doc.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Stage 8: Referral & Declarations */}
            {currentStage === 8 && (
              <div className="space-y-5">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="text-base font-bold text-slate-900">Parts I, J & K: Referral & Declarations</h3>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Part I: How did you hear about this scholarship program?
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.referralSource}
                    onChange={(e) => setFormData({ ...formData, referralSource: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                  />
                </div>

                {/* Part J: Candidate Declaration */}
                <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200 text-xs space-y-2">
                  <span className="font-bold text-[#185b9d] block">Part J: Candidate Undertaking</span>
                  <p className="text-slate-600 leading-relaxed">
                    I solemnly declare that all particulars entered in this form are correct. I agree to abide by all examination and scholarship committee regulations.
                  </p>
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-900 pt-1">
                    <input
                      type="checkbox"
                      checked={formData.agreedToApplicantDeclaration}
                      onChange={(e) => setFormData({ ...formData, agreedToApplicantDeclaration: e.target.checked })}
                      className="rounded text-[#185b9d]"
                    />
                    <span>I accept the applicant undertaking</span>
                  </label>
                </div>

                {/* Part K: Parent Declaration */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-2">
                  <span className="font-bold text-slate-900 block">Part K: Parent / Guardian Endorsement</span>
                  <p className="text-slate-600 leading-relaxed">
                    I hereby endorse this application and verify all provided data.
                  </p>
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-900 pt-1">
                    <input
                      type="checkbox"
                      checked={formData.agreedToParentDeclaration}
                      onChange={(e) => setFormData({ ...formData, agreedToParentDeclaration: e.target.checked })}
                      className="rounded text-[#185b9d]"
                    />
                    <span>Parent / Guardian endorses this form</span>
                  </label>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between pt-6 border-t border-slate-100">
              {currentStage > 1 ? (
                <button
                  type="button"
                  onClick={handlePrev}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition flex items-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Previous Step</span>
                </button>
              ) : (
                <div />
              )}

              {currentStage < totalStages ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="px-6 py-2.5 rounded-xl bg-[#185b9d] hover:bg-[#13497d] text-white text-xs font-bold shadow-md shadow-blue-500/20 transition flex items-center gap-2"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-8 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition flex items-center gap-2 disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Submitting Registration...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span>Finalize & Submit Registration</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
