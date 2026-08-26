import React, { useState, useEffect } from 'react';
import {
  School,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  Download,
  FileCheck,
  User,
  Phone,
  BookOpen,
  Award,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RotateCcw,
  Plus,
} from 'lucide-react';
import { mockApi, MockStudent } from '../../../lib/mockApi';
import { wakeUpBackend } from '../../../lib/apiClient';
import {
  formatCnic,
  formatPakistaniPhone,
  validateFullName,
  validateFatherName,
  validateCnic,
  validateGender,
  validateDobAndAge,
  validateAddress,
  validateDistrictProvince,
  validatePhone,
  validateEmail,
  validateSchoolName,
  validateGradeClass,
  validateOccupation,
  validateIncome,
  validateDependents,
  validateEmergencyContact,
  validateAcademicRecord,
  validateAcademicRecordsList,
  mapSubmitErrorToFriendlyMessage,
  trimObjectStrings,
} from '../../../utils/formValidation';
import { PreSubmitCaptchaModal } from '../../common/PreSubmitCaptchaModal';

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
  const [isCaptchaOpen, setIsCaptchaOpen] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [registeredStudent, setRegisteredStudent] = useState<MockStudent | null>(null);

  // Field touch and error states
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [academicRowErrors, setAcademicRowErrors] = useState<Record<string, string>>({});

  // Ping backend on wizard mount
  useEffect(() => {
    wakeUpBackend();
  }, []);

  // Ping backend immediately when candidate reaches the final declarations stage
  useEffect(() => {
    if (currentStage === 8) {
      wakeUpBackend(0);
    }
  }, [currentStage]);

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
    dependentsCount: 4,
    emergencyContact: '',
    emergencyRelation: 'Father',

    // Stage 6: Academic Records
    academicRecords: [
      {
        examLevel: 'SSC-I (Class 9th Board Exam)',
        boardOrUni: 'BISE Abbottabad',
        yearOfPassing: String(new Date().getFullYear() - 1),
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

  // State for adding new academic records
  const [newGrade, setNewGrade] = useState('');
  const [newYear, setNewYear] = useState(String(new Date().getFullYear()));
  const [newTotalMarks, setNewTotalMarks] = useState<number | ''>('');
  const [newObtMarks, setNewObtMarks] = useState<number | ''>('');
  const [newInstitute, setNewInstitute] = useState('');

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

  const handleCnicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCnic(e.target.value);
    setFormData((prev) => ({ ...prev, cnicOrBForm: formatted }));
    if (touchedFields.cnicOrBForm) {
      const err = validateCnic(formatted);
      setFieldErrors((prev) => {
        const next = { ...prev };
        if (err) next.cnicOrBForm = err; else delete next.cnicOrBForm;
        return next;
      });
    }
  };

  const handlePhoneChange = (fieldName: 'parentMobile' | 'studentMobile' | 'whatsapp', e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPakistaniPhone(e.target.value);
    setFormData((prev) => ({ ...prev, [fieldName]: formatted }));
    if (touchedFields[fieldName]) {
      const label = fieldName === 'parentMobile' ? 'Parent Mobile' : fieldName === 'studentMobile' ? 'Candidate Mobile' : 'WhatsApp';
      const err = validatePhone(formatted, label);
      setFieldErrors((prev) => {
        const next = { ...prev };
        if (err) next[fieldName] = err; else delete next[fieldName];
        return next;
      });
    }
  };

  const handleBlur = (field: string) => {
    setTouchedFields((prev) => ({ ...prev, [field]: true }));
    validateField(field);
  };

  const validateField = (field: string) => {
    let err: string | null = null;
    switch (field) {
      case 'fullName':
        err = validateFullName(formData.fullName);
        break;
      case 'fatherName':
        err = validateFatherName(formData.fatherName);
        break;
      case 'cnicOrBForm':
        err = validateCnic(formData.cnicOrBForm);
        break;
      case 'gender':
        err = validateGender(formData.gender);
        break;
      case 'dateOfBirth':
        err = validateDobAndAge(formData.dateOfBirth).error;
        break;
      case 'address':
        err = validateAddress(formData.address);
        break;
      case 'district':
        err = validateDistrictProvince(formData.district, formData.province);
        break;
      case 'parentMobile':
        err = validatePhone(formData.parentMobile, 'Parent Mobile');
        break;
      case 'studentMobile':
        err = validatePhone(formData.studentMobile, 'Candidate Mobile');
        break;
      case 'whatsapp':
        if (formData.whatsapp) err = validatePhone(formData.whatsapp, 'WhatsApp');
        break;
      case 'email':
        err = validateEmail(formData.email);
        break;
      case 'schoolName':
        err = validateSchoolName(formData.schoolName);
        break;
      case 'currentClass':
        err = validateGradeClass(formData.currentClass);
        break;
      case 'guardianOccupation':
        err = validateOccupation(formData.guardianOccupation);
        break;
      case 'guardianMonthlyIncome':
        err = validateIncome(formData.guardianMonthlyIncome);
        break;
      case 'emergencyContact':
        err = validateEmergencyContact(formData.emergencyContact);
        break;
      default:
        break;
    }

    setFieldErrors((prev) => {
      const next = { ...prev };
      if (err) next[field] = err; else delete next[field];
      return next;
    });
    return err;
  };

  const getStageErrors = (stage: number): string[] => {
    const errs: string[] = [];
    switch (stage) {
      case 1: {
        const e1 = validateFullName(formData.fullName);
        if (e1) errs.push(e1);
        const e2 = validateFatherName(formData.fatherName);
        if (e2) errs.push(e2);
        const e3 = validateCnic(formData.cnicOrBForm);
        if (e3) errs.push(e3);
        const e4 = validateGender(formData.gender);
        if (e4) errs.push(e4);
        const { error: e5 } = validateDobAndAge(formData.dateOfBirth);
        if (e5) errs.push(e5);
        break;
      }
      case 2: {
        const e1 = validateAddress(formData.address);
        if (e1) errs.push(e1);
        const e2 = validateDistrictProvince(formData.district, formData.province);
        if (e2) errs.push(e2);
        const e3 = validatePhone(formData.parentMobile, 'Parent Mobile');
        if (e3) errs.push(e3);
        const e4 = validatePhone(formData.studentMobile, 'Candidate Mobile');
        if (e4) errs.push(e4);
        if (formData.whatsapp) {
          const e5 = validatePhone(formData.whatsapp, 'WhatsApp');
          if (e5) errs.push(e5);
        }
        if (formData.email) {
          const e6 = validateEmail(formData.email);
          if (e6) errs.push(e6);
        }
        break;
      }
      case 3: {
        const e1 = validateGradeClass(formData.currentClass);
        if (e1) errs.push(e1);
        const e2 = validateSchoolName(formData.schoolName);
        if (e2) errs.push(e2);
        break;
      }
      case 4: {
        if (!formData.scholarshipCategory) errs.push('Please select a Scholarship Category.');
        break;
      }
      case 5: {
        const e1 = validateOccupation(formData.guardianOccupation);
        if (e1) errs.push(e1);
        const e2 = validateIncome(formData.guardianMonthlyIncome);
        if (e2) errs.push(e2);
        const e3 = validateEmergencyContact(formData.emergencyContact);
        if (e3) errs.push(e3);
        break;
      }
      case 6: {
        const recordsErr = validateAcademicRecordsList(formData.academicRecords, formData.currentClass);
        if (recordsErr) errs.push(recordsErr);
        break;
      }
      case 7: {
        if (!formData.documents.bformCnicCopy) errs.push('Candidate B-Form / CNIC copy confirmation is required.');
        if (!formData.documents.fatherCnicCopy) errs.push('Father / Guardian CNIC copy confirmation is required.');
        if (!formData.documents.previousResultCard) errs.push('Previous Examination Result Card is required.');
        break;
      }
      case 8: {
        if (!formData.agreedToApplicantDeclaration) errs.push('Please accept the applicant undertaking.');
        if (!formData.agreedToParentDeclaration) errs.push('Please confirm parent / guardian endorsement.');
        break;
      }
      default:
        break;
    }
    return errs;
  };

  const isStageComplete = (stage: number) => getStageErrors(stage).length === 0;

  const handleNext = () => {
    const errs = getStageErrors(currentStage);
    if (errs.length > 0) {
      setSubmitError(errs[0]);
      return;
    }
    setSubmitError('');
    if (currentStage < totalStages) {
      setCurrentStage((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrev = () => {
    setSubmitError('');
    if (currentStage > 1) {
      setCurrentStage((prev) => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleAddAcademicRecord = () => {
    const rowValidation = validateAcademicRecord({
      gradeClass: newGrade,
      passingYear: newYear,
      totalMarks: newTotalMarks,
      obtainedMarks: newObtMarks,
      institute: newInstitute,
    });

    if (!rowValidation.valid) {
      setAcademicRowErrors(rowValidation.errors);
      return;
    }

    setAcademicRowErrors({});
    const total = Number(newTotalMarks);
    const obt = Number(newObtMarks);
    const percentage = Math.round((obt / total) * 1000) / 10;

    setFormData((prev) => ({
      ...prev,
      academicRecords: [
        ...prev.academicRecords,
        {
          examLevel: newGrade,
          boardOrUni: newInstitute,
          yearOfPassing: newYear,
          totalMarks: total,
          obtainedMarks: obt,
          percentage,
        },
      ],
    }));

    setNewGrade('');
    setNewTotalMarks('');
    setNewObtMarks('');
    setNewInstitute('');
  };

  const handleRemoveAcademicRecord = (idx: number) => {
    setFormData((prev) => ({
      ...prev,
      academicRecords: prev.academicRecords.filter((_, i) => i !== idx),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');

    // Pre-flight check all stages 1 to 8
    for (let s = 1; s <= 8; s++) {
      const errs = getStageErrors(s);
      if (errs.length > 0) {
        setSubmitError(`Stage ${s} (${stageTitles[s - 1]}): ${errs[0]}`);
        setCurrentStage(s);
        return;
      }
    }

    // Open Pre-Submit CAPTCHA modal
    setIsCaptchaOpen(true);
  };

  const executeFinalSubmission = async () => {
    setSubmitError('');
    setIsSubmitting(true);

    try {
      const cleanData = trimObjectStrings(formData);
      const student = await mockApi.createStudent({
        ...cleanData,
        guardianMonthlyIncome: Number(cleanData.guardianMonthlyIncome),
        age: Number(cleanData.age),
      });
      setRegisteredStudent(student);
      setIsCaptchaOpen(false);
    } catch (err: any) {
      const friendlyMsg = mapSubmitErrorToFriendlyMessage(err);
      setSubmitError(friendlyMsg);
      throw new Error(friendlyMsg);
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
              Your candidate registration for the AZM.AIO Scholarship Examination has been received. Please download and print your official registration slip.
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
            <h1 className="text-sm font-extrabold text-slate-900">AZM.AIO Portal</h1>
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
          {/* Pre-Submit CAPTCHA & Server Warm-up Modal */}
          <PreSubmitCaptchaModal
            isOpen={isCaptchaOpen}
            onClose={() => setIsCaptchaOpen(false)}
            onConfirmSubmit={executeFinalSubmission}
            isSubmitting={isSubmitting}
          />

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
                      id="field-fullName"
                      type="text"
                      required
                      placeholder="e.g. Muhammad Hamza"
                      value={formData.fullName}
                      onChange={(e) => {
                        setFormData({ ...formData, fullName: e.target.value });
                        if (touchedFields.fullName) {
                          const err = validateFullName(e.target.value);
                          setFieldErrors((prev) => {
                            const next = { ...prev };
                            if (err) next.fullName = err; else delete next.fullName;
                            return next;
                          });
                        }
                      }}
                      onBlur={() => handleBlur('fullName')}
                      className={`w-full px-3.5 py-2.5 text-sm rounded-xl border focus:outline-hidden transition ${
                        touchedFields.fullName && fieldErrors.fullName
                          ? 'border-rose-400 focus:border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/20'
                          : 'bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-[#185b9d]/20 focus:border-[#185b9d]'
                      }`}
                    />
                    {touchedFields.fullName && fieldErrors.fullName && (
                      <p className="text-[11px] font-semibold text-rose-600 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{fieldErrors.fullName}</span>
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Father Name *</label>
                    <input
                      id="field-fatherName"
                      type="text"
                      required
                      placeholder="e.g. Tariq Mehmood"
                      value={formData.fatherName}
                      onChange={(e) => {
                        setFormData({ ...formData, fatherName: e.target.value });
                        if (touchedFields.fatherName) {
                          const err = validateFatherName(e.target.value);
                          setFieldErrors((prev) => {
                            const next = { ...prev };
                            if (err) next.fatherName = err; else delete next.fatherName;
                            return next;
                          });
                        }
                      }}
                      onBlur={() => handleBlur('fatherName')}
                      className={`w-full px-3.5 py-2.5 text-sm rounded-xl border focus:outline-hidden transition ${
                        touchedFields.fatherName && fieldErrors.fatherName
                          ? 'border-rose-400 focus:border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/20'
                          : 'bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-[#185b9d]/20 focus:border-[#185b9d]'
                      }`}
                    />
                    {touchedFields.fatherName && fieldErrors.fatherName && (
                      <p className="text-[11px] font-semibold text-rose-600 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{fieldErrors.fatherName}</span>
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Gender *</label>
                    <select
                      id="field-gender"
                      value={formData.gender}
                      onChange={(e) => {
                        setFormData({ ...formData, gender: e.target.value as any });
                        if (touchedFields.gender) {
                          const err = validateGender(e.target.value);
                          setFieldErrors((prev) => {
                            const next = { ...prev };
                            if (err) next.gender = err; else delete next.gender;
                            return next;
                          });
                        }
                      }}
                      onBlur={() => handleBlur('gender')}
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                    >
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">CNIC or B-Form Number *</label>
                    <input
                      id="field-cnicOrBForm"
                      type="text"
                      required
                      placeholder="13101-9876543-1"
                      value={formData.cnicOrBForm}
                      onChange={handleCnicChange}
                      onBlur={() => handleBlur('cnicOrBForm')}
                      className={`w-full px-3.5 py-2.5 text-sm font-mono rounded-xl border focus:outline-hidden transition ${
                        touchedFields.cnicOrBForm && fieldErrors.cnicOrBForm
                          ? 'border-rose-400 focus:border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/20'
                          : 'bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-[#185b9d]/20 focus:border-[#185b9d]'
                      }`}
                    />
                    {touchedFields.cnicOrBForm && fieldErrors.cnicOrBForm && (
                      <p className="text-[11px] font-semibold text-rose-600 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{fieldErrors.cnicOrBForm}</span>
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Date of Birth *</label>
                    <input
                      id="field-dateOfBirth"
                      type="date"
                      required
                      value={formData.dateOfBirth}
                      onChange={(e) => {
                        const val = e.target.value;
                        const { age } = validateDobAndAge(val);
                        setFormData((prev) => ({
                          ...prev,
                          dateOfBirth: val,
                          ...(age !== null ? { age } : {}),
                        }));
                        if (touchedFields.dateOfBirth) {
                          const { error: dobErr } = validateDobAndAge(val);
                          setFieldErrors((prev) => {
                            const next = { ...prev };
                            if (dobErr) next.dateOfBirth = dobErr; else delete next.dateOfBirth;
                            return next;
                          });
                        }
                      }}
                      onBlur={() => handleBlur('dateOfBirth')}
                      className={`w-full px-3.5 py-2.5 text-sm rounded-xl border focus:outline-hidden transition ${
                        touchedFields.dateOfBirth && fieldErrors.dateOfBirth
                          ? 'border-rose-400 focus:border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/20'
                          : 'bg-slate-50 border-slate-200 focus:bg-white'
                      }`}
                    />
                    {touchedFields.dateOfBirth && fieldErrors.dateOfBirth && (
                      <p className="text-[11px] font-semibold text-rose-600 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{fieldErrors.dateOfBirth}</span>
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Nationality</label>
                    <input
                      id="field-nationality"
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
                      id="field-parentMobile"
                      type="text"
                      required
                      placeholder="0300-1234567"
                      value={formData.parentMobile}
                      onChange={(e) => handlePhoneChange('parentMobile', e)}
                      onBlur={() => handleBlur('parentMobile')}
                      className={`w-full px-3.5 py-2.5 text-sm font-mono rounded-xl border focus:outline-hidden transition ${
                        touchedFields.parentMobile && fieldErrors.parentMobile
                          ? 'border-rose-400 focus:border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/20'
                          : 'bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-[#185b9d]/20 focus:border-[#185b9d]'
                      }`}
                    />
                    {touchedFields.parentMobile && fieldErrors.parentMobile && (
                      <p className="text-[11px] font-semibold text-rose-600 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{fieldErrors.parentMobile}</span>
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Candidate Active Mobile *</label>
                    <input
                      id="field-studentMobile"
                      type="text"
                      required
                      placeholder="0300-1234567"
                      value={formData.studentMobile}
                      onChange={(e) => handlePhoneChange('studentMobile', e)}
                      onBlur={() => handleBlur('studentMobile')}
                      className={`w-full px-3.5 py-2.5 text-sm font-mono rounded-xl border focus:outline-hidden transition ${
                        touchedFields.studentMobile && fieldErrors.studentMobile
                          ? 'border-rose-400 focus:border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/20'
                          : 'bg-slate-50 border-slate-200 focus:bg-white'
                      }`}
                    />
                    {touchedFields.studentMobile && fieldErrors.studentMobile && (
                      <p className="text-[11px] font-semibold text-rose-600 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{fieldErrors.studentMobile}</span>
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">WhatsApp Number (Optional)</label>
                    <input
                      id="field-whatsapp"
                      type="text"
                      placeholder="0300-1234567"
                      value={formData.whatsapp}
                      onChange={(e) => handlePhoneChange('whatsapp', e)}
                      onBlur={() => handleBlur('whatsapp')}
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">District *</label>
                    <input
                      id="field-district"
                      type="text"
                      required
                      value={formData.district}
                      onChange={(e) => {
                        setFormData({ ...formData, district: e.target.value });
                        if (touchedFields.district) {
                          const err = validateDistrictProvince(e.target.value, formData.province);
                          setFieldErrors((prev) => {
                            const next = { ...prev };
                            if (err) next.district = err; else delete next.district;
                            return next;
                          });
                        }
                      }}
                      onBlur={() => handleBlur('district')}
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Province *</label>
                    <input
                      id="field-province"
                      type="text"
                      required
                      value={formData.province}
                      readOnly
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-100 border border-slate-200 rounded-xl text-slate-600"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">Permanent Residential Address *</label>
                    <input
                      id="field-address"
                      type="text"
                      required
                      placeholder="House #, Street, Mohallah / Sector"
                      value={formData.address}
                      onChange={(e) => {
                        setFormData({ ...formData, address: e.target.value });
                        if (touchedFields.address) {
                          const err = validateAddress(e.target.value);
                          setFieldErrors((prev) => {
                            const next = { ...prev };
                            if (err) next.address = err; else delete next.address;
                            return next;
                          });
                        }
                      }}
                      onBlur={() => handleBlur('address')}
                      className={`w-full px-3.5 py-2.5 text-sm rounded-xl border focus:outline-hidden transition ${
                        touchedFields.address && fieldErrors.address
                          ? 'border-rose-400 focus:border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/20'
                          : 'bg-slate-50 border-slate-200 focus:bg-white'
                      }`}
                    />
                    {touchedFields.address && fieldErrors.address && (
                      <p className="text-[11px] font-semibold text-rose-600 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{fieldErrors.address}</span>
                      </p>
                    )}
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
                      id="field-currentClass"
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
                      id="field-schoolName"
                      type="text"
                      required
                      placeholder="e.g. Govt High School / Degree College"
                      value={formData.schoolName}
                      onChange={(e) => {
                        setFormData({ ...formData, schoolName: e.target.value });
                        if (touchedFields.schoolName) {
                          const err = validateSchoolName(e.target.value);
                          setFieldErrors((prev) => {
                            const next = { ...prev };
                            if (err) next.schoolName = err; else delete next.schoolName;
                            return next;
                          });
                        }
                      }}
                      onBlur={() => handleBlur('schoolName')}
                      className={`w-full px-3.5 py-2.5 text-sm rounded-xl border focus:outline-hidden transition ${
                        touchedFields.schoolName && fieldErrors.schoolName
                          ? 'border-rose-400 focus:border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/20'
                          : 'bg-slate-50 border-slate-200 focus:bg-white'
                      }`}
                    />
                    {touchedFields.schoolName && fieldErrors.schoolName && (
                      <p className="text-[11px] font-semibold text-rose-600 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{fieldErrors.schoolName}</span>
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Board / University</label>
                    <input
                      id="field-boardOrUniversity"
                      type="text"
                      value={formData.boardOrUniversity}
                      onChange={(e) => setFormData({ ...formData, boardOrUniversity: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">School Roll No</label>
                    <input
                      id="field-currentRollNo"
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
                      id="field-guardianOccupation"
                      type="text"
                      required
                      placeholder="e.g. Government Officer / Business"
                      value={formData.guardianOccupation}
                      onChange={(e) => {
                        setFormData({ ...formData, guardianOccupation: e.target.value });
                        if (touchedFields.guardianOccupation) {
                          const err = validateOccupation(e.target.value);
                          setFieldErrors((prev) => {
                            const next = { ...prev };
                            if (err) next.guardianOccupation = err; else delete next.guardianOccupation;
                            return next;
                          });
                        }
                      }}
                      onBlur={() => handleBlur('guardianOccupation')}
                      className={`w-full px-3.5 py-2.5 text-sm rounded-xl border focus:outline-hidden transition ${
                        touchedFields.guardianOccupation && fieldErrors.guardianOccupation
                          ? 'border-rose-400 focus:border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/20'
                          : 'bg-slate-50 border-slate-200 focus:bg-white'
                      }`}
                    />
                    {touchedFields.guardianOccupation && fieldErrors.guardianOccupation && (
                      <p className="text-[11px] font-semibold text-rose-600 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{fieldErrors.guardianOccupation}</span>
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Monthly Household Income (PKR) *</label>
                    <input
                      id="field-guardianMonthlyIncome"
                      type="number"
                      required
                      value={formData.guardianMonthlyIncome}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setFormData({ ...formData, guardianMonthlyIncome: val });
                        if (touchedFields.guardianMonthlyIncome) {
                          const err = validateIncome(val);
                          setFieldErrors((prev) => {
                            const next = { ...prev };
                            if (err) next.guardianMonthlyIncome = err; else delete next.guardianMonthlyIncome;
                            return next;
                          });
                        }
                      }}
                      onBlur={() => handleBlur('guardianMonthlyIncome')}
                      className={`w-full px-3.5 py-2.5 text-sm font-mono rounded-xl border focus:outline-hidden transition ${
                        touchedFields.guardianMonthlyIncome && fieldErrors.guardianMonthlyIncome
                          ? 'border-rose-400 focus:border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/20'
                          : 'bg-slate-50 border-slate-200 focus:bg-white'
                      }`}
                    />
                    {touchedFields.guardianMonthlyIncome && fieldErrors.guardianMonthlyIncome && (
                      <p className="text-[11px] font-semibold text-rose-600 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{fieldErrors.guardianMonthlyIncome}</span>
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Emergency Contact Person & Phone *</label>
                    <input
                      id="field-emergencyContact"
                      type="text"
                      required
                      placeholder="e.g. Tariq Khan (Uncle) - 0300-1234567"
                      value={formData.emergencyContact}
                      onChange={(e) => {
                        setFormData({ ...formData, emergencyContact: e.target.value });
                        if (touchedFields.emergencyContact) {
                          const err = validateEmergencyContact(e.target.value);
                          setFieldErrors((prev) => {
                            const next = { ...prev };
                            if (err) next.emergencyContact = err; else delete next.emergencyContact;
                            return next;
                          });
                        }
                      }}
                      onBlur={() => handleBlur('emergencyContact')}
                      className={`w-full px-3.5 py-2.5 text-sm rounded-xl border focus:outline-hidden transition ${
                        touchedFields.emergencyContact && fieldErrors.emergencyContact
                          ? 'border-rose-400 focus:border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/20'
                          : 'bg-slate-50 border-slate-200 focus:bg-white'
                      }`}
                    />
                    {touchedFields.emergencyContact && fieldErrors.emergencyContact ? (
                      <p className="text-[11px] font-semibold text-rose-600 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{fieldErrors.emergencyContact}</span>
                      </p>
                    ) : (
                      <span className="text-[10px] text-slate-400 mt-1 block">Must contain contact person name and 11-digit phone number</span>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Relationship with Candidate *</label>
                    <input
                      id="field-emergencyRelation"
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

                {/* BS Program Requirement Guidance */}
                {(formData.currentClass || '').toLowerCase().includes('bs') && (
                  <div className="p-3.5 rounded-2xl bg-blue-50/80 border border-blue-200 text-xs flex items-start gap-2.5 text-blue-900">
                    <Award className="w-4 h-4 text-[#185b9d] flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block">BS Program Requirement: 2 Academic Qualifications</span>
                      <span className="text-[11px] text-blue-700 leading-relaxed">
                        BS Program applicants must submit results for <strong>two different qualifications</strong> (e.g. Matric / SSC and FSc / Intermediate / Pre-Medical / Pre-Engineering).
                      </span>
                    </div>
                  </div>
                )}

                {formData.academicRecords.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 font-bold">
                          <th className="p-2.5 rounded-l-lg">Class / Exam</th>
                          <th className="p-2.5">Year</th>
                          <th className="p-2.5">Total Marks</th>
                          <th className="p-2.5">Obtained Marks</th>
                          <th className="p-2.5">% Score</th>
                          <th className="p-2.5">Institute</th>
                          <th className="p-2.5 rounded-r-lg text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {formData.academicRecords.map((rec, rIdx) => (
                          <tr key={rIdx}>
                            <td className="p-2.5 font-bold text-slate-900">{rec.examLevel}</td>
                            <td className="p-2.5 font-mono">{rec.yearOfPassing}</td>
                            <td className="p-2.5 font-mono">{rec.totalMarks}</td>
                            <td className="p-2.5 font-mono font-bold text-[#185b9d]">{rec.obtainedMarks}</td>
                            <td className="p-2.5 font-mono font-bold text-emerald-700">{rec.percentage}%</td>
                            <td className="p-2.5 text-slate-600">{rec.boardOrUni}</td>
                            <td className="p-2.5 text-right">
                              <button
                                type="button"
                                onClick={() => handleRemoveAcademicRecord(rIdx)}
                                className="text-rose-600 hover:text-rose-800 font-bold text-xs cursor-pointer"
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-6 rounded-2xl bg-rose-50/50 border border-rose-200 text-center text-xs space-y-1">
                    <p className="font-bold text-rose-800">No academic records added yet.</p>
                    <p className="text-rose-600">
                      {(formData.currentClass || '').toLowerCase().includes('bs')
                        ? 'BS applicants must submit results for two different qualifications (e.g. Matric and FSc). Please enter your examination marks below and click "Add Record".'
                        : 'Please enter your previous examination marks below and click "Add Record" to proceed.'}
                    </p>
                  </div>
                )}

                {/* If BS applicant has only 1 record */}
                {(formData.currentClass || '').toLowerCase().includes('bs') && formData.academicRecords.length === 1 && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <span>
                      1 qualification added ({formData.academicRecords[0].examLevel}). <strong>1 more qualification required</strong> (e.g. FSc / Intermediate) for BS applicants.
                    </span>
                  </div>
                )}

                {/* Add Academic Record Form */}
                <div className="p-4 rounded-2xl bg-slate-100/80 border border-slate-200 space-y-3">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5 text-[#185b9d]" />
                    Add Academic Record
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Class / Grade *</label>
                      <input
                        type="text"
                        placeholder="e.g. SSC-I (Class 9th)"
                        value={newGrade}
                        onChange={(e) => setNewGrade(e.target.value)}
                        className={`w-full px-3 py-2 text-xs rounded-xl bg-white border focus:outline-hidden ${
                          academicRowErrors.gradeClass ? 'border-rose-400 ring-1 ring-rose-400' : 'border-slate-300'
                        }`}
                      />
                      {academicRowErrors.gradeClass && (
                        <p className="text-[10px] text-rose-600 font-semibold mt-0.5">{academicRowErrors.gradeClass}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Passing Year *</label>
                      <input
                        type="text"
                        placeholder={`e.g. ${new Date().getFullYear()}`}
                        value={newYear}
                        onChange={(e) => setNewYear(e.target.value)}
                        className={`w-full px-3 py-2 text-xs font-mono rounded-xl bg-white border focus:outline-hidden ${
                          academicRowErrors.passingYear ? 'border-rose-400 ring-1 ring-rose-400' : 'border-slate-300'
                        }`}
                      />
                      {academicRowErrors.passingYear && (
                        <p className="text-[10px] text-rose-600 font-semibold mt-0.5">{academicRowErrors.passingYear}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Total Marks *</label>
                      <input
                        type="number"
                        placeholder="e.g. 550"
                        value={newTotalMarks || ''}
                        onChange={(e) => setNewTotalMarks(Number(e.target.value))}
                        className={`w-full px-3 py-2 text-xs font-mono rounded-xl bg-white border focus:outline-hidden ${
                          academicRowErrors.totalMarks ? 'border-rose-400 ring-1 ring-rose-400' : 'border-slate-300'
                        }`}
                      />
                      {academicRowErrors.totalMarks && (
                        <p className="text-[10px] text-rose-600 font-semibold mt-0.5">{academicRowErrors.totalMarks}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Obtained Marks *</label>
                      <input
                        type="number"
                        placeholder="e.g. 485"
                        value={newObtMarks || ''}
                        onChange={(e) => setNewObtMarks(Number(e.target.value))}
                        className={`w-full px-3 py-2 text-xs font-mono rounded-xl bg-white border focus:outline-hidden ${
                          academicRowErrors.obtainedMarks ? 'border-rose-400 ring-1 ring-rose-400' : 'border-slate-300'
                        }`}
                      />
                      {academicRowErrors.obtainedMarks && (
                        <p className="text-[10px] text-rose-600 font-semibold mt-0.5">{academicRowErrors.obtainedMarks}</p>
                      )}
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Board / School Name *</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="e.g. BISE Abbottabad"
                          value={newInstitute}
                          onChange={(e) => setNewInstitute(e.target.value)}
                          className={`flex-1 px-3 py-2 text-xs rounded-xl bg-white border focus:outline-hidden ${
                            academicRowErrors.institute ? 'border-rose-400 ring-1 ring-rose-400' : 'border-slate-300'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={handleAddAcademicRecord}
                          className="px-4 py-2 bg-[#185b9d] hover:bg-[#13497e] text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Record</span>
                        </button>
                      </div>
                      {academicRowErrors.institute && (
                        <p className="text-[10px] text-rose-600 font-semibold mt-0.5">{academicRowErrors.institute}</p>
                      )}
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
                      id={`field-${doc.key}`}
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
                    id="field-referralSource"
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
                      id="field-agreedToApplicantDeclaration"
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
                      id="field-agreedToParentDeclaration"
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

            {/* Error Message Box */}
            {submitError && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                <span>{submitError}</span>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between pt-6 border-t border-slate-100">
              {currentStage > 1 ? (
                <button
                  type="button"
                  onClick={handlePrev}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition flex items-center gap-2 cursor-pointer"
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
                  disabled={!isStageComplete(currentStage)}
                  onClick={handleNext}
                  className="px-6 py-2.5 rounded-xl bg-[#185b9d] hover:bg-[#13497d] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold shadow-md shadow-blue-500/20 transition flex items-center gap-2 cursor-pointer"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={isSubmitting || !isStageComplete(8)}
                  className="px-8 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition flex items-center gap-2 cursor-pointer"
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
