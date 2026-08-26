import React, { useState, useEffect, useRef } from 'react';
import { StudentApplicationData, PartnerSchoolData, PageTab } from '../../types';
import { MONTHLY_ASSISTANCE_RATES, BENEFICIARY_CATEGORIES, OFFICIAL_DATA } from '../../data/scholarshipData';
import { mockApi, printStudentDossier } from '../../lib/mockApi';
import { CandidateSlipRetrievalCard } from './CandidateSlipRetrievalCard';
import { PreSubmitCaptchaModal } from '../common/PreSubmitCaptchaModal';
import {
  formatCnic,
  formatPakistaniPhone,
  validateFullName,
  validateFatherName,
  validateCnic,
  validateGender,
  validateDobAndAge,
  validatePhotoFile,
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
  validateDocumentFile,
  autoCompressImageFile,
  mapSubmitErrorToFriendlyMessage,
  trimObjectStrings,
} from '../../utils/formValidation';
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
  const [activePortalTab, setActivePortalTab] = useState<'student' | 'partner' | 'retrieve'>('student');
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
  const [stageErrors, setStageErrors] = useState<{ [key: number]: string[] }>({});

  // Field-level validation and CAPTCHA states
  const [touchedFields, setTouchedFields] = useState<{ [field: string]: boolean }>({});
  const [fieldErrors, setFieldErrors] = useState<{ [field: string]: string }>({});
  const [academicRowErrors, setAcademicRowErrors] = useState<{ [field: string]: string }>({});
  const [isCaptchaOpen, setIsCaptchaOpen] = useState<boolean>(false);

  
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

  // Multi-file DMC documents state
  const [dmcFiles, setDmcFiles] = useState<
    Array<{ id: string; name: string; size: string; dataUrl: string; publicUrl?: string }>
  >([]);

  // Auto-compressing photo loading indicator state
  const [isCompressingPhoto, setIsCompressingPhoto] = useState(false);

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
    parentMobile: '',
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
    const formatted = formatCnic(e.target.value);
    setFormData((prev) => ({ ...prev, cnicBForm: formatted }));
    if (touchedFields.cnicBForm) {
      const err = validateCnic(formatted);
      setFieldErrors((prev) => {
        const next = { ...prev };
        if (err) next.cnicBForm = err;
        else delete next.cnicBForm;
        return next;
      });
    }
  };

  // Auto-format Pakistani phone numbers: 03XX-XXXXXXX
  const handlePhoneChange = (
    field: 'parentMobile' | 'mobile' | 'whatsapp',
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const formatted = formatPakistaniPhone(e.target.value);
    setFormData((prev) => ({ ...prev, [field]: formatted }));
    if (touchedFields[field]) {
      const label =
        field === 'parentMobile'
          ? "Father / Guardian's Mobile"
          : field === 'whatsapp'
          ? 'WhatsApp Number'
          : 'Candidate Mobile';
      const err = validatePhone(formatted, label);
      setFieldErrors((prev) => {
        const next = { ...prev };
        if (err) next[field] = err;
        else delete next[field];
        return next;
      });
    }
  };

  // Field blur validator
  const handleBlur = (field: string) => {
    setTouchedFields((prev) => ({ ...prev, [field]: true }));
    validateSingleField(field);
  };

  const validateSingleField = (field: string): string | null => {
    let err: string | null = null;
    switch (field) {
      case 'fullName':
        err = validateFullName(formData.fullName);
        break;
      case 'fatherName':
        err = validateFatherName(formData.fatherName);
        break;
      case 'cnicBForm':
        err = validateCnic(formData.cnicBForm);
        break;
      case 'gender':
        err = validateGender(formData.gender);
        break;
      case 'dob': {
        const { error, age } = validateDobAndAge(formData.dob);
        err = error;
        if (age !== null && String(formData.age) !== String(age)) {
          setFormData((prev) => ({ ...prev, age: String(age) }));
        }
        break;
      }
      case 'permanentAddress':
        err = validateAddress(formData.permanentAddress);
        break;
      case 'district':
      case 'province':
        err = validateDistrictProvince(formData.district, formData.province);
        break;
      case 'parentMobile':
        err = validatePhone(formData.parentMobile, "Father / Guardian Mobile");
        break;
      case 'mobile':
        err = validatePhone(formData.mobile, "Candidate Mobile");
        break;
      case 'whatsapp':
        err = validatePhone(formData.whatsapp, "WhatsApp Number");
        break;
      case 'email':
        err = validateEmail(formData.email);
        break;
      case 'currentClass':
        err = validateGradeClass(formData.currentClass);
        break;
      case 'schoolName':
        err = validateSchoolName(formData.schoolName);
        break;
      case 'guardianOccupation':
        err = validateOccupation(formData.guardianOccupation);
        break;
      case 'monthlyHouseholdIncome':
        err = validateIncome(formData.monthlyHouseholdIncome);
        break;
      case 'dependentsCount':
        err = validateDependents(formData.dependentsCount);
        break;
      case 'emergencyContact':
        err = validateEmergencyContact(formData.emergencyContact);
        break;
      default:
        break;
    }

    setFieldErrors((prev) => {
      const next = { ...prev };
      if (err) {
        next[field] = err;
      } else {
        delete next[field];
      }
      return next;
    });

    return err;
  };

  const scrollToField = (fieldId: string) => {
    const el = document.getElementById(fieldId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.focus();
    }
  };

  // Sync initialClass prop if user navigates from homepage category selection
  useEffect(() => {
    if (initialClass) {
      setFormData(prev => ({ ...prev, currentClass: initialClass }));
    }
  }, [initialClass]);

  // LocalStorage Draft loader
  useEffect(() => {
    try {
      const saved = localStorage.getItem('AZM_STUDENT_APP_V');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.status === 'draft') {
          setFormData(prev => ({
            ...prev,
            ...parsed,
            currentClass: initialClass || parsed.currentClass || prev.currentClass,
          }));
        }
      }
    } catch (e) {
      console.warn('LocalStorage not available');
    }
  }, []);

  const handleResetForm = () => {
    try {
      localStorage.removeItem('AZM_STUDENT_APP_V');
    } catch (e) {}
    setUploadedDocs({});
    clearSignature();
    setIsSubmitted(false);
    setCreatedStudent(null);
    setSubmittedAppId('');
    setFormData({
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
      parentMobile: '',
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
        incomeCertUploaded: false,
      },
      declarationAccepted: false,
      signatureDataUrl: '',
    });
    setCurrentStage(1);
    setStageErrors({});
    setTouchedFields({});
    setFieldErrors({});
    setSubmitError('');
    setPhotoError('');
  };

  const saveDraft = () => {
    try {
      localStorage.setItem('AZM_STUDENT_APP_V', JSON.stringify({ ...formData, status: 'draft' }));
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

  const clearSignature = () => {
    const canvas = sigCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    setHasSignature(false);
    setFormData(prev => ({ ...prev, signatureDataUrl: '' }));
  };


  const [newGrade, setNewGrade] = useState('');
  const [newYear, setNewYear] = useState('');
  const [newTotalMarks, setNewTotalMarks] = useState<number>(0);
  const [newObtMarks, setNewObtMarks] = useState<number>(0);
  const [newInstitute, setNewInstitute] = useState('');

  const handleAddAcademicRecord = () => {
    const rowValidation = validateAcademicRecord({
      gradeClass: newGrade,
      passingYear: newYear || String(new Date().getFullYear()),
      totalMarks: newTotalMarks,
      obtainedMarks: newObtMarks,
      institute: newInstitute,
    });

    if (rowValidation) {
      setAcademicRowErrors(rowValidation);
      return;
    }

    setAcademicRowErrors({});
    const pct = Number(((newObtMarks / newTotalMarks) * 100).toFixed(1));
    setFormData(prev => ({
      ...prev,
      academicRecords: [
        ...prev.academicRecords,
        {
          gradeClass: newGrade.trim(),
          passingYear: (newYear || String(new Date().getFullYear())).trim(),
          totalMarks: newTotalMarks,
          obtainedMarks: newObtMarks,
          percentage: pct,
          institute: newInstitute.trim()
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

  // Photo Upload Handler with Client-Side Validation (MIME, <=200KB, >=200x200px)
  const compressImageFile = (
    file: File,
    maxWidth = 1200,
    quality = 0.75
  ): Promise<{ dataUrl: string; sizeFormatted: string }> => {
    return new Promise((resolve) => {
      if (!file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const dataUrl = e.target?.result as string;
          const sizeFormatted =
            file.size > 1024 * 1024
              ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
              : `${(file.size / 1024).toFixed(0)} KB`;
          resolve({ dataUrl, sizeFormatted });
        };
        reader.readAsDataURL(file);
        return;
      }

      const img = new Image();
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let { width, height } = img;
          if (width > maxWidth || height > maxWidth) {
            if (width > height) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            } else {
              width = Math.round((width * maxWidth) / height);
              height = maxWidth;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
            const approxBytes = Math.round((compressedDataUrl.length * 3) / 4);
            const sizeFormatted =
              approxBytes > 1024 * 1024
                ? `${(approxBytes / (1024 * 1024)).toFixed(1)} MB`
                : `${Math.round(approxBytes / 1024)} KB`;
            resolve({ dataUrl: compressedDataUrl, sizeFormatted });
          } else {
            resolve({
              dataUrl: e.target?.result as string,
              sizeFormatted: `${Math.round(file.size / 1024)} KB`,
            });
          }
        };
        img.onerror = () => {
          resolve({
            dataUrl: e.target?.result as string,
            sizeFormatted: `${Math.round(file.size / 1024)} KB`,
          });
        };
      };
      reader.readAsDataURL(file);
    });
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhotoError('');
    const file = e.target.files?.[0];
    if (!file) return;

    // Fast client-side format & integrity check
    const validation = await validatePhotoFile(file);
    if (!validation.valid) {
      setPhotoError(validation.error || "We couldn't process this photo — please try a different one.");
      e.target.value = '';
      return;
    }

    setIsCompressingPhoto(true);
    try {
      // Auto-compress any photo client-side down to under 195 KB (preserving aspect ratio)
      const { dataUrl } = await autoCompressImageFile(file, 195, 800);
      setFormData((prev) => ({
        ...prev,
        photoUrl: dataUrl,
      }));
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.photo;
        return next;
      });

      // Upload in background to Supabase Storage
      mockApi.uploadStudentDocument({
        cnicOrBForm: formData.cnicBForm || 'TEMP_CANDIDATE',
        docType: 'photo',
        fileName: getFormattedDocName('photo', file.name),
        fileData: dataUrl,
      }).then((upRes) => {
        if (upRes?.publicUrl) {
          setFormData((prev) => ({ ...prev, photoUrl: upRes.publicUrl }));
        }
      }).catch(() => {});
    } catch (err: any) {
      console.warn('Photo compression fallback:', err);
      setPhotoError(err?.message || "We couldn't process this photo — please try a different one.");
    } finally {
      setIsCompressingPhoto(false);
      e.target.value = '';
    }
  };

  // Helper to format standardized and clear document filenames
  const getFormattedDocName = (docKey: string, originalFileName?: string): string => {
    const cleanName = (formData.fullName || 'Candidate')
      .trim()
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/_+/g, '_');
    const ext = originalFileName ? originalFileName.split('.').pop() || 'jpg' : 'jpg';

    switch (docKey) {
      case 'bformUploaded':
      case 'bform':
        return `${cleanName}_Candidate_BForm_CNIC.${ext}`;
      case 'fatherCnicUploaded':
      case 'fatherCnic':
        return `${cleanName}_Father_CNIC.${ext}`;
      case 'dmcUploaded':
      case 'dmc':
        return `${cleanName}_DMC_Marksheet.${ext}`;
      case 'domicileUploaded':
      case 'domicile':
        return `${cleanName}_Domicile_Certificate.${ext}`;
      case 'incomeCertUploaded':
      case 'paymentReceipt':
        return `${cleanName}_Fee_Payment_Receipt.${ext}`;
      case 'photo':
        return `${cleanName}_Passport_Photo.jpg`;
      default:
        return `${cleanName}_${docKey}.${ext}`;
    }
  };

  // Real Document Attachment Handler with Auto-Optimization & Clear Standard Naming
  const handleDocumentUpload = async (docKey: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateDocumentFile(file, 5);
    if (!validation.isValid) {
      alert(validation.error || 'Invalid file format or size.');
      e.target.value = '';
      return;
    }

    try {
      const standardDocName = getFormattedDocName(docKey, file.name);
      const { dataUrl, sizeFormatted } = await autoCompressImageFile(file, 600, 1400);
      setUploadedDocs((prev) => ({
        ...prev,
        [docKey]: {
          name: standardDocName,
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

      // Map docKey to candidate documents model
      const targetField =
        docKey === 'bformUploaded'
          ? 'bform'
          : docKey === 'fatherCnicUploaded'
          ? 'fatherCnic'
          : docKey === 'dmcUploaded'
          ? 'dmc'
          : docKey === 'domicileUploaded'
          ? 'domicile'
          : docKey === 'incomeCertUploaded'
          ? 'paymentReceipt'
          : docKey;

      // Upload directly to Supabase Storage
      mockApi.uploadStudentDocument({
        cnicOrBForm: formData.cnicBForm || 'TEMP_CANDIDATE',
        docType: targetField,
        fileName: standardDocName,
        fileData: dataUrl,
      }).then((upRes) => {
        if (upRes?.publicUrl) {
          setUploadedDocs((prev) => ({
            ...prev,
            [docKey]: {
              name: standardDocName,
              size: sizeFormatted,
              dataUrl: upRes.publicUrl,
              publicUrl: upRes.publicUrl,
            },
          }));
        }
      }).catch(() => {});
    } catch (err) {
      console.warn('Document compression fallback:', err);
    }
  };

  // Multi-File DMC Upload Handler with Auto-Compression
  const handleDmcFilesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const validation = validateDocumentFile(file, 5);
      if (!validation.isValid) {
        alert(validation.error || `Invalid file ${file.name}`);
        continue;
      }

      try {
        const cleanName = (formData.fullName || 'Candidate')
          .trim()
          .replace(/[^a-zA-Z0-9]/g, '_')
          .replace(/_+/g, '_');
        const ext = file.name.split('.').pop() || 'jpg';
        const dmcIndex = dmcFiles.length + i + 1;
        const standardDocName = `${cleanName}_DMC_${dmcIndex}.${ext}`;

        const { dataUrl, sizeFormatted } = await autoCompressImageFile(file, 600, 1400);

        const newDmc = {
          id: `dmc_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`,
          name: standardDocName,
          size: sizeFormatted,
          dataUrl,
        };

        setDmcFiles((prev) => [...prev, newDmc]);
        setFormData((prev) => ({
          ...prev,
          documents: {
            ...prev.documents,
            dmcUploaded: true,
          },
        }));

        setUploadedDocs((prev) => ({
          ...prev,
          dmcUploaded: newDmc,
        }));

        // Upload in background to Supabase
        mockApi
          .uploadStudentDocument({
            cnicOrBForm: formData.cnicBForm || 'TEMP_CANDIDATE',
            docType: dmcIndex === 1 ? 'dmc' : `dmc_${dmcIndex}`,
            fileName: standardDocName,
            fileData: dataUrl,
          })
          .catch(() => {});
      } catch (err) {
        console.warn('DMC upload error:', err);
      }
    }
    e.target.value = '';
  };

  const handleRemoveDmcFile = (id: string) => {
    setDmcFiles((prev) => {
      const next = prev.filter((f) => f.id !== id);
      if (next.length === 0) {
        setFormData((p) => ({
          ...p,
          documents: {
            ...p.documents,
            dmcUploaded: false,
          },
        }));
        setUploadedDocs((p) => {
          const copy = { ...p };
          delete copy.dmcUploaded;
          return copy;
        });
      } else {
        setUploadedDocs((p) => ({
          ...p,
          dmcUploaded: next[0],
        }));
      }
      return next;
    });
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

  // Check if current stage is valid
  const getStageErrors = (stageNum: number): string[] => {
    const errs: string[] = [];

    switch (stageNum) {
      case 1: {
        const nameErr = validateFullName(formData.fullName);
        if (nameErr) errs.push(nameErr);
        const fNameErr = validateFatherName(formData.fatherName);
        if (fNameErr) errs.push(fNameErr);
        const cnicErr = validateCnic(formData.cnicBForm);
        if (cnicErr) errs.push(cnicErr);
        const genderErr = validateGender(formData.gender);
        if (genderErr) errs.push(genderErr);
        const { error: dobErr } = validateDobAndAge(formData.dob);
        if (dobErr) errs.push(dobErr);
        if (!formData.photoUrl) errs.push('Passport-size Candidate Photograph is required.');
        break;
      }

      case 2: {
        const addrErr = validateAddress(formData.permanentAddress);
        if (addrErr) errs.push(addrErr);
        const distErr = validateDistrictProvince(formData.district, formData.province);
        if (distErr) errs.push(distErr);
        const parentMobErr = validatePhone(formData.parentMobile, 'Father / Guardian Mobile');
        if (parentMobErr) errs.push(parentMobErr);
        const mobErr = validatePhone(formData.mobile, 'Candidate Mobile');
        if (mobErr) errs.push(mobErr);
        const waErr = validatePhone(formData.whatsapp, 'WhatsApp Number');
        if (waErr) errs.push(waErr);
        const emailErr = validateEmail(formData.email);
        if (emailErr) errs.push(emailErr);
        break;
      }

      case 3: {
        const classErr = validateGradeClass(formData.currentClass);
        if (classErr) errs.push(classErr);
        const schErr = validateSchoolName(formData.schoolName);
        if (schErr) errs.push(schErr);
        if (!formData.currentRollNo?.trim()) errs.push('Current School Roll Number is required.');
        break;
      }

      case 4: {
        if (!formData.appliedCategory) errs.push('Please select a Scholarship Category.');
        if (formData.isSpecialNeed && !formData.specialNeedDetails?.trim()) {
          errs.push('Please describe special need / disability details.');
        }
        break;
      }

      case 5: {
        const occErr = validateOccupation(formData.guardianOccupation);
        if (occErr) errs.push(occErr);
        const incErr = validateIncome(formData.monthlyHouseholdIncome);
        if (incErr) errs.push(incErr);
        const depErr = validateDependents(formData.dependentsCount);
        if (depErr) errs.push(depErr);
        const emErr = validateEmergencyContact(formData.emergencyContact);
        if (emErr) errs.push(emErr);
        break;
      }

      case 6: {
        const recordsErr = validateAcademicRecordsList(formData.academicRecords, formData.currentClass);
        if (recordsErr) errs.push(recordsErr);
        break;
      }

      case 7: {
        if (!formData.documents?.bformUploaded) errs.push('Candidate B-Form / CNIC scanned copy is required.');
        if (!formData.documents?.fatherCnicUploaded) errs.push('Father / Guardian CNIC scanned copy is required.');
        if (!formData.documents?.dmcUploaded && dmcFiles.length === 0) {
          errs.push('Previous Examination DMC / Result Card is required.');
        }
        break;
      }

      case 8: {
        if (!formData.declarationAccepted) errs.push('Please accept the legal terms and evaluation protocol undertaking.');
        if (!formData.signatureDataUrl && !hasSignature) errs.push('Please draw your digital signature on the pad above.');
        break;
      }

      default:
        break;
    }

    return errs;
  };

  const isStageComplete = (stageNum: number): boolean => {
    return getStageErrors(stageNum).length === 0;
  };

  const getIncompleteStagesBefore8 = () => {
    const incomplete: { stage: number; title: string; errors: string[] }[] = [];
    for (let s = 1; s <= 7; s++) {
      const errs = getStageErrors(s);
      if (errs.length > 0) {
        incomplete.push({
          stage: s,
          title: stagesList[s - 1].title,
          errors: errs,
        });
      }
    }
    return incomplete;
  };

  // Pre-Submit Flow: Opens CAPTCHA modal only if all stages are valid
  const handleFinalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');

    // Pre-flight check all stages 1 to 7
    const incomplete = getIncompleteStagesBefore8();
    if (incomplete.length > 0) {
      setSubmitError(
        `Incomplete Information: Stage ${incomplete[0].stage} (${incomplete[0].title}) has missing or invalid fields: ${incomplete[0].errors[0]}`
      );
      setCurrentStage(incomplete[0].stage);
      setStageErrors((prev) => ({ ...prev, [incomplete[0].stage]: incomplete[0].errors }));
      return;
    }

    // Check Stage 8 requirements
    const stage8Errors = getStageErrors(8);
    if (stage8Errors.length > 0) {
      setSubmitError(stage8Errors[0]);
      setStageErrors((prev) => ({ ...prev, 8: stage8Errors }));
      return;
    }

    // All validation passed - open 3-step warm-up & CAPTCHA modal
    setIsCaptchaOpen(true);
  };

  // Real Database Submission (Fired after CAPTCHA challenge is solved)
  const executeFinalSubmission = async () => {
    setSubmitError('');
    setIsSubmitting(true);

    try {
      // Global whitespace trimming across all fields
      const cleanData = trimObjectStrings(formData);

      const emailVal = cleanData.email;
      const studentMobileVal = cleanData.mobile || '0300-0000000';
      const parentMobileVal = cleanData.parentMobile || cleanData.emergencyContact || studentMobileVal;

      const backendPayload = {
        fullName: cleanData.fullName,
        fatherName: cleanData.fatherName,
        gender: cleanData.gender?.toUpperCase() === 'FEMALE' ? 'FEMALE' : 'MALE',
        dateOfBirth: cleanData.dob || '2008-01-01',
        age: parseInt(String(cleanData.age), 10) || 16,
        cnicOrBForm: cleanData.cnicBForm,
        nationality: 'Pakistani',
        religion: 'Islam',
        address: cleanData.permanentAddress || 'Address',
        district: cleanData.district || 'Mansehra',
        province: cleanData.province || 'Khyber Pakhtunkhwa',
        studentMobile: studentMobileVal,
        parentMobile: parentMobileVal,
        whatsapp: cleanData.whatsapp || studentMobileVal,
        email: emailVal && emailVal.includes('@') ? emailVal : undefined,
        currentClass: cleanData.currentClass || 'SSC-II (Class 10th)',
        hsscGroup: cleanData.discipline || undefined,
        schoolName: cleanData.schoolName || 'School',
        boardOrUniversity: cleanData.boardUniversity || 'BISE Abbottabad',
        currentRollNo: cleanData.currentRollNo || undefined,
        scholarshipCategory: cleanData.appliedCategory?.includes('Orphan')
          ? 'ORPHAN'
          : cleanData.appliedCategory?.includes('Disability')
          ? 'PERSON_WITH_DISABILITY'
          : cleanData.appliedCategory?.includes('Needy') || cleanData.isSpecialNeed
          ? 'FINANCIALLY_NEEDY'
          : 'GENERAL_MERIT',
        guardianOccupation: cleanData.guardianOccupation || 'Business / Private',
        guardianMonthlyIncome: Number(cleanData.monthlyHouseholdIncome) || 0,
        emergencyContact: cleanData.emergencyContact || parentMobileVal,
        emergencyRelation: 'Guardian',
        referralSource: 'AZM.AIO Online Apply Portal',
        photoUrl: cleanData.photoUrl || undefined,
        academicRecords: (cleanData.academicRecords || []).map((r) => ({
          examLevel: r.gradeClass || 'Class 9th',
          boardOrUni: r.institute || 'BISE',
          yearOfPassing: r.passingYear || String(new Date().getFullYear()),
          totalMarks: Math.round(Number(r.totalMarks)) || 550,
          obtainedMarks: Math.round(Number(r.obtainedMarks)) || 450,
          percentage: Number(r.percentage) || 80,
        })),
        documents: {
          bformCnicCopy: !!cleanData.documents?.bformUploaded,
          fatherCnicCopy: !!cleanData.documents?.fatherCnicUploaded,
          passportPhotos: !!cleanData.photoUrl,
          previousResultCard: !!cleanData.documents?.dmcUploaded,
          domicileCertificate: !!cleanData.documents?.domicileUploaded,
          incomeCertificate: !!cleanData.documents?.incomeCertUploaded,
        },
        uploadedDocuments: {
          photo: cleanData.photoUrl
            ? {
                name: 'Candidate_Passport_Photo.jpg',
                size: '180 KB',
                dataUrl: cleanData.photoUrl,
                uploadedAt: new Date().toISOString(),
              }
            : undefined,
          bform: uploadedDocs.bformUploaded
            ? {
                name: uploadedDocs.bformUploaded.name,
                size: uploadedDocs.bformUploaded.size,
                dataUrl: uploadedDocs.bformUploaded.dataUrl,
                uploadedAt: new Date().toISOString(),
              }
            : undefined,
          fatherCnic: uploadedDocs.fatherCnicUploaded
            ? {
                name: uploadedDocs.fatherCnicUploaded.name,
                size: uploadedDocs.fatherCnicUploaded.size,
                dataUrl: uploadedDocs.fatherCnicUploaded.dataUrl,
                uploadedAt: new Date().toISOString(),
              }
            : undefined,
          dmc: dmcFiles[0]
            ? {
                name: dmcFiles[0].name,
                size: dmcFiles[0].size,
                dataUrl: dmcFiles[0].dataUrl,
                uploadedAt: new Date().toISOString(),
              }
            : uploadedDocs.dmcUploaded
            ? {
                name: uploadedDocs.dmcUploaded.name,
                size: uploadedDocs.dmcUploaded.size,
                dataUrl: uploadedDocs.dmcUploaded.dataUrl,
                uploadedAt: new Date().toISOString(),
              }
            : undefined,
          dmcFiles: dmcFiles.length > 0 ? dmcFiles : undefined,
          dmc_2: dmcFiles[1]
            ? {
                name: dmcFiles[1].name,
                size: dmcFiles[1].size,
                dataUrl: dmcFiles[1].dataUrl,
                uploadedAt: new Date().toISOString(),
              }
            : undefined,
          domicile: uploadedDocs.domicileUploaded
            ? {
                name: uploadedDocs.domicileUploaded.name,
                size: uploadedDocs.domicileUploaded.size,
                dataUrl: uploadedDocs.domicileUploaded.dataUrl,
                uploadedAt: new Date().toISOString(),
              }
            : undefined,
          paymentReceipt: uploadedDocs.incomeCertUploaded
            ? {
                name: uploadedDocs.incomeCertUploaded.name,
                size: uploadedDocs.incomeCertUploaded.size,
                dataUrl: uploadedDocs.incomeCertUploaded.dataUrl,
                uploadedAt: new Date().toISOString(),
              }
            : undefined,
          signature: cleanData.signatureDataUrl
            ? {
                name: 'Applicant_Digital_Signature.png',
                size: '25 KB',
                dataUrl: cleanData.signatureDataUrl,
                uploadedAt: new Date().toISOString(),
              }
            : undefined,
        },
        signatureDataUrl: cleanData.signatureDataUrl || undefined,
        applicantSignedAt: new Date().toISOString(),
      };

      const student = await mockApi.createStudent(backendPayload);

      setCreatedStudent(student);
      setSubmittedAppId(student.applicationNo || student.id);
      setIsSubmitted(true);
      setIsCaptchaOpen(false);

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
      const friendlyMsg = mapSubmitErrorToFriendlyMessage(err);
      setSubmitError(friendlyMsg);
      throw new Error(friendlyMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadStudentPdf = async () => {
    setIsDownloadingPdf(true);
    try {
      const studentData = createdStudent || {
        id: submittedAppId || formData.id,
        applicationNo: submittedAppId || formData.id,
        fullName: formData.fullName,
        fatherName: formData.fatherName,
        cnicOrBForm: formData.cnicBForm,
        currentClass: formData.currentClass,
        discipline: formData.discipline,
        schoolName: formData.schoolName,
        district: formData.district,
        province: formData.province,
        mobile: formData.mobile,
        parentMobile: formData.parentMobile,
        emergencyContact: formData.emergencyContact,
        photoUrl: formData.photoUrl,
        createdAt: new Date().toISOString(),
      };
      await mockApi.downloadRegistrationSlipPdf(studentData);
    } catch (err: any) {
      alert(err.message || 'Failed to download PDF registration slip');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handlePartnerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPartnerSubmitting(true);
    try {
      const payload = {
        institutionName: partnerData.institutionName,
        category: partnerData.category,
        campus: partnerData.campus,
        address: partnerData.address,
        district: partnerData.district,
        contactPerson: partnerData.contactPerson,
        designation: partnerData.designation,
        whatsapp: partnerData.whatsapp,
        email: partnerData.email,
        totalStudentStrength: Number(partnerData.totalStudentStrength) || 0,
        expectedApplicants: Number(partnerData.expectedApplicants) || 0,
        stampUploaded: !!partnerData.stampUploaded,
      };

      const res = await mockApi.registerPartnerSchool(payload);
      setCreatedPartner(res.data);
      setIsPartnerSubmitted(true);
      try {
        const confettiModule = await import('canvas-confetti');
        const confetti = confettiModule.default || confettiModule;
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      } catch (err) {}
    } catch (err: any) {
      alert(err.message || 'Failed to submit partner school application');
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

  const handleProceedNext = (targetStage: number) => {
    // If moving forward, validate the current stage first
    if (targetStage > currentStage) {
      const currentErrs = getStageErrors(currentStage);
      if (currentErrs.length > 0) {
        setStageErrors(prev => ({ ...prev, [currentStage]: currentErrs }));
        setTimeout(() => {
          const alertEl = document.getElementById('stage-validation-alert');
          if (alertEl) {
            alertEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
        return;
      }
    }

    // Clear current stage error
    setStageErrors(prev => {
      const next = { ...prev };
      delete next[currentStage];
      return next;
    });

    setCurrentStage(targetStage);
    window.scrollTo({ top: 180, behavior: 'smooth' });
  };

  return (
    <div className="py-10 max-w-7xl mx-auto px-4 sm:px-6">
      {/* Pre-Submit CAPTCHA & Server Warm-up Modal */}
      <PreSubmitCaptchaModal
        isOpen={isCaptchaOpen}
        onClose={() => setIsCaptchaOpen(false)}
        onConfirmSubmit={executeFinalSubmission}
        isSubmitting={isSubmitting}
      />

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

        {/* Triple Switcher Pill */}
        <div className="inline-flex p-1.5 rounded-2xl bg-slate-200/80 border border-slate-300 max-w-2xl w-full flex-wrap gap-1">
          <button
            id="tab-apply-student"
            onClick={() => setActivePortalTab('student')}
            className={`flex-1 min-w-[130px] py-2.5 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 focus:outline-hidden cursor-pointer ${
              activePortalTab === 'student'
                ? 'bg-[#185b9d] text-white shadow-md'
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Apply as Student</span>
          </button>

          <button
            id="tab-apply-partner"
            onClick={() => setActivePortalTab('partner')}
            className={`flex-1 min-w-[130px] py-2.5 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 focus:outline-hidden cursor-pointer ${
              activePortalTab === 'partner'
                ? 'bg-[#185b9d] text-white shadow-md'
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Partner School</span>
          </button>

          <button
            id="tab-apply-retrieve"
            onClick={() => setActivePortalTab('retrieve')}
            className={`flex-1 min-w-[150px] py-2.5 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 focus:outline-hidden cursor-pointer ${
              activePortalTab === 'retrieve'
                ? 'bg-[#185b9d] text-white shadow-md'
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Re-Download Slip &amp; Voucher</span>
          </button>
        </div>
      </div>

      {/* ================= RETRIEVE REGISTRATION SLIP TAB ================= */}
      {activePortalTab === 'retrieve' && (
        <CandidateSlipRetrievalCard onBackToApply={() => setActivePortalTab('student')} />
      )}

      {/* ================= STUDENT APPLICATION WIZARD ================= */}
      {activePortalTab === 'student' && !isSubmitted && (

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Main Wizard Form Body (8 cols) */}
          <div className="lg:col-span-8 bg-white rounded-3xl border border-slate-200/90 shadow-lg p-6 sm:p-8">
            {/* Stage Progress Bar Tracker */}
            <div className="mb-8">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-2">
                <span>Stage {currentStage} of 8: {stagesList[currentStage - 1].title}</span>
                <div className="flex items-center gap-3">
                  <span className="text-[#185b9d] font-mono">{Math.round((currentStage / 8) * 100)}% Completed</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Reset all fields and start a fresh application?')) {
                        handleResetForm();
                      }
                    }}
                    className="text-[11px] font-semibold text-slate-500 hover:text-rose-600 bg-slate-100 hover:bg-rose-50 px-2.5 py-1 rounded-lg border border-slate-200 hover:border-rose-200 flex items-center gap-1 transition"
                    title="Clear cached fields and start a new application"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Start Fresh / Clear</span>
                  </button>
                </div>
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
                {stagesList.map((st) => {
                  const isCurrent = currentStage === st.num;
                  const isDone = isStageComplete(st.num);
                  const hasErr = !!stageErrors[st.num]?.length;

                  return (
                    <button
                      key={st.num}
                      type="button"
                      onClick={() => handleProceedNext(st.num)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
                        isCurrent
                          ? 'bg-[#185b9d] text-white border-[#185b9d] shadow-sm ring-2 ring-[#185b9d]/30'
                          : hasErr
                          ? 'bg-rose-50 text-rose-800 border-rose-300'
                          : isDone
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span
                        className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          isCurrent
                            ? 'bg-white/20 text-white'
                            : hasErr
                            ? 'bg-rose-200 text-rose-900'
                            : isDone
                            ? 'bg-emerald-200 text-emerald-900'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {isDone && !isCurrent ? '✓' : hasErr && !isCurrent ? '!' : st.num}
                      </span>
                      <span>{st.title}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Form Content By Stage */}
            <form
              onSubmit={
                currentStage === 8
                  ? handleFinalSubmit
                  : (e) => {
                      e.preventDefault();
                      handleProceedNext(currentStage + 1);
                    }
              }
            >

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
                        id="field-fullName"
                        type="text"
                        required
                        placeholder="e.g. Muhammad Hamza Khan"
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
                        className={`w-full px-3.5 py-2.5 text-xs rounded-xl border focus:outline-hidden transition ${
                          touchedFields.fullName && fieldErrors.fullName
                            ? 'border-rose-400 focus:border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/20'
                            : 'bg-slate-50 border-slate-300 focus:bg-white focus:border-[#185b9d]'
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
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Father / Guardian Name *
                      </label>
                      <input
                        id="field-fatherName"
                        type="text"
                        required
                        placeholder="e.g. Tariq Mehmood Khan"
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
                        className={`w-full px-3.5 py-2.5 text-xs rounded-xl border focus:outline-hidden transition ${
                          touchedFields.fatherName && fieldErrors.fatherName
                            ? 'border-rose-400 focus:border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/20'
                            : 'bg-slate-50 border-slate-300 focus:bg-white focus:border-[#185b9d]'
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
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        CNIC / B-Form Number (Auto-Masked) *
                      </label>
                      <input
                        id="field-cnicBForm"
                        type="text"
                        required
                        placeholder="13503-1234567-1"
                        value={formData.cnicBForm}
                        onChange={handleCnicChange}
                        onBlur={() => handleBlur('cnicBForm')}
                        className={`w-full px-3.5 py-2.5 text-xs font-mono font-bold rounded-xl border focus:outline-hidden transition ${
                          touchedFields.cnicBForm && fieldErrors.cnicBForm
                            ? 'border-rose-400 focus:border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/20'
                            : 'bg-slate-50 border-slate-300 focus:bg-white focus:border-[#185b9d]'
                        }`}
                      />
                      {touchedFields.cnicBForm && fieldErrors.cnicBForm ? (
                        <p className="text-[11px] font-semibold text-rose-600 mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>{fieldErrors.cnicBForm}</span>
                        </p>
                      ) : (
                        <span className="text-[10px] text-slate-400 mt-1 block">Format: 13 Digits (13501-XXXXXXX-X)</span>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Gender *
                      </label>
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
                        className={`w-full px-3.5 py-2.5 text-xs rounded-xl border focus:outline-hidden transition ${
                          touchedFields.gender && fieldErrors.gender
                            ? 'border-rose-400 focus:border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/20'
                            : 'bg-slate-50 border-slate-300 focus:bg-white focus:border-[#185b9d]'
                        }`}
                      >
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                      {touchedFields.gender && fieldErrors.gender && (
                        <p className="text-[11px] font-semibold text-rose-600 mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>{fieldErrors.gender}</span>
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Date of Birth *
                      </label>
                      <input
                        id="field-dob"
                        type="date"
                        required
                        value={formData.dob}
                        onChange={(e) => {
                          const dobVal = e.target.value;
                          const { age } = validateDobAndAge(dobVal);
                          setFormData((prev) => ({
                            ...prev,
                            dob: dobVal,
                            ...(age !== null ? { age: String(age) } : {}),
                          }));
                          if (touchedFields.dob) {
                            const { error: dobErr } = validateDobAndAge(dobVal);
                            setFieldErrors((prev) => {
                              const next = { ...prev };
                              if (dobErr) next.dob = dobErr; else delete next.dob;
                              return next;
                            });
                          }
                        }}
                        onBlur={() => handleBlur('dob')}
                        className={`w-full px-3.5 py-2.5 text-xs rounded-xl border focus:outline-hidden transition ${
                          touchedFields.dob && fieldErrors.dob
                            ? 'border-rose-400 focus:border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/20'
                            : 'bg-slate-50 border-slate-300 focus:bg-white focus:border-[#185b9d]'
                        }`}
                      />
                      {touchedFields.dob && fieldErrors.dob ? (
                        <p className="text-[11px] font-semibold text-rose-600 mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>{fieldErrors.dob}</span>
                        </p>
                      ) : formData.age ? (
                        <span className="text-[10px] text-slate-500 mt-1 block">Calculated Age: {formData.age} years</span>
                      ) : null}
                    </div>

                    <div id="field-photo">
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold text-slate-700">
                          Passport Size Photograph *
                        </label>
                        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-emerald-600" />
                          Auto-Compressed
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
                            {isCompressingPhoto ? (
                              <Loader2 className="w-5 h-5 animate-spin text-[#185b9d]" />
                            ) : (
                              <Camera className="w-5 h-5" />
                            )}
                            <span className="text-[9px] font-bold mt-0.5">
                              {isCompressingPhoto ? '...' : 'Upload'}
                            </span>
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/jpg,image/webp"
                              onChange={handlePhotoUpload}
                              className="hidden"
                            />
                          </label>
                        )}
                        <div className="space-y-1">
                          {isCompressingPhoto ? (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-50 text-[#185b9d] rounded-xl font-semibold border border-blue-200">
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Compressing photo...</span>
                            </div>
                          ) : (
                            <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition">
                              <UploadCloud className="w-3.5 h-3.5" />
                              <span>{formData.photoUrl ? 'Replace Photo' : 'Upload Candidate Photograph'}</span>
                              <input
                                type="file"
                                accept="image/png,image/jpeg,image/jpg,image/webp"
                                onChange={handlePhotoUpload}
                                className="hidden"
                              />
                            </label>
                          )}
                          <p className="text-[10px] text-slate-400">JPG, PNG or WebP — automatically resized & optimized</p>
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
                        id="field-permanentAddress"
                        type="text"
                        required
                        placeholder="Village / Street / Mohallah / House #"
                        value={formData.permanentAddress}
                        onChange={(e) => {
                          setFormData({ ...formData, permanentAddress: e.target.value });
                          if (touchedFields.permanentAddress) {
                            const err = validateAddress(e.target.value);
                            setFieldErrors((prev) => {
                              const next = { ...prev };
                              if (err) next.permanentAddress = err; else delete next.permanentAddress;
                              return next;
                            });
                          }
                        }}
                        onBlur={() => handleBlur('permanentAddress')}
                        className={`w-full px-3.5 py-2.5 text-xs rounded-xl border focus:outline-hidden transition ${
                          touchedFields.permanentAddress && fieldErrors.permanentAddress
                            ? 'border-rose-400 focus:border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/20'
                            : 'bg-slate-50 border-slate-300 focus:bg-white focus:border-[#185b9d]'
                        }`}
                      />
                      {touchedFields.permanentAddress && fieldErrors.permanentAddress && (
                        <p className="text-[11px] font-semibold text-rose-600 mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>{fieldErrors.permanentAddress}</span>
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        District *
                      </label>
                      <select
                        id="field-district"
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
                        className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-300 focus:bg-white focus:border-[#185b9d] focus:outline-hidden"
                      >
                        <option value="Mansehra">Mansehra</option>
                        <option value="Abbottabad">Abbottabad</option>
                        <option value="Haripur">Haripur</option>
                        <option value="Battagram">Battagram</option>
                        <option value="Torghar">Torghar</option>
                        <option value="Kohistan Upper">Kohistan Upper</option>
                        <option value="Kohistan Lower">Kohistan Lower</option>
                        <option value="Kolai-Palas">Kolai-Palas</option>
                        <option value="Peshawar">Peshawar</option>
                        <option value="Mardan">Mardan</option>
                        <option value="Swabi">Swabi</option>
                        <option value="Charsadda">Charsadda</option>
                        <option value="Nowshera">Nowshera</option>
                        <option value="Kohat">Kohat</option>
                        <option value="Bannu">Bannu</option>
                        <option value="Dera Ismail Khan">Dera Ismail Khan</option>
                        <option value="Swat">Swat</option>
                        <option value="Dir Upper">Dir Upper</option>
                        <option value="Dir Lower">Dir Lower</option>
                        <option value="Chitral Upper">Chitral Upper</option>
                        <option value="Chitral Lower">Chitral Lower</option>
                        <option value="Malakand">Malakand</option>
                        <option value="Buner">Buner</option>
                        <option value="Shangla">Shangla</option>
                        <option value="Other District">Other District (KP / Pakistan)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Province *
                      </label>
                      <input
                        id="field-province"
                        type="text"
                        readOnly
                        value={formData.province}
                        className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-100 border border-slate-200 text-slate-600"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Father / Guardian Mobile Number *
                      </label>
                      <input
                        id="field-parentMobile"
                        type="tel"
                        required
                        placeholder="0300-1234567"
                        value={formData.parentMobile}
                        onChange={(e) => handlePhoneChange('parentMobile', e)}
                        onBlur={() => handleBlur('parentMobile')}
                        className={`w-full px-3.5 py-2.5 text-xs font-mono rounded-xl border focus:outline-hidden transition ${
                          touchedFields.parentMobile && fieldErrors.parentMobile
                            ? 'border-rose-400 focus:border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/20'
                            : 'bg-slate-50 border-slate-300 focus:bg-white focus:border-[#185b9d]'
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
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Candidate Mobile Number (SMS Alerts) *
                      </label>
                      <input
                        id="field-mobile"
                        type="tel"
                        required
                        placeholder="0300-1234567"
                        value={formData.mobile}
                        onChange={(e) => handlePhoneChange('mobile', e)}
                        onBlur={() => handleBlur('mobile')}
                        className={`w-full px-3.5 py-2.5 text-xs font-mono rounded-xl border focus:outline-hidden transition ${
                          touchedFields.mobile && fieldErrors.mobile
                            ? 'border-rose-400 focus:border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/20'
                            : 'bg-slate-50 border-slate-300 focus:bg-white focus:border-[#185b9d]'
                        }`}
                      />
                      {touchedFields.mobile && fieldErrors.mobile && (
                        <p className="text-[11px] font-semibold text-rose-600 mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>{fieldErrors.mobile}</span>
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        WhatsApp Number (Roll No Slip & Exam Notes) *
                      </label>
                      <input
                        id="field-whatsapp"
                        type="tel"
                        required
                        placeholder="0305-1234567"
                        value={formData.whatsapp}
                        onChange={(e) => handlePhoneChange('whatsapp', e)}
                        onBlur={() => handleBlur('whatsapp')}
                        className={`w-full px-3.5 py-2.5 text-xs font-mono rounded-xl border focus:outline-hidden transition ${
                          touchedFields.whatsapp && fieldErrors.whatsapp
                            ? 'border-rose-400 focus:border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/20'
                            : 'bg-slate-50 border-slate-300 focus:bg-white focus:border-[#185b9d]'
                        }`}
                      />
                      {touchedFields.whatsapp && fieldErrors.whatsapp && (
                        <p className="text-[11px] font-semibold text-rose-600 mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>{fieldErrors.whatsapp}</span>
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Email Address (Optional)
                      </label>
                      <input
                        id="field-email"
                        type="email"
                        placeholder="student@example.com"
                        value={formData.email}
                        onChange={(e) => {
                          setFormData({ ...formData, email: e.target.value });
                          if (touchedFields.email) {
                            const err = validateEmail(e.target.value);
                            setFieldErrors((prev) => {
                              const next = { ...prev };
                              if (err) next.email = err; else delete next.email;
                              return next;
                            });
                          }
                        }}
                        onBlur={() => handleBlur('email')}
                        className={`w-full px-3.5 py-2.5 text-xs rounded-xl border focus:outline-hidden transition ${
                          touchedFields.email && fieldErrors.email
                            ? 'border-rose-400 focus:border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/20'
                            : 'bg-slate-50 border-slate-300 focus:bg-white focus:border-[#185b9d]'
                        }`}
                      />
                      {touchedFields.email && fieldErrors.email && (
                        <p className="text-[11px] font-semibold text-rose-600 mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>{fieldErrors.email}</span>
                        </p>
                      )}
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
                        id="field-currentClass"
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
                        id="field-discipline"
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
                        id="field-schoolName"
                        type="text"
                        required
                        placeholder="e.g. Government High School Gandhian / Dubai International College"
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
                        className={`w-full px-3.5 py-2.5 text-xs rounded-xl border focus:outline-hidden transition ${
                          touchedFields.schoolName && fieldErrors.schoolName
                            ? 'border-rose-400 focus:border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/20'
                            : 'bg-slate-50 border-slate-300 focus:bg-white focus:border-[#185b9d]'
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
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Affiliated BISE Board / University *
                      </label>
                      <select
                        id="field-boardUniversity"
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
                        Current Institutional Roll No *
                      </label>
                      <input
                        id="field-currentRollNo"
                        type="text"
                        required
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
                        id="field-guardianOccupation"
                        type="text"
                        required
                        placeholder="e.g. Daily Wage Worker / Farmer / Teacher / Private Job"
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
                        className={`w-full px-3.5 py-2.5 text-xs rounded-xl border focus:outline-hidden transition ${
                          touchedFields.guardianOccupation && fieldErrors.guardianOccupation
                            ? 'border-rose-400 focus:border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/20'
                            : 'bg-slate-50 border-slate-300 focus:bg-white focus:border-[#185b9d]'
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
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Total Monthly Household Income (PKR) *
                      </label>
                      <input
                        id="field-monthlyHouseholdIncome"
                        type="number"
                        required
                        value={formData.monthlyHouseholdIncome || ''}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setFormData({ ...formData, monthlyHouseholdIncome: val });
                          if (touchedFields.monthlyHouseholdIncome) {
                            const err = validateIncome(val);
                            setFieldErrors((prev) => {
                              const next = { ...prev };
                              if (err) next.monthlyHouseholdIncome = err; else delete next.monthlyHouseholdIncome;
                              return next;
                            });
                          }
                        }}
                        onBlur={() => handleBlur('monthlyHouseholdIncome')}
                        className={`w-full px-3.5 py-2.5 text-xs font-mono font-bold rounded-xl border focus:outline-hidden transition ${
                          touchedFields.monthlyHouseholdIncome && fieldErrors.monthlyHouseholdIncome
                            ? 'border-rose-400 focus:border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/20'
                            : 'bg-slate-50 border-slate-300 focus:bg-white focus:border-[#185b9d]'
                        }`}
                      />
                      {touchedFields.monthlyHouseholdIncome && fieldErrors.monthlyHouseholdIncome && (
                        <p className="text-[11px] font-semibold text-rose-600 mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>{fieldErrors.monthlyHouseholdIncome}</span>
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Number of Family Dependents (Brothers/Sisters) *
                      </label>
                      <input
                        id="field-dependentsCount"
                        type="number"
                        value={formData.dependentsCount}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setFormData({ ...formData, dependentsCount: val });
                          if (touchedFields.dependentsCount) {
                            const err = validateDependents(val);
                            setFieldErrors((prev) => {
                              const next = { ...prev };
                              if (err) next.dependentsCount = err; else delete next.dependentsCount;
                              return next;
                            });
                          }
                        }}
                        onBlur={() => handleBlur('dependentsCount')}
                        className={`w-full px-3.5 py-2.5 text-xs rounded-xl border focus:outline-hidden transition ${
                          touchedFields.dependentsCount && fieldErrors.dependentsCount
                            ? 'border-rose-400 focus:border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/20'
                            : 'bg-slate-50 border-slate-300 focus:bg-white focus:border-[#185b9d]'
                        }`}
                      />
                      {touchedFields.dependentsCount && fieldErrors.dependentsCount && (
                        <p className="text-[11px] font-semibold text-rose-600 mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>{fieldErrors.dependentsCount}</span>
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Emergency Contact Person & Phone *
                      </label>
                      <input
                        id="field-emergencyContact"
                        type="text"
                        required
                        placeholder="e.g. Tariq Khan (Uncle) - 0312-9876543"
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
                        className={`w-full px-3.5 py-2.5 text-xs rounded-xl border focus:outline-hidden transition ${
                          touchedFields.emergencyContact && fieldErrors.emergencyContact
                            ? 'border-rose-400 focus:border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/20'
                            : 'bg-slate-50 border-slate-300 focus:bg-white focus:border-[#185b9d]'
                        }`}
                      />
                      {touchedFields.emergencyContact && fieldErrors.emergencyContact ? (
                        <p className="text-[11px] font-semibold text-rose-600 mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>{fieldErrors.emergencyContact}</span>
                        </p>
                      ) : (
                        <span className="text-[10px] text-slate-400 mt-1 block">Include person name and 11-digit phone number</span>
                      )}
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

                  {/* BS Program Specific Guidance / Requirement Notice */}
                  {(formData.currentClass || '').toLowerCase().includes('bs') && (
                    <div className="p-3.5 rounded-2xl bg-blue-50/80 border border-blue-200 text-xs flex items-start gap-2.5 text-blue-900">
                      <Sparkles className="w-4 h-4 text-[#185b9d] flex-shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block">BS Program Requirement: 2 Academic Qualifications</span>
                        <span className="text-[11px] text-blue-700 leading-relaxed">
                          BS Program applicants must submit results for <strong>two different qualifications</strong> (e.g. Matric / SSC and FSc / Intermediate / Pre-Medical / Pre-Engineering). Please ensure you add both records.
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
                        1 qualification added ({formData.academicRecords[0].gradeClass}). <strong>1 more qualification required</strong> (e.g. FSc / Intermediate) for BS applicants.
                      </span>
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
                          placeholder="e.g. Matric / SSC or FSc / Pre-Medical"
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
                          placeholder="e.g. 1100"
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
                          placeholder="e.g. 985"
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
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">School / College / Institute Name *</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="e.g. BISE Abbottabad / Degree College"
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

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span>Academic scores will be verified from physical DMCs during scrutiny.</span>
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
                      PDF, JPG, PNG, or Word format (Max 5 MB each)
                    </span>
                  </div>

                  {/* Soft Reminder for BS Applicants */}
                  {(formData.currentClass || '').toLowerCase().includes('bs') && (
                    <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[#185b9d] flex-shrink-0" />
                      <span>
                        <strong>BS Program Reminder:</strong> You have added 2 academic qualifications — please upload a DMC for each (e.g. Matric DMC & FSc DMC).
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* B-Form / CNIC */}
                    <div
                      id="field-bformUploaded"
                      className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                        formData.documents.bformUploaded
                          ? 'bg-emerald-50/80 border-emerald-300 ring-1 ring-emerald-300/30'
                          : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <FileCheck className={`w-4 h-4 flex-shrink-0 ${formData.documents.bformUploaded ? 'text-emerald-600' : 'text-slate-400'}`} />
                            <span className="text-xs font-bold text-slate-800 leading-snug">Candidate B-Form / CNIC Scanned Copy</span>
                          </div>
                          <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded-md border border-rose-100 flex-shrink-0">
                            Required
                          </span>
                        </div>

                        {formData.documents.bformUploaded && uploadedDocs.bformUploaded ? (
                          <div className="p-2 rounded-xl bg-white border border-emerald-200 flex items-center justify-between text-xs">
                            <div className="min-w-0 pr-2">
                              <span className="font-semibold text-slate-800 truncate block text-[11px]">
                                {uploadedDocs.bformUploaded.name}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {uploadedDocs.bformUploaded.size}
                              </span>
                            </div>
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md flex-shrink-0">
                              Attached ✓
                            </span>
                          </div>
                        ) : (
                          <p className="text-[10px] text-slate-400">PDF, JPG, PNG (Max 5 MB)</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                        {formData.documents.bformUploaded ? (
                          <>
                            <label className="flex-1 cursor-pointer py-1.5 text-center text-xs font-bold text-[#185b9d] bg-blue-50 hover:bg-blue-100 rounded-xl border border-blue-200 transition">
                              Change File
                              <input
                                type="file"
                                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                                onChange={(e) => handleDocumentUpload('bformUploaded', e)}
                                className="hidden"
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => handleRemoveDocument('bformUploaded')}
                              className="px-3 py-1.5 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl border border-rose-200 transition cursor-pointer"
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
                              onChange={(e) => handleDocumentUpload('bformUploaded', e)}
                              className="hidden"
                            />
                          </label>
                        )}
                      </div>
                    </div>

                    {/* Father CNIC */}
                    <div
                      id="field-fatherCnicUploaded"
                      className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                        formData.documents.fatherCnicUploaded
                          ? 'bg-emerald-50/80 border-emerald-300 ring-1 ring-emerald-300/30'
                          : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <FileCheck className={`w-4 h-4 flex-shrink-0 ${formData.documents.fatherCnicUploaded ? 'text-emerald-600' : 'text-slate-400'}`} />
                            <span className="text-xs font-bold text-slate-800 leading-snug">Father / Guardian CNIC Front & Back</span>
                          </div>
                          <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded-md border border-rose-100 flex-shrink-0">
                            Required
                          </span>
                        </div>

                        {formData.documents.fatherCnicUploaded && uploadedDocs.fatherCnicUploaded ? (
                          <div className="p-2 rounded-xl bg-white border border-emerald-200 flex items-center justify-between text-xs">
                            <div className="min-w-0 pr-2">
                              <span className="font-semibold text-slate-800 truncate block text-[11px]">
                                {uploadedDocs.fatherCnicUploaded.name}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {uploadedDocs.fatherCnicUploaded.size}
                              </span>
                            </div>
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md flex-shrink-0">
                              Attached ✓
                            </span>
                          </div>
                        ) : (
                          <p className="text-[10px] text-slate-400">PDF, JPG, PNG (Max 5 MB)</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                        {formData.documents.fatherCnicUploaded ? (
                          <>
                            <label className="flex-1 cursor-pointer py-1.5 text-center text-xs font-bold text-[#185b9d] bg-blue-50 hover:bg-blue-100 rounded-xl border border-blue-200 transition">
                              Change File
                              <input
                                type="file"
                                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                                onChange={(e) => handleDocumentUpload('fatherCnicUploaded', e)}
                                className="hidden"
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => handleRemoveDocument('fatherCnicUploaded')}
                              className="px-3 py-1.5 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl border border-rose-200 transition cursor-pointer"
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
                              onChange={(e) => handleDocumentUpload('fatherCnicUploaded', e)}
                              className="hidden"
                            />
                          </label>
                        )}
                      </div>
                    </div>

                    {/* Multi-File DMC Upload Card */}
                    <div
                      id="field-dmcUploaded"
                      className={`sm:col-span-2 p-4 rounded-2xl border transition-all space-y-3 ${
                        formData.documents.dmcUploaded || dmcFiles.length > 0
                          ? 'bg-emerald-50/80 border-emerald-300 ring-1 ring-emerald-300/30'
                          : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <FileCheck className={`w-4 h-4 flex-shrink-0 ${formData.documents.dmcUploaded || dmcFiles.length > 0 ? 'text-emerald-600' : 'text-slate-400'}`} />
                            <span className="text-xs font-bold text-slate-800 leading-snug">
                              Last Examination DMC / Result Card(s)
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Attach your official mark sheets (PDF, JPG, PNG, DOC — Max 5 MB each). Multiple uploads supported.
                          </p>
                        </div>
                        <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded-md border border-rose-100 flex-shrink-0">
                          Required
                        </span>
                      </div>

                      {/* List of uploaded DMC files */}
                      {dmcFiles.length > 0 && (
                        <div className="space-y-2 pt-1">
                          {dmcFiles.map((df, idx) => (
                            <div
                              key={df.id}
                              className="p-2.5 rounded-xl bg-white border border-emerald-200 flex items-center justify-between text-xs shadow-2xs"
                            >
                              <div className="flex items-center gap-2 min-w-0 pr-2">
                                <FileCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                                <div className="min-w-0">
                                  <span className="font-bold text-slate-800 truncate block text-[11px]">
                                    {df.name}
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    {df.size} • Certificate #{idx + 1}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                                  Attached ✓
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveDmcFile(df.id)}
                                  className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                                  title="Remove this DMC"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}

                          <div className="p-2 rounded-xl bg-emerald-100/70 border border-emerald-300/80 text-[11px] text-emerald-900 font-semibold flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                            <span>DMC uploaded. Upload next DMC if any.</span>
                          </div>
                        </div>
                      )}

                      {/* Add DMC Buttons */}
                      <div className="pt-1">
                        {dmcFiles.length > 0 ? (
                          <label className="w-full cursor-pointer py-2 text-center text-xs font-bold text-[#185b9d] bg-blue-50 hover:bg-blue-100 rounded-xl border border-blue-200 transition flex items-center justify-center gap-1.5">
                            <Plus className="w-3.5 h-3.5" />
                            <span>+ Add Another DMC</span>
                            <input
                              type="file"
                              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                              onChange={handleDmcFilesUpload}
                              className="hidden"
                            />
                          </label>
                        ) : (
                          <label className="w-full cursor-pointer py-2 text-center text-xs font-bold text-slate-700 bg-slate-100 hover:bg-[#185b9d] hover:text-white rounded-xl border border-slate-300 transition flex items-center justify-center gap-1.5">
                            <UploadCloud className="w-3.5 h-3.5" />
                            <span>+ Choose DMC File(s)</span>
                            <input
                              type="file"
                              multiple
                              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                              onChange={handleDmcFilesUpload}
                              className="hidden"
                            />
                          </label>
                        )}
                      </div>
                    </div>

                    {/* Domicile Certificate */}
                    <div
                      id="field-domicileUploaded"
                      className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                        formData.documents.domicileUploaded
                          ? 'bg-emerald-50/80 border-emerald-300 ring-1 ring-emerald-300/30'
                          : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <FileCheck className={`w-4 h-4 flex-shrink-0 ${formData.documents.domicileUploaded ? 'text-emerald-600' : 'text-slate-400'}`} />
                            <span className="text-xs font-bold text-slate-800 leading-snug">Domicile Certificate (Optional)</span>
                          </div>
                        </div>

                        {formData.documents.domicileUploaded && uploadedDocs.domicileUploaded ? (
                          <div className="p-2 rounded-xl bg-white border border-emerald-200 flex items-center justify-between text-xs">
                            <div className="min-w-0 pr-2">
                              <span className="font-semibold text-slate-800 truncate block text-[11px]">
                                {uploadedDocs.domicileUploaded.name}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {uploadedDocs.domicileUploaded.size}
                              </span>
                            </div>
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md flex-shrink-0">
                              Attached ✓
                            </span>
                          </div>
                        ) : (
                          <p className="text-[10px] text-slate-400">PDF, JPG, PNG (Max 5 MB)</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                        {formData.documents.domicileUploaded ? (
                          <>
                            <label className="flex-1 cursor-pointer py-1.5 text-center text-xs font-bold text-[#185b9d] bg-blue-50 hover:bg-blue-100 rounded-xl border border-blue-200 transition">
                              Change File
                              <input
                                type="file"
                                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                                onChange={(e) => handleDocumentUpload('domicileUploaded', e)}
                                className="hidden"
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => handleRemoveDocument('domicileUploaded')}
                              className="px-3 py-1.5 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl border border-rose-200 transition cursor-pointer"
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
                              onChange={(e) => handleDocumentUpload('domicileUploaded', e)}
                              className="hidden"
                            />
                          </label>
                        )}
                      </div>
                    </div>

                    {/* Income Certificate */}
                    <div
                      id="field-incomeCertUploaded"
                      className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                        formData.documents.incomeCertUploaded
                          ? 'bg-emerald-50/80 border-emerald-300 ring-1 ring-emerald-300/30'
                          : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <FileCheck className={`w-4 h-4 flex-shrink-0 ${formData.documents.incomeCertUploaded ? 'text-emerald-600' : 'text-slate-400'}`} />
                            <span className="text-xs font-bold text-slate-800 leading-snug">Income / Need Proof Certificate (Optional)</span>
                          </div>
                        </div>

                        {formData.documents.incomeCertUploaded && uploadedDocs.incomeCertUploaded ? (
                          <div className="p-2 rounded-xl bg-white border border-emerald-200 flex items-center justify-between text-xs">
                            <div className="min-w-0 pr-2">
                              <span className="font-semibold text-slate-800 truncate block text-[11px]">
                                {uploadedDocs.incomeCertUploaded.name}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {uploadedDocs.incomeCertUploaded.size}
                              </span>
                            </div>
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md flex-shrink-0">
                              Attached ✓
                            </span>
                          </div>
                        ) : (
                          <p className="text-[10px] text-slate-400">PDF, JPG, PNG (Max 5 MB)</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                        {formData.documents.incomeCertUploaded ? (
                          <>
                            <label className="flex-1 cursor-pointer py-1.5 text-center text-xs font-bold text-[#185b9d] bg-blue-50 hover:bg-blue-100 rounded-xl border border-blue-200 transition">
                              Change File
                              <input
                                type="file"
                                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                                onChange={(e) => handleDocumentUpload('incomeCertUploaded', e)}
                                className="hidden"
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => handleRemoveDocument('incomeCertUploaded')}
                              className="px-3 py-1.5 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl border border-rose-200 transition cursor-pointer"
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
                              onChange={(e) => handleDocumentUpload('incomeCertUploaded', e)}
                              className="hidden"
                            />
                          </label>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}


              {/* STAGE 8: DECLARATION & E-SIGNATURE */}
              {currentStage === 8 && (
                <div className="space-y-5">
                  <h3 className="text-lg font-bold text-slate-900 border-b pb-2">
                    Stage 8: Legal Declaration & Digital E-Signature
                  </h3>

                  {/* PRE-SUBMISSION AUDIT & READINESS CHECKLIST */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
                      <div className="flex items-center gap-2">
                        <FileCheck className="w-5 h-5 text-[#185b9d]" />
                        <div>
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-800 block">
                            Pre-Submission Application Audit (Stages 1 to 7)
                          </span>
                          <span className="text-[11px] text-slate-500">
                            Verify that all required data and documents are in place before final central registration
                          </span>
                        </div>
                      </div>

                      {getIncompleteStagesBefore8().length === 0 ? (
                        <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold border border-emerald-300 flex items-center gap-1.5 w-fit">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          100% Ready for Submission
                        </span>
                      ) : (
                        <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-[11px] font-bold border border-amber-300 flex items-center gap-1.5 w-fit">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-700" />
                          {getIncompleteStagesBefore8().length} Stage(s) Incomplete
                        </span>
                      )}
                    </div>

                    {/* Stage-by-stage status cards */}
                    <div className="space-y-2 pt-1">
                      {stagesList.slice(0, 7).map((st) => {
                        const errs = getStageErrors(st.num);
                        const isComplete = errs.length === 0;

                        return (
                          <div
                            key={st.num}
                            className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs transition-all ${
                              isComplete
                                ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
                                : 'bg-rose-50/80 border-rose-200 text-rose-950'
                            }`}
                          >
                            <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                              {isComplete ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5 sm:mt-0" />
                              ) : (
                                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5 sm:mt-0" />
                              )}
                              <div>
                                <span className="font-bold block sm:inline text-slate-900">
                                  Stage {st.num}: {st.title}
                                </span>
                                {!isComplete && (
                                  <span className="text-[11px] text-rose-700 font-medium block sm:inline sm:ml-2">
                                    • Missing: {errs.join(', ')}
                                  </span>
                                )}
                              </div>
                            </div>

                            {isComplete ? (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-md self-start sm:self-center">
                                Verified ✓
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleProceedNext(st.num)}
                                className="text-[11px] font-bold text-rose-700 bg-white hover:bg-rose-100 px-3 py-1 rounded-lg border border-rose-300 shadow-xs flex items-center gap-1 transition self-start sm:self-center cursor-pointer"
                              >
                                <span>Go to Stage {st.num} to Fix</span>
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Legal Undertaking Box */}
                  <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200 space-y-3 text-xs text-slate-700 leading-relaxed">
                    <p className="font-semibold text-slate-900">
                      I solemnly affirm that all information provided in this Session V (2026) application is accurate and true to the best of my knowledge.
                    </p>
                    <ul className="list-disc pl-4 space-y-1 text-slate-600 text-[11px]">
                      <li>I understand that 100% of exam questions are drawn from AZM official question banks.</li>
                      <li>I agree to adhere strictly to the OMR optical examination regulations.</li>
                      <li>Any deliberate falsehood or forged document will result in instant disqualification and debarment.</li>
                    </ul>

                    <label className="flex items-center gap-2 pt-2 text-slate-900 font-bold cursor-pointer">
                      <input
                        id="field-declarationAccepted"
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
                  <div id="field-signatureDataUrl">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-slate-800">
                        Candidate / Guardian Digital Signature Pad (Draw with mouse or finger):
                      </label>
                      <button
                        type="button"
                        onClick={clearSignature}
                        className="text-[11px] text-rose-600 hover:text-rose-800 font-semibold flex items-center gap-1 cursor-pointer"
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

              {/* STAGE INLINE VALIDATION ERROR ALERT */}
              {stageErrors[currentStage] && stageErrors[currentStage].length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  id="stage-validation-alert"
                  className="mt-6 p-4 rounded-2xl bg-rose-50 border-2 border-rose-200 text-rose-900 text-xs space-y-2 shadow-xs"
                >
                  <div className="flex items-center gap-2 text-rose-800 font-bold">
                    <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                    <span>Please Complete Missing Information on Stage {currentStage} ({stagesList[currentStage - 1].title}):</span>
                  </div>
                  <ul className="list-disc pl-6 space-y-1 text-rose-700 font-medium text-[11px]">
                    {stageErrors[currentStage].map((errText, eIdx) => (
                      <li
                        key={eIdx}
                        className="cursor-pointer hover:underline"
                        onClick={() => {
                          const alertEl = document.getElementById('stage-validation-alert');
                          if (alertEl) {
                            alertEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }
                        }}
                      >
                        {errText}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )}

              {/* Wizard Navigation & Action Buttons */}
              <div className="mt-8 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  {currentStage > 1 ? (
                    <button
                      type="button"
                      onClick={() => handleProceedNext(Math.max(currentStage - 1, 1))}
                      className="px-4 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all flex items-center gap-1.5 focus:outline-hidden cursor-pointer"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Previous Stage</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={saveDraft}
                      className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
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
                      disabled={!isStageComplete(currentStage)}
                      onClick={() => handleProceedNext(currentStage + 1)}
                      className="px-6 py-2.5 text-xs font-bold text-white bg-[#185b9d] hover:bg-[#13497e] disabled:opacity-40 disabled:cursor-not-allowed rounded-xl shadow-md transition-all flex items-center gap-2 focus:outline-hidden cursor-pointer"
                    >
                      <span>Next: Stage {currentStage + 1}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={isSubmitting || !isStageComplete(8) || getIncompleteStagesBefore8().length > 0}
                      id="btn-final-submit-application"
                      className="px-8 py-3 text-xs font-extrabold text-white bg-gradient-to-r from-[#185b9d] via-emerald-600 to-[#299b46] hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-lg transition-all flex items-center gap-2 transform hover:scale-[1.02] focus:outline-hidden cursor-pointer"
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
                <span>100% merit-based verification.</span>
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

            {/* Prominent Pre-Payment Profile Slip Download Box */}
            <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-50 via-sky-50 to-indigo-50 border-2 border-blue-300 flex flex-col sm:flex-row items-center justify-between gap-4 text-left">
              <div className="space-y-1">
                <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-[#185b9d] text-[10px] font-extrabold uppercase tracking-wider">
                  Important: Save Your Application Slip
                </span>
                <h4 className="text-sm font-black text-slate-900">
                  Download Your Official Registration Profile Slip
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  You can download and print your complete application form now, even before making the PKR 300 fee payment.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleDownloadStudentPdf}
                  disabled={isDownloadingPdf}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#185b9d] hover:bg-[#13497e] text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {isDownloadingPdf ? (
                    <>
                      <Loader2 className="w-4 h-4 text-white animate-spin" />
                      <span>Generating PDF...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>Download Registration Slip (PDF)</span>
                    </>
                  )}
                </button>
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
                <span className="text-xs font-bold">EasyPaisa / JazzCash</span>
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

            {/* TAB 1: EasyPaisa / JazzCash Details */}
            {paymentTab === 'easypaisa' && (
              <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-50/70 to-slate-50 border border-emerald-200/80 space-y-4 text-xs">
                <div className="flex items-center justify-between border-b border-emerald-200 pb-3">
                  <div>
                    <span className="font-bold text-slate-900 block text-sm">EasyPaisa / JazzCash Mobile Transfer</span>
                    <span className="text-slate-500 text-[11px]">Send PKR 300 from any mobile wallet in Pakistan</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-md bg-emerald-600 text-white font-bold text-[10px]">
                    Instant Verification
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between shadow-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">EasyPaisa / JazzCash Number</span>
                      <span className="text-base font-extrabold font-mono text-slate-900">0344-0197194</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard('03440197194', 'mobileNo')}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 font-bold text-xs flex items-center gap-1 transition-all"
                    >
                      {copiedField === 'mobileNo' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedField === 'mobileNo' ? 'Copied!' : 'Copy'}</span>
                    </button>
                  </div>

                  <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Account Title / Name</span>
                    <span className="text-base font-extrabold text-slate-900">Sumama Khan</span>
                  </div>
                </div>

                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 space-y-1">
                  <strong>Important: Payment Reference / Remarks</strong>
                  <p className="text-[11px] text-amber-800">
                    When making the mobile transfer, please put your Application ID (<strong>{submittedAppId}</strong>) in the remarks/purpose field.
                  </p>
                </div>

                {/* Instant WhatsApp Proof Button */}
                <a
                  href={`https://wa.me/923051755551?text=${encodeURIComponent(
                    `Hello AZM Accounts Desk,\n\nI have registered for Session V (2026) Scholarship Exam.\n• Application ID: ${submittedAppId}\n• Candidate: ${formData.fullName}\n• Class: ${formData.currentClass}\n• Fee Amount: PKR 300\n• Paid Via: EasyPaisa / JazzCash (To: Sumama Khan - 0344-0197194)\n\nPlease find attached my payment receipt/screenshot for quick verification and Roll Number activation.`
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
                    <span className="font-bold text-slate-900 block text-sm">Direct Commercial Bank Accounts (IBFT / Online)</span>
                    <span className="text-slate-500 text-[11px]">Transfer via banking app, ATM, or over-the-counter deposit</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-md bg-blue-700 text-white font-bold text-[10px]">
                    2 Bank Options
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Bank 1: Faysal Bank */}
                  <div className="p-4 bg-white rounded-2xl border border-blue-200 shadow-xs space-y-2.5">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="font-bold text-slate-900 text-xs">Option A: Faysal Bank</span>
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-800 text-[10px] font-bold rounded">Bank Faysal</span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Account Number</span>
                      <div className="flex items-center justify-between bg-slate-50 p-2 rounded-xl border border-slate-200">
                        <span className="text-xs font-extrabold font-mono text-slate-900">3126701000006213</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard('3126701000006213', 'faysalAcc')}
                          className="px-2 py-1 bg-white hover:bg-slate-100 rounded-lg text-slate-700 font-bold text-[10px] flex items-center gap-1 border border-slate-200"
                        >
                          {copiedField === 'faysalAcc' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedField === 'faysalAcc' ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Account Title</span>
                      <span className="text-xs font-extrabold text-slate-900">Sumama Khan</span>
                    </div>
                  </div>

                  {/* Bank 2: Bank Alfalah */}
                  <div className="p-4 bg-white rounded-2xl border border-rose-200 shadow-xs space-y-2.5">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="font-bold text-slate-900 text-xs">Option B: Bank Alfalah</span>
                      <span className="px-2 py-0.5 bg-rose-50 text-rose-800 text-[10px] font-bold rounded">Alfalah</span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Account Number</span>
                      <div className="flex items-center justify-between bg-slate-50 p-2 rounded-xl border border-slate-200">
                        <span className="text-xs font-extrabold font-mono text-slate-900">83861010161490</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard('83861010161490', 'alfalahAcc')}
                          className="px-2 py-1 bg-white hover:bg-slate-100 rounded-lg text-slate-700 font-bold text-[10px] flex items-center gap-1 border border-slate-200"
                        >
                          {copiedField === 'alfalahAcc' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedField === 'alfalahAcc' ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Account Title</span>
                      <span className="text-xs font-extrabold text-slate-900">Sumama Khan</span>
                    </div>
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
                  <a
                    href={`https://wa.me/923440197194?text=${encodeURIComponent(
                      `Hello AZM Accounts Desk,\n\nI have completed PKR 300 fee payment via Bank IBFT for Session V (2026).\n• Application ID: ${submittedAppId}\n• Candidate: ${formData.fullName}\n• Class: ${formData.currentClass}\n• Transferred To: Sumama Khan\n\nPlease find attached my bank transfer receipt for verification.`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2.5 bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>Send Bank Receipt on WhatsApp</span>
                  </a>
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
                    <span className="font-mono text-xs font-bold text-[#185b9d]">0344-0197194</span>
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
                  onClick={handleResetForm}
                  className="px-3 py-2 text-xs text-slate-500 hover:text-slate-800 font-semibold"
                >
                  Submit Another Application
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
                        <div><span className="text-slate-500">Account Title:</span> <strong className="text-slate-900">Sumama Khan</strong></div>
                        <div><span className="text-slate-500">Faysal Bank:</span> <strong className="text-slate-900 font-mono">3126701000006213</strong></div>
                        <div><span className="text-slate-500">Bank Alfalah:</span> <strong className="text-slate-900 font-mono">83861010161490</strong></div>
                        <div><span className="text-slate-500">EasyPaisa / JazzCash:</span> <span className="text-slate-800 font-mono">0344-0197194</span></div>
                        <div className="pt-2 border-t border-slate-200">
                          <span className="text-slate-500">Amount (Fee):</span> <strong className="text-emerald-700 text-xs font-bold">PKR 300/- (Fixed)</strong>
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
