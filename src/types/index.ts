export type PageTab = 
  | 'home'
  | 'about'
  | 'scholarship'
  | 'apply'
  | 'roll-number'
  | 'results'
  | 'partners'
  | 'gallery'
  | 'contact';

export interface MonthlyAssistanceRate {
  classLevel: string;
  name: string;
  monthlyAmount: number;
  annualAmount: number;
  periodLabel: string;
  iconName: string;
  notes?: string;
}

export interface BeneficiaryCategory {
  id: string;
  code: string;
  title: string;
  seats: number;
  headline: string;
  description: string;
  rewards: string[];
  eligibility: string;
  tagColor: string;
  badge: string;
}

export interface ExamSection {
  subject: string;
  questionsCount: number;
  marks: number;
  weightPercentage: number;
  topics: string[];
  icon: string;
}

export interface CalendarEvent {
  id: string;
  date: string;
  displayDate: string;
  title: string;
  description: string;
  status: 'upcoming' | 'active' | 'completed';
  badge?: string;
}

export interface StudentApplicationData {
  id: string;
  submissionDate: string;
  status: 'draft' | 'submitted' | 'under_review' | 'verified';
  // Stage 1: Personal
  fullName: string;
  fatherName: string;
  gender: 'male' | 'female' | 'other';
  dob: string;
  age: string;
  cnicBForm: string;
  photoUrl: string;
  // Stage 2: Contact
  permanentAddress: string;
  district: string;
  province: string;
  mobile: string;
  whatsapp: string;
  email: string;
  // Stage 3: Education
  currentClass: string;
  discipline?: string;
  schoolName: string;
  boardUniversity: string;
  currentRollNo: string;
  // Stage 4: Scholarship Category
  appliedCategory: string;
  isSpecialNeed: boolean;
  specialNeedDetails?: string;
  // Stage 5: Family & Financial
  guardianOccupation: string;
  monthlyHouseholdIncome: number;
  dependentsCount: number;
  emergencyContact: string;
  // Stage 6: Academic History
  academicRecords: {
    gradeClass: string;
    passingYear: string;
    totalMarks: number;
    obtainedMarks: number;
    percentage: number;
    institute: string;
  }[];
  // Stage 7: Documents
  documents: {
    bformUploaded: boolean;
    fatherCnicUploaded: boolean;
    dmcUploaded: boolean;
    domicileUploaded: boolean;
    incomeCertUploaded: boolean;
  };
  // Stage 8: Declaration
  declarationAccepted: boolean;
  signatureDataUrl?: string;
}

export interface PartnerSchoolData {
  id: string;
  institutionName: string;
  category: 'School' | 'College' | 'Higher Secondary' | 'University/Degree College';
  campus: string;
  address: string;
  district: string;
  contactPerson: string;
  designation: string;
  whatsapp: string;
  email: string;
  totalStudentStrength: number;
  expectedApplicants: number;
  stampUploaded: boolean;
  isRegistrationHub?: boolean;
}

export interface RollNumberSlip {
  rollNo: string;
  applicationId: string;
  candidateName: string;
  fatherName: string;
  cnicBForm: string;
  classLevel: string;
  candidatePhoto: string;
  testCenter: string;
  centerAddress: string;
  examDate: string;
  reportingTime: string;
  examStartTime: string;
  roomNo: string;
  seatIndex: string;
  securityHash: string;
  qrPayload: string;
  barcode: string;
  specialInstructions: string[];
}

export interface ResultCard {
  rollNo: string;
  candidateName: string;
  fatherName: string;
  cnicBForm: string;
  classLevel: string;
  testCenter: string;
  totalMarks: number;
  obtainedScore: number;
  percentage: number;
  percentileRank: number;
  overallRank: number;
  category: string;
  status: 'QUALIFIED FOR INTERVIEW' | 'PARTICIPATION CONFIRMED' | 'RECOMMENDED FOR AWARD';
  interviewDate?: string;
  interviewVenue?: string;
  reportingSlot?: string;
  subjectScores: {
    subject: string;
    total: number;
    obtained: number;
    accuracy: number;
  }[];
}

export interface PublicMeritEntry {
  rank: number;
  rollNo: string;
  candidateName: string;
  fatherNameInitial: string;
  maskedCnic: string;
  classLevel: string;
  district: string;
  testScore: number;
  category: string;
  status: string;
}

export interface QuestionBankItem {
  id: number;
  classLevel: string;
  subject: string;
  question: string;
  options: [string, string, string, string];
  correctIndex: number;
  explanation: string;
}

export interface GrievanceTicket {
  ticketId: string;
  name: string;
  email: string;
  phone: string;
  cnicOrRollNo: string;
  subject: string;
  category: 'Roll Number Slip' | 'Registration Correction' | 'Result Inquiry' | 'Payment/Fee' | 'General Query';
  message: string;
  timestamp: string;
  status: 'Open' | 'Under Review' | 'Resolved';
}

export type AlertType = 'urgent' | 'registration' | 'exam' | 'info';

export interface AlertItem {
  id: string;
  title: string;
  subtitle?: string;
  message: string;
  type: AlertType;
  badge: string;
  date: string;
  actionText?: string;
  actionTab?: PageTab;
  isPinned?: boolean;
  deadlineDate?: string;
}

export interface GalleryItem {
  id: string;
  title: string;
  session: string;
  category: string;
  image: string;
  description: string;
}

