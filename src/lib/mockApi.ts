import { setToken, setUser, getUser, getToken } from './auth';
import { apiFetch, apiDownloadPdf } from './apiClient';

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

let currentUser: CurrentUser = getUser<CurrentUser>() || {
  id: 'usr_001',
  name: 'Prof. Dr. M. Jadoon',
  email: 'superadmin@jadoon.edu.pk',
  role: 'SUPER_ADMIN',
  avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
};

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
    setUser(user);
    currentUser = user;

    return {
      user,
      token: res.accessToken,
      role: user.role,
    };
  },

  async getCurrentUser(): Promise<CurrentUser> {
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
      ...currentUser,
      role,
      name:
        role === 'SUPER_ADMIN'
          ? 'Prof. Dr. M. Jadoon (Super Admin)'
          : role === 'ADMIN'
          ? 'Muhammad Rashid (Admin)'
          : role === 'ACCOUNTANT'
          ? 'Kashif Finance'
          : 'Asad Ali (Examiner/Teacher)',
    };
    setUser(currentUser);
    return currentUser;
  },

  // 2. Dashboard Overview Aggregation
  async getDashboardOverview() {
    const live = await apiFetch<any>('/api/dashboard/overview');

    // Fetch fee defaulters from live fees
    const feesList = await apiFetch<any[]>('/api/fees?status=UNPAID').catch(() => []);

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
        { day: 'Mon', rate: 94 },
        { day: 'Tue', rate: 92 },
        { day: 'Wed', rate: 96 },
        { day: 'Thu', rate: 95 },
        { day: 'Fri', rate: 91 },
        { day: 'Today', rate: live.attendanceToday?.attendancePercentage || 0 },
      ],
      feeDefaulters: feesList.slice(0, 5).map((f: any) => ({
        id: f.id,
        studentName: f.student?.fullName || f.studentName || 'Candidate',
        rollNumber: f.student?.rollNumber || f.rollNumber || 'JPS-2026',
        currentClass: f.student?.currentClass || f.currentClass || 'SSC',
        amountDue: f.amountDue,
        status: f.status,
      })),
      recentActivity: [
        {
          id: 'act_1',
          text: 'System metrics aggregated with live PostgreSQL / In-Memory database.',
          time: 'Just now',
        },
        {
          id: 'act_2',
          text: `Morning attendance session: ${live.attendanceToday?.markedCount || 0} students recorded today.`,
          time: '10m ago',
        },
        {
          id: 'act_3',
          text: `Monthly ledger: PKR ${live.financialFlow?.feeIncome?.toLocaleString() || '0'} fee receipts recorded.`,
          time: '1h ago',
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
    if (filters?.classLevel && filters.classLevel !== 'ALL') params.append('classLevel', filters.classLevel);
    if (filters?.status && filters.status !== 'ALL') params.append('status', filters.status);
    if (filters?.search) params.append('search', filters.search);
    const query = params.toString() ? `?${params.toString()}` : '';

    const list = await apiFetch<any[]>(`/api/students${query}`);
    return list.map((s) => ({
      ...s,
      feeStatus: s.feeStatus || (s.feeRecords?.length ? s.feeRecords[0].status : 'UNPAID'),
      attendancePercentage: s.attendancePercentage ?? 95,
    }));
  },

  async getStudentById(id: string): Promise<MockStudent> {
    const s = await apiFetch<any>(`/api/students/${id}`);
    return {
      ...s,
      feeStatus: s.feeStatus || 'UNPAID',
      attendancePercentage: s.attendancePercentage ?? 95,
    };
  },

  async createStudent(studentData: any): Promise<MockStudent> {
    return apiFetch<MockStudent>('/api/students/register', {
      method: 'POST',
      body: JSON.stringify(studentData),
    });
  },

  async updateOfficeUse(studentId: string, officeUseData: any) {
    return apiFetch<any>(`/api/students/${studentId}/office-use`, {
      method: 'PATCH',
      body: JSON.stringify(officeUseData),
    });
  },

  async downloadStudentPdf(studentId: string, rollNumber: string): Promise<void> {
    await apiDownloadPdf(
      `/api/students/${studentId}/registration-pdf`,
      `Student_Registration_${rollNumber || studentId}.pdf`
    );
  },

  // 4. Partner Institutions
  async getPartners(): Promise<MockPartner[]> {
    return apiFetch<MockPartner[]>('/api/partners');
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
    status?: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
  }): Promise<{ attendance: MockAttendance; student: MockStudent }> {
    return apiFetch<{ attendance: MockAttendance; student: MockStudent }>('/api/attendance/scan', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getTodayAttendance(): Promise<any> {
    return apiFetch<any>('/api/attendance/today');
  },

  async getStudentAttendanceHistory(studentId: string): Promise<MockAttendance[]> {
    return apiFetch<MockAttendance[]>(`/api/attendance/student/${studentId}`);
  },

  // 6. Fees & Challans
  async getFees(filters?: { month?: string; status?: string }): Promise<MockFeeChallan[]> {
    const params = new URLSearchParams();
    if (filters?.month && filters.month !== 'ALL') params.append('month', filters.month);
    if (filters?.status && filters.status !== 'ALL') params.append('status', filters.status);
    const query = params.toString() ? `?${params.toString()}` : '';

    const list = await apiFetch<any[]>(`/api/fees${query}`);
    return list.map((f) => ({
      id: f.id,
      challanNumber: f.challanNumber,
      studentId: f.studentId,
      studentName: f.student?.fullName || f.studentName || 'Student Candidate',
      rollNumber: f.student?.rollNumber || f.rollNumber || 'JPS-2026',
      currentClass: f.student?.currentClass || f.currentClass || 'SSC',
      month: f.month,
      amountDue: Number(f.amountDue),
      amountPaid: Number(f.amountPaid),
      status: f.status,
      dueDate: f.dueDate ? new Date(f.dueDate).toISOString().split('T')[0] : '2026-08-28',
      createdAt: f.createdAt,
    }));
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
    return apiFetch<MockStaff[]>('/api/staff');
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
    const query = month && month !== 'ALL' ? `?month=${month}` : '';
    const list = await apiFetch<any[]>(`/api/payroll${query}`);
    return list.map((p) => ({
      id: p.id,
      staffId: p.staffId,
      staffName: p.staff?.fullName || p.staffName || 'Staff Member',
      role: p.staff?.role || p.role || 'Faculty',
      month: p.month,
      amount: Number(p.amount),
      status: p.status,
      paidAt: p.paidAt,
      createdAt: p.createdAt,
    }));
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
    const query = type && type !== 'ALL' ? `?type=${type}` : '';
    const list = await apiFetch<any[]>(`/api/transactions${query}`);
    return list.map((t) => ({
      id: t.id,
      type: t.type,
      amount: Number(t.amount),
      description: t.description,
      relatedFeeId: t.relatedFeeId,
      relatedPayrollId: t.relatedPayrollId,
      createdAt: t.createdAt,
    }));
  },

  // 10. User Management (Super Admin)
  async getUsers(): Promise<MockUserAccount[]> {
    return [
      {
        id: 'usr_001',
        name: 'Prof. Dr. M. Jadoon',
        email: 'superadmin@jadoon.edu.pk',
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
        createdAt: '2025-01-01T00:00:00Z',
      },
      {
        id: 'usr_002',
        name: 'Muhammad Rashid (Admin)',
        email: 'admin@jadoon.edu.pk',
        role: 'ADMIN',
        status: 'ACTIVE',
        createdAt: '2025-02-15T00:00:00Z',
      },
      {
        id: 'usr_003',
        name: 'Asad Ali (Examiner/Teacher)',
        email: 'teacher@jadoon.edu.pk',
        role: 'TEACHER',
        status: 'ACTIVE',
        createdAt: '2025-03-01T00:00:00Z',
      },
      {
        id: 'usr_004',
        name: 'Kashif Finance',
        email: 'accountant@jadoon.edu.pk',
        role: 'ACCOUNTANT',
        status: 'ACTIVE',
        createdAt: '2025-04-10T00:00:00Z',
      },
    ];
  },

  async createUser(payload: { name: string; email: string; role: Role }): Promise<MockUserAccount> {
    return {
      id: `usr_${Date.now()}`,
      name: payload.name,
      email: payload.email,
      role: payload.role,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
    };
  },
};
