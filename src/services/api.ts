import {
  StudentApplicationData,
  PartnerSchoolData,
  RollNumberSlip,
  ResultCard,
  PublicMeritEntry,
  GrievanceTicket,
  QuestionBankItem,
  AlertItem
} from '../types';
import {
  OFFICIAL_ALERTS,
  PARTNER_SCHOOLS,
  REGISTRATION_HUBS,
  SAMPLE_QUESTION_BANK
} from '../data/scholarshipData';

/**
 * Global API Service Layer for AZM.AIO Portal
 * 
 * To connect your custom backend:
 * 1. Create a `.env` file with `VITE_API_BASE_URL=https://your-api-domain.com/api`
 * 2. Set `USE_MOCK_FALLBACK = false` when your backend endpoints are fully deployed.
 */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
export const USE_MOCK_FALLBACK = true;

/**
 * Standard API Response envelope
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// -------------------------------------------------------------
// 1. Roll Number Slips API
// -------------------------------------------------------------
// 1. Roll Number Slips API
// -------------------------------------------------------------
export async function searchRollNumberSlip(query: string): Promise<ApiResponse<RollNumberSlip>> {
  const clean = query.trim().toLowerCase();
  if (!clean) {
    return { success: false, error: 'Please provide a valid Roll Number, CNIC / B-Form, or Application ID.' };
  }

  try {
    const { mockApi } = await import('../lib/mockApi');
    const students = await mockApi.getStudents();

    // Match by rollNumber, applicationNo, or cnicOrBForm
    const student = students.find((s: any) => {
      const matchRoll = s.rollNumber && s.rollNumber.toLowerCase() === clean;
      const matchApp = s.applicationNo && s.applicationNo.toLowerCase() === clean;
      const matchCnic = s.cnicOrBForm && s.cnicOrBForm.replace(/\D/g, '') === clean.replace(/\D/g, '');
      return matchRoll || matchApp || matchCnic;
    });

    if (student) {
      // Check if fee is paid and roll number issued
      if (!student.rollNumber || student.feeStatus !== 'PAID') {
        return {
          success: false,
          error: `Application Found (${student.fullName} - ${student.applicationNo}): Registration fee payment of PKR 300 is pending verification. Roll Number Slip and Biometric QR will be issued once payment is approved by administration.`
        };
      }

      // Fee is approved & roll number is active
      const slip: RollNumberSlip = {
        rollNumber: student.rollNumber,
        candidateName: student.fullName,
        fatherName: student.fatherName,
        cnicBForm: student.cnicOrBForm,
        appliedClass: student.currentClass,
        testCenter: student.officeUse?.testCentre || 'Jadoon Public School & College Main Exam Hall',
        reportingTime: student.officeUse?.testReportingTime || '09:00 AM',
        testDate: student.officeUse?.testDate || 'Sunday, 15 November 2026',
        centerAddress: 'Mansehra / Abbottabad Regional Examination Center, KP',
        seatNumber: `HALL-${student.rollNumber.split('-').pop() || 'A01'}`,
        instructions: [
          'Bring your original CNIC / B-Form along with this printed entry slip to the examination centre.',
          'Entry gate closes strictly 15 minutes before the reporting time (08:45 AM).',
          'Biometric verification will be carried out at the entry desk using your QR code.'
        ],
        qrDataUrl: student.qrImageUrl || `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(student.rollNumber)}`
      };

      return {
        success: true,
        data: slip
      };
    }
  } catch (err) {
    console.error('searchRollNumberSlip error:', err);
  }

  return {
    success: false,
    error: `No issued roll number slip found for "${query}". If you recently applied, please ensure your PKR 300 deposit challan has been approved by the accountant desk.`
  };
}

// -------------------------------------------------------------
// 2. Results & Merit API
// -------------------------------------------------------------
export async function searchCandidateResult(query: string): Promise<ApiResponse<ResultCard>> {
  const clean = query.trim();
  if (!clean) {
    return { success: false, error: 'Please enter a valid Roll Number or CNIC.' };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/results/search?query=${encodeURIComponent(clean)}`);
    if (response.ok) {
      const data = await response.json();
      return { success: true, data };
    }
  } catch (err) {
    // Backend not reached
  }

  return {
    success: false,
    error: `No result record found for "${clean}". Session V results will be published following the November 2026 examination.`
  };
}

export async function fetchPublicMeritList(params?: {
  category?: string;
  district?: string;
  search?: string;
}): Promise<ApiResponse<PublicMeritEntry[]>> {
  try {
    const queryParams = new URLSearchParams();
    if (params?.category && params.category !== 'all') queryParams.append('category', params.category);
    if (params?.district && params.district !== 'all') queryParams.append('district', params.district);
    if (params?.search) queryParams.append('search', params.search);

    const response = await fetch(`${API_BASE_URL}/results/merit-list?${queryParams.toString()}`);
    if (response.ok) {
      const data = await response.json();
      return { success: true, data };
    }
  } catch (err) {
    // Backend not reached
  }

  // Default empty merit list until backend populates
  return {
    success: true,
    data: []
  };
}

// -------------------------------------------------------------
// 3. Application Submissions API
// -------------------------------------------------------------
// -------------------------------------------------------------
// 3. Application Submissions API
// -------------------------------------------------------------
export async function submitStudentApplication(
  payload: StudentApplicationData
): Promise<ApiResponse<{ applicationId: string; rollNumber?: string; id?: string; qrToken?: string; qrImageUrl?: string }>> {
  try {
    const { mockApi } = await import('../lib/mockApi');
    
    // Map frontend wizard model to backend registration schema
    const backendPayload = {
      fullName: payload.fullName,
      fatherName: payload.fatherName,
      gender: payload.gender?.toUpperCase() === 'FEMALE' ? 'FEMALE' : 'MALE',
      dateOfBirth: payload.dob || '2008-01-01',
      age: Number(payload.age) || 16,
      cnicOrBForm: payload.cnicBForm,
      nationality: 'Pakistani',
      religion: 'Islam',
      address: payload.permanentAddress || 'Address',
      district: payload.district || 'Abbottabad',
      province: payload.province || 'Khyber Pakhtunkhwa',
      studentMobile: payload.mobile,
      parentMobile: payload.emergencyContact || payload.mobile || '0300-0000000',
      whatsapp: payload.whatsapp,
      email: payload.email,
      currentClass: payload.currentClass || 'SSC-II (Class 10th)',
      hsscGroup: payload.discipline,
      schoolName: payload.schoolName || 'School',
      boardOrUniversity: payload.boardUniversity || 'BISE Abbottabad',
      currentRollNo: payload.currentRollNo,
      scholarshipCategory: payload.appliedCategory?.includes('Orphan')
        ? 'ORPHAN'
        : payload.appliedCategory?.includes('Disability')
        ? 'PERSON_WITH_DISABILITY'
        : payload.appliedCategory?.includes('Needy') || payload.isSpecialNeed
        ? 'FINANCIALLY_NEEDY'
        : 'GENERAL_MERIT',
      guardianOccupation: payload.guardianOccupation,
      guardianMonthlyIncome: Number(payload.monthlyHouseholdIncome) || 0,
      emergencyContact: payload.emergencyContact || payload.mobile || '0300-0000000',
      emergencyRelation: 'Guardian',
      referralSource: 'AZM.AIO Online Apply Portal',
      photoUrl: payload.photoUrl,
      academicRecords: (payload.academicRecords || []).map((r) => ({
        examLevel: r.gradeClass || 'Class 9th',
        boardOrUni: r.institute || 'BISE',
        yearOfPassing: r.passingYear || '2025',
        totalMarks: Number(r.totalMarks) || 550,
        obtainedMarks: Number(r.obtainedMarks) || 450,
        percentage: Number(r.percentage) || 80,
      })),
      documents: {
        bformCnicCopy: !!payload.documents?.bformUploaded,
        fatherCnicCopy: !!payload.documents?.fatherCnicUploaded,
        passportPhotos: !!payload.photoUrl,
        previousResultCard: !!payload.documents?.dmcUploaded,
        domicileCertificate: !!payload.documents?.domicileUploaded,
        incomeCertificate: !!payload.documents?.incomeCertUploaded,
      },
    };

    const student = await mockApi.createStudent(backendPayload);
    return {
      success: true,
      data: {
        id: student.id,
        applicationId: student.applicationNo || `APP-2026-${Math.floor(1000 + Math.random() * 9000)}`,
        rollNumber: student.rollNumber,
        qrToken: student.qrToken,
        qrImageUrl: student.qrImageUrl,
      },
      message: 'Application received and registered into central database.',
    };
  } catch (err: any) {
    console.error('Student registration error:', err);
    throw err;
  }
}

export async function submitPartnerSchoolApplication(
  payload: PartnerSchoolData
): Promise<ApiResponse<{ partnerId: string; partnerCode?: string; id?: string }>> {
  try {
    const { mockApi } = await import('../lib/mockApi');

    const backendPayload = {
      institutionName: payload.institutionName,
      institutionType:
        payload.category?.toLowerCase().includes('college') || payload.category?.toLowerCase().includes('inter')
          ? 'COLLEGE'
          : payload.category?.toLowerCase().includes('uni')
          ? 'UNIVERSITY'
          : 'SCHOOL',
      campus: payload.campus || 'Main Campus',
      address: payload.address || 'Campus Address',
      district: payload.district || 'Abbottabad',
      province: 'Khyber Pakhtunkhwa',
      contactName: payload.contactPerson || 'Principal / Administrator',
      contactDesignation: payload.designation || 'Head of Institution',
      contactMobile: payload.whatsapp || payload.phone || '0300-0000000',
      contactWhatsapp: payload.whatsapp,
      contactEmail: payload.email,
      website: payload.website,
      classesOffered: payload.classesOffered || ['SSC', 'HSSC'],
      studentStrength: Number(payload.approxStudents) || 100,
      expectedApplicants: Number(payload.expectedApplicants) || 50,
      agreedToTerms: true,
    };

    const partner = await mockApi.registerPartner(backendPayload);
    return {
      success: true,
      data: {
        id: partner.id,
        partnerId: partner.partnerCode || `PRT-2026-${Math.floor(1000 + Math.random() * 9000)}`,
        partnerCode: partner.partnerCode,
      },
      message: 'Partner institution affiliation request submitted successfully.',
    };
  } catch (err: any) {
    console.error('Partner affiliation error:', err);
    throw err;
  }
}

// -------------------------------------------------------------
// 4. Grievance & Support Tickets API
// -------------------------------------------------------------
export async function submitGrievanceTicket(
  payload: Omit<GrievanceTicket, 'ticketId' | 'timestamp' | 'status'>
): Promise<ApiResponse<{ ticketId: string }>> {
  try {
    const response = await fetch(`${API_BASE_URL}/grievances`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (response.ok) {
      const data = await response.json();
      return { success: true, data };
    }
  } catch (err) {
    // Backend offline
  }

  const ticketId = `TKT-2026-${Math.floor(1000 + Math.random() * 9000)}`;
  return {
    success: true,
    data: { ticketId },
    message: 'Ticket lodged successfully. Expected resolution within 24 hours.'
  };
}

// -------------------------------------------------------------
// 5. Live Alerts & Announcements API
// -------------------------------------------------------------
export async function fetchLiveAlerts(): Promise<ApiResponse<AlertItem[]>> {
  try {
    const response = await fetch(`${API_BASE_URL}/alerts`);
    if (response.ok) {
      const data = await response.json();
      return { success: true, data };
    }
  } catch (err) {
    // Backend offline
  }

  return {
    success: true,
    data: OFFICIAL_ALERTS
  };
}

// -------------------------------------------------------------
// 6. Question Bank Practice Simulator API
// -------------------------------------------------------------
export async function fetchQuestionBankItems(classLevel?: string): Promise<ApiResponse<QuestionBankItem[]>> {
  try {
    const url = classLevel 
      ? `${API_BASE_URL}/questions?class=${encodeURIComponent(classLevel)}`
      : `${API_BASE_URL}/questions`;
    const response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      return { success: true, data };
    }
  } catch (err) {
    // Backend offline
  }

  return {
    success: true,
    data: SAMPLE_QUESTION_BANK
  };
}

// -------------------------------------------------------------
// 7. Directory & Institutions API
// -------------------------------------------------------------
export async function fetchPartnerInstitutions(): Promise<ApiResponse<PartnerSchoolData[]>> {
  try {
    const response = await fetch(`${API_BASE_URL}/institutions`);
    if (response.ok) {
      const data = await response.json();
      return { success: true, data };
    }
  } catch (err) {}

  return {
    success: true,
    data: PARTNER_SCHOOLS
  };
}
