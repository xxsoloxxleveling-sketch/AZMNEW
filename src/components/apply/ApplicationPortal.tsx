import React, { useState, useEffect, useRef } from 'react';
import { StudentApplicationData, PartnerSchoolData, PageTab } from '../../types';
import { MONTHLY_ASSISTANCE_RATES, BENEFICIARY_CATEGORIES, OFFICIAL_DATA } from '../../data/scholarshipData';
import { submitStudentApplication, submitPartnerSchoolApplication } from '../../services/api';
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
  Plus
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

  // Complete Application Submit

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.declarationAccepted) {
      alert('Please accept the final declaration before submitting.');
      return;
    }

    const res = await submitStudentApplication(formData);
    const finalId = res.data?.applicationId || `APP-V-${Math.floor(10000 + Math.random() * 90000)}`;
    setSubmittedAppId(finalId);
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
        origin: { y: 0.6 }
      });
    } catch (err) {}
  };

  // Partner School Submit
  const handlePartnerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitPartnerSchoolApplication(partnerData);
    setIsPartnerSubmitted(true);
    try {
      const confettiModule = await import('canvas-confetti');
      const confetti = confettiModule.default || confettiModule;
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    } catch (err) {}
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
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Candidate Passport Photo Preview
                      </label>
                      <div className="flex items-center gap-3">
                        <img
                          src={formData.photoUrl}
                          alt="Candidate Preview"
                          className="w-12 h-12 rounded-xl object-cover border-2 border-[#185b9d]"
                        />
                        <button
                          type="button"
                          onClick={() => alert('Photo crop & verification preview active.')}
                          className="px-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium"
                        >
                          Change / Recrop
                        </button>
                      </div>
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
                  <h3 className="text-lg font-bold text-slate-900 border-b pb-2">
                    Stage 7: Mandatory Document Upload Matrix
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      { key: 'bformUploaded' as const, title: 'Candidate B-Form / CNIC Scanned Copy', req: true },
                      { key: 'fatherCnicUploaded' as const, title: 'Father / Guardian CNIC Front & Back', req: true },
                      { key: 'dmcUploaded' as const, title: 'Last Examination DMC / Result Card', req: true },
                      { key: 'domicileUploaded' as const, title: 'Domicile Certificate (KP / Hazara)', req: true },
                      { key: 'incomeCertUploaded' as const, title: 'Income / Need Proof Certificate (Optional)', req: false },
                    ].map((doc) => {
                      const isUploaded = formData.documents[doc.key];
                      return (
                        <div
                          key={doc.key}
                          className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${
                            isUploaded
                              ? 'bg-emerald-50/70 border-emerald-300 ring-1 ring-emerald-300/30'
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <FileCheck className={`w-4 h-4 ${isUploaded ? 'text-emerald-600' : 'text-slate-400'}`} />
                              <span className="text-xs font-bold text-slate-800">{doc.title}</span>
                            </div>
                            <span className={`text-[10px] font-semibold flex items-center gap-1 ${
                              isUploaded ? 'text-emerald-700' : 'text-slate-400'
                            }`}>
                              {isUploaded ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Attached
                                </>
                              ) : (
                                <span>Pending Attachment</span>
                              )}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setFormData(prev => ({
                                ...prev,
                                documents: {
                                  ...prev.documents,
                                  [doc.key]: !isUploaded
                                }
                              }));
                            }}
                            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-colors border ${
                              isUploaded
                                ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                                : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                            }`}
                          >
                            {isUploaded ? 'Attached ✓' : '+ Attach File'}
                          </button>
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
                      id="btn-final-submit-application"
                      className="px-8 py-3 text-xs font-extrabold text-white bg-gradient-to-r from-[#185b9d] via-emerald-600 to-[#299b46] hover:opacity-95 rounded-xl shadow-lg transition-all flex items-center gap-2 transform hover:scale-[1.02] focus:outline-hidden"
                    >
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      <span>Submit Official Session V Application</span>
                    </button>
                  )}
                </div>
              </div>
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
                <img
                  src={formData.photoUrl}
                  alt="Candidate"
                  className="w-14 h-14 rounded-2xl object-cover border-2 border-emerald-400"
                />
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

      {/* ================= SUCCESS CONFIRMATION RECEIPT MODAL ================= */}
      {isSubmitted && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-2xl mx-auto bg-white rounded-3xl border border-slate-200 shadow-2xl p-8 text-center space-y-6"
        >
          <div className="w-16 h-16 rounded-3xl bg-emerald-100 border border-emerald-300 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full uppercase">
              Application Successfully Registered
            </span>
            <h2 className="text-2xl font-bold font-display text-slate-900">
              Welcome to Session V (2026) Candidate Register!
            </h2>
            <p className="text-xs text-slate-600 max-w-md mx-auto">
              Your application has been logged into the AZM central admissions ledger. Save your official Application ID below for tracking and Roll Number Slip retrieval.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 max-w-sm mx-auto space-y-1">
            <span className="text-[11px] text-slate-500 uppercase font-bold tracking-wider">
              Official Application ID
            </span>
            <div className="text-2xl font-extrabold font-mono text-[#185b9d]">
              {submittedAppId}
            </div>
            <span className="text-[10px] text-emerald-700 font-semibold block">
              Candidate: {formData.fullName} ({formData.currentClass})
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-4 border-t border-slate-100">
            <button
              onClick={() => onSelectTab('roll-number')}
              className="px-6 py-2.5 rounded-xl bg-[#185b9d] hover:bg-[#13497e] text-white font-bold text-xs shadow-md flex items-center gap-2"
            >
              <FileCheck className="w-4 h-4" />
              <span>Preview Roll Number Slip</span>
            </button>

            <button
              onClick={() => window.print()}
              className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs flex items-center gap-2"
            >
              <Printer className="w-4 h-4" />
              <span>Print Application Receipt</span>
            </button>

            <button
              onClick={() => setIsSubmitted(false)}
              className="px-4 py-2.5 text-xs text-slate-500 hover:text-slate-900"
            >
              Submit Another Application
            </button>
          </div>
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
              id="btn-partner-submit"
              className="w-full py-3 bg-[#185b9d] hover:bg-[#13497e] text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
            >
              <Building2 className="w-4 h-4" />
              <span>Enroll Institution in AZM Affiliation Network</span>
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
            Thank you, <strong>{partnerData.institutionName || 'Principal'}</strong>. Our admissions team will dispatch official Session V Question Banks and enrollment ledgers to your campus address.
          </p>
          <button
            onClick={() => setIsPartnerSubmitted(false)}
            className="px-5 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 rounded-xl"
          >
            Back to Portal
          </button>
        </div>
      )}
    </div>
  );
};
