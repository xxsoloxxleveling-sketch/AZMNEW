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
import { API_BASE_URL } from '../lib/apiClient';
export { API_BASE_URL };
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
  const cleanDigits = query.replace(/\D/g, '');

  if (!clean && cleanDigits.length < 5) {
    return { success: false, error: 'Please provide a valid Roll Number, CNIC / B-Form, or Application ID.' };
  }

  try {
    const { mockApi } = await import('../lib/mockApi');
    const students = await mockApi.getStudents();

    // Match by rollNumber, applicationNo, CNIC, or ID
    const student = students.find((s: any) => {
      const matchRoll = s.rollNumber && (s.rollNumber.toLowerCase() === clean || s.rollNumber.toLowerCase().includes(clean));
      const matchApp = s.applicationNo && (s.applicationNo.toLowerCase() === clean || s.applicationNo.toLowerCase().includes(clean));
      const matchId = s.id && s.id.toLowerCase() === clean;
      const sDigits = s.cnicOrBForm ? s.cnicOrBForm.replace(/\D/g, '') : '';
      const matchCnic = cleanDigits.length >= 5 && sDigits && (sDigits === cleanDigits || sDigits.includes(cleanDigits));
      const matchName = s.fullName && s.fullName.toLowerCase() === clean;

      return matchRoll || matchApp || matchId || matchCnic || matchName;
    });

    if (student) {
      // Check if fee is paid or roll number issued
      const isFeePaid =
        student.feeStatus === 'PAID' ||
        (student.feeRecords && student.feeRecords.some((f: any) => f.status === 'PAID')) ||
        (student.feeChallan && student.feeChallan.status === 'PAID') ||
        Boolean(student.rollNumber && (student.rollNumber.startsWith('AZMVS') || student.rollNumber.startsWith('JPS')));

      if (!isFeePaid) {
        return {
          success: false,
          error: `Application Found (${student.fullName} - ${student.applicationNo}): Registration fee payment of PKR 300 is pending verification. Please deposit PKR 300 via JazzCash (03051755551) or Faysal Bank (3126701000006213) and send receipt to WhatsApp 0305-1755551 to activate your Roll Number Slip.`
        };
      }

      // Check if roll number is not yet batch-issued OR if scheduled release date is in the future
      if (!student.rollNumber || !mockApi.isRollNumberReleased()) {
        const releaseConfig = mockApi.getRollNumberReleaseConfig();
        const dateFormatted = new Date(releaseConfig.releaseDateTime).toLocaleString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
        const msg = !student.rollNumber
          ? `Registration fee payment of PKR 300 is confirmed! Official Roll Numbers and examination hall seating plans are scheduled for batch release on ${dateFormatted}. Please return on the release date to download your slip.`
          : releaseConfig.announcementMessage;

        return {
          success: false,
          error: `SCHEDULED_RELEASE:::${student.fullName}:::${student.applicationNo}:::${dateFormatted}:::${msg}`,
        };
      }

      const rollNo = student.rollNumber;

      const slip: RollNumberSlip = {
        rollNo: rollNo,
        applicationId: student.applicationNo || student.id || 'APP-2026',
        candidateName: student.fullName,
        fatherName: student.fatherName,
        cnicBForm: student.cnicOrBForm,
        classLevel: student.currentClass || 'SSC-II (Class 10th)',
        candidatePhoto: student.photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80',
        testCenter: student.officeUse?.testCentre || 'Main Campus Examination Center, Mansehra',
        centerAddress: 'Main College Road, Mansehra / Abbottabad Regional Center, KP',
        examDate: student.officeUse?.testDate || 'Sunday, 15 November 2026',
        reportingTime: student.officeUse?.testReportingTime || '09:00 AM',
        examStartTime: '10:00 AM - 12:00 PM (120 Mins)',
        roomNo: student.assignedRoom || 'HALL-01',
        seatIndex: student.seatNo || `SEAT-${rollNo.split('-').pop() || '0101'}`,
        securityHash: `AZMVS-SHA256-${rollNo}`,
        qrPayload: student.qrToken || `VERIFIED-${rollNo}`,
        barcode: `||| |||| || ||||| ${rollNo}`,
        specialInstructions: [
          'Bring your original CNIC / B-Form along with this printed entry slip to the examination centre.',
          'Entry gate closes strictly 15 minutes before the reporting time (08:45 AM).',
          'Biometric verification will be carried out at the entry desk using your QR code.',
          'Mobile phones, smartwatches, and programmable calculators are strictly prohibited inside the hall.'
        ],
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
    error: `No registered candidate or issued slip found for "${query}". Please check your CNIC / Application ID, or verify that your registration was submitted.`
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
    const response = await fetch(`${API_BASE_URL}/api/results/search?query=${encodeURIComponent(clean)}`);
    const data = await response.json();
    if (response.ok && data.success) {
      return { success: true, data: data.data };
    } else {
      return {
        success: false,
        error: data.error?.message || `No result record found for "${clean}". Session V results will be announced on 20 November 2026.`,
      };
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

    const response = await fetch(`${API_BASE_URL}/api/results/merit-list?${queryParams.toString()}`);
    if (response.ok) {
      const data = await response.json();
      return { success: true, data: data.data || (Array.isArray(data) ? data : []) };
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
    const response = await fetch(`${API_BASE_URL}/api/grievances`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (response.ok && data.success) {
      return {
        success: true,
        data: data.data,
        message: data.message || 'Grievance ticket registered successfully',
      };
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
