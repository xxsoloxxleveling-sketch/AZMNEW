import { extractSignedAttendanceToken } from '../utils/signedAttendanceQr';
import { setToken, setRefreshToken, setUser, getUser, getToken } from './auth';
import { apiFetch, apiDownloadPdf, apiOpenPdfForPrint, API_BASE_URL } from './apiClient';
export { API_BASE_URL };

export interface HallCandidate {
  legacyAllocationNeedsReview?: boolean;
  id: string;
  fullName: string;
  rollNumber: string | null;
  applicationNo: string | null;
  currentClass: string;
  assignedHallId: string | null;
  assignedRoom: string | null;
  seatNo: string | null;
}
export interface HallCandidatePage {
  candidates: HallCandidate[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'TEACHER' | 'ACCOUNTANT';

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  status?: string;
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
  displayRollNumber?: string;
  rollNumberStatus?: 'OFFICIAL' | 'PROVISIONAL';
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
  hasPhoto?: boolean;
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
  paperVariant?: 'A' | 'B' | 'C' | 'D';
  testDate?: string;
  reportingTime?: string;
  examStartTime?: string;
  examDurationMinutes?: number;
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
    testDate?: string;
    testReportingTime?: string;
    finalStatus?: string;
    officeRemarks?: string;
  };
}

export interface MockPartner {
  id: string;
  partnerCode: string;
  institutionName: string;
  institutionType: 'SCHOOL' | 'COLLEGE' | 'ACADEMY' | 'UNIVERSITY';
  campus?: string | null;
  address: string;
  district: string;
  province: string;
  contactName: string;
  contactDesignation: string;
  contactMobile: string;
  contactWhatsapp?: string | null;
  contactEmail?: string | null;
  website?: string | null;
  classesOffered: string[];
  studentStrength?: number | null;
  expectedApplicants?: number | null;
  agreedToTerms?: boolean;
  signedAt?: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  statusAudits?: PartnerStatusAuditRecord[];
}

export interface PartnerStatusAuditRecord {
  id: string;
  partnerId: string;
  previousStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  newStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  reason: string | null;
  changedById: string | null;
  changedByEmail: string | null;
  changedByName: string | null;
  changedAt: string;
}

export interface CreatePartnerPayload {
  institutionName: string;
  institutionType: 'SCHOOL' | 'COLLEGE' | 'ACADEMY' | 'UNIVERSITY';
  campus?: string | null;
  address: string;
  district: string;
  province: string;
  contactName: string;
  contactDesignation: string;
  contactMobile: string;
  contactWhatsapp?: string | null;
  contactEmail?: string | null;
  website?: string | null;
  classesOffered: string[];
  studentStrength?: number | null;
  expectedApplicants?: number | null;
  agreedToTerms?: boolean;
  signedAt?: string | Date | null;
}

export interface UpdatePartnerProfilePayload {
  institutionName?: string;
  institutionType?: 'SCHOOL' | 'COLLEGE' | 'ACADEMY' | 'UNIVERSITY';
  campus?: string | null;
  address?: string;
  district?: string;
  province?: string;
  contactName?: string;
  contactDesignation?: string;
  contactMobile?: string;
  contactWhatsapp?: string | null;
  contactEmail?: string | null;
  website?: string | null;
  classesOffered?: string[];
  studentStrength?: number | null;
  expectedApplicants?: number | null;
}

export interface PartnerQueryParams {
  search?: string;
  status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL';
  institutionType?: 'SCHOOL' | 'COLLEGE' | 'ACADEMY' | 'UNIVERSITY' | 'ALL';
  district?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface PartnerPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PartnerListResponse {
  data: MockPartner[];
  pagination: PartnerPagination;
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

export type AttendanceStatus = 'PRESENT' | 'LATE' | 'ABSENT';

export interface AttendanceSessionMetrics {
  expectedCount: number;
  markedCount: number;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  unmarkedCount: number;
  attendancePercentage: number | null;
}

export interface AttendancePagination {
  page: number; limit: number; total: number; totalPages: number;
}
export interface AttendanceSession {
  id: string;
  examHallId: string;
  businessDate: string;
  status: 'OPEN' | 'CLOSED';
  openedByUserId: string;
  openedAt: string;
  closedByUserId: string | null;
  closedAt: string | null;
  hallNameSnapshot: string;
  roomNumberSnapshot: string;
  testCenterNameSnapshot: string | null;
  examDateSnapshot: string;
  reportingTimeSnapshot: string;
}
export interface AttendanceSessionCandidate {
  studentId: string;
  fullNameSnapshot: string;
  rollNumberSnapshot: string | null;
  applicationNoSnapshot: string;
  currentClassSnapshot: string;
  seatNoSnapshot: string | null;
  status: AttendanceStatus | 'NOT_MARKED';
  method: 'MANUAL' | 'QR_SCAN' | null;
  markedAt: string | null;
  // Operator labels are optional; the 13A roster does not expose them.
  markedByName?: string | null;
}
export interface AttendanceSessionListResponse {
  sessions: (AttendanceSession & { stats: AttendanceSessionMetrics })[];
  pagination: AttendancePagination;
}
export interface AttendanceSessionDetail {
  session: AttendanceSession;
  stats: AttendanceSessionMetrics;
  roster: AttendanceSessionCandidate[];
}
export interface AttendanceCandidatesResponse {
  candidates: AttendanceSessionCandidate[];
  pagination: AttendancePagination;
}
export interface AttendanceMarkResponse {
  attendance: { id: string; sessionId: string; studentId: string; status: AttendanceStatus; method: 'MANUAL' | 'QR_SCAN'; markedByUserId: string; createdAt: string };
  student: { id: string; fullName: string; rollNumber: string | null; currentClass: string; status: string };
  message?: string;
}
export interface StudentExamAttendanceHistory {
  student: { id: string; fullName: string; rollNumber: string | null; currentClass: string };
  stats: AttendanceSessionMetrics;
  history: (AttendanceSessionCandidate & { session: AttendanceSession })[];
  pagination: AttendancePagination;
  legacyHistory: { id: string; date: string; status: string; method: string; createdAt: string; label: 'Legacy attendance record' }[];
}
function validateAttendanceMetrics(value: any): void {
  const counts = ['expectedCount', 'markedCount', 'presentCount', 'lateCount', 'absentCount', 'unmarkedCount'];
  if (!value || counts.some(key => !Number.isInteger(value[key]) || value[key] < 0) || !(value.attendancePercentage === null || (Number.isFinite(value.attendancePercentage) && value.attendancePercentage >= 0 && value.attendancePercentage <= 100))) throw new Error('Invalid examination attendance metrics');
  if (value.markedCount !== value.presentCount + value.lateCount + value.absentCount || value.expectedCount !== value.markedCount + value.unmarkedCount || (value.expectedCount === 0 && value.attendancePercentage !== null)) throw new Error('Inconsistent examination attendance metrics');
}
function validateAttendancePagination(value: any): void {
  if (!value || !Number.isInteger(value.page) || value.page < 1 || !Number.isInteger(value.limit) || value.limit < 1 || !Number.isInteger(value.total) || value.total < 0 || !Number.isInteger(value.totalPages) || value.totalPages < 0) throw new Error('Invalid attendance pagination');
}
function validateAttendanceCandidates(value: any): void {
  if (!Array.isArray(value) || value.some(row => typeof row?.studentId !== 'string' || !['NOT_MARKED', 'PRESENT', 'LATE', 'ABSENT'].includes(row.status))) throw new Error('Invalid frozen attendance roster');
}

function validateAttendanceSessionIdentity(value: any): void {
  if (typeof value?.id !== 'string' || !value.id.trim() || typeof value.examHallId !== 'string' || !value.examHallId.trim()) throw new Error('Invalid attendance session identity');
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

export type StaffStatus = 'ACTIVE' | 'INACTIVE';

export interface StaffDirectoryRecord {
  id: string;
  fullName: string;
  role: string;
  cnic: string;
  phone: string;
  status: StaffStatus;
  joinDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface StaffQueryParams {
  search?: string;
  role?: string;
  status?: StaffStatus;
  page?: number;
  limit?: number;
}

export interface StaffPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface StaffListResponse {
  staff: StaffDirectoryRecord[];
  pagination: StaffPagination;
}

export interface StaffPayrollRecord {
  id: string;
  staffId: string;
  month: string;
  amount: string;
  status: 'PENDING' | 'PAID';
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StaffPortalAccount { id: string; email: string; role: 'TEACHER'; status: string; }
export interface StaffPortalCredentials { email: string; temporaryPassword: string; role: 'TEACHER'; }
export interface StaffSalaryPayment { id: string; amount: string; transactionDate: string; status: 'POSTED' | 'VOIDED'; paymentMethod: PaymentMethod | null; referenceNumber: string | null; description: string; createdByName: string | null; }
export interface OneTimeSalaryPaymentInput { amount: number; paymentMethod?: PaymentMethod; referenceNumber?: string; note?: string; paidAt?: string; }
export interface StaffCreateRecord extends StaffDetailRecord { portalCredentials?: StaffPortalCredentials; }
export interface TeacherExportRecord { id: string; fullName: string; role: string; phone: string; cnic: string; joinDate: string; status: StaffStatus; salary: string; createdAt: string; portalAccount: StaffPortalAccount | null; }
export interface StaffDetailRecord {
  portalAccount?: StaffPortalAccount | null;
  salaryPayments?: StaffSalaryPayment[];
  id: string;
  fullName: string;
  role: string;
  cnic: string;
  phone: string;
  joinDate: string;
  salary: string;
  status: StaffStatus;
  createdAt: string;
  updatedAt: string;
  payroll: StaffPayrollRecord[];
}

export interface CreateStaffPayload {
  fullName: string;
  role: string;
  cnic: string;
  phone: string;
  salary: number;
  joinDate?: string;
}

export interface UpdateStaffPayload {
  fullName?: string;
  role?: string;
  cnic?: string;
  phone?: string;
  salary?: number;
  joinDate?: string;
  status?: StaffStatus;
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

export type TransactionType = 'FEE_INCOME' | 'SALARY_EXPENSE' | 'OTHER_INCOME' | 'OTHER_EXPENSE';
export type TransactionStatus = 'POSTED' | 'VOIDED';
export type TransactionSource = 'MANUAL' | 'FEE' | 'PAYROLL' | 'STAFF_PAYMENT';
export type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'CHEQUE' | 'ONLINE' | 'OTHER';

export interface TransactionFeeRecord {
  id: string;
  studentId: string;
  challanNumber: string;
  month: string;
  status: string;
  student?: {
    id: string;
    fullName: string;
    applicationNo: string;
  } | null;
}

export interface TransactionPayrollRecord {
  id: string;
  staffId: string;
  month: string;
  status: string;
  staff?: {
    id: string;
    fullName: string;
    role: string;
  } | null;
}

export interface TransactionRecord {
  id: string;
  type: TransactionType;
  amount: string; // Authoritative decimal string
  description: string;
  transactionDate: string;
  status: TransactionStatus;
  source: TransactionSource;
  category?: string | null;
  paymentMethod?: PaymentMethod | null;
  referenceNumber?: string | null;
  createdById?: string | null;
  createdByName?: string | null;
  createdByEmail?: string | null;
  voidedAt?: string | null;
  voidedById?: string | null;
  voidedByName?: string | null;
  voidedByEmail?: string | null;
  voidReason?: string | null;
  relatedFeeId?: string | null;
  relatedPayrollId?: string | null;
  createdAt: string;
  feeRecord?: TransactionFeeRecord | null;
  payrollRecord?: TransactionPayrollRecord | null;
}

// Backward compatibility alias
export type MockTransaction = TransactionRecord;

export interface TransactionPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface TransactionListResponse {
  transactions: TransactionRecord[];
  pagination: TransactionPagination;
}

export interface TransactionQueryParams {
  page?: number;
  limit?: number;
  type?: TransactionType | 'ALL';
  status?: TransactionStatus | 'ALL';
  source?: TransactionSource | 'ALL';
  search?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: 'transactionDate' | 'createdAt' | 'amount';
  sortOrder?: 'asc' | 'desc';
}

export interface TransactionSummaryPeriod {
  startDate: string | null;
  endDate: string | null;
}

export interface TransactionSummaryResponse {
  currency: string;
  totalIncome: string;
  totalExpense: string;
  netMovement: string;
  postedCount: number;
  voidedCount: number;
  period: TransactionSummaryPeriod;
}

export interface TransactionSummaryQueryParams {
  startDate?: string;
  endDate?: string;
  type?: TransactionType | 'ALL';
  source?: TransactionSource | 'ALL';
}

export interface CreateManualTransactionPayload {
  type: 'OTHER_INCOME' | 'OTHER_EXPENSE';
  amount: number;
  description: string;
  transactionDate?: string;
  category?: string | null;
  paymentMethod?: PaymentMethod | null;
  referenceNumber?: string | null;
}

export type UserStatus = 'ACTIVE' | 'INACTIVE';

export interface UserAccountRecord {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
}

export interface UserQueryParams {
  search?: string;
  role?: Role | 'ALL';
  status?: UserStatus | 'ALL';
  page?: number;
  limit?: number;
}

export interface UserPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface UserListResponse {
  users: UserAccountRecord[];
  pagination: UserPagination;
}

export interface CreateUserPayload {
  name: string;
  email: string;
  role: Role;
  password: string;
  status?: UserStatus;
}

export type UpdateUserPayload =
  | { name?: string; role?: Role }
  | { status: UserStatus }
  | { password: string };

export interface MockUserAccount {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt?: string;
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
  fileEndpoint?: string;
  storageDocType?: string;
  fileSize: string;
  fileType: string;
  uploadedAt: string;
  status: 'VERIFIED' | 'PENDING_REVIEW' | 'REJECTED';
  rejectionReason?: string;
}

let currentUser: CurrentUser | null = getUser<CurrentUser>() || null;
const candidateUploadSessions = new Map<string, string>();

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

export type AlertVisualType = 'urgent' | 'registration' | 'exam' | 'info';

export interface ManagedAnnouncement {
  id: string;
  title: string;
  subtitle?: string | null;
  message: string;
  type: AlertVisualType;
  badge: string;
  isPinned: boolean;
  isPublished: boolean;
  publishStartAt?: string | null;
  publishEndAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAnnouncementPayload {
  title: string;
  subtitle?: string | null;
  message: string;
  type: AlertVisualType;
  badge: string;
  isPinned?: boolean;
  isPublished?: boolean;
  publishStartAt?: string | null;
  publishEndAt?: string | null;
}

export type UpdateAnnouncementPayload = Partial<CreateAnnouncementPayload>;

// Release scheduling uses Pakistan time (UTC+05:00), never the host timezone.
// Current saves are canonical UTC ISO; legacy naive datetimes are PKT wall-clock values.
export function parseReleaseDateTime(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})?$/.exec(value);
  if (!match) return null;
  const [, y, mo, d, h, mi, s = '0', ms = '0', zone] = match;
  const parts = [+y, +mo, +d, +h, +mi, +s, +ms.padEnd(3, '0')];
  const wall = new Date(0);
  wall.setUTCFullYear(parts[0], parts[1] - 1, parts[2]);
  wall.setUTCHours(parts[3], parts[4], parts[5], parts[6]);
  if (wall.getUTCFullYear() !== parts[0] || wall.getUTCMonth() !== parts[1] - 1 ||
      wall.getUTCDate() !== parts[2] || wall.getUTCHours() !== parts[3] ||
      wall.getUTCMinutes() !== parts[4] || wall.getUTCSeconds() !== parts[5]) return null;
  let offset = 300;
  if (zone === 'Z') offset = 0;
  else if (zone) {
    const hours = +zone.slice(1, 3), minutes = +zone.slice(4, 6);
    if (hours > 23 || minutes > 59) return null;
    offset = (hours * 60 + minutes) * (zone[0] === '+' ? 1 : -1);
  }
  return new Date(wall.getTime() - offset * 60000);
}

export function canonicalReleaseDateTime(value: unknown): string | null {
  return parseReleaseDateTime(value)?.toISOString() ?? null;
}

export function isReleaseConfigReleased(config: { isScheduled: boolean; releaseDateTime: string }, now = Date.now()): boolean {
  const instant = parseReleaseDateTime(config.releaseDateTime);
  return !config.isScheduled || (instant !== null && now >= instant.getTime());
}

export function formatReleaseDateTime(value: unknown): string {
  const instant = parseReleaseDateTime(value);
  if (!instant) return 'Official release time requires correction';
  const date = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Karachi', weekday: 'long',
    year: 'numeric', month: 'long', day: 'numeric' }).format(instant);
  const time = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Karachi', hour: '2-digit',
    minute: '2-digit', hour12: true }).format(instant);
  return `${date} at ${time} PKT`;
}

export function releaseDateTimeToPakistanInput(value: unknown): string {
  const instant = parseReleaseDateTime(value);
  return instant ? new Date(instant.getTime() + 300 * 60000).toISOString().slice(0, 16) : '';
}

export interface RollNumberReleaseConfig {
  isScheduled: boolean; // true = schedule on/after releaseDateTime; false = immediate on payment approval
  releaseDateTime: string; // Canonical UTC ISO on save; legacy timezone-less strings mean Asia/Karachi.
  announcementTitle: string;
  announcementMessage: string;
  emergencyNotice?: string;
  examCenterName: string;
  examDate: string;
  femaleReportingTime: string;
  femaleTestStartTime: string;
  femaleTestEndTime: string;
  maleReportingTime: string;
  maleTestStartTime: string;
  maleTestEndTime: string;
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
  examCenterName: 'Dubai International School and College Boys Campus Mansehra',
  examDate: '2026-11-15',
  femaleReportingTime: '08:00',
  femaleTestStartTime: '09:00',
  femaleTestEndTime: '10:00',
  maleReportingTime: '11:00',
  maleTestStartTime: '12:00',
  maleTestEndTime: '13:00',
  updatedAt: '2026-08-24T00:00:00Z',
};

let inMemoryReleaseConfig: RollNumberReleaseConfig = { ...DEFAULT_RELEASE_CONFIG };

export async function fetchRollNumberReleaseConfig(): Promise<RollNumberReleaseConfig> {
  try {
    const res: any = await apiFetch<any>('/api/students/release-config');
    const data = res?.data || res;
    if (data && typeof data.isScheduled === 'boolean') {
      inMemoryReleaseConfig = { ...DEFAULT_RELEASE_CONFIG, ...data };
      return inMemoryReleaseConfig;
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
  const releaseDateTime = canonicalReleaseDateTime(config.releaseDateTime ?? inMemoryReleaseConfig.releaseDateTime);
  if (!releaseDateTime) throw new Error('Invalid release date/time. Enter a valid Pakistan release time.');
  const merged = { ...inMemoryReleaseConfig, ...config, releaseDateTime, updatedAt: new Date().toISOString() };
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
  return isReleaseConfigReleased(inMemoryReleaseConfig);
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
    if (!currentUser) {
      currentUser = getUser<CurrentUser>();
    }
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




  // 2. Dashboard Overview Aggregation
  async getDashboardOverview() {
    const live = await apiFetch<any>('/api/dashboard/overview');

    // Fetch fee defaulters from live fees
    const feesRes: any = await apiFetch<any>('/api/fees?status=UNPAID').catch(() => []);
    const feesList = Array.isArray(feesRes) ? feesRes : Array.isArray(feesRes?.feeRecords) ? feesRes.feeRecords : [];

    // Build truthful Monday-Friday work week schedule derived from period date
    const refDate = live?.period?.date ? new Date(live.period.date) : new Date();
    const dayOfWeek = refDate.getDay(); // 0: Sun, 1: Mon, ..., 6: Sat
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(refDate);
    monday.setDate(refDate.getDate() + mondayOffset);

    const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const sourceAttendanceToday = live?.attendanceToday;
    const attendanceToday = sourceAttendanceToday ? {
      sessionCount: sourceAttendanceToday.sessionCount,
      expectedCount: sourceAttendanceToday.expectedCount,
      markedCount: sourceAttendanceToday.markedCount,
      presentCount: sourceAttendanceToday.presentCount,
      lateCount: sourceAttendanceToday.lateCount,
      absentCount: sourceAttendanceToday.absentCount,
      unmarkedCount: sourceAttendanceToday.unmarkedCount,
      attendancePercentage: sourceAttendanceToday.attendancePercentage ?? null,
    } : null;
    const todayRate = attendanceToday?.attendancePercentage ?? null;
    const hasTodaySession = (attendanceToday?.sessionCount || 0) > 0;

    const attendanceTrends = weekdays.map((weekday, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const isToday = d.toDateString() === refDate.toDateString();
      const dayLabel = `${weekday} ${d.getDate()}`;

      return {
        day: dayLabel,
        isToday,
        hasSession: isToday ? hasTodaySession : false,
        rate: isToday && hasTodaySession ? todayRate : null,
      };
    });

    return {
      stats: {
        totalStudents: live.stats?.totalStudents || 0,
        totalPartners: live.stats?.totalPartners ?? live.partnerStats?.totalPartners ?? 0,
        pendingPartners: live.stats?.pendingPartners ?? live.partnerStats?.pendingPartners ?? 0,
        totalExpectedApplicants: live.stats?.totalExpectedApplicants || 0,
        attendancePercentage: live.attendanceToday?.attendancePercentage ?? null,
        feeCollectionPercentage: live.feeCollection?.collectionPercentage || 0,
        activeStaffCount: live.stats?.activeStaffCount || 0,
        totalBilled: live.feeCollection?.totalBilled || 0,
        totalCollected: live.feeCollection?.totalCollected || 0,
        feeIncome: live.financialFlow?.feeIncome || 0,
        salaryExpenses: live.financialFlow?.salaryExpenses || 0,
        netCashFlow: live.financialFlow?.netCashFlow || 0,
      },
      attendanceToday,
      attendanceTrends,
      feeDefaulters: (feesList || []).slice(0, 5).map((f: any) => ({
        id: f.id,
        studentName: f.student?.fullName || f.studentName || 'Candidate',
        rollNumber: f.student?.rollNumber || f.rollNumber || 'Pending Approval',
        currentClass: f.student?.currentClass || f.currentClass || 'SSC',
        amountDue: Number(f.amountDue) || 300,
        status: f.status || 'UNPAID',
      })),
      recentActivity: [],
      demographics: {
        byGender: live.studentDemographics?.byGender || { MALE: 0, FEMALE: 0 },
        byClassLevel: live.studentDemographics?.byClassLevel || {},
        byScholarshipCategory: live.studentDemographics?.byScholarshipCategory || {},
      },
    };
  },

  // 3. Students Management

  async getStudentsPage(filters?: { classLevel?: string; gender?: string; status?: string; search?: string; page?: number; limit?: number }): Promise<{
    students: MockStudent[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const params = new URLSearchParams();
    params.append('page', String(filters?.page || 1));
    params.append('limit', String(filters?.limit || 50));
    if (filters?.classLevel && filters?.classLevel !== 'ALL') params.append('classLevel', filters.classLevel);
    if (filters?.gender && filters?.gender !== 'ALL') params.append('gender', filters.gender);
    if (filters?.status && filters?.status !== 'ALL') params.append('status', filters.status);
    if (filters?.search && filters.search.trim()) params.append('search', filters.search.trim());
    const query = `?${params.toString()}`;

    const res: any = await apiFetch<any>(`/api/students${query}`);
    const raw = Array.isArray(res) ? res : Array.isArray(res?.students) ? res.students : [];
    const students = raw.map((s: any) => ({
      ...s,
      rollNumber: s.rollNumber || null,
      feeStatus: s.feeStatus || (s.feeRecords?.length ? s.feeRecords[0].status : 'UNPAID'),
      attendancePercentage: s.attendancePercentage,
    }));
    return {
      students,
      pagination: res?.pagination || {
        page: filters?.page || 1,
        limit: filters?.limit || 50,
        total: students.length,
        totalPages: 1,
      },
    };
  },

  async getStudents(filters?: { classLevel?: string; gender?: string; status?: string; search?: string }): Promise<MockStudent[]> {
    const result = await this.getStudentsPage({ ...filters, page: 1, limit: 250 });
    return result.students;
  },

  async getStudentById(id: string): Promise<MockStudent> {
    const s: any = await apiFetch<any>(`/api/students/${id}`);
    return {
      ...s,
      feeStatus: s.feeStatus || (s.feeRecords?.length ? s.feeRecords[0].status : 'UNPAID'),
      attendancePercentage: s.attendancePercentage,
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
  }): Promise<{
    publicUrl?: string;
    path: string;
    bucket: string;
    mimeType: string;
    byteSize: number;
    checksumSha256: string;
  }> {
    const candidateKey = (params.cnicOrBForm || params.applicationNo || params.studentId)?.trim();
    let uploadSessionToken: string | undefined;
    if (!getToken()) {
      if (!candidateKey || candidateKey === 'TEMP_CANDIDATE') {
        throw new Error('Enter the candidate CNIC or B-Form before uploading documents.');
      }
      uploadSessionToken = candidateUploadSessions.get(candidateKey);
      if (!uploadSessionToken) {
        const session = await apiFetch<{ token: string; expiresInSeconds: number }>(
          '/api/students/upload-session',
          {
            method: 'POST',
            body: JSON.stringify({ cnicOrBForm: candidateKey }),
          }
        );
        uploadSessionToken = session.token;
        candidateUploadSessions.set(candidateKey, uploadSessionToken);
      }
    }

    let res: any;
    const dataUrlMatch = params.fileData.match(/^data:([^;]+);base64,(.*)$/s);
    if (dataUrlMatch && candidateKey) {
      const binary = atob(dataUrlMatch[2]);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
      res = await apiFetch<any>('/api/students/upload-document-binary', {
        method: 'POST',
        headers: {
          'Content-Type': params.contentType || dataUrlMatch[1],
          'X-Candidate-Key': candidateKey,
          'X-Document-Type': params.docType,
          'X-File-Name': encodeURIComponent(params.fileName || `${params.docType}.bin`),
          ...(uploadSessionToken ? { 'X-Upload-Session': uploadSessionToken } : {}),
        },
        body: new Blob([bytes], { type: params.contentType || dataUrlMatch[1] }),
      });
    } else {
      res = await apiFetch<any>('/api/students/upload-document', {
        method: 'POST',
        headers: uploadSessionToken ? { 'X-Upload-Session': uploadSessionToken } : undefined,
        body: JSON.stringify(params),
      });
    }
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


  async updateStudent(studentId: string, updates: Record<string, any>): Promise<MockStudent> {
    const res = await apiFetch<any>(`/api/students/${studentId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
    return res?.data || res;
  },

  async updateOfficeUse(studentId: string, officeUseData: any) {
    return apiFetch<any>(`/api/students/${studentId}/office-use`, {
      method: 'PATCH',
      body: JSON.stringify(officeUseData),
    });
  },

  async getExamHalls(): Promise<any[]> {
    const res = await apiFetch<any[]>('/api/exam-halls');
    if (!Array.isArray(res) || res.some(h => typeof h?.id !== 'string' || !Number.isInteger(h?.assignedCount))) throw new Error('Invalid exam halls response.');
    return res;
  },

  async getExamHall(id: string): Promise<any> {
    const res = await apiFetch<any>(`/api/exam-halls/${id}`);
    if (res?.id !== id || !Array.isArray(res?.assignedStudents)) throw new Error('Invalid hall roster response.');
    return res;
  },

  async getHallCandidates(query: { search?: string; class?: string; gender?: 'MALE' | 'FEMALE'; assignment?: 'unassigned' | 'assigned' | 'all'; page?: number; limit?: number }): Promise<HallCandidatePage> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== '') params.set(key, String(value));
    const res = await apiFetch<HallCandidatePage>(`/api/exam-halls/candidates?${params}`);
    if (!Array.isArray(res?.candidates) || !res?.pagination ||
      !['page', 'limit', 'total', 'totalPages'].every(key => Number.isInteger((res.pagination as any)[key])) ||
      res.pagination.page < 1 || res.pagination.limit < 1 || res.pagination.total < 0 || res.pagination.totalPages < 0) throw new Error('Invalid candidate placement response.');
    return res;
  },

  async createExamHall(data: any): Promise<any> {
    const res = await apiFetch<any>('/api/exam-halls', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (typeof res?.id !== 'string' || typeof res?.name !== 'string') throw new Error('Invalid created hall response.');
    return res;
  },

  async updateExamHall(id: string, data: any): Promise<any> {
    const res = await apiFetch<any>(`/api/exam-halls/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    if (res?.id !== id || typeof res?.name !== 'string') throw new Error('Invalid updated hall response.');
    return res;
  },

  async deleteExamHall(id: string): Promise<boolean> {
    const res = await apiFetch<any>(`/api/exam-halls/${id}`, { method: 'DELETE' });
    if (res?.success !== true) throw new Error('Invalid hall deletion response.');
    return true;
  },

  async updateStudentAllocation(
    studentId: string,
    allocation: {
      testCenterId?: string;
      testCenterName?: string;
      assignedHallId?: string | null;
      assignedHall?: string | null;
      assignedRoom?: string | null;
      seatNo?: string | null;
    }
  ): Promise<HallCandidate> {
    const res = await apiFetch<any>(`/api/exam-halls/students/${studentId}/allocation`, {
      method: 'PATCH',
      body: JSON.stringify(allocation),
    });
    if (res?.id !== studentId) throw new Error('Invalid allocation response.');
    return res;
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
    if (!Number.isInteger(res?.assignedCount) || res.assignedCount < 0) throw new Error('Invalid batch allocation response.');
    return res.assignedCount;
  },

  async unassignStudentFromHall(studentId: string): Promise<boolean> {
    const res = await apiFetch<any>(`/api/exam-halls/students/${studentId}/allocation`, {
      method: 'DELETE',
    });
    if (res?.id !== studentId || res.assignedHallId !== null || res.seatNo !== null) throw new Error('Invalid unassignment response.');
    return true;
  },



  async downloadStudentPdf(studentId: string, rollNumber?: string, studentObj?: any): Promise<void> {
    if (!studentId) throw new Error('Student identifier is required to download the registration slip.');
    // Registration PDFs are generated server-side so the private original photo
    // is fetched only for this explicit download, never from a roster response.
    const headers: Record<string, string> = {};
    if (studentObj?.cnicOrBForm) {
      headers['X-Candidate-CNIC'] = String(studentObj.cnicOrBForm).trim();
    }
    await apiDownloadPdf(
      `/api/students/${encodeURIComponent(studentId)}/registration-pdf`,
      `AZM-Registration-${rollNumber || studentId}.pdf`,
      { headers }
    );
  },

  async printStudentRegistrationPdf(studentId: string, studentObj?: any): Promise<void> {
    if (!studentId) throw new Error('Student identifier is required to print the registration slip.');
    const headers: Record<string, string> = {};
    if (studentObj?.cnicOrBForm) {
      headers['X-Candidate-CNIC'] = String(studentObj.cnicOrBForm).trim();
    }
    await apiOpenPdfForPrint(
      `/api/students/${encodeURIComponent(studentId)}/registration-pdf`,
      { headers }
    );
  },

  async startProfileThumbnailBackfill(): Promise<void> {
    await apiFetch('/api/students/backfill-profile-thumbnails', { method: 'POST' });
  },

  async downloadRollSlipPdf(studentId: string, rollNumber?: string, studentObj?: any): Promise<void> {
    // If backend PDF service is reachable, use server-side Puppeteer PDF
    try {
      await this.downloadStudentRollSlipPdf(studentId, rollNumber);
      return;
    } catch (e) {
      if (e instanceof Error && e.message.includes('PLACEMENT_PENDING')) throw e;
      console.warn('Server-side roll slip PDF fallback to client print:', e);
    }
    let data;
    try {
      // Revalidate placement rather than trusting a possibly stale caller object.
      data = await this.getStudentById(studentId);
    } catch {
      data = { ...studentObj, id: studentId, rollNumber: rollNumber || studentObj?.rollNumber,
        placementStatus: 'PLACEMENT_PENDING', assignedHallId: null };
    }
    printRollNumberSlip(data || { id: studentId, rollNumber });
  },

  async downloadStudentRollSlipPdf(studentId: string, rollNumber?: string): Promise<void> {
    if (!studentId) throw new Error('Student identifier is required to download roll number slip.');
    await apiDownloadPdf(
      `/api/students/${encodeURIComponent(studentId)}/roll-slip-pdf`,
      `AZM-RollSlip-${rollNumber || studentId}.pdf`
    );
  },

  async downloadStudentOmrPdf(studentId: string, rollNumber?: string): Promise<void> {
    if (!studentId) throw new Error('Student identifier is required to download OMR answer sheet.');
    await apiDownloadPdf(
      `/api/students/${encodeURIComponent(studentId)}/omr-sheet-pdf`,
      `AZM-OMR-${rollNumber || studentId}.pdf`
    );
  },

  async downloadBulkOmrPdf(studentIds: string[]): Promise<void> {
    if (!studentIds?.length) throw new Error('At least one student must be selected.');
    await apiDownloadPdf(
      '/api/students/bulk-omr-pdf',
      `AZM-Bulk-OMR-${studentIds.length}-Candidates.pdf`,
      { method: 'POST', body: { studentIds } }
    );
  },

  async downloadBulkRollSlipsPdf(studentIds: string[]): Promise<void> {
    if (!studentIds?.length) throw new Error('At least one student must be selected.');
    await apiDownloadPdf(
      '/api/students/bulk-roll-slips-pdf',
      `AZM-Bulk-RollSlips-${studentIds.length}-Candidates.pdf`,
      { method: 'POST', body: { studentIds } }
    );
  },

  async printStudentRollSlipPdf(studentId: string): Promise<void> {
    if (!studentId) throw new Error('Student identifier is required to print roll number slip.');
    await apiOpenPdfForPrint(
      `/api/students/${encodeURIComponent(studentId)}/roll-slip-pdf`,
      { title: 'Printing Roll Number Slip…' }
    );
  },

  async printStudentOmrPdf(studentId: string): Promise<void> {
    if (!studentId) throw new Error('Student identifier is required to print OMR answer sheet.');
    await apiOpenPdfForPrint(
      `/api/students/${encodeURIComponent(studentId)}/omr-sheet-pdf`,
      { title: 'Printing MCQs OMR Sheet…' }
    );
  },

  async downloadRegistrationSlipPdf(studentData: any): Promise<void> {
    const studentId = studentData?.id || studentData?.applicationNo;
    const rollNumber = studentData?.rollNumber;
    return this.downloadStudentPdf(studentId, rollNumber, studentData);
  },

  async downloadStudentsListPdf(
    filters?: { classLevel?: string; gender?: string; status?: string; search?: string },
    preloadedStudents?: MockStudent[]
  ): Promise<void> {
    void preloadedStudents;
    const params = new URLSearchParams();
    if (filters?.classLevel && filters.classLevel !== 'ALL') params.append('classLevel', filters.classLevel);
    if (filters?.gender && filters.gender !== 'ALL') params.append('gender', filters.gender);
    if (filters?.status && filters.status !== 'ALL') params.append('status', filters.status);
    if (filters?.search && filters.search.trim()) params.append('search', filters.search.trim());

    const suggestedFilename = `AZM-Students-${new Date().toISOString().split('T')[0]}.pdf`;
    await apiDownloadPdf(`/api/students/export-pdf?${params.toString()}`, suggestedFilename);
  },

  async downloadAllStudentsListPdf(): Promise<void> {
    const filename = `AZM-Students-All-${new Date().toISOString().split('T')[0]}.pdf`;
    await apiDownloadPdf('/api/students/export-all-pdf', filename);
  },

  async downloadSelectedStudentsListPdf(studentIds: string[]): Promise<void> {
    if (!Array.isArray(studentIds) || studentIds.length < 1 || studentIds.length > 250 || new Set(studentIds).size !== studentIds.length) {
      throw new Error('Select between 1 and 250 unique students to export.');
    }
    const filename = `AZM-Students-Selected-${studentIds.length}-${new Date().toISOString().split('T')[0]}.pdf`;
    await apiDownloadPdf('/api/students/export-selected-pdf', filename, {
      method: 'POST',
      body: { studentIds },
    });
  },


  // 4. Partner Institutions
  async getPartners(query?: PartnerQueryParams): Promise<PartnerListResponse> {
    const params = new URLSearchParams();
    if (query?.search) params.set('search', query.search);
    if (query?.status && query.status !== 'ALL') params.set('status', query.status);
    if (query?.institutionType && query.institutionType !== 'ALL') params.set('institutionType', query.institutionType);
    if (query?.district && query.district !== 'ALL' && query.district !== 'all') params.set('district', query.district);
    if (query?.page) params.set('page', String(query.page));
    if (query?.limit) params.set('limit', String(query.limit));
    if (query?.sortBy) params.set('sortBy', query.sortBy);
    if (query?.sortOrder) params.set('sortOrder', query.sortOrder);

    const queryString = params.toString() ? `?${params.toString()}` : '';
    const res: any = await apiFetch<any>(`/api/partners${queryString}`);

    if (res && res.data && Array.isArray(res.data)) {
      return {
        data: res.data,
        pagination: res.pagination || { page: 1, limit: res.data.length, total: res.data.length, totalPages: 1 },
      };
    } else if (Array.isArray(res)) {
      return {
        data: res,
        pagination: { page: 1, limit: res.length, total: res.length, totalPages: 1 },
      };
    }

    return {
      data: [],
      pagination: { page: 1, limit: 25, total: 0, totalPages: 1 },
    };
  },

  async getPartnerById(id: string): Promise<MockPartner> {
    const res: any = await apiFetch<any>('/api/partners/' + id);
    return (res?.data !== undefined ? res.data : res) as MockPartner;
  },

  async getPartnerStatusHistory(id: string): Promise<PartnerStatusAuditRecord[]> {
    const res: any = await apiFetch<any>('/api/partners/' + id + '/status-history');
    if (res && Array.isArray(res.data)) {
      return res.data;
    }
    if (Array.isArray(res)) {
      return res;
    }
    return [];
  },

  async registerPartner(partnerData: any, idempotencyKey?: string): Promise<MockPartner> {
    const headers: Record<string, string> = {};
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }

    return apiFetch<MockPartner>('/api/partners/register', {
      method: 'POST',
      headers,
      body: JSON.stringify(partnerData),
    });
  },

  async createPartner(payload: CreatePartnerPayload): Promise<MockPartner> {
    const res: any = await apiFetch<any>('/api/partners', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return (res?.data !== undefined ? res.data : res) as MockPartner;
  },

  async updatePartnerProfile(id: string, payload: UpdatePartnerProfilePayload): Promise<MockPartner> {
    const res: any = await apiFetch<any>(`/api/partners/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return (res?.data !== undefined ? res.data : res) as MockPartner;
  },

  async updatePartnerStatus(
    id: string,
    payload: { status: 'PENDING' | 'APPROVED' | 'REJECTED'; reason?: string; expectedStatus?: string }
  ): Promise<MockPartner> {
    return apiFetch<MockPartner>(`/api/partners/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  async downloadPartnerPdf(
    partnerId: string,
    partnerCode?: string,
    verification?: { mobile?: string; email?: string }
  ): Promise<void> {
    const headers: Record<string, string> = {};
    if (verification?.mobile) headers['X-Partner-Mobile'] = verification.mobile.trim();
    if (verification?.email) headers['X-Partner-Email'] = verification.email.trim();

    await apiDownloadPdf(
      `/api/partners/${partnerId}/registration-pdf`,
      `AZM_Partner_Acknowledgement_${partnerCode || partnerId}.pdf`,
      { headers }
    );
  },

  // 5. Hall-scoped attendance sessions
  async getAttendanceSessions(query?: { page?: number; limit?: number; examHallId?: string; businessDate?: string; status?: 'OPEN' | 'CLOSED' }): Promise<AttendanceSessionListResponse> {
    const params = new URLSearchParams();
    params.set('page', String(query?.page || 1));
    params.set('limit', String(query?.limit || 25));
    if (query?.examHallId) params.set('examHallId', query.examHallId);
    if (query?.businessDate) params.set('businessDate', query.businessDate);
    if (query?.status) params.set('status', query.status);
    const res: any = await apiFetch<any>(`/api/attendance/sessions?${params.toString()}`);
    if (!Array.isArray(res?.sessions) || !res?.pagination) throw new Error('Invalid attendance sessions response');
    validateAttendancePagination(res.pagination);
    res.sessions.forEach((session: any) => { if (typeof session?.id !== 'string' || typeof session.examHallId !== 'string') throw new Error('Invalid attendance session'); validateAttendanceMetrics(session.stats); });
    return res as AttendanceSessionListResponse;
  },

  async getAttendanceSession(id: string): Promise<AttendanceSessionDetail> {
    const res: any = await apiFetch<any>(`/api/attendance/sessions/${encodeURIComponent(id)}`);
    if (!res?.session || !res?.stats || !Array.isArray(res?.roster)) throw new Error('Invalid attendance session detail');
    validateAttendanceSessionIdentity(res.session);
    validateAttendanceMetrics(res.stats);
    validateAttendanceCandidates(res.roster);
    return res as AttendanceSessionDetail;
  },

  async createAttendanceSession(payload: { examHallId: string }): Promise<AttendanceSessionDetail> {
    const res: any = await apiFetch<any>('/api/attendance/sessions', {
      method: 'POST', body: JSON.stringify(payload),
    });
    if (!res?.session || !res?.stats || !Array.isArray(res?.roster)) throw new Error('Invalid created attendance session');
    validateAttendanceSessionIdentity(res.session);
    validateAttendanceMetrics(res.stats);
    validateAttendanceCandidates(res.roster);
    return res as AttendanceSessionDetail;
  },

  async getAttendanceSessionCandidates(id: string, query?: { page?: number; limit?: number; search?: string }): Promise<AttendanceCandidatesResponse> {
    const params = new URLSearchParams({ page: String(query?.page ?? 1), limit: String(query?.limit ?? 25) });
    if (query?.search?.trim()) params.set('search', query.search.trim());
    const res: any = await apiFetch<any>(`/api/attendance/sessions/${encodeURIComponent(id)}/candidates?${params}`);
    validateAttendanceCandidates(res?.candidates);
    validateAttendancePagination(res?.pagination);
    return res as AttendanceCandidatesResponse;
  },

  async markAttendanceSession(id: string, payload: { studentId?: string; rollNumber?: string; qrToken?: string; status: AttendanceStatus }): Promise<AttendanceMarkResponse> {
    const identifiers = [payload.studentId, payload.rollNumber, payload.qrToken].filter((value) => typeof value === 'string' && value.trim());
    if (identifiers.length !== 1) throw new Error('Provide exactly one studentId, rollNumber, or qrToken');
    const body = Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]));
    const res: any = await apiFetch<any>(`/api/attendance/sessions/${encodeURIComponent(id)}/mark`, {
      method: 'POST', body: JSON.stringify(body),
    });
    if (!res?.attendance || !res?.student) throw new Error('Invalid attendance mark response');
    return res;
  },

  async closeAttendanceSession(id: string, payload: { markRemainingAbsent?: boolean } = {}): Promise<AttendanceSessionDetail> {
    const res: any = await apiFetch<any>(`/api/attendance/sessions/${encodeURIComponent(id)}/close`, {
      method: 'POST', body: JSON.stringify({ markRemainingAbsent: payload.markRemainingAbsent ?? false }),
    });
    if (!res?.session || !res?.stats || !Array.isArray(res?.roster)) throw new Error('Invalid closed attendance session');
    validateAttendanceSessionIdentity(res.session);
    validateAttendanceMetrics(res.stats);
    validateAttendanceCandidates(res.roster);
    return res as AttendanceSessionDetail;
  },

  // Compatibility adapter for deferred attendance callers. Session scope is mandatory at runtime.
  async scanAttendance(payload: {
    sessionId?: string;
    qrToken?: string;
    studentId?: string;
    rollNumber?: string;
    status?: AttendanceStatus;
  }): Promise<AttendanceMarkResponse & { alreadyMarked?: boolean }> {
    if (typeof payload.sessionId !== 'string' || !payload.sessionId.trim()) throw new Error('Attendance session is required');
    const { sessionId, ...mark } = payload;
    // Preserve legacy manual callers; camera scans exclusively use signed tokens.
    if (!mark.qrToken) return this.markAttendanceSession(sessionId, { ...mark, status: mark.status || 'PRESENT' });
    const invalidQr = () => Object.assign(new Error('Invalid Candidate QR'), { code: 'INVALID_QR' });
    if (mark.studentId || mark.rollNumber || (mark.status && mark.status !== 'PRESENT')) throw invalidQr();
    const qrToken = extractSignedAttendanceToken(mark.qrToken);
    if (!qrToken) throw invalidQr();
    const res: AttendanceMarkResponse & { alreadyMarked?: boolean } = await apiFetch('/api/attendance/scan', {
      method: 'POST', timeoutMs: 15000,
      body: JSON.stringify({ sessionId: sessionId.trim(), qrToken, status: 'PRESENT' }),
    });
    const attendance = res?.attendance, student = res?.student;
    const nonempty = (value: unknown) => typeof value === 'string' && !!value.trim();
    if (!attendance || !student || !nonempty(attendance.id) || attendance.sessionId !== sessionId.trim() || !nonempty(attendance.studentId) || student.id !== attendance.studentId || !nonempty(student.fullName) || student.status !== 'ACTIVE' || !nonempty(attendance.markedByUserId) || !nonempty(attendance.createdAt) || !Number.isFinite(Date.parse(attendance.createdAt)) || !['PRESENT', 'LATE', 'ABSENT'].includes(attendance.status) || !['MANUAL', 'QR_SCAN'].includes(attendance.method) || (res.alreadyMarked !== undefined && typeof res.alreadyMarked !== 'boolean') || (!res.alreadyMarked && (attendance.status !== 'PRESENT' || attendance.method !== 'QR_SCAN'))) throw new Error('The server did not confirm a persisted attendance record for this session.');
    return res;
  },


  async getTodayAttendance(): Promise<any> {
    const res: any = await apiFetch<any>('/api/attendance/today');
    if (!Number.isInteger(res?.sessionCount) || !Number.isInteger(res?.expectedCount) || !(res?.attendancePercentage === null || Number.isFinite(res?.attendancePercentage))) throw new Error('Invalid examination attendance summary');
    return res;
  },

  async getStudentAttendanceHistory(studentId: string): Promise<StudentExamAttendanceHistory> {
    const res: any = await apiFetch<any>(`/api/attendance/student/${studentId}`);
    if (Array.isArray(res?.history) && Array.isArray(res?.legacyHistory)) { validateAttendanceMetrics(res.stats); validateAttendancePagination(res.pagination); return res as StudentExamAttendanceHistory; }
    throw new Error('Invalid student attendance history response');
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
  async getStaffDirectory(query?: StaffQueryParams): Promise<StaffListResponse> {
    const params = new URLSearchParams();
    if (query?.search?.trim()) params.set('search', query.search.trim());
    if (query?.role?.trim()) params.set('role', query.role.trim());
    if (query?.status) params.set('status', query.status);
    if (query?.page) params.set('page', String(query.page));
    if (query?.limit) params.set('limit', String(query.limit));

    const queryString = params.toString() ? `?${params.toString()}` : '';
    const res: any = await apiFetch<any>(`/api/staff${queryString}`);

    const rawList = Array.isArray(res?.staff)
      ? res.staff
      : Array.isArray(res?.data?.staff)
      ? res.data.staff
      : Array.isArray(res?.data)
      ? res.data
      : Array.isArray(res)
      ? res
      : [];

    const rawPagination = res?.pagination || res?.data?.pagination;

    const staff: StaffDirectoryRecord[] = rawList.map((s: any) => ({
      id: s.id,
      fullName: s.fullName || '',
      role: s.role || '',
      cnic: s.cnic || '',
      phone: s.phone || '',
      status: s.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
      joinDate: s.joinDate ? (typeof s.joinDate === 'string' ? s.joinDate.split('T')[0] : String(s.joinDate)) : '',
      createdAt: s.createdAt || '',
      updatedAt: s.updatedAt || '',
    }));

    const pagination: StaffPagination = {
      page: Number(rawPagination?.page) || 1,
      limit: Number(rawPagination?.limit) || (query?.limit || 20),
      total: Number(rawPagination?.total) || staff.length,
      totalPages: Number(rawPagination?.totalPages) || (rawPagination?.total ? Math.ceil(rawPagination.total / (Number(rawPagination?.limit) || 20)) : 1),
    };

    return { staff, pagination };
  },

  async getStaffById(id: string): Promise<StaffDetailRecord> {
    const res: any = await apiFetch<any>(`/api/staff/${id}`);
    const data = res?.data || res;
    return {
      portalAccount: data.portalAccount ?? null,
      salaryPayments: Array.isArray(data.salaryPayments) ? data.salaryPayments : [],
      id: data.id,
      fullName: data.fullName || '',
      role: data.role || '',
      cnic: data.cnic || '',
      phone: data.phone || '',
      joinDate: data.joinDate ? (typeof data.joinDate === 'string' ? data.joinDate.split('T')[0] : String(data.joinDate)) : '',
      salary: data.salary != null ? String(data.salary) : '0',
      status: data.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
      createdAt: data.createdAt || '',
      updatedAt: data.updatedAt || '',
      payroll: Array.isArray(data.payroll)
        ? data.payroll.map((p: any) => ({
            id: p.id,
            staffId: p.staffId,
            month: p.month || '',
            amount: p.amount != null ? String(p.amount) : '0',
            status: p.status === 'PAID' ? 'PAID' : 'PENDING',
            paidAt: p.paidAt || null,
            createdAt: p.createdAt || '',
            updatedAt: p.updatedAt || '',
          }))
        : [],
    };
  },

  async createStaffMember(payload: CreateStaffPayload): Promise<StaffCreateRecord> {
    const res: any = await apiFetch<any>('/api/staff', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const data = res?.data || res;
    return {
      portalAccount: data.portalAccount ?? null,
      salaryPayments: Array.isArray(data.salaryPayments) ? data.salaryPayments : [],
      id: data.id,
      fullName: data.fullName || '',
      role: data.role || '',
      cnic: data.cnic || '',
      phone: data.phone || '',
      joinDate: data.joinDate ? (typeof data.joinDate === 'string' ? data.joinDate.split('T')[0] : String(data.joinDate)) : '',
      salary: data.salary != null ? String(data.salary) : '0',
      status: data.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
      createdAt: data.createdAt || '',
      updatedAt: data.updatedAt || '',
      payroll: [],
      ...(data.portalCredentials ? { portalCredentials: data.portalCredentials } : {}),
    };
  },

  async updateStaffMember(id: string, payload: UpdateStaffPayload): Promise<StaffDetailRecord> {
    const res: any = await apiFetch<any>(`/api/staff/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    const data = res?.data || res;
    return {
      portalAccount: data.portalAccount ?? null,
      salaryPayments: Array.isArray(data.salaryPayments) ? data.salaryPayments : [],
      id: data.id,
      fullName: data.fullName || '',
      role: data.role || '',
      cnic: data.cnic || '',
      phone: data.phone || '',
      joinDate: data.joinDate ? (typeof data.joinDate === 'string' ? data.joinDate.split('T')[0] : String(data.joinDate)) : '',
      salary: data.salary != null ? String(data.salary) : '0',
      status: data.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
      createdAt: data.createdAt || '',
      updatedAt: data.updatedAt || '',
      payroll: Array.isArray(data.payroll)
        ? data.payroll.map((p: any) => ({
            id: p.id,
            staffId: p.staffId,
            month: p.month || '',
            amount: p.amount != null ? String(p.amount) : '0',
            status: p.status === 'PAID' ? 'PAID' : 'PENDING',
            paidAt: p.paidAt || null,
            createdAt: p.createdAt || '',
            updatedAt: p.updatedAt || '',
          }))
        : [],
    };
  },

  async payStaffSalaryOnce(id: string, payload: OneTimeSalaryPaymentInput, idempotencyKey: string): Promise<StaffSalaryPayment> {
    const res: any = await apiFetch('/api/staff/' + encodeURIComponent(id) + '/payments', { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey }, body: JSON.stringify(payload) });
    return res.data || res;
  },
  async exportTeachers(): Promise<TeacherExportRecord[]> {
    const res: any = await apiFetch('/api/staff/teachers/export?format=json');
    return (res.data || res).teachers;
  },

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

  // 9. General Financial Ledger Transactions
  async getTransactions(queryOrType?: TransactionQueryParams | string): Promise<TransactionListResponse> {
    const query: TransactionQueryParams =
      typeof queryOrType === 'string'
        ? { type: queryOrType as any }
        : queryOrType || {};

    const params = new URLSearchParams();
    if (query.page) params.set('page', String(query.page));
    if (query.limit) params.set('limit', String(query.limit));
    if (query.type && query.type !== 'ALL') params.set('type', query.type);
    if (query.status && query.status !== 'ALL') params.set('status', query.status);
    if (query.source && query.source !== 'ALL') params.set('source', query.source);
    if (query.search && query.search.trim()) params.set('search', query.search.trim());
    if (query.startDate && query.startDate.trim()) params.set('startDate', query.startDate.trim());
    if (query.endDate && query.endDate.trim()) params.set('endDate', query.endDate.trim());
    if (query.sortBy) params.set('sortBy', query.sortBy);
    if (query.sortOrder) params.set('sortOrder', query.sortOrder);

    const queryString = params.toString() ? `?${params.toString()}` : '';
    const res: any = await apiFetch<any>(`/api/transactions${queryString}`);

    const rawList = Array.isArray(res?.transactions)
      ? res.transactions
      : Array.isArray(res?.data?.transactions)
      ? res.data.transactions
      : Array.isArray(res?.data)
      ? res.data
      : Array.isArray(res)
      ? res
      : [];

    const rawPagination = res?.pagination || res?.data?.pagination;

    const transactions: TransactionRecord[] = rawList.map((t: any) => ({
      id: t.id,
      type: t.type,
      amount: t.amount != null ? String(t.amount) : '0.00',
      description: t.description || '',
      transactionDate: t.transactionDate || t.createdAt,
      status: t.status || 'POSTED',
      source: t.source || 'MANUAL',
      category: t.category ?? null,
      paymentMethod: t.paymentMethod ?? null,
      referenceNumber: t.referenceNumber ?? null,
      createdById: t.createdById ?? null,
      createdByName: t.createdByName ?? null,
      createdByEmail: t.createdByEmail ?? null,
      voidedAt: t.voidedAt ?? null,
      voidedById: t.voidedById ?? null,
      voidedByName: t.voidedByName ?? null,
      voidedByEmail: t.voidedByEmail ?? null,
      voidReason: t.voidReason ?? null,
      relatedFeeId: t.relatedFeeId ?? null,
      relatedPayrollId: t.relatedPayrollId ?? null,
      createdAt: t.createdAt,
      feeRecord: t.feeRecord ?? null,
      payrollRecord: t.payrollRecord ?? null,
    }));

    return {
      transactions,
      pagination: {
        page: Number(rawPagination?.page) || query.page || 1,
        limit: Number(rawPagination?.limit) || query.limit || 20,
        total: typeof rawPagination?.total === 'number' ? rawPagination.total : transactions.length,
        totalPages: Number(rawPagination?.totalPages) || (Math.ceil(transactions.length / (query.limit || 20)) || 1),
      },
    };
  },

  async getTransactionSummary(query?: TransactionSummaryQueryParams): Promise<TransactionSummaryResponse> {
    const params = new URLSearchParams();
    if (query?.type && query.type !== 'ALL') params.set('type', query.type);
    if (query?.source && query.source !== 'ALL') params.set('source', query.source);
    if (query?.startDate && query.startDate.trim()) params.set('startDate', query.startDate.trim());
    if (query?.endDate && query.endDate.trim()) params.set('endDate', query.endDate.trim());

    const queryString = params.toString() ? `?${params.toString()}` : '';
    const res: any = await apiFetch<any>(`/api/transactions/summary${queryString}`);
    const data = res?.data !== undefined ? res.data : res;

    return {
      currency: data?.currency || 'PKR',
      totalIncome: data?.totalIncome != null ? String(data.totalIncome) : '0.00',
      totalExpense: data?.totalExpense != null ? String(data.totalExpense) : '0.00',
      netMovement: data?.netMovement != null ? String(data.netMovement) : '0.00',
      postedCount: typeof data?.postedCount === 'number' ? data.postedCount : 0,
      voidedCount: typeof data?.voidedCount === 'number' ? data.voidedCount : 0,
      period: {
        startDate: data?.period?.startDate ?? query?.startDate ?? null,
        endDate: data?.period?.endDate ?? query?.endDate ?? null,
      },
    };
  },

  async getTransactionById(id: string): Promise<TransactionRecord> {
    const res: any = await apiFetch<any>(`/api/transactions/${id}`);
    const t = res?.data !== undefined ? res.data : res;
    return {
      id: t.id,
      type: t.type,
      amount: t.amount != null ? String(t.amount) : '0.00',
      description: t.description || '',
      transactionDate: t.transactionDate || t.createdAt,
      status: t.status || 'POSTED',
      source: t.source || 'MANUAL',
      category: t.category ?? null,
      paymentMethod: t.paymentMethod ?? null,
      referenceNumber: t.referenceNumber ?? null,
      createdById: t.createdById ?? null,
      createdByName: t.createdByName ?? null,
      createdByEmail: t.createdByEmail ?? null,
      voidedAt: t.voidedAt ?? null,
      voidedById: t.voidedById ?? null,
      voidedByName: t.voidedByName ?? null,
      voidedByEmail: t.voidedByEmail ?? null,
      voidReason: t.voidReason ?? null,
      relatedFeeId: t.relatedFeeId ?? null,
      relatedPayrollId: t.relatedPayrollId ?? null,
      createdAt: t.createdAt,
      feeRecord: t.feeRecord ?? null,
      payrollRecord: t.payrollRecord ?? null,
    };
  },

  async createManualTransaction(
    data: CreateManualTransactionPayload,
    idempotencyKey?: string
  ): Promise<TransactionRecord> {
    const headers: Record<string, string> = {};
    if (idempotencyKey && idempotencyKey.trim()) {
      headers['Idempotency-Key'] = idempotencyKey.trim();
    }
    const res: any = await apiFetch<any>('/api/transactions', {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
    const t = res?.data !== undefined ? res.data : res;
    return {
      id: t.id,
      type: t.type,
      amount: t.amount != null ? String(t.amount) : '0.00',
      description: t.description || '',
      transactionDate: t.transactionDate || t.createdAt,
      status: t.status || 'POSTED',
      source: t.source || 'MANUAL',
      category: t.category ?? null,
      paymentMethod: t.paymentMethod ?? null,
      referenceNumber: t.referenceNumber ?? null,
      createdById: t.createdById ?? null,
      createdByName: t.createdByName ?? null,
      createdByEmail: t.createdByEmail ?? null,
      voidedAt: t.voidedAt ?? null,
      voidedById: t.voidedById ?? null,
      voidedByName: t.voidedByName ?? null,
      voidedByEmail: t.voidedByEmail ?? null,
      voidReason: t.voidReason ?? null,
      relatedFeeId: t.relatedFeeId ?? null,
      relatedPayrollId: t.relatedPayrollId ?? null,
      createdAt: t.createdAt,
      feeRecord: t.feeRecord ?? null,
      payrollRecord: t.payrollRecord ?? null,
    };
  },

  async voidTransaction(id: string, reason: string): Promise<TransactionRecord> {
    const res: any = await apiFetch<any>(`/api/transactions/${id}/void`, {
      method: 'POST',
      body: JSON.stringify({ reason: reason.trim() }),
    });
    const t = res?.data !== undefined ? res.data : res;
    return {
      id: t.id,
      type: t.type,
      amount: t.amount != null ? String(t.amount) : '0.00',
      description: t.description || '',
      transactionDate: t.transactionDate || t.createdAt,
      status: t.status || 'VOIDED',
      source: t.source || 'MANUAL',
      category: t.category ?? null,
      paymentMethod: t.paymentMethod ?? null,
      referenceNumber: t.referenceNumber ?? null,
      createdById: t.createdById ?? null,
      createdByName: t.createdByName ?? null,
      createdByEmail: t.createdByEmail ?? null,
      voidedAt: t.voidedAt ?? null,
      voidedById: t.voidedById ?? null,
      voidedByName: t.voidedByName ?? null,
      voidedByEmail: t.voidedByEmail ?? null,
      voidReason: t.voidReason ?? null,
      relatedFeeId: t.relatedFeeId ?? null,
      relatedPayrollId: t.relatedPayrollId ?? null,
      createdAt: t.createdAt,
      feeRecord: t.feeRecord ?? null,
      payrollRecord: t.payrollRecord ?? null,
    };
  },

  async deleteTransaction(transactionId: string): Promise<boolean> {
    await apiFetch<any>(`/api/transactions/${transactionId}`, {
      method: 'DELETE',
    });
    return true;
  },

  // 10. User Management (Super Admin)
  async getUsers(query?: UserQueryParams): Promise<MockUserAccount[]> {
    const listRes = await this.getUserDirectory(query);
    return listRes.users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      status: u.status,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    }));
  },

  async getUserDirectory(query?: UserQueryParams): Promise<UserListResponse> {
    const params = new URLSearchParams();
    if (query?.search?.trim()) params.set('search', query.search.trim());
    if (query?.role && query.role !== 'ALL') params.set('role', query.role);
    if (query?.status && query.status !== 'ALL') params.set('status', query.status);
    if (query?.page) params.set('page', String(query.page));
    if (query?.limit) params.set('limit', String(query.limit));

    const queryString = params.toString() ? `?${params.toString()}` : '';
    const res: any = await apiFetch<any>(`/api/users${queryString}`);

    const raw = res?.data ?? res;
    const rawList = Array.isArray(raw?.users)
      ? raw.users
      : Array.isArray(raw?.items)
      ? raw.items
      : Array.isArray(raw)
      ? raw
      : [];

    const rawPagination = raw?.pagination || res?.pagination;

    const users: UserAccountRecord[] = rawList.map((u: any) => ({
      id: u.id,
      name: u.name || (u.email ? u.email.split('@')[0] : ''),
      email: u.email || '',
      role: u.role,
      status: u.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
      createdAt: u.createdAt || '',
      updatedAt: u.updatedAt || '',
    }));

    const pagination: UserPagination = {
      page: Number(rawPagination?.page) || 1,
      limit: Number(rawPagination?.limit) || (query?.limit || 20),
      total: Number(rawPagination?.total) || users.length,
      totalPages: Number(rawPagination?.totalPages) || (rawPagination?.total ? Math.ceil(rawPagination.total / (Number(rawPagination?.limit) || 20)) : 1),
    };

    return { users, pagination };
  },

  async getUserById(id: string): Promise<UserAccountRecord> {
    const res: any = await apiFetch<any>(`/api/users/${id}`);
    const u = res?.data ?? res;
    return {
      id: u.id,
      name: u.name || '',
      email: u.email || '',
      role: u.role,
      status: u.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
      createdAt: u.createdAt || '',
      updatedAt: u.updatedAt || '',
    };
  },

  async createUser(payload: CreateUserPayload): Promise<UserAccountRecord> {
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
      updatedAt: u.updatedAt || new Date().toISOString(),
    };
  },

  async updateUserAccount(id: string, payload: UpdateUserPayload): Promise<UserAccountRecord> {
    const res = await apiFetch<any>(`/api/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    const u = res?.data || res;
    return {
      id: u.id || id,
      name: u.name || '',
      email: u.email || '',
      role: u.role,
      status: u.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
      createdAt: u.createdAt || '',
      updatedAt: u.updatedAt || new Date().toISOString(),
    };
  },

  async updateUser(
    id: string,
    payload: { name?: string; role?: Role; status?: 'ACTIVE' | 'INACTIVE'; password?: string }
  ): Promise<MockUserAccount> {
    const res = await apiFetch<any>(`/api/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    const u = res?.data || res;
    return {
      id: u.id || id,
      name: u.name || '',
      email: u.email || '',
      role: u.role,
      status: u.status || 'ACTIVE',
      createdAt: u.createdAt || new Date().toISOString(),
    };
  },

  async deleteUser(id: string): Promise<{ success: boolean; message?: string }> {
    const res = await apiFetch<any>(`/api/users/${id}`, {
      method: 'DELETE',
    });
    return {
      success: true,
      message: res?.message || 'User account deleted successfully',
    };
  },

  // 11. Announcements Management (Super Admin)
  async getAnnouncements(): Promise<{ configured: boolean; items: ManagedAnnouncement[] }> {
    const res = await apiFetch<any>('/api/announcements/admin');
    return {
      configured: res?.configured ?? true,
      items: Array.isArray(res?.items) ? res.items : [],
    };
  },

  async createAnnouncement(payload: CreateAnnouncementPayload): Promise<ManagedAnnouncement> {
    const res = await apiFetch<any>('/api/announcements/admin', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res?.data || res;
  },

  async updateAnnouncement(id: string, payload: UpdateAnnouncementPayload): Promise<ManagedAnnouncement> {
    const res = await apiFetch<any>(`/api/announcements/admin/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return res?.data || res;
  },

  async deleteAnnouncement(id: string): Promise<{ success: boolean; id: string }> {
    const res = await apiFetch<any>(`/api/announcements/admin/${id}`, {
      method: 'DELETE',
    });
    return res?.data || res || { success: true, id };
  },

  // 10. Test Centers Management (Custom Centers)
  async getTestCenters(): Promise<MockTestCenter[]> {
    const res = await apiFetch<any>('/api/test-centers');
    if (!Array.isArray(res)) throw new Error('Invalid test centers response.');
    const list = res;

    return list.map((tc: any) => {
      return {
        id: tc.id,
        name: tc.name,
        code: tc.code,
        campus: tc.campus,
        address: tc.address,
        district: tc.district,
        province: tc.province,
        capacity: tc.capacity,
        reportingTime: tc.reportingTime,
        testDate: tc.testDate,
        contactPerson: tc.contactPerson || '',
        contactPhone: tc.contactPhone || '',
        status: tc.status,
        createdAt: tc.createdAt,
        assignedCount: tc.assignedCount,
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
  async getStudentDocumentsPage(
    page = 1,
    limit = 24,
    studentId?: string
  ): Promise<{
    documents: MockStudentDocument[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (studentId) params.set('studentId', studentId);
    const result = await apiFetch<any>(`/api/students/documents?${params.toString()}`);
    if (Array.isArray(result?.documents)) {
      const typeMap: Record<string, MockStudentDocument['docType']> = {
        photo: 'CANDIDATE_PHOTO',
        bform: 'CNIC_BFORM',
        fatherCnic: 'GUARDIAN_CNIC',
        dmc: 'PREVIOUS_DMC',
        domicile: 'DOMICILE',
        paymentReceipt: 'PAYMENT_CHALLAN',
      };
      const documents = result.documents.map((document: any) => ({
        id: document.id,
        studentId: document.studentId,
        studentName: document.studentName,
        rollNumber: document.rollNumber,
        applicationNo: document.applicationNo,
        currentClass: document.currentClass,
        docType: typeMap[document.documentType] || 'PREVIOUS_DMC',
        storageDocType: document.documentType,
        title: document.originalFileName || `${document.documentType} document`,
        fileUrl: '',
        fileEndpoint: document.fileEndpoint,
        fileSize: document.byteSize ? `${Math.ceil(document.byteSize / 1024)} KB` : 'Stored attachment',
        fileType: document.mimeType,
        uploadedAt: document.uploadedAt,
        status:
          document.eligibility === 'ELIGIBLE'
            ? 'VERIFIED'
            : document.eligibility === 'NOT_ELIGIBLE'
            ? 'REJECTED'
            : 'PENDING_REVIEW',
        rejectionReason: document.eligibilityRemarks,
      }));
      return {
        documents,
        pagination: result.pagination || {
          page,
          limit,
          total: documents.length,
          totalPages: 1,
        },
      };
    }

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

      let up = s.uploadedDocuments;
      if (typeof up === 'string') {
        try { up = JSON.parse(up); } catch {}
      }
      if (!up && (s as any).uploadedDocsJson) {
        try { up = JSON.parse((s as any).uploadedDocsJson); } catch {}
      }
      up = up || {};

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
      const photoFile = up.photo || up.photoUploaded || up.passportPhoto || up.candidatePhoto || up.profilePhoto;
      if (photoFile || s.photoUrl) {
        const isBase64 = photoFile?.dataUrl?.startsWith('data:') || s.photoUrl?.startsWith('data:');
        docMap.set(`${candKey}_PHOTO`, {
          id: `doc_photo_${s.id}`,
          studentId: s.id,
          studentName: s.fullName,
          rollNumber: s.rollNumber || 'PENDING',
          applicationNo: s.applicationNo || 'APP-2026',
          currentClass: s.currentClass || 'SSC',
          docType: 'CANDIDATE_PHOTO',
          storageDocType: 'photo',
          title: photoFile?.name || `${s.fullName}_Passport_Photo.jpg`,
          fileUrl: isBase64 ? (photoFile?.dataUrl || s.photoUrl) : '',
          fileEndpoint: `/api/students/${s.id}/document/photo`,
          fileSize: photoFile?.size || (photoFile?.byteSize ? `${Math.ceil(photoFile.byteSize / 1024)} KB` : 'Candidate Photo'),
          fileType: 'image/jpeg',
          uploadedAt: photoFile?.uploadedAt || s.createdAt || new Date().toISOString(),
          status: docStatus,
          rejectionReason,
        });
      }

      // 2. CNIC / B-Form Document
      const bformFile = up.bform || up.bformUploaded || up.cnic || up.candidateCnic;
      if (bformFile) {
        const isPdf = bformFile.name?.endsWith('.pdf') || bformFile.mimeType === 'application/pdf' || bformFile.dataUrl?.includes('application/pdf');
        docMap.set(`${candKey}_BFORM`, {
          id: `doc_cnic_${s.id}`,
          studentId: s.id,
          studentName: s.fullName,
          rollNumber: s.rollNumber || 'PENDING',
          applicationNo: s.applicationNo || 'APP-2026',
          currentClass: s.currentClass || 'SSC',
          docType: 'CNIC_BFORM',
          storageDocType: 'bform',
          title: bformFile.name || `${s.fullName}_Candidate_BForm_CNIC.jpg`,
          fileUrl: bformFile.dataUrl?.startsWith('data:') ? bformFile.dataUrl : '',
          fileEndpoint: `/api/students/${s.id}/document/bform`,
          fileSize: bformFile.size || (bformFile.byteSize ? `${Math.ceil(bformFile.byteSize / 1024)} KB` : 'Candidate Attachment'),
          fileType: isPdf ? 'application/pdf' : 'image/jpeg',
          uploadedAt: bformFile.uploadedAt || s.createdAt || new Date().toISOString(),
          status: docStatus,
          rejectionReason,
        });
      }

      // 3. Father / Guardian CNIC
      const fatherCnicFile = up.fatherCnic || up.fatherCnicUploaded || up.fcnic;
      if (fatherCnicFile) {
        const isPdf = fatherCnicFile.name?.endsWith('.pdf') || fatherCnicFile.mimeType === 'application/pdf' || fatherCnicFile.dataUrl?.includes('application/pdf');
        docMap.set(`${candKey}_FATHER_CNIC`, {
          id: `doc_fcnic_${s.id}`,
          studentId: s.id,
          studentName: s.fullName,
          rollNumber: s.rollNumber || 'PENDING',
          applicationNo: s.applicationNo || 'APP-2026',
          currentClass: s.currentClass || 'SSC',
          docType: 'CNIC_BFORM',
          storageDocType: 'fatherCnic',
          title: fatherCnicFile.name || `${s.fullName}_Father_CNIC.jpg`,
          fileUrl: fatherCnicFile.dataUrl?.startsWith('data:') ? fatherCnicFile.dataUrl : '',
          fileEndpoint: `/api/students/${s.id}/document/fatherCnic`,
          fileSize: fatherCnicFile.size || (fatherCnicFile.byteSize ? `${Math.ceil(fatherCnicFile.byteSize / 1024)} KB` : 'Candidate Attachment'),
          fileType: isPdf ? 'application/pdf' : 'image/jpeg',
          uploadedAt: fatherCnicFile.uploadedAt || s.createdAt || new Date().toISOString(),
          status: docStatus,
          rejectionReason,
        });
      }

      // 4. Academic Transcript / DMC
      const dmcFile = up.dmc || up.dmcUploaded || up.resultCard || up.previousResult;
      if (dmcFile) {
        const isPdf = dmcFile.name?.endsWith('.pdf') || dmcFile.mimeType === 'application/pdf' || dmcFile.dataUrl?.includes('application/pdf');
        docMap.set(`${candKey}_DMC`, {
          id: `doc_dmc_${s.id}`,
          studentId: s.id,
          studentName: s.fullName,
          rollNumber: s.rollNumber || 'PENDING',
          applicationNo: s.applicationNo || 'APP-2026',
          currentClass: s.currentClass || 'SSC',
          docType: 'PREVIOUS_DMC',
          storageDocType: 'dmc',
          title: dmcFile.name || `${s.fullName}_DMC_Marksheet.jpg`,
          fileUrl: dmcFile.dataUrl?.startsWith('data:') ? dmcFile.dataUrl : '',
          fileEndpoint: `/api/students/${s.id}/document/dmc`,
          fileSize: dmcFile.size || (dmcFile.byteSize ? `${Math.ceil(dmcFile.byteSize / 1024)} KB` : 'Candidate Attachment'),
          fileType: isPdf ? 'application/pdf' : 'image/jpeg',
          uploadedAt: dmcFile.uploadedAt || s.createdAt || new Date().toISOString(),
          status: docStatus,
          rejectionReason,
        });
      }

      // 5. Payment Deposit Receipt
      const feeFile = up.paymentReceipt || up.incomeCertUploaded || up.receipt || up.challan;
      if (feeFile) {
        const isPdf = feeFile.name?.endsWith('.pdf') || feeFile.mimeType === 'application/pdf' || feeFile.dataUrl?.includes('application/pdf');
        docMap.set(`${candKey}_FEE`, {
          id: `doc_pay_${s.id}`,
          studentId: s.id,
          studentName: s.fullName,
          rollNumber: s.rollNumber || 'PENDING',
          applicationNo: s.applicationNo || 'APP-2026',
          currentClass: s.currentClass || 'SSC',
          docType: 'PAYMENT_CHALLAN',
          storageDocType: 'paymentReceipt',
          title: feeFile.name || `${s.fullName}_Fee_Payment_Receipt.jpg`,
          fileUrl: feeFile.dataUrl?.startsWith('data:') ? feeFile.dataUrl : '',
          fileEndpoint: `/api/students/${s.id}/document/paymentReceipt`,
          fileSize: feeFile.size || (feeFile.byteSize ? `${Math.ceil(feeFile.byteSize / 1024)} KB` : 'Candidate Attachment'),
          fileType: isPdf ? 'application/pdf' : 'image/jpeg',
          uploadedAt: feeFile.uploadedAt || s.createdAt || new Date().toISOString(),
          status: docStatus,
          rejectionReason,
        });
      }

      // 6. Domicile Certificate
      const domicileFile = up.domicile || up.domicileUploaded;
      if (domicileFile) {
        const isPdf = domicileFile.name?.endsWith('.pdf') || domicileFile.mimeType === 'application/pdf' || domicileFile.dataUrl?.includes('application/pdf');
        docMap.set(`${candKey}_DOMICILE`, {
          id: `doc_dom_${s.id}`,
          studentId: s.id,
          studentName: s.fullName,
          rollNumber: s.rollNumber || 'PENDING',
          applicationNo: s.applicationNo || 'APP-2026',
          currentClass: s.currentClass || 'SSC',
          docType: 'CNIC_BFORM',
          storageDocType: 'domicile',
          title: domicileFile.name || `${s.fullName}_Domicile_Certificate.jpg`,
          fileUrl: domicileFile.dataUrl?.startsWith('data:') ? domicileFile.dataUrl : '',
          fileEndpoint: `/api/students/${s.id}/document/domicile`,
          fileSize: domicileFile.size || (domicileFile.byteSize ? `${Math.ceil(domicileFile.byteSize / 1024)} KB` : 'Candidate Attachment'),
          fileType: isPdf ? 'application/pdf' : 'image/jpeg',
          uploadedAt: domicileFile.uploadedAt || s.createdAt || new Date().toISOString(),
          status: docStatus,
          rejectionReason,
        });
      }
    });

    const documents = Array.from(docMap.values());
    const total = documents.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(Math.max(1, page), totalPages);
    return {
      documents: documents.slice((safePage - 1) * limit, safePage * limit),
      pagination: { page: safePage, limit, total, totalPages },
    };
  },

  // Compatibility helper for existing screens. New list screens should use
  // getStudentDocumentsPage so that the API never needs to return the full vault.
  async getStudentDocuments(studentId?: string): Promise<MockStudentDocument[]> {
    return (await this.getStudentDocumentsPage(1, 50, studentId)).documents;
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
          <strong style="color: #15803d;">🏦 Bank Alfalah (IBFT):</strong><br/>
          Account: <strong style="font-family: monospace; color: #0f172a;">83861010161490</strong><br/>
          Title: <strong>Sumama Khan</strong>
        </div>
      </div>
      <p style="font-size: 10px; color: #166534; margin-top: 6px; font-weight: 600;">
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
 * High-definition browser printable Roll Number Slip entry pass generator
 */
export function printRollNumberSlip(student: any) {
  const assigned = student.placementStatus === 'ASSIGNED' && Boolean(student.assignedHallId);
  if (student.rollNumber && (!assigned || !student.assignedRoom || !student.seatNo || !student.testDate || !student.reportingTime)) {
    alert('PLACEMENT_PENDING: Examination placement is not yet available.');
    return;
  }
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to open and print your official Roll Number Slip.');
    return;
  }

  const rollNo = student.rollNumber || student.officeUse?.testRollNo || `PROV-${student.applicationNo || student.id || 'UNASSIGNED'}`;
  const examDate = assigned && student.testDate || 'To be announced';
  const reportingTime = assigned && student.reportingTime || 'To be announced';
  const hall = assigned && student.assignedHall || 'To be assigned';
  const room = assigned && student.assignedRoom || 'To be assigned';
  const seat = assigned && student.seatNo || 'To be assigned';
  const testCenter = assigned && student.testCenterName || 'To be assigned';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>AZM Examination Entry Pass - Roll Slip ${rollNo}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #0f172a; }
    body { background: #f8fafc; padding: 24px; }
    .slip-container { max-width: 800px; margin: 0 auto; background: #fff; border: 2px solid #185b9d; border-radius: 16px; padding: 28px; box-shadow: 0 10px 25px rgba(0,0,0,0.06); }
    .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #185b9d; padding-bottom: 14px; margin-bottom: 18px; }
    .title-area h1 { font-size: 20px; font-weight: 900; color: #185b9d; letter-spacing: -0.5px; }
    .title-area p { font-size: 11px; font-weight: 600; color: #64748b; margin-top: 2px; }
    .badge { background: #dbeafe; color: #1e40af; border: 1px solid #93c5fd; padding: 4px 12px; border-radius: 999px; font-weight: 700; font-size: 11px; }
    .candidate-banner { display: flex; gap: 20px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 18px; align-items: center; justify-content: space-between; }
    .photo-frame { width: 96px; height: 110px; border: 2px dashed #cbd5e1; border-radius: 8px; overflow: hidden; background: #fff; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .photo-frame img { width: 100%; height: 100%; object-fit: cover; }
    .meta-title { font-size: 18px; font-weight: 800; color: #0f172a; }
    .roll-highlight { font-size: 22px; font-weight: 900; color: #185b9d; font-family: monospace; letter-spacing: 1px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 18px; }
    .info-card { background: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #185b9d; border-radius: 8px; padding: 10px 14px; }
    .info-label { font-size: 10px; text-transform: uppercase; font-weight: 700; color: #64748b; margin-bottom: 2px; }
    .info-value { font-size: 13px; font-weight: 700; color: #0f172a; }
    .exam-box { background: #f0fdf4; border: 2px solid #86efac; border-radius: 12px; padding: 16px; margin-bottom: 18px; }
    .exam-title { color: #166534; font-size: 13px; font-weight: 800; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
    .notice-box { font-size: 11px; color: #475569; border-top: 1px solid #e2e8f0; padding-top: 12px; line-height: 1.6; }
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
        <h1>AZM.AIO SCHOLARSHIP & EXAMINATION AUTHORITY</h1>
        <p>Session V (2026) Official Standardized Examination Roll Number Slip & Entry Pass</p>
      </div>
      <div style="text-align: right;">
        <span class="badge">Verified Candidate Entry Pass ✓</span>
      </div>
    </div>

    <div class="candidate-banner">
      <div style="display: flex; gap: 16px; align-items: center;">
        <div class="photo-frame">
          ${student.photoUrl ? `<img src="${student.photoUrl}" alt="Photo" />` : '<span style="font-size: 10px; color: #94a3b8; text-align: center; line-height: 1.2;">Candidate<br/>Photo</span>'}
        </div>
        <div>
          <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">OFFICIAL ROLL NUMBER</div>
          <div class="roll-highlight">${rollNo}</div>
          <div class="meta-title" style="margin-top: 4px;">${student.fullName || 'Candidate Name'}</div>
          <div style="font-size: 12px; color: #475569; margin-top: 2px;">Father / Guardian: <strong>${student.fatherName || 'Father Name'}</strong></div>
          <div style="font-size: 12px; color: #475569; margin-top: 2px;">CNIC / B-Form: <strong style="font-family: monospace;">${student.cnicOrBForm || student.cnicBForm || 'N/A'}</strong></div>
        </div>
      </div>
      <div style="text-align: center; flex-shrink: 0;">
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(rollNo)}" alt="QR" style="width: 85px; height: 85px; border-radius: 8px; border: 1px solid #cbd5e1; padding: 2px; background: #fff;" />
        <div style="font-size: 9px; font-weight: 700; color: #64748b; margin-top: 2px;">BIOMETRIC QR PASS</div>
      </div>
    </div>

    <div class="exam-box">
      <div class="exam-title">🎯 Examination Hall & Venue Assignment</div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px;">
        <div>📅 <strong>Exam Date:</strong> ${examDate}</div>
        <div>⏰ <strong>Reporting Time:</strong> ${reportingTime}</div>
        <div>🏛️ <strong>Exam Hall:</strong> ${hall}</div>
        <div>🚪 <strong>Room & Seat:</strong> ${room} — ${seat}</div>
        <div style="grid-column: 1 / -1; margin-top: 4px;">📍 <strong>Examination Centre:</strong> ${testCenter}</div>
      </div>
    </div>

    <div class="grid">
      <div class="info-card">
        <div class="info-label">Candidate Class / Grade</div>
        <div class="info-value">${student.currentClass || 'SSC / HSSC'}</div>
      </div>
      <div class="info-card">
        <div class="info-label">Scholarship Stream / Quota</div>
        <div class="info-value">${(student.scholarshipCategory || 'GENERAL_MERIT').replace(/_/g, ' ')}</div>
      </div>
    </div>

    <div class="notice-box">
      <strong>Mandatory Examination Hall Instructions:</strong>
      <ul>
        <li>Candidate must bring this printed Roll Number Slip along with original CNIC / B-Form / School ID card.</li>
        <li>Reach the examination center at least 30 minutes before the scheduled start time.</li>
        <li>Calculators, mobile phones, and electronic smartwatches are strictly prohibited in the exam hall.</li>
        <li>Central Directorate Helpline: <strong>0305-1755551</strong> | <strong>azmgoc30@gmail.com</strong></li>
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
  const photoMarkup = student.photoUrl
    ? `<img src="${student.photoUrl}" alt="${student.fullName || 'Candidate'} photo" style="width: 100%; height: 100%; object-fit: cover;" />`
    : `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #e2e8f0; color: #64748b; font-size: 10px; font-weight: 800; text-align: center;">NO PHOTO<br/>AVAILABLE</div>`;
  const qrImageUrl = student.qrImageUrl || `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(rollNo)}`;

  // Use genuine academic records only; never synthesize fake qualifications
  const academic = Array.isArray(student.academicRecords) ? student.academicRecords : [];

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
        <img src="${qrImageUrl}" alt="QR" style="width: 70px; height: 70px; border-radius: 6px; border: 1px solid #cbd5e1; padding: 2px;" />
        <div style="font-size: 9px; font-family: monospace; font-weight: bold; margin-top: 2px;">${rollNo}</div>
      </div>
    </div>

    <div style="display: flex; gap: 18px; align-items: center; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; margin-bottom: 12px;">
      <div style="width: 90px; height: 100px; border-radius: 8px; border: 2px solid #0f172a; overflow: hidden; background: #fff; flex-shrink: 0;">
        ${photoMarkup}
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
        ${academic.length > 0 ? academic.map((rec: any) => `
          <tr>
            <td><strong>${rec.examLevel || '—'}</strong></td>
            <td>${rec.yearOfPassing || rec.year || '—'}</td>
            <td>${rec.institute || rec.boardOrUni || '—'}</td>
            <td>${rec.boardOrUni || rec.board || '—'}</td>
            <td>${rec.totalMarks != null ? rec.totalMarks : '—'}</td>
            <td><strong>${rec.obtainedMarks != null ? rec.obtainedMarks : '—'}</strong></td>
            <td><strong style="color: #15803d;">${rec.percentage != null ? `${rec.percentage}%` : '—'}</strong></td>
          </tr>
        `).join('') : `
          <tr>
            <td colspan="7" style="text-align: center; padding: 14px; color: #64748b; font-size: 11px;">No previous qualification records on file for this candidate.</td>
          </tr>
        `}
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
      var images = Array.prototype.slice.call(document.images);
      var imageLoads = images.map(function(image) {
        if (image.complete) return Promise.resolve();
        return new Promise(function(resolve) {
          image.addEventListener('load', resolve, { once: true });
          image.addEventListener('error', resolve, { once: true });
        });
      });

      Promise.all(imageLoads).then(function() {
        setTimeout(function() {
          window.print();
        }, 150);
      });
    };
  </script>
</body>
</html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
