import React, { useState, useEffect, useRef } from 'react';
import { StudentApplicationData, PartnerSchoolData, PageTab } from '../../types';
import { MONTHLY_ASSISTANCE_RATES, BENEFICIARY_CATEGORIES, OFFICIAL_DATA } from '../../data/scholarshipData';
import { mockApi } from '../../lib/mockApi';
import { 
  User, 
  Phone, 
  GraduationCap, 
  Award, 
  Users, 
  FileSpreadsheet, 
  UploadCloud, 
  CheckCircle2, 
  Sparkles, 
  ArrowRight, 
  ArrowLeft, 
  Save, 
  Trash2, 
  RotateCcw, 
  Download, 
  Printer, 
  ShieldCheck, 
  Building2, 
  AlertCircle,
  FileCheck,
  Eye,
  Plus,
  Camera,
  Loader2,
  Clock,
  CreditCard,
  QrCode,
  Copy,
  Check,
  ExternalLink,
  FileText,
  Smartphone,
  Receipt,
  MessageCircle,
  HelpCircle,
  X,
  Image as ImageIcon
} from 'lucide-react';

import { motion, AnimatePresence } from 'motion/react';

interface ApplicationPortalProps {
  initialClass?: string;
  onSelectTab: (tab: PageTab) => void;
}

export const ApplicationPortal: React.FC<ApplicationPortalProps> = ({ initialClass, onSelectTab }) => {
  const [activePortalTab, setActivePortalTab] = useState<'student' | 'partner'>('student');
  const [currentStage, setCurrentStage] = useState<number>(1);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [submittedAppId, setSubmittedAppId] = useState<string>('');
  const [saveStatus, setSaveStatus] = useState<string>('');
  
  // Real API & Submission States
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string>('');
  const [createdStudent, setCreatedStudent] = useState<any>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<boolean>(false);
  const [photoError, setPhotoError] = useState<string>('');
  
  // Payment Method & Challan Modal State
  const [paymentTab, setPaymentTab] = useState<'easypaisa' | 'bank' | 'hub'>('easypaisa');
  const [copiedField, setCopiedField] = useState<string>('');
  const [showFullChallan, setShowFullChallan] = useState<boolean>(false);

  const copyToClipboard = (text: string, fieldName: string) => {
    try {
      navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(''), 2500);
    } catch (e) {
      console.warn('Clipboard write failed');
    }
  };


  const [isPartnerSubmitting, setIsPartnerSubmitting] = useState<boolean>(false);
  const [createdPartner, setCreatedPartner] = useState<any>(null);
  const [isDownloadingPartnerPdf, setIsDownloadingPartnerPdf] = useState<boolean>(false);

  // Real Uploaded Document Files State
  const [uploadedDocs, setUploadedDocs] = useState<{
    [key: string]: { name: string; size: string; dataUrl?: string };
  }>({});

  // Signature canvas ref
  const sigCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  // Student Form State - pristine empty initial state
  const [formData, setFormData] = useState<StudentApplicationData>({
    id: `APP-V-${Math.floor(10000 + Math.random() * 90000)}`,
    submissionDate: new Date().toISOString().split('T')[0],
    status: 'draft',
    fullName: '',
    fatherName: '',
    gender: 'male',
    dob: '',
    age: '',
    cnicBForm: '',
    photoUrl: '',
    permanentAddress: '',
    district: 'Mansehra',
    province: 'Khyber Pakhtunkhwa',
    mobile: '',
    whatsapp: '',
    email: '',
    currentClass: initialClass || 'Class 10th (SSC-II)',
    discipline: 'Science (Biology/Pre-Medical)',
    schoolName: '',
    boardUniversity: 'BISE Abbottabad',
    currentRollNo: '',
    appliedCategory: 'Category B - Director General Merit Scholarship',
    isSpecialNeed: false,
    specialNeedDetails: '',
    guardianOccupation: '',
    monthlyHouseholdIncome: 0,
    dependentsCount: 1,
    emergencyContact: '',
    academicRecords: [],
    documents: {
      bformUploaded: false,
      fatherCnicUploaded: false,
      dmcUploaded: false,
      domicileUploaded: false,
      incomeCertUploaded: false
    },
    declarationAccepted: false,
    signatureDataUrl: ''
  });

  // Partner School Form State - pristine empty initial state
  const [partnerData, setPartnerData] = useState<PartnerSchoolData>({
    id: `PS-V-${Math.floor(1000 + Math.random() * 9000)}`,
    institutionName: '',
    category: 'Higher Secondary',
    campus: '',
    address: '',
    district: 'Mansehra',
    contactPerson: '',
    designation: '',
    whatsapp: '',
    email: '',
    totalStudentStrength: 0,
    expectedApplicants: 0,
    stampUploaded: false
  });
  const [isPartnerSubmitted, setIsPartnerSubmitted] = useState(false);

  // Auto-mask CNIC/B-Form: 00000-0000000-0
  const handleCnicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, ''); // digits only
    if (val.length > 13) val = val.substring(0, 13);
    
    let formatted = val;
    if (val.length > 5 && val.length <= 12) {
      formatted = `${val.substring(0, 5)}-${val.substring(5)}`;
    } else if (val.length > 12) {
      formatted = `${val.substring(0, 5)}-${val.substring(5, 12)}-${val.substring(12, 13)}`;
    }
    setFormData(prev => ({ ...prev, cnicBForm: formatted }));
  };

  // LocalStorage Auto-save & load
  useEffect(() => {
    try {
      const saved = localStorage.getItem('AZM_STUDENT_APP_V');
      if (saved) {
        const parsed = JSON.parse(saved);
        setFormData(prev => ({ ...prev, ...parsed }));
      }
    } catch (e) {
      console.warn('LocalStorage not available');
    }
  }, []);

  const saveDraft = () => {
    try {
      localStorage.setItem('AZM_STUDENT_APP_V', JSON.stringify(formData));
      setSaveStatus('Draft auto-saved locally!');
      setTimeout(() => setSaveStatus(''), 3000);
    } catch (e) {
      setSaveStatus('Draft saved');
    }
  };

  // E-Signature Drawing Handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0f172a';
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    if (isDrawing && sigCanvasRef.current) {
      setIsDrawing(false);
      const dataUrl = sigCanvasRef.current.toDataURL();
      setFormData(prev => ({ ...prev, signatureDataUrl: dataUrl }));
    }
  };

  const [newGrade, setNewGrade] = useState('');
  const [newYear, setNewYear] = useState('');
  const [newTotalMarks, setNewTotalMarks] = useState<number>(0);
  const [newObtMarks, setNewObtMarks] = useState<number>(0);
  const [newInstitute, setNewInstitute] = useState('');

  const handleAddAcademicRecord = () => {
    if (!newGrade || !newInstitute || newTotalMarks <= 0) {
      alert('Please fill in Exam Class, Year, Marks, and Institute name.');
      return;
    }
    const pct = Number(((newObtMarks / newTotalMarks) * 100).toFixed(1));
    setFormData(prev => ({
      ...prev,
      academicRecords: [
        ...prev.academicRecords,
        {
          gradeClass: newGrade,
          passingYear: newYear || '2025',
          totalMarks: newTotalMarks,
          obtainedMarks: newObtMarks,
          percentage: pct,
          institute: newInstitute
        }
      ]
    }));
    setNewGrade('');
    setNewYear('');
    setNewTotalMarks(0);
    setNewObtMarks(0);
    setNewInstitute('');
  };

  const handleRemoveAcademicRecord = (index: number) => {
    setFormData(prev => ({
      ...prev,
      academicRecords: prev.academicRecords.filter((_, idx) => idx !== index)
    }));
  };

  // Photo Upload Handler with Max 200KB Validation
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhotoError('');
    const file = e.target.files?.[0];
    if (!file) return;

    // Strict 200 KB validation
    const maxSizeBytes = 200 * 1024;
    if (file.size > maxSizeBytes) {
      setPhotoError(
        `File size (${(file.size / 1024).toFixed(0)} KB) exceeds the maximum 200 KB limit. Please compress or select a smaller photo.`
      );
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const dataUrl = uploadEvent.target?.result as string;
      setFormData((prev) => ({
        ...prev,
        photoUrl: dataUrl,
      }));
    };
    reader.readAsDataURL(file);
  };

  // Real Document Attachment Handler
  const handleDocumentUpload = (docKey: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const sizeFormatted =
      file.size > 1024 * 1024
        ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
        : `${(file.size / 1024).toFixed(0)} KB`;

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const dataUrl = uploadEvent.target?.result as string;
      setUploadedDocs((prev) => ({
        ...prev,
        [docKey]: {
          name: file.name,
          size: sizeFormatted,
          dataUrl,
        },
      }));
      setFormData((prev) => ({
        ...prev,
        documents: {
          ...prev.documents,
          [docKey]: true,
        },
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveDocument = (docKey: string) => {
    setUploadedDocs((prev) => {
      const next = { ...prev };
      delete next[docKey];
      return next;
    });
    setFormData((prev) => ({
      ...prev,
      documents: {
        ...prev.documents,
        [docKey]: false,
      },
    }));
  };

  // Complete Application Submit to Live Database
  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');

    if (!formData.declarationAccepted) {
      alert('Please accept the final declaration before submitting.');
      return;
    }

    setIsSubmitting(true);
    try {
      const backendPayload = {
        fullName: formData.fullName,
        fatherName: formData.fatherName,
        gender: formData.gender?.toUpperCase() === 'FEMALE' ? 'FEMALE' : 'MALE',
        dateOfBirth: formData.dob || '2008-01-01',
        age: Number(formData.age) || 16,
        cnicOrBForm: formData.cnicBForm,
        nationality: 'Pakistani',
        religion: 'Islam',
        address: formData.permanentAddress || 'Campus Address',
        district: formData.district || 'Abbottabad',
        province: formData.province || 'Khyber Pakhtunkhwa',
        studentMobile: formData.mobile,
        parentMobile: formData.emergencyContact || formData.mobile || '0300-0000000',
        whatsapp: formData.whatsapp,
        email: formData.email,
        currentClass: formData.currentClass || 'SSC-II (Class 10th)',
        hsscGroup: formData.discipline,
        schoolName: formData.schoolName || 'School',
        boardOrUniversity: formData.boardUniversity || 'BISE Abbottabad',
        currentRollNo: formData.currentRollNo,
        scholarshipCategory: formData.appliedCategory?.includes('Orphan')
          ? 'ORPHAN'
          : formData.appliedCategory?.includes('Disability')
          ? 'PERSON_WITH_DISABILITY'
          : formData.appliedCategory?.includes('Needy') || formData.isSpecialNeed
          ? 'FINANCIALLY_NEEDY'
          : 'GENERAL_MERIT',
        guardianOccupation: formData.guardianOccupation,
        guardianMonthlyIncome: Number(formData.monthlyHouseholdIncome) || 0,
        emergencyContact: formData.emergencyContact || formData.mobile || '0300-0000000',
        emergencyRelation: 'Guardian',
        referralSource: 'AZM.AIO Online Apply Portal',
        photoUrl: formData.photoUrl,
        academicRecords: (formData.academicRecords || []).map((r) => ({
          examLevel: r.gradeClass || 'Class 9th',
          boardOrUni: r.institute || 'BISE',
          yearOfPassing: r.passingYear || '2025',
          totalMarks: Number(r.totalMarks) || 550,
          obtainedMarks: Number(r.obtainedMarks) || 450,
          percentage: Number(r.percentage) || 80,
        })),
        documents: {
          bformCnicCopy: !!formData.documents?.bformUploaded,
          fatherCnicCopy: !!formData.documents?.fatherCnicUploaded,
          passportPhotos: !!formData.photoUrl,
          previousResultCard: !!formData.documents?.dmcUploaded,
          domicileCertificate: !!formData.documents?.domicileUploaded,
          incomeCertificate: !!formData.documents?.incomeCertUploaded,
        },
      };

      const student = await mockApi.createStudent(backendPayload);
      setCreatedStudent(student);
      setSubmittedAppId(student.applicationNo || student.id);
      setIsSubmitted(true);

      try {
        localStorage.removeItem('AZM_STUDENT_APP_V');
      } catch (err) {}

      // Trigger celebratory confetti dynamically
      try {
        const confettiModule = await import('canvas-confetti');
        const confetti = confettiModule.default || confettiModule;
        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.6 },
        });
      } catch (err) {}
    } catch (err: any) {
      setSubmitError(
        err.message ||
          'Failed to submit registration. Please check that your CNIC is not already registered.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadStudentPdf = async () => {
    if (!createdStudent?.id) return;
    setIsDownloadingPdf(true);
    try {
      await mockApi.downloadStudentPdf(createdStudent.id, createdStudent.rollNumber);
    } catch (err: any) {
      alert(err.message || 'Failed to download PDF');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  // Partner School Submit to Live Database
  const handlePartnerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPartnerSubmitting(true);
    try {
      const backendPayload = {
        institutionName: partnerData.institutionName,
        institutionType:
          partnerData.category?.toLowerCase().includes('college') || partnerData.category?.toLowerCase().includes('inter')
            ? 'COLLEGE'
            : partnerData.category?.toLowerCase().includes('uni')
            ? 'UNIVERSITY'
            : 'SCHOOL',
        campus: partnerData.campus || 'Main Campus',
        address: partnerData.address || 'Campus Address',
        district: partnerData.district || 'Abbottabad',
        province: 'Khyber Pakhtunkhwa',
        contactName: partnerData.contactPerson || 'Principal / Administrator',
        contactDesignation: partnerData.designation || 'Head of Institution',
        contactMobile: partnerData.whatsapp || '0300-0000000',
        contactWhatsapp: partnerData.whatsapp,
        contactEmail: `${partnerData.institutionName.toLowerCase().replace(/[^a-z0-9]/g, '')}@partner.edu.pk`,
        website: 'https://jadoon.edu.pk',
        classesOffered: ['SSC', 'HSSC'],
        studentStrength: Number(partnerData.totalStudentStrength) || 100,
        expectedApplicants: Number(partnerData.expectedApplicants) || 50,
        agreedToTerms: true,
      };

      const partner = await mockApi.registerPartner(backendPayload);
      setCreatedPartner(partner);
      setIsPartnerSubmitted(true);
      try {
        const confettiModule = await import('canvas-confetti');
        const confetti = confettiModule.default || confettiModule;
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      } catch (err) {}
    } catch (err: any) {
      alert(err.message || 'Failed to submit partner affiliation.');
    } finally {
      setIsPartnerSubmitting(false);
    }
  };

  const handleDownloadPartnerPdf = async () => {
    if (!createdPartner?.id) return;
    setIsDownloadingPartnerPdf(true);
    try {
      await mockApi.downloadPartnerPdf(createdPartner.id, createdPartner.partnerCode);
    } catch (err: any) {
      alert(err.message || 'Failed to download partner agreement PDF');
    } finally {
      setIsDownloadingPartnerPdf(false);
    }
  };


  // Calculate Progress %
  const calculateProgress = () => {
    let score = 0;
    if (formData.fullName && formData.fatherName && formData.cnicBForm) score += 20;
    if (formData.mobile && formData.permanentAddress) score += 15;
    if (formData.currentClass && formData.schoolName) score += 20;
    if (formData.guardianOccupation && formData.monthlyHouseholdIncome) score += 15;
    if (formData.academicRecords.length > 0) score += 15;
    if (formData.declarationAccepted) score += 15;
    return Math.min(score, 100);
  };

  const stagesList = [
    { num: 1, title: 'Personal Profile', icon: User },
    { num: 2, title: 'Contact Info', icon: Phone },
    { num: 3, title: 'Education Info', icon: GraduationCap },
    { num: 4, title: 'Scholarship Category', icon: Award },
    { num: 5, title: 'Family & Financial', icon: Users },
    { num: 6, title: 'Academic History', icon: FileSpreadsheet },
    { num: 7, title: 'Document Uploads', icon: UploadCloud },
    { num: 8, title: 'Declaration & Signature', icon: CheckCircle2 },
  ];

  return (
    <div className="py-10 max-w-7xl mx-auto px-4 sm:px-6">
      {/* Header & Tab Switcher */}
      <div className="text-center max-w-3xl mx-auto space-y-4 mb-8">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#185b9d]/10 text-[#185b9d] border border-[#185b9d]/20">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          Session V (2026) Official Admissions
        </span>
        <h1 className="text-3xl sm:text-4xl font-display font-extrabold text-slate-900 tracking-tight">
          AZM.AIO Dual Application Portal
        </h1>
        <p className="text-sm text-slate-600">
          Choose whether you are submitting an individual student scholarship application or enrolling as an affiliated partner institution.
        </p>

        {/* Dual Switcher Pill */}
        <div className="inline-flex p-1.5 rounded-2xl bg-slate-200/80 border border-slate-300 max-w-md w-full">
          <button
            id="tab-apply-student"
            onClick={() => setActivePortalTab('student')}
            className={`flex-1 py-2.5 px-4 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 focus:outline-hidden ${
              activePortalTab === 'student'
                ? 'bg-[#185b9d] text-white shadow-md'
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Apply as Student (8-Stage)</span>
          </button>

          <button
            id="tab-apply-partner"
            onClick={() => setActivePortalTab('partner')}
            className={`flex-1 py-2.5 px-4 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 focus:outline-hidden ${
              activePortalTab === 'partner'
                ? 'bg-[#185b9d] text-white shadow-md'
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Partner School Enrolment</span>
          </button>
        </div>
      </div>

      {/* ================= STUDENT APPLICATION WIZARD ================= */}
      {activePortalTab === 'student' && !isSubmitted && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Main Wizard Form Body (8 cols) */}
          <div className="lg:col-span-8 bg-white rounded-3xl border border-slate-200/90 shadow-lg p-6 sm:p-8">
            {/* Stage Progress Bar Tracker */}
            <div className="mb-8">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-2">
                <span>Stage {currentStage} of 8: {stagesList[currentStage - 1].title}</span>
                <span className="text-[#185b9d] font-mono">{Math.round((currentStage / 8) * 100)}% Completed</span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                <motion.div
                  className="h-full bg-gradient-to-r from-[#185b9d] to-emerald-500 rounded-full"
                  initial={{ width: '0%' }}
                  animate={{ width: `${(currentStage / 8) * 100}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>

              {/* Stage Step Pills Carousel */}
              <div className="flex gap-2 overflow-x-auto py-3 no-scrollbar mt-2">
                {stagesList.map((st) => (
                  <button
                    key={st.num}
                    onClick={() => setCurrentStage(st.num)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
                      currentStage === st.num
                        ? 'bg-[#185b9d] text-white border-[#185b9d] shadow-xs'
                        : currentStage > st.num
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}
                  >
                    <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[10px]">
                      {st.num}
                    </span>
                    <span>{st.title}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Form Content By Stage */}
            <form onSubmit={currentStage === 8 ? handleFinalSubmit : (e) => { e.preventDefault(); setCurrentStage(prev => Math.min(prev + 1, 8)); }}>
              {/* STAGE 1: PERSONAL PROFILE */}
              {currentStage === 1 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-slate-900 border-b pb-2">
                    Stage 1: Candidate Personal Profile
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Full Name (as per B-Form / School Record) *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Muhammad Hamza Khan"
                        value={formData.fullName}
                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                        className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-300 focus:bg-white focus:border-[#185b9d] focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Father / Guardian Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Tariq Mehmood Khan"
                        value={formData.fatherName}
                        onChange={(e) => setFormData({ ...formData, fatherName: e.target.value })}
                        className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-300 focus:bg-white focus:border-[#185b9d] focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        CNIC / B-Form Number (Auto-Masked) *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="13503-1234567-1"
                        value={formData.cnicBForm}
                        onChange={handleCnicChange}
                        className="w-full px-3.5 py-2.5 text-xs font-mono font-bold rounded-xl bg-slate-50 border border-slate-300 focus:bg-white focus:border-[#185b9d] focus:outline-hidden"
                      />
                      <span className="text-[10px] text-slate-400 mt-1 block">Format: 13 Digits (13501-XXXXXXX-X)</span>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Gender *
                      </label>
                      <select
                        value={formData.gender}
                        onChange={(e) => setFormData({ ...formData, gender: e.target.value as any })}
                        className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-300 focus:bg-white focus:border-[#185b9d] focus:outline-hidden"
                      >
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Date of Birth *
                      </label>
                      <input
                        type="date"
                        required
                        value={formData.dob}
                        onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                        className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-300 focus:bg-white focus:border-[#185b9d] focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold text-slate-700">
                          Passport Size Photo (Max 200 KB) *
                        </label>
                        <span className="text-[10px] font-semibold text-[#185b9d] bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                          Max 200 KB
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        {formData.photoUrl ? (
                          <div className="relative group">
                            <img
                              src={formData.photoUrl}
                              alt="Candidate Preview"
                              className="w-14 h-14 rounded-2xl object-cover border-2 border-[#185b9d] shadow-sm"
                            />
                            <label className="absolute inset-0 bg-black/40 rounded-2xl opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity text-white text-[10px] font-bold">
                              Change
                              <input
                                type="file"
                                accept="image/png,image/jpeg,image/jpg,image/webp"
                                onChange={handlePhotoUpload}
                                className="hidden"
                              />
                            </label>
                          </div>
                        ) : (
                          <label className="w-14 h-14 rounded-2xl border-2 border-dashed border-slate-300 hover:border-[#185b9d] bg-slate-50 flex flex-col items-center justify-center cursor-pointer transition-colors text-slate-400 hover:text-[#185b9d]">
                            <Camera className="w-5 h-5" />
                            <span className="text-[9px] font-bold mt-0.5">Upload</span>
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/jpg,image/webp"
                              onChange={handlePhotoUpload}
                              className="hidden"
                            />
                          </label>
                        )}
                        <div className="space-y-1">
                          <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition">
                            <UploadCloud className="w-3.5 h-3.5" />
                            <span>{formData.photoUrl ? 'Replace Photo' : 'Select Photo (Max 200 KB)'}</span>
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/jpg,image/webp"
                              onChange={handlePhotoUpload}
                              className="hidden"
                            />
                          </label>
                          <p className="text-[10px] text-slate-400">JPG, PNG or WebP with white / light background</p>
                        </div>
                      </div>

                      {photoError && (
                        <div className="mt-2 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                          <span>{photoError}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* STAGE 2: CONTACT INFO */}
              {currentStage === 2 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-slate-900 border-b pb-2">
                    Stage 2: Residential & Contact Coordinates
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Permanent Residential Address *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Village / Street / Mohallah / House #"
                        value={formData.permanentAddress}
                        onChange={(e) => setFormData({ ...formData, permanentAddress: e.target.value })}
                        className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-300 focus:bg-white focus:border-[#185b9d] focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        District *
                      </label>
                      <select
                        value={formData.district}
                        onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                        className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-300 focus:bg-white focus:border-[#185b9d] focus:outline-hidden"
                      >
                        <option value="Mansehra">Mansehra</option>
                        <option value="Abbottabad">Abbottabad</option>
                        <option value="Haripur">Haripur</option>
                        <option value="Battagram">Battagram</option>
                        <option value="Torghar">Torghar</option>
                        <option value="Kohistan">Kohistan</option>
                        <option value="Other District (KP / Pakistan)">Other District (KP / Pakistan)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Province *
                      </label>
                      <input
                        type="text"
                        readOnly
                        value={formData.province}
                        className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-100 border border-slate-200 text-slate-600"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Candidate Mobile Number (SMS Alerts) *
                      </label>
                      <input
                        type="tel"
                        required
                        placeholder="0300-1234567"
                        value={formData.mobile}
                        onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                        className="w-full px-3.5 py-2.5 text-xs font-mono rounded-xl bg-slate-50 border border-slate-300 focus:bg-white focus:border-[#185b9d] focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        WhatsApp Number (Roll No Slip & Exam Notes) *
                      </label>
                      <input
                        type="tel"
                        required
                        placeholder="0305-1234567"
                        value={formData.whatsapp}
                        onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                        className="w-full px-3.5 py-2.5 text-xs font-mono rounded-xl bg-slate-50 border border-slate-300 focus:bg-white focus:border-[#185b9d] focus:outline-hidden"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STAGE 3: EDUCATION INFO */}
              {currentStage === 3 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-slate-900 border-b pb-2">
                    Stage 3: Current Educational Enrollment
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Current Class Level Applying For *
                      </label>
                      <select
                        value={formData.currentClass}
                        onChange={(e) => setFormData({ ...formData, currentClass: e.target.value })}
                        className="w-full px-3.5 py-2.5 text-xs font-bold text-[#185b9d] rounded-xl bg-blue-50 border border-blue-200 focus:bg-white focus:border-[#185b9d] focus:outline-hidden"
                      >
                        {MONTHLY_ASSISTANCE_RATES.map((rate) => (
                          <option key={rate.classLevel} value={rate.classLevel}>
                            {rate.classLevel} ({rate.name})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Discipline / Group *
                      </label>
                      <input
                        type="text"
                        placeholder="Science (Biology) / Pre-Engg / Computer Science"
                        value={formData.discipline}
                        onChange={(e) => setFormData({ ...formData, discipline: e.target.value })}
                        className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-300 focus:bg-white focus:border-[#185b9d] focus:outline-hidden"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Current School / College Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Government High School Gandhian / Dubai International College"
                        value={formData.schoolName}
                        onChange={(e) => setFormData({ ...formData, schoolName: e.target.value })}
                        className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-300 focus:bg-white focus:border-[#185b9d] focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Affiliated BISE Board / University *
                      </label>
                      <select
                        value={formData.boardUniversity}
                        onChange={(e) => setFormData({ ...formData, boardUniversity: e.target.value })}
                        className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-300 focus:bg-white focus:border-[#185b9d] focus:outline-hidden"
                      >
                        <option value="BISE Abbottabad">BISE Abbottabad</option>
                        <option value="BISE Peshawar">BISE Peshawar</option>
                        <option value="BISE Mardan">BISE Mardan</option>
                        <option value="BISE Malakand">BISE Malakand</option>
                        <option value="Federal Board (FBISE)">Federal Board (FBISE)</option>
                        <option value="Hazara University Mansehra">Hazara University Mansehra</option>
                        <option value="Other Board / University">Other Board / University</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Current Institutional Roll No
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 4210"
                        value={formData.currentRollNo}
                        onChange={(e) => setFormData({ ...formData, currentRollNo: e.target.value })}
                        className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-300 focus:bg-white focus:border-[#185b9d] focus:outline-hidden"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STAGE 4: SCHOLARSHIP CATEGORY */}
              {currentStage === 4 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-slate-900 border-b pb-2">
                    Stage 4: Primary Scholarship Category Selection
                  </h3>

                  <div className="space-y-3">
                    {BENEFICIARY_CATEGORIES.map((cat) => (
                      <label
                        key={cat.id}
                        className={`flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition-all ${
                          formData.appliedCategory.includes(cat.title)
                            ? 'bg-blue-50/80 border-[#185b9d] ring-1 ring-[#185b9d]'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="scholarshipCategory"
                          checked={formData.appliedCategory.includes(cat.title)}
                          onChange={() => setFormData({ ...formData, appliedCategory: `${cat.code} - ${cat.title}` })}
                          className="mt-1 text-[#185b9d] focus:ring-[#185b9d]"
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-900">{cat.code}: {cat.title}</span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                              {cat.seats} Seats
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 mt-0.5">{cat.headline}</p>
                        </div>
                      </label>
                    ))}
                  </div>

                  <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs">
                    <label className="flex items-center gap-2 font-bold text-amber-900">
                      <input
                        type="checkbox"
                        checked={formData.isSpecialNeed}
                        onChange={(e) => setFormData({ ...formData, isSpecialNeed: e.target.checked })}
                        className="rounded text-amber-600 focus:ring-amber-500"
                      />
                      <span>Apply under Special Quota (Orphan / Persons with Disability / Single-Parent)</span>
                    </label>
                  </div>
                </div>
              )}

              {/* STAGE 5: FAMILY & FINANCIAL INFO */}
              {currentStage === 5 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-slate-900 border-b pb-2">
                    Stage 5: Guardian Profile & Household Financials
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Father / Guardian Occupation *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Daily Wage Worker / Farmer / Teacher / Private Job"
                        value={formData.guardianOccupation}
                        onChange={(e) => setFormData({ ...formData, guardianOccupation: e.target.value })}
                        className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-300 focus:bg-white focus:border-[#185b9d] focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Total Monthly Household Income (PKR) *
                      </label>
                      <input
                        type="number"
                        required
                        value={formData.monthlyHouseholdIncome}
                        onChange={(e) => setFormData({ ...formData, monthlyHouseholdIncome: Number(e.target.value) })}
                        className="w-full px-3.5 py-2.5 text-xs font-mono font-bold rounded-xl bg-slate-50 border border-slate-300 focus:bg-white focus:border-[#185b9d] focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Number of Family Dependents (Brothers/Sisters) *
                      </label>
                      <input
                        type="number"
                        value={formData.dependentsCount}
                        onChange={(e) => setFormData({ ...formData, dependentsCount: Number(e.target.value) })}
                        className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-300 focus:bg-white focus:border-[#185b9d] focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Emergency Contact Person & Phone *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Uncle: 0312-9876543"
                        value={formData.emergencyContact}
                        onChange={(e) => setFormData({ ...formData, emergencyContact: e.target.value })}
                        className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-300 focus:bg-white focus:border-[#185b9d] focus:outline-hidden"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STAGE 6: ACADEMIC HISTORY */}
              {currentStage === 6 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b pb-2">
                    <h3 className="text-lg font-bold text-slate-900">
                      Stage 6: Prior Academic Record Matrix
                    </h3>
                    <span className="text-xs text-slate-500 font-medium">10% Merit Weighting</span>
                  </div>

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
                              <td className="p-2.5 font-bold text-slate-900">{rec.gradeClass}</td>
                              <td className="p-2.5 font-mono">{rec.passingYear}</td>
                              <td className="p-2.5 font-mono">{rec.totalMarks}</td>
                              <td className="p-2.5 font-mono font-bold text-[#185b9d]">{rec.obtainedMarks}</td>
                              <td className="p-2.5 font-mono font-bold text-emerald-700">{rec.percentage}%</td>
                              <td className="p-2.5 text-slate-600">{rec.institute}</td>
                              <td className="p-2.5 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveAcademicRecord(rIdx)}
                                  className="text-rose-600 hover:text-rose-800 font-bold text-xs"
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
                    <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500 space-y-1">
                      <p className="font-semibold text-slate-700">No academic records added yet.</p>
                      <p>Enter your previous grade results below to include them with your application.</p>
                    </div>
                  )}

                  {/* Add Academic Record Form */}
                  <div className="p-4 rounded-2xl bg-slate-100/80 border border-slate-200 space-y-3">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Plus className="w-3.5 h-3.5 text-[#185b9d]" />
                      Add Academic Examination Record
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Class / Grade *</label>
                        <input
                          type="text"
                          placeholder="e.g. Class 9th / Matric"
                          value={newGrade}
                          onChange={(e) => setNewGrade(e.target.value)}
                          className="w-full px-3 py-2 text-xs rounded-xl bg-white border border-slate-300 focus:outline-hidden"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Passing Year *</label>
                        <input
                          type="text"
                          placeholder="e.g. 2025"
                          value={newYear}
                          onChange={(e) => setNewYear(e.target.value)}
                          className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-white border border-slate-300 focus:outline-hidden"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Total Marks *</label>
                        <input
                          type="number"
                          placeholder="e.g. 550"
                          value={newTotalMarks || ''}
                          onChange={(e) => setNewTotalMarks(Number(e.target.value))}
                          className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-white border border-slate-300 focus:outline-hidden"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Obtained Marks *</label>
                        <input
                          type="number"
                          placeholder="e.g. 485"
                          value={newObtMarks || ''}
                          onChange={(e) => setNewObtMarks(Number(e.target.value))}
                          className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-white border border-slate-300 focus:outline-hidden"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">School / Institute Name *</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="e.g. Government High School Gandhian"
                            value={newInstitute}
                            onChange={(e) => setNewInstitute(e.target.value)}
                            className="flex-1 px-3 py-2 text-xs rounded-xl bg-white border border-slate-300 focus:outline-hidden"
                          />
                          <button
                            type="button"
                            onClick={handleAddAcademicRecord}
                            className="px-4 py-2 bg-[#185b9d] hover:bg-[#13497e] text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add Record</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span>DMC results will be authenticated during the 6-member interview scrutiny.</span>
                  </div>
                </div>
              )}

              {/* STAGE 7: DOCUMENT UPLOAD MATRIX */}
              {currentStage === 7 && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b pb-2 gap-2">
                    <h3 className="text-lg font-bold text-slate-900">
                      Stage 7: Mandatory Document Upload Matrix
                    </h3>
                    <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 inline-flex items-center gap-1 w-fit">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                      No file size limit for documents
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      { key: 'bformUploaded' as const, title: 'Candidate B-Form / CNIC Scanned Copy', req: true },
                      { key: 'fatherCnicUploaded' as const, title: 'Father / Guardian CNIC Front & Back', req: true },
                      { key: 'dmcUploaded' as const, title: 'Last Examination DMC / Result Card', req: true },
                      { key: 'domicileUploaded' as const, title: 'Domicile Certificate (KP / Hazara)', req: true },
                      { key: 'incomeCertUploaded' as const, title: 'Income / Need Proof Certificate (Optional)', req: false },
                    ].map((doc) => {
                      const isUploaded = formData.documents[doc.key];
                      const fileInfo = uploadedDocs[doc.key];

                      return (
                        <div
                          key={doc.key}
                          className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                            isUploaded
                              ? 'bg-emerald-50/80 border-emerald-300 ring-1 ring-emerald-300/30'
                              : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                          }`}
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-1.5">
                                <FileCheck className={`w-4 h-4 flex-shrink-0 ${isUploaded ? 'text-emerald-600' : 'text-slate-400'}`} />
                                <span className="text-xs font-bold text-slate-800 leading-snug">{doc.title}</span>
                              </div>
                              {doc.req && (
                                <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded-md border border-rose-100 flex-shrink-0">
                                  Required
                                </span>
                              )}
                            </div>

                            {isUploaded && fileInfo ? (
                              <div className="p-2 rounded-xl bg-white border border-emerald-200 flex items-center justify-between text-xs">
                                <div className="min-w-0 pr-2">
                                  <span className="font-semibold text-slate-800 truncate block text-[11px]">
                                    {fileInfo.name}
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    {fileInfo.size}
                                  </span>
                                </div>
                                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md flex-shrink-0">
                                  Attached ✓
                                </span>
                              </div>
                            ) : (
                              <p className="text-[10px] text-slate-400">PDF, JPG, PNG, or Word document</p>
                            )}
                          </div>

                          <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                            {isUploaded ? (
                              <>
                                <label className="flex-1 cursor-pointer py-1.5 text-center text-xs font-bold text-[#185b9d] bg-blue-50 hover:bg-blue-100 rounded-xl border border-blue-200 transition">
                                  Change File
                                  <input
                                    type="file"
                                    accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                                    onChange={(e) => handleDocumentUpload(doc.key, e)}
                                    className="hidden"
                                  />
                                </label>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveDocument(doc.key)}
                                  className="px-3 py-1.5 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl border border-rose-200 transition"
                                >
                                  Remove
                                </button>
                              </>
                            ) : (
                              <label className="w-full cursor-pointer py-2 text-center text-xs font-bold text-slate-700 bg-slate-100 hover:bg-[#185b9d] hover:text-white rounded-xl border border-slate-300 transition flex items-center justify-center gap-1.5">
                                <UploadCloud className="w-3.5 h-3.5" />
                                <span>+ Choose Document File</span>
                                <input
                                  type="file"
                                  accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                                  onChange={(e) => handleDocumentUpload(doc.key, e)}
                                  className="hidden"
                                />
                              </label>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}


              {/* STAGE 8: DECLARATION & E-SIGNATURE */}
              {currentStage === 8 && (
                <div className="space-y-5">
                  <h3 className="text-lg font-bold text-slate-900 border-b pb-2">
                    Stage 8: Legal Declaration & Digital E-Signature
                  </h3>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 text-xs text-slate-700 leading-relaxed">
                    <p className="font-semibold text-slate-900">
                      I solemnly affirm that all information provided in this Session V (2026) application is accurate and true to the best of my knowledge.
                    </p>
                    <ul className="list-disc pl-4 space-y-1 text-slate-600">
                      <li>I understand that 100% of exam questions are drawn from AZM official question banks.</li>
                      <li>I agree to adhere strictly to the OMR optical examination regulations.</li>
                      <li>Any deliberate falsehood or forged document will result in instant disqualification and debarment.</li>
                    </ul>

                    <label className="flex items-center gap-2 pt-2 text-slate-900 font-bold cursor-pointer">
                      <input
                        type="checkbox"
                        required
                        checked={formData.declarationAccepted}
                        onChange={(e) => setFormData({ ...formData, declarationAccepted: e.target.checked })}
                        className="rounded text-[#185b9d] focus:ring-[#185b9d] w-4 h-4"
                      />
                      <span>I accept the AZM.AIO Session V Terms, Merit Rules, and Evaluation Protocol *</span>
                    </label>
                  </div>

                  {/* Interactive Signature Pad */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-slate-800">
                        Candidate / Guardian Digital Signature Pad (Draw with mouse or finger):
                      </label>
                      <button
                        type="button"
                        onClick={clearSignature}
                        className="text-[11px] text-rose-600 hover:text-rose-800 font-semibold flex items-center gap-1"
                      >
                        <RotateCcw className="w-3 h-3" /> Clear Signature
                      </button>
                    </div>

                    <div className="border-2 border-dashed border-slate-300 rounded-2xl bg-slate-50 p-1">
                      <canvas
                        ref={sigCanvasRef}
                        width={500}
                        height={120}
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                        onTouchStart={startDrawing}
                        onTouchMove={draw}
                        onTouchEnd={stopDrawing}
                        className="w-full h-[120px] bg-white rounded-xl cursor-crosshair touch-none"
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Sign above using touch screen, stylus, or trackpad.
                    </span>
                  </div>
                </div>
              )}

              {/* Wizard Navigation & Action Buttons */}
              <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between">
                <div>
                  {currentStage > 1 ? (
                    <button
                      type="button"
                      onClick={() => setCurrentStage(prev => Math.max(prev - 1, 1))}
                      className="px-4 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all flex items-center gap-1.5 focus:outline-hidden"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Previous Stage</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={saveDraft}
                      className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 flex items-center gap-1"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{saveStatus || 'Auto-Save Draft'}</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {currentStage < 8 ? (
                    <button
                      type="button"
                      onClick={() => setCurrentStage(prev => Math.min(prev + 1, 8))}
                      className="px-6 py-2.5 text-xs font-bold text-white bg-[#185b9d] hover:bg-[#13497e] rounded-xl shadow-md transition-all flex items-center gap-2 focus:outline-hidden"
                    >
                      <span>Next: Stage {currentStage + 1}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      id="btn-final-submit-application"
                      className="px-8 py-3 text-xs font-extrabold text-white bg-gradient-to-r from-[#185b9d] via-emerald-600 to-[#299b46] hover:opacity-95 disabled:opacity-60 rounded-xl shadow-lg transition-all flex items-center gap-2 transform hover:scale-[1.02] focus:outline-hidden"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 text-white animate-spin" />
                          <span>Registering in Central Database...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 text-amber-300" />
                          <span>Submit Official Session V Application</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {submitError && (
                <div className="mt-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                  <span>{submitError}</span>
                </div>
              )}
            </form>
          </div>

          {/* Right Live Application Preview & Status Card (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="p-6 rounded-3xl bg-slate-900 text-white shadow-xl border border-slate-800 space-y-4 sticky top-24">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                  Live Application Ledger
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white/10 text-slate-300">
                  {formData.id}
                </span>
              </div>

              {/* Candidate Info Snippet */}
              <div className="flex items-center gap-3">
                {formData.photoUrl ? (
                  <img
                    src={formData.photoUrl}
                    alt="Candidate"
                    className="w-14 h-14 rounded-2xl object-cover border-2 border-emerald-400"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-2xl bg-slate-800 border-2 border-dashed border-slate-600 flex items-center justify-center text-slate-500">
                    <User className="w-6 h-6" />
                  </div>
                )}
                <div>
                  <div className="text-sm font-bold text-white font-display">
                    {formData.fullName || 'Candidate Full Name'}
                  </div>
                  <div className="text-xs text-slate-400">
                    S/O: {formData.fatherName || 'Father Name'}
                  </div>
                  <div className="text-[11px] text-emerald-400 font-mono mt-0.5">
                    {formData.cnicBForm || '13503-XXXXXXX-X'}
                  </div>
                </div>
              </div>

              {/* Progress Ring */}
              <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400 block">Form Completeness</span>
                  <span className="text-lg font-bold text-emerald-300 font-display">
                    {calculateProgress()}% Ready
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block">Target Grade</span>
                  <span className="text-xs font-bold text-white">{formData.currentClass}</span>
                </div>
              </div>

              {/* Selected Target Category */}
              <div className="space-y-1 text-xs">
                <span className="text-slate-400 text-[11px]">Applied Category:</span>
                <div className="p-2.5 rounded-xl bg-white/10 font-medium text-slate-200 text-xs">
                  {formData.appliedCategory}
                </div>
              </div>

              {/* Trust Badge */}
              <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>Zero registration fee. 100% merit-based verification.</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= SUCCESS CONFIRMATION & FEE PAYMENT HUB ================= */}
      {isSubmitted && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-3xl mx-auto space-y-6"
        >
          {/* Main Success & Status Banner */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-6 sm:p-8 text-center space-y-5 relative overflow-hidden">
            <div className="absolute top-0 right-0 left-0 h-2 bg-gradient-to-r from-amber-400 via-emerald-500 to-[#185b9d]" />
            
            <div className="w-16 h-16 rounded-3xl bg-emerald-100 border border-emerald-300 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1 bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold rounded-full uppercase tracking-wider">
                <Clock className="w-3.5 h-3.5 text-amber-700 animate-spin" style={{ animationDuration: '6s' }} />
                Registration Logged • Fee Pending Verification
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold font-display text-slate-900">
                Application Successfully Registered!
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 max-w-xl mx-auto leading-relaxed">
                Thank you, <strong>{formData.fullName}</strong>. Your candidate registration for <strong>AZM.AIO Session V (2026)</strong> has been logged into the central database.
              </p>
            </div>

            {/* Candidate Metadata Summary Card */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-left">
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Application ID</span>
                <span className="text-xs sm:text-sm font-extrabold font-mono text-[#185b9d] block truncate">
                  {submittedAppId}
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(submittedAppId, 'appId')}
                  className="text-[10px] text-[#185b9d] hover:underline font-bold flex items-center gap-1"
                >
                  {copiedField === 'appId' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedField === 'appId' ? 'Copied!' : 'Copy ID'}</span>
                </button>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Challan Fee</span>
                <span className="text-xs sm:text-sm font-extrabold font-mono text-emerald-700 block">
                  PKR 300 (Fixed)
                </span>
                <span className="text-[10px] text-slate-500 font-medium block">Nominal test fee</span>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Class / Grade</span>
                <span className="text-xs sm:text-sm font-bold text-slate-900 block truncate">
                  {formData.currentClass}
                </span>
                <span className="text-[10px] text-slate-500 block truncate">{formData.discipline || 'General'}</span>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Exam Roll No</span>
                <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md inline-block">
                  Awaiting Fee
                </span>
                <span className="text-[10px] text-slate-500 font-medium block">Unlocks on approval</span>
              </div>
            </div>

            {/* Explanatory Notice */}
            <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-blue-950 text-xs flex items-start gap-3 text-left">
              <ShieldCheck className="w-5 h-5 text-[#185b9d] flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <strong className="block text-slate-900 font-bold">
                  Next Step: Complete PKR 300 Fee Payment to Unlock Roll Number Slip
                </strong>
                <p className="text-slate-600 leading-relaxed text-[11px]">
                  To prevent ghost registrations, your standardized <strong>Roll Number Slip with Biometric Exam QR Code</strong> will be activated once your PKR 300 fee is approved. Choose your preferred payment option below:
                </p>
              </div>
            </div>
          </div>

          {/* Payment Methods Tabs Box */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <span className="text-xs font-bold text-emerald-700 uppercase tracking-widest block">
                  Select Payment Method
                </span>
                <h3 className="text-lg font-bold font-display text-slate-900">
                  How Would You Like to Pay PKR 300?
                </h3>
              </div>
              <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold font-mono rounded-full">
                Amount: PKR 300
              </span>
            </div>

            {/* Payment Method Selector Buttons */}
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setPaymentTab('easypaisa')}
                className={`p-3.5 rounded-2xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                  paymentTab === 'easypaisa'
                    ? 'bg-[#185b9d] text-white border-[#185b9d] shadow-md ring-2 ring-[#185b9d]/30'
                    : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                }`}
              >
                <Smartphone className="w-5 h-5" />
                <span className="text-xs font-bold">JazzCash / EasyPaisa</span>
                <span className={`text-[10px] ${paymentTab === 'easypaisa' ? 'text-sky-200' : 'text-slate-500'}`}>Instant Transfer</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentTab('bank')}
                className={`p-3.5 rounded-2xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                  paymentTab === 'bank'
                    ? 'bg-[#185b9d] text-white border-[#185b9d] shadow-md ring-2 ring-[#185b9d]/30'
                    : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                }`}
              >
                <CreditCard className="w-5 h-5" />
                <span className="text-xs font-bold">Bank Transfer / IBFT</span>
                <span className={`text-[10px] ${paymentTab === 'bank' ? 'text-sky-200' : 'text-slate-500'}`}>Online / Branch</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentTab('hub')}
                className={`p-3.5 rounded-2xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                  paymentTab === 'hub'
                    ? 'bg-[#185b9d] text-white border-[#185b9d] shadow-md ring-2 ring-[#185b9d]/30'
                    : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                }`}
              >
                <Building2 className="w-5 h-5" />
                <span className="text-xs font-bold">In-Person at Hub</span>
                <span className={`text-[10px] ${paymentTab === 'hub' ? 'text-sky-200' : 'text-slate-500'}`}>Mansehra Centres</span>
              </button>
            </div>

            {/* TAB 1: JazzCash / EasyPaisa Details */}
            {paymentTab === 'easypaisa' && (
              <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-50/70 to-slate-50 border border-emerald-200/80 space-y-4 text-xs">
                <div className="flex items-center justify-between border-b border-emerald-200 pb-3">
                  <div>
                    <span className="font-bold text-slate-900 block text-sm">JazzCash / EasyPaisa Direct Transfer</span>
                    <span className="text-slate-500 text-[11px]">Send PKR 300 from any mobile wallet in Pakistan</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-md bg-emerald-600 text-white font-bold text-[10px]">
                    Recommended
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Account Number / Mobile</span>
                      <span className="text-sm font-extrabold font-mono text-slate-900">0305-1755551</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard('03051755551', 'mobileNo')}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 font-bold text-[11px] flex items-center gap-1"
                    >
                      {copiedField === 'mobileNo' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedField === 'mobileNo' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Account Title</span>
                    <span className="text-sm font-extrabold text-slate-900">AZM.AIO (Pvt.) Ltd.</span>
                  </div>
                </div>

                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 space-y-1">
                  <strong>Important: Payment Reference / Note</strong>
                  <p className="text-[11px] text-amber-800">
                    When making the transfer, enter your Application ID (<strong>{submittedAppId}</strong>) in the remarks/purpose field.
                  </p>
                </div>

                {/* Instant WhatsApp Proof Button */}
                <a
                  href={`https://wa.me/923051755551?text=${encodeURIComponent(
                    `Hello AZM Accounts Desk,\n\nI have registered for Session V (2026) Scholarship Exam.\n• Application ID: ${submittedAppId}\n• Candidate: ${formData.fullName}\n• Class: ${formData.currentClass}\n• Fee Amount: PKR 300\n\nPlease find attached my payment receipt/screenshot for quick verification and Roll Number activation.`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-3 bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Send Fee Screenshot on WhatsApp (+92 305 1755551)</span>
                </a>
              </div>
            )}

            {/* TAB 2: Bank Transfer / IBFT Details */}
            {paymentTab === 'bank' && (
              <div className="p-5 rounded-2xl bg-gradient-to-br from-blue-50/70 to-slate-50 border border-blue-200/80 space-y-4 text-xs">
                <div className="flex items-center justify-between border-b border-blue-200 pb-3">
                  <div>
                    <span className="font-bold text-slate-900 block text-sm">Direct Bank Transfer / Online IBFT</span>
                    <span className="text-slate-500 text-[11px]">Pay via banking app or visit any bank branch</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-md bg-blue-700 text-white font-bold text-[10px]">
                    Bank / ATM
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Account Title</span>
                    <span className="text-xs font-bold text-slate-900">AZM.AIO (Pvt.) Ltd.</span>
                    <span className="text-[10px] text-slate-500 block">SECP CUIN: {OFFICIAL_DATA.cuin}</span>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Account Number</span>
                      <span className="text-xs font-extrabold font-mono text-slate-900">0321467001</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard('0321467001', 'bankAcc')}
                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 font-bold text-[11px] flex items-center gap-1"
                    >
                      {copiedField === 'bankAcc' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedField === 'bankAcc' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Bank Name</span>
                    <span className="text-xs font-bold text-slate-900">Bank of Khyber / Meezan Bank</span>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Branch</span>
                    <span className="text-xs font-bold text-slate-900">Main City Branch, Mansehra</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowFullChallan(true)}
                    className="px-4 py-2.5 bg-[#185b9d] hover:bg-[#13497e] text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5"
                  >
                    <Receipt className="w-4 h-4" />
                    <span>View Official 3-Part Bank Challan</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs rounded-xl flex items-center gap-1.5"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print Deposit Slip</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB 3: Walk-In Cash at Hubs */}
            {paymentTab === 'hub' && (
              <div className="p-5 rounded-2xl bg-gradient-to-br from-purple-50/70 to-slate-50 border border-purple-200/80 space-y-4 text-xs">
                <div className="flex items-center justify-between border-b border-purple-200 pb-3">
                  <div>
                    <span className="font-bold text-slate-900 block text-sm">Pay Cash at In-Person Facilitation Hubs</span>
                    <span className="text-slate-500 text-[11px]">Submit PKR 300 fee directly at any of our 3 Mansehra desks</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-md bg-purple-700 text-white font-bold text-[10px]">
                    Cash Counter
                  </span>
                </div>

                <div className="space-y-2.5">
                  <div className="p-3 bg-white rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <strong className="text-slate-900 block font-bold">1. Jadoon Public High School & College (Head Office)</strong>
                      <span className="text-slate-500 text-[11px]">Karakoram Highway, Gandhian, Mansehra • Mon-Sat (8:30 AM - 4:30 PM)</span>
                    </div>
                    <span className="font-mono text-xs font-bold text-[#185b9d]">0305-1755551</span>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <strong className="text-slate-900 block font-bold">2. Dubai International Public School & College (DIPS)</strong>
                      <span className="text-slate-500 text-[11px]">Kashmir Road, Near Shinkiari Chowk • Pervez (Principal)</span>
                    </div>
                    <span className="font-mono text-xs font-bold text-emerald-700">+92 300 5643177</span>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <strong className="text-slate-900 block font-bold">3. Khyber Public School & College</strong>
                      <span className="text-slate-500 text-[11px]">Abbottabad Road, College Chowk • Asfandyar (Vice Principal)</span>
                    </div>
                    <span className="font-mono text-xs font-bold text-emerald-700">+92 331 5014441</span>
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Actions Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadStudentPdf}
                  disabled={isDownloadingPdf}
                  className="px-5 py-2.5 rounded-xl bg-[#185b9d] hover:bg-[#13497e] disabled:opacity-50 text-white font-bold text-xs shadow-md flex items-center gap-2 transition"
                >
                  {isDownloadingPdf ? (
                    <>
                      <Loader2 className="w-4 h-4 text-white animate-spin" />
                      <span>Generating Application PDF...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>Download Registration Slip (PDF)</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setShowFullChallan(true)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs flex items-center gap-1.5"
                >
                  <Receipt className="w-4 h-4" />
                  <span>3-Part Bank Challan</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onSelectTab('rollnumber');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="px-4 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs border border-emerald-200 flex items-center gap-1.5"
                >
                  <span>Check Roll No Desk</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsSubmitted(false);
                    setCreatedStudent(null);
                    setCurrentStage(1);
                  }}
                  className="px-3 py-2 text-xs text-slate-500 hover:text-slate-800"
                >
                  Submit Another
                </button>
              </div>
            </div>
          </div>

          {/* 3-PART BANK CHALLAN POPUP MODAL */}
          {showFullChallan && (
            <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
              <div className="bg-white rounded-3xl max-w-4xl w-full p-6 sm:p-8 space-y-6 shadow-2xl border border-slate-200 my-8">
                <div className="flex items-center justify-between border-b pb-4">
                  <div className="flex items-center gap-2">
                    <Receipt className="w-5 h-5 text-[#185b9d]" />
                    <h3 className="text-lg font-bold font-display text-slate-900">
                      Official 3-Part Bank Deposit Challan (Session V)
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowFullChallan(false)}
                    className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-500"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* 3 Columns Challan Slip */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
                  {['Bank Copy', 'AZM Board Copy', 'Candidate Copy'].map((copyTitle, cIdx) => (
                    <div key={cIdx} className="p-4 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 space-y-3">
                      <div className="text-center border-b border-slate-300 pb-2">
                        <span className="font-bold text-slate-900 block font-display text-xs uppercase">AZM.AIO (Pvt.) Ltd.</span>
                        <span className="text-[10px] text-slate-500 block">SECP CUIN: {OFFICIAL_DATA.cuin}</span>
                        <span className="px-2 py-0.5 bg-blue-100 text-[#185b9d] text-[10px] font-bold rounded-md inline-block mt-1">
                          {copyTitle}
                        </span>
                      </div>

                      <div className="space-y-1.5 text-[11px]">
                        <div><span className="text-slate-500">Challan No:</span> <strong className="text-slate-900">{submittedAppId}</strong></div>
                        <div><span className="text-slate-500">Candidate:</span> <strong className="text-slate-900">{formData.fullName || 'Candidate'}</strong></div>
                        <div><span className="text-slate-500">Father Name:</span> <span className="text-slate-800">{formData.fatherName}</span></div>
                        <div><span className="text-slate-500">Class:</span> <span className="text-slate-800">{formData.currentClass}</span></div>
                        <div><span className="text-slate-500">CNIC / B-Form:</span> <span className="text-slate-800">{formData.cnicBForm}</span></div>
                        <div><span className="text-slate-500">Account No:</span> <strong className="text-slate-900">0321467001</strong></div>
                        <div className="pt-2 border-t border-slate-200">
                          <span className="text-slate-500">Amount (Fee):</span> <strong className="text-emerald-700 text-xs">PKR 300/-</strong>
                        </div>
                      </div>

                      <div className="pt-6 border-t border-slate-300 flex justify-between text-[9px] text-slate-400">
                        <span>Bank Officer Stamp</span>
                        <span>Candidate Sign</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="px-5 py-2.5 bg-[#185b9d] hover:bg-[#13497e] text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print 3-Part Challan</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowFullChallan(false)}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      )}


      {/* ================= PARTNER INSTITUTION ENROLMENT ================= */}
      {activePortalTab === 'partner' && !isPartnerSubmitted && (
        <div className="max-w-3xl mx-auto bg-white rounded-3xl border border-slate-200/90 shadow-xl p-6 sm:p-8 space-y-6">
          <div className="border-b border-slate-200 pb-4">
            <span className="text-xs font-bold text-[#185b9d] uppercase tracking-widest">
              Institutional Accreditation
            </span>
            <h2 className="text-2xl font-bold font-display text-slate-900 mt-1">
              Partner School & College Registration (Session V)
            </h2>
            <p className="text-xs text-slate-600 mt-1">
              Schools and colleges across Hazara Division and KP can enroll to facilitate bulk student registrations, host examination centers, and receive official AZM Question Bank syllabus copies.
            </p>
          </div>

          <form onSubmit={handlePartnerSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Institution Official Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Modern Age Public High School & College"
                  value={partnerData.institutionName}
                  onChange={(e) => setPartnerData({ ...partnerData, institutionName: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-300 focus:bg-white focus:border-[#185b9d] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Institution Category *
                </label>
                <select
                  value={partnerData.category}
                  onChange={(e) => setPartnerData({ ...partnerData, category: e.target.value as any })}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-300 focus:bg-white focus:border-[#185b9d] focus:outline-hidden"
                >
                  <option value="School">School (Grade 6 to 10)</option>
                  <option value="Higher Secondary">Higher Secondary / Inter College (Grade 6 to 12)</option>
                  <option value="University/Degree College">Degree College / BS University</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Campus / Branch *
                </label>
                <input
                  type="text"
                  placeholder="Main Campus / Girls Wing"
                  value={partnerData.campus}
                  onChange={(e) => setPartnerData({ ...partnerData, campus: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-300 focus:bg-white focus:border-[#185b9d] focus:outline-hidden"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Full Campus Postal Address *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Main Road, Tehsil, District"
                  value={partnerData.address}
                  onChange={(e) => setPartnerData({ ...partnerData, address: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-300 focus:bg-white focus:border-[#185b9d] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Principal / Head Focal Person *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Prof. / Dr. / Mr. Name"
                  value={partnerData.contactPerson}
                  onChange={(e) => setPartnerData({ ...partnerData, contactPerson: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-300 focus:bg-white focus:border-[#185b9d] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Official WhatsApp Contact *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="0300-1234567"
                  value={partnerData.whatsapp}
                  onChange={(e) => setPartnerData({ ...partnerData, whatsapp: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-xs font-mono rounded-xl bg-slate-50 border border-slate-300 focus:bg-white focus:border-[#185b9d] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Total Student Strength
                </label>
                <input
                  type="number"
                  value={partnerData.totalStudentStrength}
                  onChange={(e) => setPartnerData({ ...partnerData, totalStudentStrength: Number(e.target.value) })}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-300 focus:bg-white focus:border-[#185b9d] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Expected Candidate Nominations
                </label>
                <input
                  type="number"
                  value={partnerData.expectedApplicants}
                  onChange={(e) => setPartnerData({ ...partnerData, expectedApplicants: Number(e.target.value) })}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-300 focus:bg-white focus:border-[#185b9d] focus:outline-hidden"
                />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <div className="text-xs">
                  <span className="font-bold text-slate-900 block">Official Principal Stamp & Signature</span>
                  <span className="text-slate-500 text-[11px]">Attach letterhead or verified stamp (Simulated Active)</span>
                </div>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-800">
                Verified Attached
              </span>
            </div>

            <button
              type="submit"
              disabled={isPartnerSubmitting}
              id="btn-partner-submit"
              className="w-full py-3 bg-[#185b9d] hover:bg-[#13497e] disabled:opacity-60 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
            >
              {isPartnerSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 text-white animate-spin" />
                  <span>Enrolling Institution in Network...</span>
                </>
              ) : (
                <>
                  <Building2 className="w-4 h-4" />
                  <span>Enroll Institution in AZM Affiliation Network</span>
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* Partner Confirmation Modal */}
      {isPartnerSubmitted && (
        <div className="max-w-xl mx-auto bg-white rounded-3xl border border-slate-200 shadow-xl p-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold font-display text-slate-900">
            Institution Enrollment Confirmed!
          </h2>
          <p className="text-xs text-slate-600">
            Thank you, <strong>{partnerData.institutionName || 'Principal'}</strong>. Your institution has been enrolled into the AZM Affiliation Ledger with Partner Code <strong>{createdPartner?.partnerCode || 'PRT-2026'}</strong>.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
            <button
              onClick={handleDownloadPartnerPdf}
              disabled={isDownloadingPartnerPdf}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs shadow-md flex items-center gap-2 transition"
            >
              {isDownloadingPartnerPdf ? (
                <>
                  <Loader2 className="w-4 h-4 text-white animate-spin" />
                  <span>Generating Official Agreement PDF...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Download Affiliation Agreement PDF</span>
                </>
              )}
            </button>

            <button
              onClick={() => {
                setIsPartnerSubmitted(false);
                setCreatedPartner(null);
              }}
              className="px-5 py-2.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl"
            >
              Back to Portal
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
