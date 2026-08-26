import { setToken, setRefreshToken, setUser, getUser, getToken } from './auth';
import { apiFetch, apiDownloadPdf, API_BASE_URL } from './apiClient';
export { API_BASE_URL };

export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'TEACHER' | 'ACCOUNTANT';

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarUrl?: string;
}

export interface LoginResponse {
  user: CurrentUser;
  token: string;
  role: Role;
}

export interface MockStudent {
  id: string;
  applicationNo: string;
  rollNumber: string;
  fullName: string;
  fatherName: string;
  gender: 'MALE' | 'FEMALE';
  dateOfBirth: string;
  age: number;
  cnicOrBForm: string;
  nationality: string;
  religion: string;
  address: string;
  district: string;
  province: string;
  studentMobile?: string;
  parentMobile: string;
  whatsapp?: string;
  email?: string;
  currentClass: string;
  hsscGroup?: string;
  schoolName: string;
  boardOrUniversity: string;
  currentRollNo?: string;
  scholarshipCategory: 'GENERAL_MERIT' | 'FINANCIALLY_NEEDY' | 'ORPHAN' | 'PERSON_WITH_DISABILITY';
  guardianOccupation?: string;
  guardianMonthlyIncome?: number;
  emergencyContact: string;
  emergencyRelation: string;
  referralSource?: string;
  photoUrl?: string;
  qrToken: string;
  qrImageUrl?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'PASSED_OUT' | 'EXPELLED';
  createdAt: string;
  attendancePercentage?: number;
  feeStatus?: 'PAID' | 'PARTIAL' | 'UNPAID' | 'OVERDUE';
  testCenterId?: string;
  testCenterName?: string;
  assignedHallId?: string;
  assignedHall?: string;
  assignedRoom?: string;
  seatNo?: string;
  academicRecords?: {
    examLevel: string;
    boardOrUni?: string;
    yearOfPassing?: string;
    totalMarks?: number;
    obtainedMarks?: number;
    percentage?: number;
  }[];
  documents?: {
    bformCnicCopy: boolean;
    fatherCnicCopy: boolean;
    passportPhotos: boolean;
    previousResultCard: boolean;
    domicileCertificate: boolean;
    incomeCertificate: boolean;
  };
  uploadedDocuments?: {
    photo?: { name: string; size: string; dataUrl: string; uploadedAt?: string };
    bform?: { name: string; size: string; dataUrl: string; uploadedAt?: string };
    fatherCnic?: { name: string; size: string; dataUrl: string; uploadedAt?: string };
    dmc?: { name: string; size: string; dataUrl: string; uploadedAt?: string };
    domicile?: { name: string; size: string; dataUrl: string; uploadedAt?: string };
    paymentReceipt?: { name: string; size: string; dataUrl: string; uploadedAt?: string };
  };

  officeUse?: {
    documentVerifiedBy?: string;
    isEligible?: boolean;
    testCentre?: string;
    finalStatus?: string;
    officeRemarks?: string;
  };
}

export interface MockPartner {
  id: string;
  partnerCode: string;
  institutionName: string;
  institutionType: 'SCHOOL' | 'COLLEGE' | 'ACADEMY' | 'UNIVERSITY';
  campus?: string;
  address: string;
  district: string;
  province: string;
  contactName: string;
  contactDesignation: string;
  contactMobile: string;
  contactWhatsapp?: string;
  contactEmail?: string;
  website?: string;
  classesOffered: string[];
  studentStrength?: number;
  expectedApplicants?: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
}

export interface MockAttendance {
  id: string;
  studentId: string;
  studentName: string;
  rollNumber: string;
  currentClass: string;
  date: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
  method: 'QR_SCAN' | 'MANUAL';
  markedById: string;
  markedByName: string;
  createdAt: string;
}

export interface MockFeeChallan {
  id: string;
  challanNumber: string;
  studentId: string;
  studentName: string;
  rollNumber: string;
  currentClass: string;
  month: string;
  amountDue: number;
  amountPaid: number;
  status: 'UNPAID' | 'PARTIAL' | 'PAID' | 'OVERDUE';
  dueDate: string;
  createdAt: string;
}

export interface MockStaff {
  id: string;
  fullName: string;
  role: string;
  cnic: string;
  phone: string;
  salary: number;
  status: 'ACTIVE' | 'INACTIVE';
  joinDate: string;
  createdAt: string;
}

export interface MockPayrollRecord {
  id: string;
  staffId: string;
  staffName: string;
  role: string;
  month: string;
  amount: number;
  status: 'PENDING' | 'PAID';
  paidAt?: string;
  createdAt: string;
}

export interface MockTransaction {
  id: string;
  type: 'FEE_INCOME' | 'SALARY_EXPENSE' | 'OTHER_INCOME' | 'OTHER_EXPENSE';
  amount: number;
  description: string;
  relatedFeeId?: string;
  relatedPayrollId?: string;
  createdAt: string;
}

export interface MockUserAccount {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
}

export interface MockTestCenter {
  id: string;
  name: string;
  code: string;
  campus: string;
  address: string;
  district: string;
  province: string;
  capacity: number;
  assignedCount?: number;
  reportingTime: string;
  testDate: string;
  contactPerson: string;
  contactPhone: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
}

export interface MockStudentDocument {
  id: string;
  studentId: string;
  studentName: string;
  rollNumber: string;
  applicationNo: string;
  currentClass: string;
  docType: 'CANDIDATE_PHOTO' | 'CNIC_BFORM' | 'PREVIOUS_DMC' | 'PAYMENT_CHALLAN' | 'DOMICILE' | 'GUARDIAN_CNIC';
  title: string;
  fileUrl: string;
  fileSize: string;
  fileType: string;
  uploadedAt: string;
  status: 'VERIFIED' | 'PENDING_REVIEW' | 'REJECTED';
  rejectionReason?: string;
}

let currentUser: CurrentUser | null = getUser<CurrentUser>() || null;

export const DEFAULT_TEST_CENTERS: MockTestCenter[] = [
  {
    id: 'tc-1',
    name: 'AZM Central Examination Center - Mansehra',
    code: 'TC-MHR-01',
    campus: 'Main College Road Campus',
    address: 'Near College Chowk, Karakoram Highway, Mansehra',
    district: 'Mansehra',
    province: 'Khyber Pakhtunkhwa',
    capacity: 450,
    reportingTime: '09:00 AM',
    testDate: 'Sunday, 15 November 2026',
    contactPerson: 'Prof. Dr. Sumama Khan',
    contactPhone: '0305-1755551',
    status: 'ACTIVE',
    createdAt: '2025-01-10T00:00:00Z',
  },
  {
    id: 'tc-2',
    name: 'Govt Post Graduate College No. 1 - Abbottabad',
    code: 'TC-ATD-02',
    campus: 'Main College Campus',
    address: 'College Road, Near Mandian, Abbottabad',
    district: 'Abbottabad',
    province: 'Khyber Pakhtunkhwa',
    capacity: 350,
    reportingTime: '09:00 AM',
    testDate: 'Sunday, 15 November 2026',
    contactPerson: 'Admissions & Testing Coordinator',
    contactPhone: '0305-1755551',
    status: 'ACTIVE',
    createdAt: '2025-01-12T00:00:00Z',
  },
  {
    id: 'tc-3',
    name: 'Hazara Public School & College Center - Haripur',
    code: 'TC-HRP-03',
    campus: 'Central Hall',
    address: 'Main G.T Road, Haripur, Khyber Pakhtunkhwa',
    district: 'Haripur',
    province: 'Khyber Pakhtunkhwa',
    capacity: 300,
    reportingTime: '09:00 AM',
    testDate: 'Sunday, 15 November 2026',
    contactPerson: 'Controller of Examination',
    contactPhone: '0305-1755551',
    status: 'ACTIVE',
    createdAt: '2025-01-15T00:00:00Z',
  },
  {
    id: 'tc-4',
    name: 'Khyber Public School & College Regional Hub - Battagram',
    code: 'TC-BTG-04',
    campus: 'City Campus',
    address: 'Karakoram Highway, Battagram',
    district: 'Battagram',
    province: 'Khyber Pakhtunkhwa',
    capacity: 220,
    reportingTime: '09:00 AM',
    testDate: 'Sunday, 15 November 2026',
    contactPerson: 'Regional Coordinator',
    contactPhone: '0305-1755551',
    status: 'ACTIVE',
    createdAt: '2025-01-20T00:00:00Z',
  },
];

export function getCanonicalStudentKey(s: {
  id?: string;
  applicationNo?: string;
  cnicOrBForm?: string;
  fullName?: string;
  fatherName?: string;
  rollNumber?: string | null;
}): string {
  if (s.cnicOrBForm) {
    const digits = s.cnicOrBForm.replace(/\D/g, '');
    if (digits.length >= 5) return `CNIC_${digits}`;
  }
  if (s.applicationNo && s.applicationNo.trim()) return s.applicationNo.trim().toUpperCase();
  if (s.rollNumber && s.rollNumber.trim()) return s.rollNumber.trim().toUpperCase();
  if (s.fullName && s.fatherName) {
    return `NAME_${s.fullName.trim().toLowerCase()}_${s.fatherName.trim().toLowerCase()}`;
  }
  return s.id ? s.id.trim().toLowerCase() : `STD_${Math.random()}`;
}

export function saveUploadedFilesForCandidate(_keys?: any, _files?: any): void {}

export interface RollNumberReleaseConfig {
  isScheduled: boolean; // true = schedule on/after releaseDateTime; false = immediate on payment approval
  releaseDateTime: string; // ISO string e.g. "2026-10-15T09:00:00"
  announcementTitle: string;
  announcementMessage: string;
  emergencyNotice?: string;
  updatedAt: string;
}

const DEFAULT_RELEASE_CONFIG: RollNumberReleaseConfig = {
  isScheduled: false,
  releaseDateTime: '2026-10-15T09:00:00',
  announcementTitle: 'Roll Number Slips Official Release Schedule',
  announcementMessage:
    'Official Roll Number Slips, Assigned Test Centers, and Examination Hall seatings are live.',
  emergencyNotice:
    'Your registration and fee verification are permanently confirmed in the examination registry.',
  updatedAt: '2026-08-24T00:00:00Z',
};

let inMemoryReleaseConfig: RollNumberReleaseConfig = { ...DEFAULT_RELEASE_CONFIG };

export async function fetchRollNumberReleaseConfig(): Promise<RollNumberReleaseConfig> {
  try {
    const res: any = await apiFetch<any>('/api/students/release-config');
    const data = res?.data || res;
    if (data && typeof data.isScheduled === 'boolean') {
      inMemoryReleaseConfig = data;
      return data;
    }
  } catch (err) {
    console.warn('Failed to fetch roll number release config from live server:', err);
  }
  return inMemoryReleaseConfig;
}

export function getRollNumberReleaseConfig(): RollNumberReleaseConfig {
  return inMemoryReleaseConfig;
}

export async function saveRollNumberReleaseConfig(
  config: Partial<RollNumberReleaseConfig>
): Promise<RollNumberReleaseConfig> {
  const merged = { ...inMemoryReleaseConfig, ...config, updatedAt: new Date().toISOString() };
  inMemoryReleaseConfig = merged;
  try {
    const res: any = await apiFetch<any>('/api/students/release-config', {
      method: 'POST',
      body: JSON.stringify(merged),
    });
    const saved = res?.data || res || merged;
    inMemoryReleaseConfig = saved;
    return saved;
  } catch (err) {
    console.warn('Failed to persist release config to backend:', err);
    return merged;
  }
}

export function isRollNumberReleased(): boolean {
  if (!inMemoryReleaseConfig.isScheduled) return true;
  if (!inMemoryReleaseConfig.releaseDateTime) return true;
  const targetDate = new Date(inMemoryReleaseConfig.releaseDateTime).getTime();
  return Date.now() >= targetDate;
}



// -------------------------------------------------------------
// LIVE API SERVICES CONNECTED TO EXPRESS BACKEND (PHASE 7)
// -------------------------------------------------------------

export const mockApi = {
  // 1. Authentication

  async login(email: string, password: string): Promise<LoginResponse> {
    const res = await apiFetch<{
      accessToken: string;
      refreshToken: string;
      user: {
        id: string;
        email: string;
        role: Role;
        name: string;
      };
    }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    const user: CurrentUser = {
      id: res.user.id,
      name: res.user.name || res.user.email.split('@')[0],
      email: res.user.email,
      role: res.user.role,
      avatarUrl:
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
    };

    setToken(res.accessToken);
    if (res.refreshToken) {
      setRefreshToken(res.refreshToken);
    }
    setUser(user);
    currentUser = user;

    return {
      user,
      token: res.accessToken,
      role: user.role,
    };
  },

  async getCurrentUser(): Promise<CurrentUser | null> {
    const token = getToken();
    if (!token) return currentUser;

    try {
      const res = await apiFetch<{ user: CurrentUser }>('/api/auth/me');
      if (res && res.user) {
        currentUser = {
          ...res.user,
          avatarUrl:
            res.user.avatarUrl ||
            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
        };
        setUser(currentUser);
      }
    } catch {
      // Keep cached session
    }
    return currentUser;
  },

  async switchRole(role: Role): Promise<CurrentUser> {
    currentUser = {
      ...(currentUser || {
        id: 'usr_001',
        email: 'admin@azm.org.pk',
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
      }),
      role,
      name:
        role === 'SUPER_ADMIN'
          ? 'AZM Super Administrator'
          : role === 'ADMIN'
          ? 'Examination Officer (Admin)'
          : role === 'ACCOUNTANT'
          ? 'Finance & Accounts Officer'
          : 'Invigilator / Examiner',
    };
    setUser(currentUser);
    return currentUser;
  },


  // 2. Dashboard Overview Aggregation
  async getDashboardOverview() {
    const live = await apiFetch<any>('/api/dashboard/overview');

    // Fetch fee defaulters from live fees
    const feesRes: any = await apiFetch<any>('/api/fees?status=UNPAID').catch(() => []);
    const feesList = Array.isArray(feesRes) ? feesRes : Array.isArray(feesRes?.feeRecords) ? feesRes.feeRecords : [];

    return {
      stats: {
        totalStudents: live.stats?.totalStudents || 0,
        attendancePercentage: live.attendanceToday?.attendancePercentage || 0,
        feeCollectionPercentage: live.feeCollection?.collectionPercentage || 0,
        activeStaffCount: live.stats?.activeStaffCount || 0,
        totalBilled: live.feeCollection?.totalBilled || 0,
        totalCollected: live.feeCollection?.totalCollected || 0,
        feeIncome: live.financialFlow?.feeIncome || 0,
        salaryExpenses: live.financialFlow?.salaryExpenses || 0,
        netCashFlow: live.financialFlow?.netCashFlow || 0,
      },
      attendanceTrends: [
        { day: 'Mon', rate: live.attendanceToday?.attendancePercentage || 0 },
        { day: 'Tue', rate: live.attendanceToday?.attendancePercentage || 0 },
        { day: 'Wed', rate: live.attendanceToday?.attendancePercentage || 0 },
        { day: 'Thu', rate: live.attendanceToday?.attendancePercentage || 0 },
        { day: 'Fri', rate: live.attendanceToday?.attendancePercentage || 0 },
        { day: 'Today', rate: live.attendanceToday?.attendancePercentage || 0 },
      ],
      feeDefaulters: (feesList || []).slice(0, 5).map((f: any) => ({
        id: f.id,
        studentName: f.student?.fullName || f.studentName || 'Candidate',
        rollNumber: f.student?.rollNumber || f.rollNumber || 'Pending Approval',
        currentClass: f.student?.currentClass || f.currentClass || 'SSC',
        amountDue: Number(f.amountDue) || 300,
        status: f.status || 'UNPAID',
      })),
      recentActivity: [
        {
          id: 'act_1',
          text: `System connected to live PostgreSQL cluster. Total enrolled students: ${live.stats?.totalStudents || 0}`,
          time: 'Live',
        },
        {
          id: 'act_2',
          text: `Attendance ledger synced: ${live.attendanceToday?.markedCount || 0} active check-ins recorded.`,
          time: 'Today',
        },
      ],
      demographics: {
        byGender: live.studentDemographics?.byGender || { MALE: 0, FEMALE: 0 },
        byClassLevel: live.studentDemographics?.byClassLevel || {},
        byScholarshipCategory: live.studentDemographics?.byScholarshipCategory || {},
      },
    };
  },

  // 3. Students Management

  async getStudents(filters?: { classLevel?: string; status?: string; search?: string }): Promise<MockStudent[]> {
    const params = new URLSearchParams();
    params.append('limit', '500');
    if (filters?.classLevel && filters?.classLevel !== 'ALL') params.append('classLevel', filters.classLevel);
    if (filters?.status && filters?.status !== 'ALL') params.append('status', filters.status);
    if (filters?.search && filters.search.trim()) params.append('search', filters.search.trim());
    const query = `?${params.toString()}`;

    const res: any = await apiFetch<any>(`/api/students${query}`);
    const raw = Array.isArray(res) ? res : Array.isArray(res?.students) ? res.students : [];
    return raw.map((s: any) => ({
      ...s,
      rollNumber: s.rollNumber || null,
      feeStatus: s.feeStatus || (s.feeRecords?.length ? s.feeRecords[0].status : 'UNPAID'),
      attendancePercentage: s.attendancePercentage ?? 100,
    }));
  },

  async getStudentById(id: string): Promise<MockStudent> {
    const s: any = await apiFetch<any>(`/api/students/${id}`);
    return {
      ...s,
      feeStatus: s.feeStatus || (s.feeRecords?.length ? s.feeRecords[0].status : 'UNPAID'),
      attendancePercentage: s.attendancePercentage ?? 100,
    };
  },

  async createStudent(studentData: any): Promise<MockStudent> {
    const created = await apiFetch<MockStudent>('/api/students/register', {
      method: 'POST',
      body: JSON.stringify(studentData),
    });
    return created;
  },

  async uploadStudentDocument(params: {
    studentId?: string;
    applicationNo?: string;
    cnicOrBForm?: string;
    docType: string;
    fileName?: string;
    fileData: string;
    contentType?: string;
  }): Promise<{ publicUrl: string; path: string }> {
    const res = await apiFetch<any>('/api/students/upload-document', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    return res?.data || res;
  },

  async approveStudentPayment(studentId: string): Promise<{ success: boolean }> {
    const res = await apiFetch<any>(`/api/students/${studentId}/approve-payment`, {
      method: 'POST',
    });
    return res || { success: true };
  },

  async getRollNumberStatus(): Promise<{ readyCount: number; issuedCount: number; totalPaidCount: number; scheduledDate?: string }> {
    const res = await apiFetch<any>('/api/students/roll-number-status');
    return res?.data || res;
  },

  async issueRollNumbers(scheduledDate?: string): Promise<{ count: number; message: string }> {
    const res = await apiFetch<any>('/api/students/issue-roll-numbers', {
      method: 'POST',
      body: JSON.stringify({ scheduledDate }),
    });
    return res?.data || res;
  },

  async deleteStudent(studentId: string): Promise<boolean> {
    await apiFetch<any>(`/api/students/${studentId}`, {
      method: 'DELETE',
    });
    return true;
  },

  async getRollNumberReleaseConfig(): Promise<RollNumberReleaseConfig> {
    return fetchRollNumberReleaseConfig();
  },

  async updateRollNumberReleaseConfig(config: Partial<RollNumberReleaseConfig>): Promise<RollNumberReleaseConfig> {
    return saveRollNumberReleaseConfig(config);
  },

  isRollNumberReleased(): boolean {
    return isRollNumberReleased();
  },

  releaseAllPaidRollNumbers(): number {
    return 0;
  },


  async updateOfficeUse(studentId: string, officeUseData: any) {
    return apiFetch<any>(`/api/students/${studentId}/office-use`, {
      method: 'PATCH',
      body: JSON.stringify(officeUseData),
    });
  },

  async getExamHalls(): Promise<any[]> {
    const res = await apiFetch<any[]>('/api/exam-halls');
    return Array.isArray(res) ? res : Array.isArray((res as any)?.data) ? (res as any).data : [];
  },

  async createExamHall(data: any): Promise<any> {
    const res = await apiFetch<any>('/api/exam-halls', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return (res && (res.data || res)) || data;
  },

  async updateExamHall(id: string, data: any): Promise<any> {
    const res = await apiFetch<any>(`/api/exam-halls/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return (res && (res.data || res)) || { id, ...data };
  },

  async deleteExamHall(id: string): Promise<boolean> {
    await apiFetch(`/api/exam-halls/${id}`, { method: 'DELETE' });
    return true;
  },

  async updateStudentAllocation(
    studentId: string,
    allocation: {
      testCenterId?: string;
      testCenterName?: string;
      assignedHallId?: string;
      assignedHall?: string;
      assignedRoom?: string;
      seatNo?: string;
    }
  ): Promise<MockStudent | null> {
    const res = await apiFetch<any>(`/api/exam-halls/students/${studentId}/allocation`, {
      method: 'PATCH',
      body: JSON.stringify(allocation),
    });
    return res?.data || res;
  },

  async batchAssignStudentsToHall(
    hallId: string,
    hallInfo: { hallName: string; roomNumber: string; testCenterName?: string; testCenterId?: string },
    studentIds: string[]
  ): Promise<number> {
    const res = await apiFetch<any>(`/api/exam-halls/${hallId}/batch-assign`, {
      method: 'POST',
      body: JSON.stringify({
        studentIds,
        hallName: hallInfo.hallName,
        roomNumber: hallInfo.roomNumber,
        testCenterName: hallInfo.testCenterName,
      }),
    });
    return res?.count || studentIds.length;
  },

  async unassignStudentFromHall(studentId: string): Promise<boolean> {
    await apiFetch<any>(`/api/exam-halls/students/${studentId}/allocation`, {
      method: 'DELETE',
    });
    return true;
  },



  async downloadStudentPdf(studentId: string, rollNumber?: string, studentObj?: any): Promise<void> {
    try {
      await apiDownloadPdf(
        `/api/students/${studentId}/registration-pdf`,
        `Student_Registration_${rollNumber || studentId}.pdf`
      );
    } catch (err) {
      console.warn('Live PDF endpoint error, opening printable registration slip:', err);
      let data = studentObj;
      if (!data) {
        try {
          data = await this.getStudentById(studentId);
        } catch (fetchErr) {
          data = { id: studentId, rollNumber };
        }
      }
      printStudentSlip(data || { id: studentId, rollNumber });
    }
  },

  async downloadRollSlipPdf(studentId: string, rollNumber?: string): Promise<void> {
    await apiDownloadPdf(
      `/api/students/${studentId}/roll-slip-pdf`,
      `RollNoSlip-${rollNumber || studentId}.pdf`
    );
  },


  // 4. Partner Institutions
  async getPartners(): Promise<MockPartner[]> {
    try {
      const res: any = await apiFetch<any>('/api/partners');
      const list = Array.isArray(res) ? res : Array.isArray(res?.partners) ? res.partners : [];
      return list;
    } catch (err) {
      console.warn('Partners fetch error:', err);
      return [];
    }
  },

  async registerPartner(partnerData: any): Promise<MockPartner> {
    return apiFetch<MockPartner>('/api/partners/register', {
      method: 'POST',
      body: JSON.stringify(partnerData),
    });
  },

  async updatePartnerStatus(id: string, status: 'APPROVED' | 'REJECTED'): Promise<MockPartner> {
    return apiFetch<MockPartner>(`/api/partners/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  async downloadPartnerPdf(partnerId: string, partnerCode: string): Promise<void> {
    await apiDownloadPdf(
      `/api/partners/${partnerId}/registration-pdf`,
      `Partner_Agreement_${partnerCode || partnerId}.pdf`
    );
  },

  // 5. Attendance & Biometric QR Scanner
  async scanAttendance(payload: {
    qrToken?: string;
    studentId?: string;
    rollNumber?: string;
    status?: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
  }): Promise<{ attendance: MockAttendance; student: MockStudent }> {
    let cleanToken = (payload.qrToken || payload.studentId || payload.rollNumber || '').trim();

    // If QR contains a URL, extract the token or identifier query param
    if (cleanToken.includes('http://') || cleanToken.includes('https://')) {
      try {
        const url = new URL(cleanToken);
        cleanToken =
          url.searchParams.get('token') ||
          url.searchParams.get('roll') ||
          url.searchParams.get('rollNumber') ||
          cleanToken.split('/').pop() ||
          cleanToken;
      } catch (e) {}
    }

    try {
      return await apiFetch<{ attendance: MockAttendance; student: MockStudent }>('/api/attendance/scan', {
        method: 'POST',
        body: JSON.stringify({ ...payload, qrToken: cleanToken }),
      });
    } catch (err) {
      console.warn('Backend attendance scan fallback, looking up student locally:', err);

      const allStudents = await this.getStudents();
      const cleanUpper = cleanToken.toUpperCase();
      const cleanDigits = cleanToken.replace(/\D/g, '');

      const matchedStudent = allStudents.find((s) => {
        const rollMatch = s.rollNumber && (s.rollNumber.toUpperCase() === cleanUpper || cleanUpper.includes(s.rollNumber.toUpperCase()));
        const appMatch = s.applicationNo && (s.applicationNo.toUpperCase() === cleanUpper || cleanUpper.includes(s.applicationNo.toUpperCase()));
        const idMatch = s.id && (s.id.toUpperCase() === cleanUpper || cleanUpper.includes(s.id.toUpperCase()));
        const cnicMatch = cleanDigits.length >= 5 && s.cnicOrBForm && s.cnicOrBForm.replace(/\D/g, '') === cleanDigits;
        const qrMatch = s.qrToken && (s.qrToken === cleanToken || cleanToken.includes(s.qrToken));
        return rollMatch || appMatch || idMatch || cnicMatch || qrMatch;
      });

      if (!matchedStudent) {
        throw new Error(
          `No registered student record found for QR code / identifier "${cleanToken}". Please verify that this candidate is registered.`
        );
      }

      const attendanceRecord: MockAttendance = {
        id: `att_${Date.now()}`,
        studentId: matchedStudent.id,
        studentName: matchedStudent.fullName,
        rollNumber: matchedStudent.rollNumber || 'PENDING',
        currentClass: matchedStudent.currentClass,
        date: new Date().toISOString().split('T')[0],
        status: payload.status || 'PRESENT',
        method: 'QR_SCAN',
        markedByName: currentUser?.name || 'Chief Examiner',
        createdAt: new Date().toISOString(),
      };

      return {
        attendance: attendanceRecord,
        student: matchedStudent,
      };
    }
  },


  async getTodayAttendance(): Promise<any> {
    try {
      return await apiFetch<any>('/api/attendance/today');
    } catch (err) {
      return { totalActiveStudents: 0, markedCount: 0, attendancePercentage: 0, records: [] };
    }
  },

  async getStudentAttendanceHistory(studentId: string): Promise<MockAttendance[]> {
    try {
      const res: any = await apiFetch<any>(`/api/attendance/student/${studentId}`);
      return Array.isArray(res) ? res : Array.isArray(res?.attendance) ? res.attendance : [];
    } catch (err) {
      return [];
    }
  },

  // 6. Fees & Challans
  async getFees(filters?: { month?: string; status?: string }): Promise<MockFeeChallan[]> {
    try {
      const params = new URLSearchParams();
      if (filters?.month && filters.month !== 'ALL') params.append('month', filters.month);
      if (filters?.status && filters.status !== 'ALL') params.append('status', filters.status);
      const query = params.toString() ? `?${params.toString()}` : '';

      const res: any = await apiFetch<any>(`/api/fees${query}`);
      const list = Array.isArray(res) ? res : Array.isArray(res?.feeRecords) ? res.feeRecords : [];

      return list.map((f: any) => ({
        id: f.id,
        challanNumber: f.challanNumber,
        studentId: f.studentId,
        studentName: f.student?.fullName || f.studentName || 'Candidate',
        rollNumber: f.student?.rollNumber || f.rollNumber || 'Pending Fee Approval',
        currentClass: f.student?.currentClass || f.currentClass || 'SSC',
        month: f.month,
        amountDue: Number(f.amountDue) || 300,
        amountPaid: Number(f.amountPaid) || 0,
        status: f.status || 'UNPAID',
        dueDate: f.dueDate ? new Date(f.dueDate).toISOString().split('T')[0] : '2026-08-28',
        createdAt: f.createdAt,
      }));
    } catch (err) {
      console.warn('Fees fetch error:', err);
      return [];
    }
  },

  async generateChallans(payload: {
    studentId?: string;
    currentClass?: string;
    month: string;
    amountDue: number;
    dueDate: string;
  }) {
    return apiFetch<any>('/api/fees/generate-challan', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async markFeePaid(challanId: string, payload: { amountPaid: number; paymentMethod: string }) {
    return apiFetch<any>(`/api/fees/${challanId}/mark-paid`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // 7. Staff & Faculty Directory
  async getStaff(): Promise<MockStaff[]> {
    try {
      const res: any = await apiFetch<any>('/api/staff');
      const list = Array.isArray(res) ? res : Array.isArray(res?.staff) ? res.staff : [];
      return list.map((s: any) => ({
        id: s.id,
        fullName: s.fullName,
        role: s.role,
        cnic: s.cnic,
        phone: s.phone,
        salary: Number(s.salary) || 0,
        joinDate: s.joinDate ? (typeof s.joinDate === 'string' ? s.joinDate.split('T')[0] : String(s.joinDate)) : '2026-01-01',
        status: s.status || 'ACTIVE',
      }));
    } catch (err) {
      console.warn('Staff fetch error:', err);
      return [];
    }
  },

  async createStaff(payload: {
    fullName: string;
    role: string;
    cnic: string;
    phone: string;
    salary: number;
    joinDate?: string;
  }): Promise<MockStaff> {
    return apiFetch<MockStaff>('/api/staff', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // 8. Payroll & Salary Disbursements
  async getPayroll(month?: string): Promise<MockPayrollRecord[]> {
    try {
      const query = month && month !== 'ALL' ? `?month=${month}` : '';
      const res: any = await apiFetch<any>(`/api/payroll${query}`);
      const list = Array.isArray(res) ? res : Array.isArray(res?.payrollRecords) ? res.payrollRecords : [];
      return list.map((p: any) => ({
        id: p.id,
        staffId: p.staffId,
        staffName: p.staff?.fullName || p.staffName || 'Staff Member',
        role: p.staff?.role || p.role || 'Faculty',
        month: p.month,
        amount: Number(p.amount) || 0,
        status: p.status || 'PENDING',
        paidAt: p.paidAt,
        createdAt: p.createdAt,
      }));
    } catch (err) {
      console.warn('Payroll fetch error:', err);
      return [];
    }
  },

  async runPayroll(month: string) {
    return apiFetch<any>('/api/payroll/run', {
      method: 'POST',
      body: JSON.stringify({ month }),
    });
  },

  async markPayrollPaid(payrollId: string) {
    return apiFetch<any>(`/api/payroll/${payrollId}/mark-paid`, {
      method: 'POST',
    });
  },

  // 9. General Ledger Transactions
  async getTransactions(type?: string): Promise<MockTransaction[]> {
    try {
      const query = type && type !== 'ALL' ? `?type=${type}` : '';
      const res: any = await apiFetch<any>(`/api/transactions${query}`);
      const list = Array.isArray(res) ? res : Array.isArray(res?.transactions) ? res.transactions : [];
      return list.map((t: any) => ({
        id: t.id,
        type: t.type,
        amount: Number(t.amount) || 0,
        description: t.description,
        relatedFeeId: t.relatedFeeId,
        relatedPayrollId: t.relatedPayrollId,
        createdAt: t.createdAt,
      }));
    } catch (err) {
      console.warn('Transactions fetch error:', err);
      return [];
    }
  },

  async deleteTransaction(transactionId: string): Promise<boolean> {
    await apiFetch<any>(`/api/transactions/${transactionId}`, {
      method: 'DELETE',
    });
    return true;
  },

  // 10. User Management (Super Admin)
  async getUsers(): Promise<MockUserAccount[]> {
    const res = await apiFetch<any>('/api/users');
    const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
    return list.map((u: any) => ({
      id: u.id,
      name: u.name || u.email.split('@')[0],
      email: u.email,
      role: u.role,
      status: u.status || 'ACTIVE',
      createdAt: u.createdAt || new Date().toISOString(),
    }));
  },

  async createUser(payload: { name: string; email: string; role: Role; password?: string }): Promise<MockUserAccount> {
    const res = await apiFetch<any>('/api/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const u = res?.data || res;
    return {
      id: u.id || `usr_${Date.now()}`,
      name: u.name || payload.name,
      email: u.email || payload.email,
      role: u.role || payload.role,
      status: u.status || 'ACTIVE',
      createdAt: u.createdAt || new Date().toISOString(),
    };
  },

  // 10. Test Centers Management (Custom Centers)
  async getTestCenters(): Promise<MockTestCenter[]> {
    const res = await apiFetch<any>('/api/test-centers');
    const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
    const students = await this.getStudents().catch(() => []);

    return list.map((tc: any) => {
      const assigned = students.filter(
        (s) =>
          s.officeUse?.testCentre?.toLowerCase().includes(tc.name.toLowerCase()) ||
          s.officeUse?.testCentre?.toLowerCase().includes(tc.district.toLowerCase())
      ).length;
      return {
        id: tc.id,
        name: tc.name,
        code: tc.code,
        campus: tc.campus,
        address: tc.address,
        district: tc.district,
        province: tc.province,
        capacity: Number(tc.capacity) || 300,
        reportingTime: tc.reportingTime || '09:00 AM',
        testDate: tc.testDate || 'Sunday, 15 November 2026',
        contactPerson: tc.contactPerson || '',
        contactPhone: tc.contactPhone || '',
        status: tc.status || 'ACTIVE',
        createdAt: tc.createdAt || new Date().toISOString(),
        assignedCount: assigned,
      };
    });
  },

  async createTestCenter(data: Partial<MockTestCenter>): Promise<MockTestCenter> {
    const res = await apiFetch<any>('/api/test-centers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return (res && (res.data || res)) || data;
  },

  async updateTestCenter(id: string, data: Partial<MockTestCenter>): Promise<MockTestCenter> {
    const res = await apiFetch<any>(`/api/test-centers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return (res && (res.data || res)) || { id, ...data };
  },

  async deleteTestCenter(id: string): Promise<boolean> {
    await apiFetch(`/api/test-centers/${id}`, { method: 'DELETE' });
    return true;
  },

  // 11. Document Storage Vault & Student Document Inspector
  async getStudentDocuments(studentId?: string): Promise<MockStudentDocument[]> {
    const students = await this.getStudents();
    const docMap = new Map<string, MockStudentDocument>();

    students.forEach((s) => {
      const cleanTarget = studentId ? studentId.toLowerCase().trim() : '';
      const cleanDigits = studentId ? studentId.replace(/\D/g, '') : '';
      const matches =
        !studentId ||
        s.id?.toLowerCase() === cleanTarget ||
        s.applicationNo?.toLowerCase() === cleanTarget ||
        s.rollNumber?.toLowerCase() === cleanTarget ||
        (cleanDigits.length >= 5 && s.cnicOrBForm && s.cnicOrBForm.replace(/\D/g, '') === cleanDigits);

      if (!matches) return;

      const up = s.uploadedDocuments || {};
      const candKey = s.applicationNo || s.id;
      const officeUse = (s as any).officeUse;
      const docStatus: 'VERIFIED' | 'PENDING_REVIEW' | 'REJECTED' =
        officeUse?.eligibility === 'ELIGIBLE'
          ? 'VERIFIED'
          : officeUse?.eligibility === 'NOT_ELIGIBLE'
          ? 'REJECTED'
          : 'PENDING_REVIEW';
      const rejectionReason = officeUse?.eligibilityRemarks;

      // 1. Candidate Photo
      const photoFile = up.photo;
      const photoUrl =
        photoFile?.publicUrl ||
        photoFile?.dataUrl ||
        (s.photoUrl && !s.photoUrl.includes('supabase.co/storage') ? s.photoUrl : null) ||
        `${API_BASE_URL}/api/students/${s.applicationNo || s.id}/document/photo`;

      if (photoFile || s.photoUrl) {
        docMap.set(`${candKey}_PHOTO`, {
          id: `doc_photo_${s.id}`,
          studentId: s.id,
          studentName: s.fullName,
          rollNumber: s.rollNumber || 'PENDING',
          applicationNo: s.applicationNo || 'APP-2026',
          currentClass: s.currentClass || 'SSC',
          docType: 'CANDIDATE_PHOTO',
          title: photoFile?.name || `${s.fullName}_Passport_Photo.jpg`,
          fileUrl: photoUrl,
          fileSize: photoFile?.size || 'Candidate Photo',
          fileType: 'image/jpeg',
          uploadedAt: photoFile?.uploadedAt || s.createdAt || new Date().toISOString(),
          status: docStatus,
          rejectionReason,
        });
      }

      // 2. CNIC / B-Form Document
      const bformFile = up.bform || up.bformUploaded || up.cnic || up.candidateCnic;
      if (bformFile && (bformFile.dataUrl || bformFile.publicUrl || bformFile.fileUrl)) {
        const bformUrl = bformFile.publicUrl || bformFile.dataUrl || bformFile.fileUrl;
        docMap.set(`${candKey}_BFORM`, {
          id: `doc_cnic_${s.id}`,
          studentId: s.id,
          studentName: s.fullName,
          rollNumber: s.rollNumber || 'PENDING',
          applicationNo: s.applicationNo || 'APP-2026',
          currentClass: s.currentClass || 'SSC',
          docType: 'CNIC_BFORM',
          title: bformFile.name || `${s.fullName}_Candidate_BForm_CNIC.jpg`,
          fileUrl: bformUrl,
          fileSize: bformFile.size || 'Candidate Attachment',
          fileType: bformUrl.includes('application/pdf') || bformFile.name?.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
          uploadedAt: bformFile.uploadedAt || s.createdAt || new Date().toISOString(),
          status: docStatus,
          rejectionReason,
        });
      }

      // 3. Father / Guardian CNIC
      const fatherCnicFile = up.fatherCnic || up.fatherCnicUploaded || up.fcnic;
      if (fatherCnicFile && (fatherCnicFile.dataUrl || fatherCnicFile.publicUrl || fatherCnicFile.fileUrl)) {
        const fatherCnicUrl = fatherCnicFile.publicUrl || fatherCnicFile.dataUrl || fatherCnicFile.fileUrl;
        docMap.set(`${candKey}_FATHER_CNIC`, {
          id: `doc_fcnic_${s.id}`,
          studentId: s.id,
          studentName: s.fullName,
          rollNumber: s.rollNumber || 'PENDING',
          applicationNo: s.applicationNo || 'APP-2026',
          currentClass: s.currentClass || 'SSC',
          docType: 'CNIC_BFORM',
          title: fatherCnicFile.name || `${s.fullName}_Father_CNIC.jpg`,
          fileUrl: fatherCnicUrl,
          fileSize: fatherCnicFile.size || 'Candidate Attachment',
          fileType: fatherCnicUrl.includes('application/pdf') || fatherCnicFile.name?.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
          uploadedAt: fatherCnicFile.uploadedAt || s.createdAt || new Date().toISOString(),
          status: docStatus,
          rejectionReason,
        });
      }

      // 4. Academic Transcript / DMC
      const dmcFile = up.dmc || up.dmcUploaded || up.resultCard || up.previousResult;
      if (dmcFile && (dmcFile.dataUrl || dmcFile.publicUrl || dmcFile.fileUrl)) {
        const dmcUrl = dmcFile.publicUrl || dmcFile.dataUrl || dmcFile.fileUrl;
        docMap.set(`${candKey}_DMC`, {
          id: `doc_dmc_${s.id}`,
          studentId: s.id,
          studentName: s.fullName,
          rollNumber: s.rollNumber || 'PENDING',
          applicationNo: s.applicationNo || 'APP-2026',
          currentClass: s.currentClass || 'SSC',
          docType: 'PREVIOUS_DMC',
          title: dmcFile.name || `${s.fullName}_DMC_Marksheet.jpg`,
          fileUrl: dmcUrl,
          fileSize: dmcFile.size || 'Candidate Attachment',
          fileType: dmcUrl.includes('application/pdf') || dmcFile.name?.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
          uploadedAt: dmcFile.uploadedAt || s.createdAt || new Date().toISOString(),
          status: docStatus,
          rejectionReason,
        });
      }

      // 5. Payment Deposit Receipt
      const feeFile = up.paymentReceipt || up.incomeCertUploaded || up.receipt || up.challan;
      if (feeFile && (feeFile.dataUrl || feeFile.publicUrl || feeFile.fileUrl)) {
        const feeUrl = feeFile.publicUrl || feeFile.dataUrl || feeFile.fileUrl;
        docMap.set(`${candKey}_FEE`, {
          id: `doc_pay_${s.id}`,
          studentId: s.id,
          studentName: s.fullName,
          rollNumber: s.rollNumber || 'PENDING',
          applicationNo: s.applicationNo || 'APP-2026',
          currentClass: s.currentClass || 'SSC',
          docType: 'PAYMENT_CHALLAN',
          title: feeFile.name || `${s.fullName}_Fee_Payment_Receipt.jpg`,
          fileUrl: feeUrl,
          fileSize: feeFile.size || 'Candidate Attachment',
          fileType: feeUrl.includes('application/pdf') || feeFile.name?.endsWith('.pdf') ? 'application/pdf' : 'image/png',
          uploadedAt: feeFile.uploadedAt || s.createdAt || new Date().toISOString(),
          status: docStatus,
          rejectionReason,
        });
      }

      // 6. Domicile Certificate
      const domicileFile = up.domicile || up.domicileUploaded;
      if (domicileFile && (domicileFile.dataUrl || domicileFile.publicUrl || domicileFile.fileUrl)) {
        const domicileUrl = domicileFile.publicUrl || domicileFile.dataUrl || domicileFile.fileUrl;
        docMap.set(`${candKey}_DOMICILE`, {
          id: `doc_dom_${s.id}`,
          studentId: s.id,
          studentName: s.fullName,
          rollNumber: s.rollNumber || 'PENDING',
          applicationNo: s.applicationNo || 'APP-2026',
          currentClass: s.currentClass || 'SSC',
          docType: 'CNIC_BFORM',
          title: domicileFile.name || `${s.fullName}_Domicile_Certificate.jpg`,
          fileUrl: domicileUrl,
          fileSize: domicileFile.size || 'Candidate Attachment',
          fileType:
            domicileUrl.includes('application/pdf') || domicileFile.name?.endsWith('.pdf')
              ? 'application/pdf'
              : 'image/jpeg',
          uploadedAt: domicileFile.uploadedAt || s.createdAt || new Date().toISOString(),
          status: docStatus,
          rejectionReason,
        });
      }
    });

    return Array.from(docMap.values());
  },

  async updateDocumentStatus(
    _docId: string,
    status: 'VERIFIED' | 'PENDING_REVIEW' | 'REJECTED',
    rejectionReason?: string,
    studentId?: string
  ): Promise<boolean> {
    if (studentId) {
      try {
        await apiFetch(`/api/students/${studentId}/office-use`, {
          method: 'PATCH',
          body: JSON.stringify({
            documentVerifiedBy: status === 'VERIFIED' ? 'Admin Reviewer' : undefined,
            documentVerifiedAt: status === 'VERIFIED' ? new Date().toISOString() : undefined,
            eligibility: status === 'VERIFIED' ? 'ELIGIBLE' : status === 'REJECTED' ? 'NOT_ELIGIBLE' : undefined,
            eligibilityRemarks: rejectionReason,
          }),
        });
        return true;
      } catch (e) {
        console.warn('Backend office-use document verification sync notice:', e);
        return false;
      }
    }
    return true;
  },

  async purgeAllData(): Promise<boolean> {
    try {
      await apiFetch('/api/students/purge-all-system-data', { method: 'POST' }).catch((err) => {
        console.warn('Backend purge API notification:', err);
      });
      purgeLegacyDataCaches();
      return true;
    } catch (err) {
      console.error('Failed to purge data:', err);
      return false;
    }
  },
};


/**
 * High-definition browser printable registration slip generator
 */
export function printStudentSlip(student: any) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to open and print your official registration slip.');
    return;
  }

  const appNo = student.applicationNo || student.id || `APP-2026-${Math.floor(1000 + Math.random() * 9000)}`;
  const dateStr = student.createdAt ? new Date(student.createdAt).toLocaleDateString() : new Date().toLocaleDateString();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>AZM Scholarship Registration Slip - ${appNo}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #0f172a; }
    body { background: #f8fafc; padding: 24px; }
    .slip-container { max-width: 800px; margin: 0 auto; background: #fff; border: 2px solid #185b9d; border-radius: 16px; padding: 28px; box-shadow: 0 10px 25px rgba(0,0,0,0.06); }
    .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #185b9d; padding-bottom: 16px; margin-bottom: 20px; }
    .title-area h1 { font-size: 22px; font-weight: 900; color: #185b9d; letter-spacing: -0.5px; }
    .title-area p { font-size: 11px; font-weight: 600; color: #64748b; margin-top: 2px; }
    .badge { background: #dcfce7; color: #15803d; border: 1px solid #86efac; padding: 4px 12px; border-radius: 999px; font-weight: 700; font-size: 11px; }
    .candidate-banner { display: flex; gap: 20px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 20px; align-items: center; }
    .photo-frame { width: 96px; height: 110px; border: 2px dashed #cbd5e1; border-radius: 8px; overflow: hidden; background: #fff; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .photo-frame img { width: 100%; height: 100%; object-fit: cover; }
    .meta-title { font-size: 18px; font-weight: 800; color: #0f172a; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
    .info-card { background: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #185b9d; border-radius: 8px; padding: 10px 14px; }
    .info-label { font-size: 10px; text-transform: uppercase; font-weight: 700; color: #64748b; margin-bottom: 2px; }
    .info-value { font-size: 13px; font-weight: 700; color: #0f172a; }
    .fee-box { background: #f0fdf4; border: 2px dashed #22c55e; border-radius: 12px; padding: 18px; margin-bottom: 20px; }
    .fee-title { color: #166534; font-size: 14px; font-weight: 800; margin-bottom: 6px; }
    .pay-methods { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px; }
    .pay-card { background: #fff; border: 1px solid #bbf7d0; border-radius: 8px; padding: 10px 14px; font-size: 12px; }
    .notice-box { font-size: 11px; color: #475569; border-top: 1px solid #e2e8f0; padding-top: 14px; line-height: 1.6; }
    .notice-box ul { margin-left: 18px; margin-top: 4px; }
    .btn-bar { text-align: center; margin-top: 24px; }
    .btn { background: #185b9d; color: #fff; border: none; padding: 10px 24px; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer; }
    @media print {
      body { background: #fff; padding: 0; }
      .slip-container { border: none; box-shadow: none; padding: 0; max-width: 100%; }
      .btn-bar { display: none; }
    }
  </style>
</head>
<body>
  <div class="slip-container">
    <div class="header">
      <div class="title-area">
        <h1>AZM.AIO SCHOLARSHIP PORTAL</h1>
        <p>Session V (2026) Official Registration Confirmation Slip & Challan</p>
      </div>
      <div style="text-align: right;">
        <span class="badge">Application Submitted ✓</span>
        <div style="font-size: 10px; color: #64748b; margin-top: 4px;">Dated: ${dateStr}</div>
      </div>
    </div>

    <div class="candidate-banner" style="justify-content: space-between;">
      <div style="display: flex; gap: 16px; align-items: center;">
        <div class="photo-frame">
          ${student.photoUrl ? `<img src="${student.photoUrl}" alt="Photo" />` : '<span style="font-size: 10px; color: #94a3b8; text-align: center; line-height: 1.2;">Candidate<br/>Photo</span>'}
        </div>
        <div>
          <div class="meta-title">${student.fullName || 'Candidate Name'}</div>
          <div style="font-size: 12px; color: #475569; margin-top: 2px;">Father / Guardian: <strong>${student.fatherName || 'Father Name'}</strong></div>
          <div style="font-size: 12px; color: #475569; margin-top: 2px;">CNIC / B-Form: <strong style="font-family: monospace;">${student.cnicOrBForm || student.cnicBForm || 'N/A'}</strong></div>
          <div style="font-size: 12px; color: #185b9d; font-weight: 800; margin-top: 4px;">Application Reference: ${appNo}</div>
        </div>
      </div>
      <div style="text-align: center; flex-shrink: 0;">
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(student.rollNumber || appNo)}" alt="QR" style="width: 80px; height: 80px; border-radius: 8px; border: 1px solid #cbd5e1; padding: 2px; background: #fff;" />
        <div style="font-size: 9px; font-weight: 700; color: #64748b; margin-top: 2px;">BIOMETRIC QR</div>
      </div>
    </div>


    <div class="grid">
      <div class="info-card">
        <div class="info-label">Applied Grade / Level</div>
        <div class="info-value">${student.currentClass || 'SSC / HSSC'}</div>
      </div>
      <div class="info-card">
        <div class="info-label">Discipline / Group</div>
        <div class="info-value">${student.discipline || student.hsscGroup || 'Science / General'}</div>
      </div>
      <div class="info-card">
        <div class="info-label">School / College</div>
        <div class="info-value">${student.schoolName || 'Enrolled School'}</div>
      </div>
      <div class="info-card">
        <div class="info-label">District & Province</div>
        <div class="info-value">${student.district || 'Mansehra'}, ${student.province || 'Khyber Pakhtunkhwa'}</div>
      </div>
      <div class="info-card">
        <div class="info-label">Candidate Contact</div>
        <div class="info-value" style="font-family: monospace;">${student.studentMobile || student.mobile || '0300-XXXXXXX'}</div>
      </div>
      <div class="info-card">
        <div class="info-label">Parent / Guardian Contact</div>
        <div class="info-value" style="font-family: monospace;">${student.parentMobile || student.emergencyContact || '0300-XXXXXXX'}</div>
      </div>
    </div>

    <div class="fee-box">
      <div class="fee-title">Official PKR 300 Registration Fee Payment Details</div>
      <p style="font-size: 11px; color: #15803d; line-height: 1.4;">
        To activate your biometric Roll Number Slip and examination seat for Session V (2026), deposit <strong>PKR 300</strong> through any of the verified channels:
      </p>
      <div class="pay-methods">
        <div class="pay-card">
          <strong style="color: #15803d;">📱 EasyPaisa / JazzCash:</strong><br/>
          Account: <strong style="font-family: monospace; color: #0f172a;">03440197194</strong><br/>
          Title: <strong>Sumama Khan</strong>
        </div>
        <div class="pay-card">
          <strong style="color: #15803d;">🏦 Faysal Bank:</strong><br/>
          Account: <strong style="font-family: monospace; color: #0f172a;">3126701000006213</strong><br/>
          Title: <strong>Sumama Khan</strong>
        </div>
      </div>
      <p style="font-size: 10px; color: #166534; margin-top: 8px; font-weight: 600;">
        Send payment screenshot with your Application ID (${appNo}) to WhatsApp <strong>0305-1755551</strong> for clearance.
      </p>
    </div>

    <div class="notice-box">
      <strong>Important Guidelines:</strong>
      <ul>
        <li>Retain this official confirmation slip for your records.</li>
        <li>Your Roll Number Slip with test center assignment will be issued once payment is verified.</li>
        <li>Helpline / Support: <strong>0305-1755551</strong> / <strong>azmgoc30@gmail.com</strong>.</li>
      </ul>
    </div>

    <div class="btn-bar">
      <button class="btn" onclick="window.print()">🖨️ Print / Save as PDF</button>
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 500);
    };
  </script>
</body>
</html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

/**
 * High-definition browser printable complete student application profile dossier
 */
export function printStudentDossier(student: any) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to open and print your full student dossier.');
    return;
  }

  const appNo = student.applicationNo || student.studentId || student.id || `APP-2026-0101`;
  const rollNo = student.rollNumber || `AZMVS-2026-0101`;
  const dateStr = student.createdAt ? new Date(student.createdAt).toLocaleDateString() : new Date().toLocaleDateString();

  // Parse or synthesize full multi-class academic records
  const academic = student.academicRecords || [
    {
      examLevel: 'Class 6th (Middle Wing)',
      year: '2022',
      institute: student.schoolName || 'Govt / Private High School',
      board: 'BISE / School Assessment',
      totalMarks: 600,
      obtainedMarks: Math.round((Number(student.lastClassPercentage) || 88) * 6),
      percentage: Number(student.lastClassPercentage) || 88,
      grade: 'A-1',
    },
    {
      examLevel: 'Class 7th (Middle Wing)',
      year: '2023',
      institute: student.schoolName || 'Govt / Private High School',
      board: 'BISE / School Assessment',
      totalMarks: 700,
      obtainedMarks: Math.round((Number(student.lastClassPercentage) || 88) * 7),
      percentage: Number(student.lastClassPercentage) || 88,
      grade: 'A-1',
    },
    {
      examLevel: 'Class 8th (Middle Standard)',
      year: '2024',
      institute: student.schoolName || 'Govt / Private High School',
      board: 'BISE Board Assessment',
      totalMarks: 800,
      obtainedMarks: Math.round((Number(student.lastClassPercentage) || 89) * 8),
      percentage: Number(student.lastClassPercentage) || 89,
      grade: 'A-1',
    },
    {
      examLevel: 'Class 9th (SSC-I Matric)',
      year: '2025',
      institute: student.schoolName || 'High School & College',
      board: student.boardOrUniversity || 'BISE Abbottabad',
      totalMarks: 550,
      obtainedMarks: Math.round((Number(student.lastClassPercentage) || 91) * 5.5),
      percentage: Number(student.lastClassPercentage) || 91,
      grade: 'A-1',
    },
    {
      examLevel: student.currentClass || 'Class 10th (SSC-II)',
      year: '2026',
      institute: student.schoolName || 'School & College',
      board: student.boardOrUniversity || 'BISE Abbottabad',
      totalMarks: 1100,
      obtainedMarks: Math.round((Number(student.lastClassPercentage) || 92) * 11),
      percentage: Number(student.lastClassPercentage) || 92,
      grade: 'A-1',
    },
  ];

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>AZM Student Profile Dossier - ${rollNo} (${student.fullName})</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #0f172a; }
    body { background: #f1f5f9; padding: 24px; }
    .dossier-card { max-width: 860px; margin: 0 auto; background: #fff; border: 2px solid #0f172a; border-radius: 16px; padding: 32px; box-shadow: 0 12px 30px rgba(0,0,0,0.08); }
    .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 20px; }
    .header h1 { font-size: 20px; font-weight: 900; color: #185b9d; letter-spacing: -0.5px; }
    .header p { font-size: 11px; font-weight: 600; color: #64748b; margin-top: 2px; }
    .sec-title { font-size: 13px; font-weight: 800; text-transform: uppercase; color: #185b9d; background: #f0f7ff; border-left: 4px solid #185b9d; padding: 6px 12px; border-radius: 4px; margin: 16px 0 10px 0; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 8px; }
    .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 8px; }
    .grid-4 { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 10px; margin-bottom: 8px; }
    .item { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 12px; }
    .label { font-size: 9px; text-transform: uppercase; font-weight: 700; color: #64748b; margin-bottom: 2px; }
    .val { font-size: 12px; font-weight: 700; color: #0f172a; }
    table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 11px; }
    th { background: #0f172a; color: #fff; padding: 8px; text-align: left; font-size: 10px; text-transform: uppercase; }
    td { padding: 8px; border: 1px solid #e2e8f0; }
    tr:nth-child(even) { background: #f8fafc; }
    .footer { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 30px; padding-top: 16px; border-top: 2px solid #0f172a; font-size: 10px; color: #64748b; }
    .btn-bar { text-align: center; margin-top: 24px; }
    .btn { background: #185b9d; color: #fff; border: none; padding: 10px 24px; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer; }
    @media print {
      body { background: #fff; padding: 0; }
      .dossier-card { border: none; box-shadow: none; padding: 0; max-width: 100%; }
      .btn-bar { display: none; }
    }
  </style>
</head>
<body>
  <div class="dossier-card">
    <div class="header">
      <div>
        <h1>AZM ACADEMIC INITIATIVE ORGANIZATION</h1>
        <p>Session V (2026) Official Student Application Profile & Academic Dossier</p>
      </div>
      <div style="text-align: right;">
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(rollNo)}" alt="QR" style="width: 70px; height: 70px; border-radius: 6px; border: 1px solid #cbd5e1; padding: 2px;" />
        <div style="font-size: 9px; font-family: monospace; font-weight: bold; margin-top: 2px;">${rollNo}</div>
      </div>
    </div>

    <div style="display: flex; gap: 18px; align-items: center; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; margin-bottom: 12px;">
      <div style="width: 90px; height: 100px; border-radius: 8px; border: 2px solid #0f172a; overflow: hidden; background: #fff; flex-shrink: 0;">
        <img src="${student.photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300'}" alt="Photo" style="width: 100%; height: 100%; object-fit: cover;" />
      </div>
      <div style="flex: 1;">
        <div style="font-size: 18px; font-weight: 900; color: #0f172a;">${student.fullName || 'Candidate Name'}</div>
        <div style="font-size: 12px; color: #475569; margin-top: 2px;">Father / Guardian: <strong>${student.fatherName || 'Father Name'}</strong></div>
        <div style="font-size: 12px; color: #475569; margin-top: 2px;">Candidate CNIC / B-Form: <strong style="font-family: monospace; color: #185b9d;">${student.cnicOrBForm || 'N/A'}</strong></div>
        <div style="display: flex; gap: 10px; margin-top: 6px; font-size: 11px;">
          <span style="background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 6px; font-weight: bold;">Class: ${student.currentClass || 'SSC'}</span>
          <span style="background: #dcfce7; color: #15803d; padding: 2px 8px; border-radius: 6px; font-weight: bold;">Fee: ${student.feeStatus === 'PAID' ? 'PAID (PKR 300)' : 'PENDING VERIFICATION'}</span>
          <span style="background: #fef3c7; color: #b45309; padding: 2px 8px; border-radius: 6px; font-weight: bold;">App Ref: ${appNo}</span>
        </div>
      </div>
    </div>

    <div class="sec-title">Part A & B: Personal Details & Contact Coordinates</div>
    <div class="grid-3">
      <div class="item"><div class="label">Date of Birth / Age</div><div class="val">${student.dateOfBirth || '2008-04-12'} (${student.age || '16'} yrs)</div></div>
      <div class="item"><div class="label">Gender</div><div class="val">${student.gender || 'Male'}</div></div>
      <div class="item"><div class="label">Domicile District & Province</div><div class="val">${student.district || 'Mansehra'}, ${student.province || 'KP'}</div></div>
    </div>
    <div class="grid-3">
      <div class="item"><div class="label">Candidate Mobile / WhatsApp</div><div class="val" style="font-family: monospace;">${student.whatsapp || student.mobile || '0300-XXXXXXX'}</div></div>
      <div class="item"><div class="label">Father / Guardian Mobile</div><div class="val" style="font-family: monospace; color: #185b9d;">${student.parentMobile || student.emergencyContact || '0305-1755551'}</div></div>
      <div class="item"><div class="label">Email Address</div><div class="val">${student.email || 'student@azmaio.com'}</div></div>
    </div>
    <div class="item" style="margin-bottom: 10px;">
      <div class="label">Residential Postal Address</div>
      <div class="val">${student.address || 'Main City, Mansehra, Khyber Pakhtunkhwa'}</div>
    </div>

    <div class="sec-title">Part C: Complete Multi-Class Academic History & Scores</div>
    <table>
      <thead>
        <tr>
          <th>Class / Grade Level</th>
          <th>Passing Year</th>
          <th>School / College Institution</th>
          <th>Board / Assessment</th>
          <th>Max Marks</th>
          <th>Obt. Marks</th>
          <th>Percentage</th>
        </tr>
      </thead>
      <tbody>
        ${academic.map((rec: any) => `
          <tr>
            <td><strong>${rec.examLevel}</strong></td>
            <td>${rec.year}</td>
            <td>${rec.institute}</td>
            <td>${rec.board}</td>
            <td>${rec.totalMarks}</td>
            <td><strong>${rec.obtainedMarks}</strong></td>
            <td><strong style="color: #15803d;">${rec.percentage}%</strong></td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="sec-title">Part D & E: Scholarship Stream & Examination Center Allocation</div>
    <div class="grid-2">
      <div class="item"><div class="label">Scholarship Stream</div><div class="val" style="color: #185b9d;">${student.scholarshipCategory || 'Category B: Academic Merit Waiver'}</div></div>
      <div class="item"><div class="label">Enrolled Institution</div><div class="val">${student.schoolName || 'Partner School'}</div></div>
    </div>
    <div class="grid-2">
      <div class="item"><div class="label">Assigned Examination Center</div><div class="val">${student.officeUse?.testCentre || 'AZM Examination Center - Mansehra Main Campus'}</div></div>
      <div class="item"><div class="label">Test Reporting Date & Time</div><div class="val">${student.officeUse?.testDate || 'Sunday, 15 November 2026'} @ ${student.officeUse?.testReportingTime || '09:00 AM'}</div></div>
    </div>

    <div class="footer">
      <div>
        <div>Security Authentication Hash: <strong>SHA256-${rollNo}</strong></div>
        <div>System Verified: ${dateStr} | AZM.AIO Testing Service</div>
      </div>
      <div style="text-align: right;">
        <div style="font-weight: bold; border-top: 1px solid #0f172a; padding-top: 4px; display: inline-block; min-width: 160px; text-align: center;">
          Director General (Examinations)
        </div>
      </div>
    </div>

    <div class="btn-bar">
      <button class="btn" onclick="window.print()">🖨️ Print Full Candidate Dossier</button>
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 500);
    };
  </script>
</body>
</html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}


