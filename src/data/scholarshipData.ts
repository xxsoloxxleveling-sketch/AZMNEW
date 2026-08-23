import {
  MonthlyAssistanceRate,
  BeneficiaryCategory,
  ExamSection,
  CalendarEvent,
  RollNumberSlip,
  ResultCard,
  PublicMeritEntry,
  PartnerSchoolData,
  QuestionBankItem,
  AlertItem,
  GalleryItem
} from '../types';


export const OFFICIAL_ALERTS: AlertItem[] = [
  {
    id: 'alert-1',
    title: 'Session V (2026) Online Test Registration Active',
    subtitle: '100% Free Entry • PKR 0 Registration Fee',
    message: 'Registrations are open for students from Class 6th to BS Level. Over 500 scholarship seats with PKR 5.2M+ in direct educational grants, Umrah tickets, laptops, and fee subsidies.',
    type: 'registration',
    badge: 'Registration Active',
    date: 'Deadline: 30 August 2026',
    actionText: 'Register for Test Now',
    actionTab: 'apply',
    isPinned: true,
    deadlineDate: '2026-08-30'
  },
  {
    id: 'alert-2',
    title: 'Standardized Question Bank Release (1,000 MCQs)',
    subtitle: 'Transparent Syllabus per Grade Level',
    message: 'Official Question Banks for Middle School, Matric, Intermediate, and BS programs will be published on September 1, 2026. 100% of exam questions are derived directly from these published banks.',
    type: 'exam',
    badge: 'Syllabus Release',
    date: '01 September 2026',
    actionText: 'View Exam Syllabus',
    actionTab: 'scholarship',
    isPinned: false
  },
  {
    id: 'alert-3',
    title: 'Digital Roll Number Slips & Exam Venues',
    subtitle: 'QR-Verified Examination Passes',
    message: 'Roll number slips with assigned test center allocations and reporting timings will be issued digitally on October 25, 2026. Keep your Application Tracking ID ready for fast retrieval.',
    type: 'info',
    badge: 'Upcoming Issuance',
    date: '25 October 2026',
    actionText: 'Roll Number Desk',
    actionTab: 'roll-number',
    isPinned: false
  },
  {
    id: 'alert-4',
    title: 'In-Person Registration Centres (Mansehra)',
    subtitle: '3 Physical Facilitation Hubs Open',
    message: 'Candidates and school principals can submit physical forms at Jadoon Public College Gandhian, Dubai International School Kashmir Road, or Khyber Public College Mansehra (Mon-Sat, 9 AM to 4 PM).',
    type: 'info',
    badge: 'Physical Hubs',
    date: 'Active Daily',
    actionText: 'View Hub Coordinates',
    actionTab: 'partners',
    isPinned: false
  }
];

export const OFFICIAL_DATA = {
  session: 'Session V (2026)',
  tagline: 'Empowering Potential. Inspiring Excellence.',
  urduQuote: 'صلاحیت کو موقعے، اور محنت کو پہچان',
  trustMandate: 'Independent, fair, and transparent: funded by AZM Group of Companies, not donations.',
  helpline: '0305-1755551',
  helplineHours: 'Mon to Sat, 9:00 AM to 5:00 PM',
  email: 'azmgoc30@gmail.com',
  headOffice: 'Jadoon Public High School & College, Gandhian, Mansehra, KP, Pakistan',
  registrationFee: 'PKR 0 (Free Entry for Session V)',
  founder: {
    name: 'Mr. Sumama Khan',
    role: 'Founder & Director General',
    organization: 'AZM Group of Companies (Pvt.) Ltd.',
    quote: 'True educational empowerment begins when merit is rewarded with absolute transparency and unyielding dedication to our youth.'
  },
  coFounder: {
    name: 'Mrs. Iram Zeb',
    role: 'Co-Founder & Executive Director',
    organization: 'AZM Group of Companies (Pvt.) Ltd.',
    quote: 'Our mission is to ensure that financial hardship never stands between an ambitious student and their academic aspirations.'
  }
};

export const MONTHLY_ASSISTANCE_RATES: MonthlyAssistanceRate[] = [
  {
    classLevel: 'Class 6th',
    name: 'Middle School (Grade 6)',
    monthlyAmount: 1600,
    annualAmount: 19200,
    periodLabel: 'per month',
    iconName: 'GraduationCap',
    notes: 'Direct monthly stipend + course textbook assistance'
  },
  {
    classLevel: 'Class 7th',
    name: 'Middle School (Grade 7)',
    monthlyAmount: 1800,
    annualAmount: 21600,
    periodLabel: 'per month',
    iconName: 'BookOpen',
    notes: 'Direct monthly stipend + stationery support'
  },
  {
    classLevel: 'Class 8th',
    name: 'Middle School (Grade 8)',
    monthlyAmount: 2000,
    annualAmount: 24000,
    periodLabel: 'per month',
    iconName: 'Award',
    notes: 'Board preparation stipend + monthly educational grant'
  },
  {
    classLevel: 'Class 9th (SSC-I)',
    name: 'Secondary School Certificate - I',
    monthlyAmount: 2500,
    annualAmount: 30000,
    periodLabel: 'per month',
    iconName: 'FileText',
    notes: 'BISE board registration support + monthly grant'
  },
  {
    classLevel: 'Class 10th (SSC-II)',
    name: 'Secondary School Certificate - II',
    monthlyAmount: 3000,
    annualAmount: 36000,
    periodLabel: 'per month',
    iconName: 'Medal',
    notes: 'Matriculation board scholarship & examination aid'
  },
  {
    classLevel: 'Class 11th (HSSC-I)',
    name: 'Higher Secondary School Certificate - I',
    monthlyAmount: 3500,
    annualAmount: 42000,
    periodLabel: 'per month',
    iconName: 'Trophy',
    notes: 'F.Sc / FA / ICS / I.Com monthly academic stipend'
  },
  {
    classLevel: 'Class 12th (HSSC-II)',
    name: 'Higher Secondary School Certificate - II',
    monthlyAmount: 4000,
    annualAmount: 48000,
    periodLabel: 'per month',
    iconName: 'ShieldCheck',
    notes: 'Pre-Medical / Pre-Engineering / ICS final year stipend'
  },
  {
    classLevel: 'BS Program (Undergraduate)',
    name: 'Newly Registered BS University Program',
    monthlyAmount: 5000,
    annualAmount: 60000,
    periodLabel: 'PKR 30,000 / semester',
    iconName: 'Sparkles',
    notes: '4-Year BS degree semester fee & research support'
  },
];

export const BENEFICIARY_CATEGORIES: BeneficiaryCategory[] = [
  {
    id: 'cat-a',
    code: 'Category A',
    title: "Chairman's Excellence Award",
    seats: 2,
    headline: 'Top 2 Overall Performers Across All Divisions',
    description: 'The highest civilian academic honor in Session V, reserved for the absolute top 2 scorers in the entire scholarship cycle.',
    rewards: [
      'Umrah Ticket (Any Airline of Choice) OR PKR 100,000 Educational Grant',
      '100% Full Tuition Fee Coverage (1 Full Academic Year)',
      'Gold Medal of Honor & Prestigious Shield',
      'Certificate of Excellence signed by Director General'
    ],
    eligibility: 'Overall 1st and 2nd rank on the combined merit index.',
    tagColor: 'from-amber-500 to-yellow-600',
    badge: '2 Elite Seats'
  },
  {
    id: 'cat-b',
    code: 'Category B',
    title: 'Director General Merit Scholarship',
    seats: 18,
    headline: 'Top 18 Outstanding Academic Champions',
    description: 'High-merit recognition awarded to top achievers demonstrating exceptional analytical precision across all examination subjects.',
    rewards: [
      '100% Full Tuition Fee Coverage (1 Full Academic Year)',
      'Official Gold Medal of Academic Distinction',
      'Certificate of Excellence & Institutional Trophy',
      'Priority Access to AZM Mentorship Labs'
    ],
    eligibility: 'Merit Ranks 3 to 20 on the official merit index.',
    tagColor: 'from-blue-600 to-indigo-700',
    badge: '18 Seats'
  },
  {
    id: 'cat-c',
    code: 'Category C',
    title: 'Academic Excellence Scholarship',
    seats: 80,
    headline: 'Tiered Tuition Grants (70%, 50%, or 30%)',
    description: 'Substantial semester fee reductions allocated according to strict score percentiles in the written OMR examination.',
    rewards: [
      '70%, 50%, or 30% Tuition Fee Subsidy (1 Academic Semester)',
      'Official Certificate of Achievement',
      'Free Access to AZM Question Banks & Digital Prep Library',
      'Merit Verification Badge on National Portal'
    ],
    eligibility: 'Merit Ranks 21 to 100 meeting interview benchmark.',
    tagColor: 'from-emerald-600 to-teal-700',
    badge: '80 Seats'
  },
  {
    id: 'cat-d',
    code: 'Category D',
    title: 'Educational Support Grant',
    seats: 150,
    headline: 'Laptops, Chromebooks & Comprehensive Study Kits',
    description: 'Direct material support designed to bridge the digital and educational divide for students across Hazara division and beyond.',
    rewards: [
      'Brand New High-Performance Laptop / Chromebook',
      'Ergonomic AZM Branded School Bag',
      'Complete Textbooks, Course Materials & Stationery Kits',
      'Digital Literacy & Software Toolkit Access'
    ],
    eligibility: 'Awarded to top performers in need of technological enablement.',
    tagColor: 'from-purple-600 to-pink-700',
    badge: '150 Seats'
  },
  {
    id: 'cat-e',
    code: 'Category E',
    title: 'Orphan & Financial Assistance',
    seats: 50,
    headline: 'Full Tuition & Monthly Stipend Allocation',
    description: 'Dedicated reserved quota for orphans, single-parent families, and students facing acute socioeconomic challenges.',
    rewards: [
      '100% Full Tuition Fee + Monthly Sustenance Stipend',
      'Uniform, Books, and Educational Transportation Aid',
      'Comprehensive Healthcare & Student Welfare Coverage',
      'Confidential Verification by 6-Member Welfare Board'
    ],
    eligibility: 'Orphaned students & verified household income < PKR 25,000.',
    tagColor: 'from-cyan-600 to-blue-700',
    badge: '50 Reserved Seats'
  },
  {
    id: 'cat-f',
    code: 'Category F',
    title: 'Merit Recognition & Cash Awards',
    seats: 200,
    headline: 'Over PKR 500,000+ Direct Cash Disbursal',
    description: 'Direct cash distributions handed on stage during the grand Session V felicitation ceremony.',
    rewards: [
      'Merit 21 to 50 (30 Students): PKR 5,000 cash each',
      'Merit 51 to 100 (50 Students): PKR 3,000 cash each',
      'Merit 101 to 150 (50 Students): PKR 2,000 cash each',
      'Merit 151 to 220 (70 Students): PKR 1,000 cash each'
    ],
    eligibility: 'Achievers ranked 21st to 220th in the final combined listing.',
    tagColor: 'from-amber-600 to-rose-700',
    badge: '200 Seats (PKR 500K+)'
  }
];

export const EXAM_SECTIONS: ExamSection[] = [
  {
    subject: 'Sciences (Physics / Chemistry / Biology / General Science)',
    questionsCount: 30,
    marks: 30,
    weightPercentage: 30,
    topics: ['Fundamental Physics Concepts', 'Chemical Reactions & States', 'Living Systems & Ecology', 'Scientific Inquiry & Everyday Science'],
    icon: 'FlaskConical'
  },
  {
    subject: 'English Language & Comprehension',
    questionsCount: 20,
    marks: 20,
    weightPercentage: 20,
    topics: ['Grammar & Sentence Syntax', 'Vocabulary & Antonyms/Synonyms', 'Reading Passage Comprehension', 'Idioms & Prepositions'],
    icon: 'BookOpen'
  },
  {
    subject: 'Mathematics & Quantitative Reasoning',
    questionsCount: 20,
    marks: 20,
    weightPercentage: 20,
    topics: ['Algebra & Number Theory', 'Geometry & Mensuration', 'Ratios, Proportions & Percentages', 'Analytical Logic'],
    icon: 'Calculator'
  },
  {
    subject: 'General Knowledge & Current Affairs',
    questionsCount: 20,
    marks: 20,
    weightPercentage: 20,
    topics: ['World Geography & Capitals', 'Pakistan History & Heritage', 'Scientific Discoveries', 'Global Organizations & Sports'],
    icon: 'Globe2'
  },
  {
    subject: 'Islamic Studies & Pakistan Studies',
    questionsCount: 10,
    marks: 10,
    weightPercentage: 10,
    topics: ['Quranic Concepts & Seerat-un-Nabi (PBUH)', 'Islamic Jurisprudence & Ethics', 'Ideology of Pakistan & Constitution', 'Non-Muslim Ethics (Alternative)'],
    icon: 'Compass'
  }
];

export const EVALUATION_WEIGHTS = [
  { label: 'Written OMR Examination', percentage: 60, color: '#185b9d' },
  { label: 'Comprehensive 6-Member Interview', percentage: 20, color: '#299b46' },
  { label: 'Previous Academic Record (DMC)', percentage: 10, color: '#70a9db' },
  { label: 'Financial Assessment / Need Verification', percentage: 5, color: '#f59e0b' },
  { label: 'Co-Curricular & Profile Assessment', percentage: 5, color: '#8b5cf6' }
];

export const SESSION_V_CALENDAR: CalendarEvent[] = [
  {
    id: 'cal-1',
    date: '2026-08-16',
    displayDate: '16 Aug 2026',
    title: 'Registration Opens Nationwide',
    description: 'Online portal launches for candidate registration & partner school bulk enrollment.',
    status: 'completed',
    badge: 'Launched'
  },
  {
    id: 'cal-2',
    date: '2026-08-30',
    displayDate: '30 Aug 2026',
    title: 'Registration Closes (23:59 PST)',
    description: 'Strict deadline for online applications, physical form drop-offs, and school lists.',
    status: 'active',
    badge: 'Registration Active'
  },
  {
    id: 'cal-3',
    date: '2026-09-01',
    displayDate: '01 Sep 2026',
    title: 'Official Syllabus & 1,000 MCQs Bank Release',
    description: 'Official AZM Question Banks unlocked for Class 6th to BS students for transparent prep.',
    status: 'upcoming',
    badge: 'Upcoming'
  },
  {
    id: 'cal-4',
    date: '2026-10-25',
    displayDate: '25 Oct 2026',
    title: 'Roll Number Slips Issued Online',
    description: 'Download official digital slips with QR verification and assigned examination centers.',
    status: 'upcoming',
    badge: 'Upcoming'
  },
  {
    id: 'cal-5',
    date: '2026-11-10',
    displayDate: '10 - 15 Nov 2026',
    title: 'Written Scholarship Examination (OMR)',
    description: '100 MCQs standardized optical sheet examination conducted across regional centers.',
    status: 'upcoming',
    badge: 'Exam Week'
  },
  {
    id: 'cal-6',
    date: '2026-11-20',
    displayDate: '20 Nov 2026',
    title: 'Written Test Results Announced',
    description: 'Digital result cards, subject breakdowns, and interview shortlist publication.',
    status: 'upcoming',
    badge: 'Results'
  },
  {
    id: 'cal-7',
    date: '2026-12-07',
    displayDate: '07 - 13 Dec 2026',
    title: 'Comprehensive 6-Member Interviews',
    description: 'Qualitative assessment, document scrutiny, and financial verification rounds.',
    status: 'upcoming',
    badge: 'Interviews'
  },
  {
    id: 'cal-8',
    date: '2026-12-26',
    displayDate: '26 Dec 2026',
    title: 'Final Merit List & Grand Award Ceremony',
    description: 'Announcement of Category A to F winners, Umrah tickets, laptops, and cash awards.',
    status: 'upcoming',
    badge: 'Grand Finale'
  }
];

export const REGISTRATION_HUBS = [
  {
    id: 'hub-1',
    name: 'Jadoon Public High School & College',
    campus: 'Headquarters & Examination Center',
    address: 'Gandhian, Karakoram Highway, Mansehra, KP',
    focalPerson: 'Prof. Muhammad Asif Jadoon',
    contact: '0305-1755551',
    timing: '8:30 AM - 4:30 PM (Mon-Sat)',
    capacity: '1,200 Candidates',
    isHeadOffice: true
  },
  {
    id: 'hub-2',
    name: 'Dubai International School & College',
    campus: 'City Registration Hub',
    address: 'Kashmir Road, Near Shinkiari Chowk, Mansehra',
    focalPerson: 'Engr. Tariq Mehmood',
    contact: '0313-9876543',
    timing: '9:00 AM - 4:00 PM (Mon-Sat)',
    capacity: '800 Candidates',
    isHeadOffice: false
  },
  {
    id: 'hub-3',
    name: 'Khyber Public School & College',
    campus: 'Regional Hub',
    address: 'Abbottabad Road, Near College Chowk, Mansehra',
    focalPerson: 'Sardar Naveed Ahmed',
    contact: '0300-5544332',
    timing: '9:00 AM - 3:30 PM (Mon-Sat)',
    capacity: '650 Candidates',
    isHeadOffice: false
  }
];

// Candidate records are provided by the backend API service
export const SAMPLE_ROLL_NUMBER_SLIPS: RollNumberSlip[] = [];
export const SAMPLE_RESULT_CARDS: ResultCard[] = [];
export const PUBLIC_MERIT_LIST: PublicMeritEntry[] = [];


export const PARTNER_SCHOOLS: PartnerSchoolData[] = [
  {
    id: 'ps-1',
    institutionName: 'Jadoon Public High School & College',
    category: 'Higher Secondary',
    campus: 'Main Campus Gandhian',
    address: 'Karakoram Highway, Gandhian, Mansehra',
    district: 'Mansehra',
    contactPerson: 'Prof. Muhammad Asif Jadoon',
    designation: 'Principal & Head of Examinations',
    whatsapp: '0305-1755551',
    email: 'jadooncollege@gmail.com',
    totalStudentStrength: 1450,
    expectedApplicants: 320,
    stampUploaded: true,
    isRegistrationHub: true
  },
  {
    id: 'ps-2',
    institutionName: 'Dubai International Public School & College',
    category: 'Higher Secondary',
    campus: 'Girls & Boys Campus',
    address: 'Kashmir Road, Near Shinkiari Chowk, Mansehra',
    district: 'Mansehra',
    contactPerson: 'Engr. Tariq Mehmood',
    designation: 'Managing Director',
    whatsapp: '0313-9876543',
    email: 'dubaischool.mhr@gmail.com',
    totalStudentStrength: 1800,
    expectedApplicants: 450,
    stampUploaded: true,
    isRegistrationHub: true
  },
  {
    id: 'ps-3',
    institutionName: 'Khyber Public School & College',
    category: 'School',
    campus: 'Main College Road',
    address: 'Abbottabad Road, Near College Chowk, Mansehra',
    district: 'Mansehra',
    contactPerson: 'Sardar Naveed Ahmed',
    designation: 'Vice Principal',
    whatsapp: '0300-5544332',
    email: 'khyberpublic.mhr@gmail.com',
    totalStudentStrength: 950,
    expectedApplicants: 210,
    stampUploaded: true,
    isRegistrationHub: true
  },
  {
    id: 'ps-4',
    institutionName: 'Army Public School & College (APS)',
    category: 'Higher Secondary',
    campus: 'Garrison Campus',
    address: 'Cantt Area, Mansehra',
    district: 'Mansehra',
    contactPerson: 'Col. (R) Shahzad Malik',
    designation: 'Academic Coordinator',
    whatsapp: '0333-5123456',
    email: 'aps.mansehra@gmail.com',
    totalStudentStrength: 1200,
    expectedApplicants: 280,
    stampUploaded: true
  },
  {
    id: 'ps-5',
    institutionName: 'Hazara Model High School & College',
    category: 'Higher Secondary',
    campus: 'City Campus',
    address: 'Main Bazar, Baffa, Mansehra',
    district: 'Mansehra',
    contactPerson: 'Mr. Inam Ullah Khan',
    designation: 'Principal',
    whatsapp: '0345-9871234',
    email: 'hazaramodel@gmail.com',
    totalStudentStrength: 650,
    expectedApplicants: 140,
    stampUploaded: true
  },
  {
    id: 'ps-6',
    institutionName: 'The Peace Group of Schools & Colleges',
    category: 'Higher Secondary',
    campus: 'Abbottabad Road Campus',
    address: 'Near Mandian, Abbottabad Road, Abbottabad',
    district: 'Abbottabad',
    contactPerson: 'Dr. Sajid Farooq',
    designation: 'Regional Director',
    whatsapp: '0302-8877665',
    email: 'peacegroup.atd@gmail.com',
    totalStudentStrength: 2100,
    expectedApplicants: 520,
    stampUploaded: true
  },
  {
    id: 'ps-7',
    institutionName: 'Modern Age Public School & College',
    category: 'Higher Secondary',
    campus: 'Sector 2, Mandian',
    address: 'Mandian, Abbottabad',
    district: 'Abbottabad',
    contactPerson: 'Mr. Abdul Waheed',
    designation: 'Head of Admissions',
    whatsapp: '0312-3344556',
    email: 'modernage@gmail.com',
    totalStudentStrength: 1300,
    expectedApplicants: 290,
    stampUploaded: true
  },
  {
    id: 'ps-8',
    institutionName: 'Sir Syed Model High School & College',
    category: 'Higher Secondary',
    campus: 'Central Haripur',
    address: 'GT Road, Near Railway Station, Haripur',
    district: 'Haripur',
    contactPerson: 'Chaudhry Riaz Ahmed',
    designation: 'Executive Principal',
    whatsapp: '0301-4455667',
    email: 'sirsyed.haripur@gmail.com',
    totalStudentStrength: 1100,
    expectedApplicants: 230,
    stampUploaded: true
  },
  {
    id: 'ps-9',
    institutionName: 'Allama Iqbal Model School',
    category: 'School',
    campus: 'Oghi Campus',
    address: 'Main Bazar Oghi, District Mansehra',
    district: 'Mansehra',
    contactPerson: 'Maulana Shafiq-ur-Rehman',
    designation: 'Principal',
    whatsapp: '0346-7788990',
    email: 'iqbal.oghi@gmail.com',
    totalStudentStrength: 480,
    expectedApplicants: 95,
    stampUploaded: true
  },
  {
    id: 'ps-10',
    institutionName: 'Battagram Public School & College',
    category: 'Higher Secondary',
    campus: 'Karakoram Highway Campus',
    address: 'Main KKH, Battagram',
    district: 'Battagram',
    contactPerson: 'Malik Zafar Iqbal',
    designation: 'Managing Trustee',
    whatsapp: '0334-1122334',
    email: 'battagramps@gmail.com',
    totalStudentStrength: 720,
    expectedApplicants: 160,
    stampUploaded: true
  }
];

export const SAMPLE_QUESTION_BANK: QuestionBankItem[] = [
  {
    id: 1,
    classLevel: 'Class 10th (SSC-II)',
    subject: 'Sciences (Physics)',
    question: 'The rate of flow of electric charge through any cross-sectional area of a conductor is called:',
    options: ['Electric Potential', 'Electric Current', 'Capacitance', 'Resistance'],
    correctIndex: 1,
    explanation: 'Electric current (I) is defined mathematically as I = Q / t, the rate of charge flow measured in Amperes (A).'
  },
  {
    id: 2,
    classLevel: 'Class 10th (SSC-II)',
    subject: 'Sciences (Chemistry)',
    question: 'Which of the following functional groups represents Carboxylic Acids?',
    options: ['-CHO', '-OH', '-COOH', '-CO-'],
    correctIndex: 2,
    explanation: 'The carboxyl group (-COOH) consists of a carbonyl (C=O) and a hydroxyl group (-OH) attached to the same carbon.'
  },
  {
    id: 3,
    classLevel: 'Class 10th (SSC-II)',
    subject: 'English Comprehension',
    question: 'Choose the correct synonym of the word "PERSISTENT":',
    options: ['Relentless', 'Hesitant', 'Occasional', 'Fragile'],
    correctIndex: 0,
    explanation: '"Persistent" means continuing firmly or obstinately in a course of action; "relentless" is the closest synonym.'
  },
  {
    id: 4,
    classLevel: 'Class 10th (SSC-II)',
    subject: 'Mathematics',
    question: 'If the discriminant of a quadratic equation (b² - 4ac) is positive and not a perfect square, the roots are:',
    options: ['Real, Rational, and Equal', 'Real, Irrational, and Unequal', 'Imaginary / Complex', 'Rational and Equal'],
    correctIndex: 1,
    explanation: 'When Δ > 0 and not a square number, the square root remains in radical form, yielding real, irrational, and unequal roots.'
  },
  {
    id: 5,
    classLevel: 'Class 10th (SSC-II)',
    subject: 'Islamic Studies / Pak Studies',
    question: 'The Objectives Resolution (Qarardad-e-Maqasid) was passed by the Constituent Assembly of Pakistan on:',
    options: ['14 August 1947', '12 March 1949', '23 March 1956', '16 October 1951'],
    correctIndex: 1,
    explanation: 'Prime Minister Liaquat Ali Khan presented the historic Objectives Resolution which was adopted on March 12, 1949.'
  },
  {
    id: 6,
    classLevel: 'Class 10th (SSC-II)',
    subject: 'General Knowledge',
    question: 'Which is the world’s second-highest mountain peak located in Gilgit-Baltistan, Pakistan?',
    options: ['Nanga Parbat', 'K2 (Godwin-Austen)', 'Broad Peak', 'Gasherbrum I'],
    correctIndex: 1,
    explanation: 'K2 stands at 8,611 meters (28,251 ft) above sea level in the Karakoram range.'
  }
];

export const GALLERY_ITEMS: GalleryItem[] = [
  {
    "id": "gal-1",
    "title": "Session IV OMR Examination & Invigilation (Photo 1)",
    "session": "Session IV (2025)",
    "category": "Examination",
    "image": "/pictures/Session 4/WhatsApp Image 2026-07-14 at 2.49.46 PM.jpeg",
    "description": "Standardized 100 MCQs optical test conducted with transparent center supervision."
  },
  {
    "id": "gal-2",
    "title": "Session IV OMR Examination & Invigilation (Photo 2)",
    "session": "Session IV (2025)",
    "category": "Examination",
    "image": "/pictures/Session 4/WhatsApp Image 2026-07-14 at 2.49.47 PM (1).jpeg",
    "description": "Standardized 100 MCQs optical test conducted with transparent center supervision."
  },
  {
    "id": "gal-3",
    "title": "Session IV OMR Examination & Invigilation (Photo 3)",
    "session": "Session IV (2025)",
    "category": "Examination",
    "image": "/pictures/Session 4/WhatsApp Image 2026-07-14 at 2.49.47 PM.jpeg",
    "description": "Standardized 100 MCQs optical test conducted with transparent center supervision."
  },
  {
    "id": "gal-4",
    "title": "Session IV OMR Examination & Invigilation (Photo 4)",
    "session": "Session IV (2025)",
    "category": "Examination",
    "image": "/pictures/Session 4/WhatsApp Image 2026-07-14 at 2.49.48 PM (1).jpeg",
    "description": "Standardized 100 MCQs optical test conducted with transparent center supervision."
  },
  {
    "id": "gal-5",
    "title": "Session IV OMR Examination & Invigilation (Photo 5)",
    "session": "Session IV (2025)",
    "category": "Examination",
    "image": "/pictures/Session 4/WhatsApp Image 2026-07-14 at 2.49.48 PM.jpeg",
    "description": "Standardized 100 MCQs optical test conducted with transparent center supervision."
  },
  {
    "id": "gal-6",
    "title": "Session IV OMR Examination & Invigilation (Photo 6)",
    "session": "Session IV (2025)",
    "category": "Examination",
    "image": "/pictures/Session 4/WhatsApp Image 2026-07-14 at 2.49.49 PM (1).jpeg",
    "description": "Standardized 100 MCQs optical test conducted with transparent center supervision."
  },
  {
    "id": "gal-7",
    "title": "Session IV OMR Examination & Invigilation (Photo 7)",
    "session": "Session IV (2025)",
    "category": "Examination",
    "image": "/pictures/Session 4/WhatsApp Image 2026-07-14 at 2.49.49 PM (2).jpeg",
    "description": "Standardized 100 MCQs optical test conducted with transparent center supervision."
  },
  {
    "id": "gal-8",
    "title": "Session IV OMR Examination & Invigilation (Photo 8)",
    "session": "Session IV (2025)",
    "category": "Examination",
    "image": "/pictures/Session 4/WhatsApp Image 2026-07-14 at 2.49.49 PM.jpeg",
    "description": "Standardized 100 MCQs optical test conducted with transparent center supervision."
  },
  {
    "id": "gal-9",
    "title": "Session IV OMR Examination & Invigilation (Photo 9)",
    "session": "Session IV (2025)",
    "category": "Examination",
    "image": "/pictures/Session 4/WhatsApp Image 2026-07-14 at 2.49.50 PM (1).jpeg",
    "description": "Standardized 100 MCQs optical test conducted with transparent center supervision."
  },
  {
    "id": "gal-10",
    "title": "Session IV OMR Examination & Invigilation (Photo 10)",
    "session": "Session IV (2025)",
    "category": "Examination",
    "image": "/pictures/Session 4/WhatsApp Image 2026-07-14 at 2.49.50 PM.jpeg",
    "description": "Standardized 100 MCQs optical test conducted with transparent center supervision."
  },
  {
    "id": "gal-11",
    "title": "Session IV OMR Examination & Invigilation (Photo 11)",
    "session": "Session IV (2025)",
    "category": "Examination",
    "image": "/pictures/Session 4/WhatsApp Image 2026-07-14 at 2.49.51 PM (1).jpeg",
    "description": "Standardized 100 MCQs optical test conducted with transparent center supervision."
  },
  {
    "id": "gal-12",
    "title": "Session IV OMR Examination & Invigilation (Photo 12)",
    "session": "Session IV (2025)",
    "category": "Examination",
    "image": "/pictures/Session 4/WhatsApp Image 2026-07-14 at 2.49.51 PM.jpeg",
    "description": "Standardized 100 MCQs optical test conducted with transparent center supervision."
  },
  {
    "id": "gal-13",
    "title": "Session IV OMR Examination & Invigilation (Photo 13)",
    "session": "Session IV (2025)",
    "category": "Examination",
    "image": "/pictures/Session 4/WhatsApp Image 2026-07-14 at 2.49.52 PM (1).jpeg",
    "description": "Standardized 100 MCQs optical test conducted with transparent center supervision."
  },
  {
    "id": "gal-14",
    "title": "Session IV OMR Examination & Invigilation (Photo 14)",
    "session": "Session IV (2025)",
    "category": "Examination",
    "image": "/pictures/Session 4/WhatsApp Image 2026-07-14 at 2.49.52 PM.jpeg",
    "description": "Standardized 100 MCQs optical test conducted with transparent center supervision."
  },
  {
    "id": "gal-15",
    "title": "Session IV OMR Examination & Invigilation (Photo 15)",
    "session": "Session IV (2025)",
    "category": "Examination",
    "image": "/pictures/Session 4/WhatsApp Image 2026-07-14 at 2.49.53 PM (1).jpeg",
    "description": "Standardized 100 MCQs optical test conducted with transparent center supervision."
  },
  {
    "id": "gal-16",
    "title": "Session IV OMR Examination & Invigilation (Photo 16)",
    "session": "Session IV (2025)",
    "category": "Examination",
    "image": "/pictures/Session 4/WhatsApp Image 2026-07-14 at 2.49.53 PM (2).jpeg",
    "description": "Standardized 100 MCQs optical test conducted with transparent center supervision."
  },
  {
    "id": "gal-17",
    "title": "Session IV OMR Examination & Invigilation (Photo 17)",
    "session": "Session IV (2025)",
    "category": "Examination",
    "image": "/pictures/Session 4/WhatsApp Image 2026-07-14 at 2.49.53 PM.jpeg",
    "description": "Standardized 100 MCQs optical test conducted with transparent center supervision."
  },
  {
    "id": "gal-18",
    "title": "Session IV OMR Examination & Invigilation (Photo 18)",
    "session": "Session IV (2025)",
    "category": "Examination",
    "image": "/pictures/Session 4/WhatsApp Image 2026-07-14 at 2.49.54 PM.jpeg",
    "description": "Standardized 100 MCQs optical test conducted with transparent center supervision."
  },
  {
    "id": "gal-19",
    "title": "Winter Session III Award Distribution & Honors (Photo 1)",
    "session": "Winter Session III & Ceremony",
    "category": "Ceremony",
    "image": "/pictures/Winter Session 3 and ceremony/WhatsApp Image 2026-07-14 at 2.48.17 PM (1).jpeg",
    "description": "Official felicitation of position holders, laptop presentations, and scholarship award distribution."
  },
  {
    "id": "gal-20",
    "title": "Winter Session III Award Distribution & Honors (Photo 2)",
    "session": "Winter Session III & Ceremony",
    "category": "Ceremony",
    "image": "/pictures/Winter Session 3 and ceremony/WhatsApp Image 2026-07-14 at 2.48.17 PM.jpeg",
    "description": "Official felicitation of position holders, laptop presentations, and scholarship award distribution."
  },
  {
    "id": "gal-21",
    "title": "Winter Session III Award Distribution & Honors (Photo 3)",
    "session": "Winter Session III & Ceremony",
    "category": "Ceremony",
    "image": "/pictures/Winter Session 3 and ceremony/WhatsApp Image 2026-07-14 at 2.48.18 PM.jpeg",
    "description": "Official felicitation of position holders, laptop presentations, and scholarship award distribution."
  },
  {
    "id": "gal-22",
    "title": "Winter Session III Award Distribution & Honors (Photo 4)",
    "session": "Winter Session III & Ceremony",
    "category": "Ceremony",
    "image": "/pictures/Winter Session 3 and ceremony/WhatsApp Image 2026-07-14 at 2.48.19 PM.jpeg",
    "description": "Official felicitation of position holders, laptop presentations, and scholarship award distribution."
  },
  {
    "id": "gal-23",
    "title": "Winter Session III Award Distribution & Honors (Photo 5)",
    "session": "Winter Session III & Ceremony",
    "category": "Ceremony",
    "image": "/pictures/Winter Session 3 and ceremony/WhatsApp Image 2026-07-14 at 2.48.20 PM.jpeg",
    "description": "Official felicitation of position holders, laptop presentations, and scholarship award distribution."
  },
  {
    "id": "gal-24",
    "title": "Winter Session III Award Distribution & Honors (Photo 6)",
    "session": "Winter Session III & Ceremony",
    "category": "Ceremony",
    "image": "/pictures/Winter Session 3 and ceremony/WhatsApp Image 2026-07-14 at 2.48.21 PM.jpeg",
    "description": "Official felicitation of position holders, laptop presentations, and scholarship award distribution."
  },
  {
    "id": "gal-25",
    "title": "Winter Session III Award Distribution & Honors (Photo 7)",
    "session": "Winter Session III & Ceremony",
    "category": "Ceremony",
    "image": "/pictures/Winter Session 3 and ceremony/WhatsApp Image 2026-07-14 at 2.48.22 PM.jpeg",
    "description": "Official felicitation of position holders, laptop presentations, and scholarship award distribution."
  },
  {
    "id": "gal-26",
    "title": "Winter Session III Award Distribution & Honors (Photo 8)",
    "session": "Winter Session III & Ceremony",
    "category": "Ceremony",
    "image": "/pictures/Winter Session 3 and ceremony/WhatsApp Image 2026-07-14 at 2.48.24 PM.jpeg",
    "description": "Official felicitation of position holders, laptop presentations, and scholarship award distribution."
  },
  {
    "id": "gal-27",
    "title": "Winter Session III Award Distribution & Honors (Photo 9)",
    "session": "Winter Session III & Ceremony",
    "category": "Ceremony",
    "image": "/pictures/Winter Session 3 and ceremony/WhatsApp Image 2026-07-14 at 2.48.26 PM.jpeg",
    "description": "Official felicitation of position holders, laptop presentations, and scholarship award distribution."
  },
  {
    "id": "gal-28",
    "title": "Winter Session III Award Distribution & Honors (Photo 10)",
    "session": "Winter Session III & Ceremony",
    "category": "Ceremony",
    "image": "/pictures/Winter Session 3 and ceremony/WhatsApp Image 2026-07-14 at 2.48.28 PM.jpeg",
    "description": "Official felicitation of position holders, laptop presentations, and scholarship award distribution."
  },
  {
    "id": "gal-29",
    "title": "Winter Session III Award Distribution & Honors (Photo 11)",
    "session": "Winter Session III & Ceremony",
    "category": "Ceremony",
    "image": "/pictures/Winter Session 3 and ceremony/WhatsApp Image 2026-07-14 at 2.48.30 PM.jpeg",
    "description": "Official felicitation of position holders, laptop presentations, and scholarship award distribution."
  },
  {
    "id": "gal-30",
    "title": "Winter Session III Award Distribution & Honors (Photo 12)",
    "session": "Winter Session III & Ceremony",
    "category": "Ceremony",
    "image": "/pictures/Winter Session 3 and ceremony/WhatsApp Image 2026-07-14 at 2.48.31 PM (1).jpeg",
    "description": "Official felicitation of position holders, laptop presentations, and scholarship award distribution."
  },
  {
    "id": "gal-31",
    "title": "Winter Session III Award Distribution & Honors (Photo 13)",
    "session": "Winter Session III & Ceremony",
    "category": "Ceremony",
    "image": "/pictures/Winter Session 3 and ceremony/WhatsApp Image 2026-07-14 at 2.48.31 PM.jpeg",
    "description": "Official felicitation of position holders, laptop presentations, and scholarship award distribution."
  },
  {
    "id": "gal-32",
    "title": "Winter Session III Award Distribution & Honors (Photo 14)",
    "session": "Winter Session III & Ceremony",
    "category": "Ceremony",
    "image": "/pictures/Winter Session 3 and ceremony/WhatsApp Image 2026-07-14 at 2.48.32 PM (1).jpeg",
    "description": "Official felicitation of position holders, laptop presentations, and scholarship award distribution."
  },
  {
    "id": "gal-33",
    "title": "Winter Session III Award Distribution & Honors (Photo 15)",
    "session": "Winter Session III & Ceremony",
    "category": "Ceremony",
    "image": "/pictures/Winter Session 3 and ceremony/WhatsApp Image 2026-07-14 at 2.48.32 PM.jpeg",
    "description": "Official felicitation of position holders, laptop presentations, and scholarship award distribution."
  },
  {
    "id": "gal-34",
    "title": "Winter Session III Award Distribution & Honors (Photo 16)",
    "session": "Winter Session III & Ceremony",
    "category": "Ceremony",
    "image": "/pictures/Winter Session 3 and ceremony/WhatsApp Image 2026-07-14 at 2.48.33 PM (1).jpeg",
    "description": "Official felicitation of position holders, laptop presentations, and scholarship award distribution."
  },
  {
    "id": "gal-35",
    "title": "Winter Session III Award Distribution & Honors (Photo 17)",
    "session": "Winter Session III & Ceremony",
    "category": "Ceremony",
    "image": "/pictures/Winter Session 3 and ceremony/WhatsApp Image 2026-07-14 at 2.48.33 PM (2).jpeg",
    "description": "Official felicitation of position holders, laptop presentations, and scholarship award distribution."
  },
  {
    "id": "gal-36",
    "title": "Winter Session III Award Distribution & Honors (Photo 18)",
    "session": "Winter Session III & Ceremony",
    "category": "Ceremony",
    "image": "/pictures/Winter Session 3 and ceremony/WhatsApp Image 2026-07-14 at 2.48.33 PM.jpeg",
    "description": "Official felicitation of position holders, laptop presentations, and scholarship award distribution."
  },
  {
    "id": "gal-37",
    "title": "Winter Session III Award Distribution & Honors (Photo 19)",
    "session": "Winter Session III & Ceremony",
    "category": "Ceremony",
    "image": "/pictures/Winter Session 3 and ceremony/WhatsApp Image 2026-07-14 at 2.48.34 PM (1).jpeg",
    "description": "Official felicitation of position holders, laptop presentations, and scholarship award distribution."
  },
  {
    "id": "gal-38",
    "title": "Winter Session III Award Distribution & Honors (Photo 20)",
    "session": "Winter Session III & Ceremony",
    "category": "Ceremony",
    "image": "/pictures/Winter Session 3 and ceremony/WhatsApp Image 2026-07-14 at 2.48.34 PM.jpeg",
    "description": "Official felicitation of position holders, laptop presentations, and scholarship award distribution."
  },
  {
    "id": "gal-39",
    "title": "Winter Session III Award Distribution & Honors (Photo 21)",
    "session": "Winter Session III & Ceremony",
    "category": "Ceremony",
    "image": "/pictures/Winter Session 3 and ceremony/WhatsApp Image 2026-07-14 at 2.48.35 PM (1).jpeg",
    "description": "Official felicitation of position holders, laptop presentations, and scholarship award distribution."
  },
  {
    "id": "gal-40",
    "title": "Winter Session III Award Distribution & Honors (Photo 22)",
    "session": "Winter Session III & Ceremony",
    "category": "Ceremony",
    "image": "/pictures/Winter Session 3 and ceremony/WhatsApp Image 2026-07-14 at 2.48.35 PM.jpeg",
    "description": "Official felicitation of position holders, laptop presentations, and scholarship award distribution."
  },
  {
    "id": "gal-41",
    "title": "Winter Session III Award Distribution & Honors (Photo 23)",
    "session": "Winter Session III & Ceremony",
    "category": "Ceremony",
    "image": "/pictures/Winter Session 3 and ceremony/WhatsApp Image 2026-07-14 at 2.48.36 PM (1).jpeg",
    "description": "Official felicitation of position holders, laptop presentations, and scholarship award distribution."
  },
  {
    "id": "gal-42",
    "title": "Winter Session III Award Distribution & Honors (Photo 24)",
    "session": "Winter Session III & Ceremony",
    "category": "Ceremony",
    "image": "/pictures/Winter Session 3 and ceremony/WhatsApp Image 2026-07-14 at 2.48.36 PM (2).jpeg",
    "description": "Official felicitation of position holders, laptop presentations, and scholarship award distribution."
  },
  {
    "id": "gal-43",
    "title": "Winter Session III Award Distribution & Honors (Photo 25)",
    "session": "Winter Session III & Ceremony",
    "category": "Ceremony",
    "image": "/pictures/Winter Session 3 and ceremony/WhatsApp Image 2026-07-14 at 2.48.36 PM.jpeg",
    "description": "Official felicitation of position holders, laptop presentations, and scholarship award distribution."
  },
  {
    "id": "gal-44",
    "title": "Winter Session III Award Distribution & Honors (Photo 26)",
    "session": "Winter Session III & Ceremony",
    "category": "Ceremony",
    "image": "/pictures/Winter Session 3 and ceremony/WhatsApp Image 2026-07-14 at 2.48.37 PM (1).jpeg",
    "description": "Official felicitation of position holders, laptop presentations, and scholarship award distribution."
  },
  {
    "id": "gal-45",
    "title": "Winter Session III Award Distribution & Honors (Photo 27)",
    "session": "Winter Session III & Ceremony",
    "category": "Ceremony",
    "image": "/pictures/Winter Session 3 and ceremony/WhatsApp Image 2026-07-14 at 2.48.37 PM.jpeg",
    "description": "Official felicitation of position holders, laptop presentations, and scholarship award distribution."
  },
  {
    "id": "gal-46",
    "title": "Winter Session III Award Distribution & Honors (Photo 28)",
    "session": "Winter Session III & Ceremony",
    "category": "Ceremony",
    "image": "/pictures/Winter Session 3 and ceremony/WhatsApp Image 2026-07-14 at 2.48.38 PM (1).jpeg",
    "description": "Official felicitation of position holders, laptop presentations, and scholarship award distribution."
  },
  {
    "id": "gal-47",
    "title": "Winter Session III Award Distribution & Honors (Photo 29)",
    "session": "Winter Session III & Ceremony",
    "category": "Ceremony",
    "image": "/pictures/Winter Session 3 and ceremony/WhatsApp Image 2026-07-14 at 2.48.38 PM.jpeg",
    "description": "Official felicitation of position holders, laptop presentations, and scholarship award distribution."
  },
  {
    "id": "gal-48",
    "title": "Winter Session III Award Distribution & Honors (Photo 30)",
    "session": "Winter Session III & Ceremony",
    "category": "Ceremony",
    "image": "/pictures/Winter Session 3 and ceremony/WhatsApp Image 2026-07-14 at 2.48.39 PM (1).jpeg",
    "description": "Official felicitation of position holders, laptop presentations, and scholarship award distribution."
  },
  {
    "id": "gal-49",
    "title": "Winter Session III Award Distribution & Honors (Photo 31)",
    "session": "Winter Session III & Ceremony",
    "category": "Ceremony",
    "image": "/pictures/Winter Session 3 and ceremony/WhatsApp Image 2026-07-14 at 2.48.39 PM.jpeg",
    "description": "Official felicitation of position holders, laptop presentations, and scholarship award distribution."
  },
  {
    "id": "gal-50",
    "title": "Winter Session III Award Distribution & Honors (Photo 32)",
    "session": "Winter Session III & Ceremony",
    "category": "Ceremony",
    "image": "/pictures/Winter Session 3 and ceremony/WhatsApp Image 2026-07-14 at 2.48.40 PM (1).jpeg",
    "description": "Official felicitation of position holders, laptop presentations, and scholarship award distribution."
  },
  {
    "id": "gal-51",
    "title": "Winter Session III Award Distribution & Honors (Photo 33)",
    "session": "Winter Session III & Ceremony",
    "category": "Ceremony",
    "image": "/pictures/Winter Session 3 and ceremony/WhatsApp Image 2026-07-14 at 2.48.40 PM.jpeg",
    "description": "Official felicitation of position holders, laptop presentations, and scholarship award distribution."
  },
  {
    "id": "gal-52",
    "title": "Winter Session III Award Distribution & Honors (Photo 34)",
    "session": "Winter Session III & Ceremony",
    "category": "Ceremony",
    "image": "/pictures/Winter Session 3 and ceremony/WhatsApp Image 2026-07-14 at 2.48.41 PM (1).jpeg",
    "description": "Official felicitation of position holders, laptop presentations, and scholarship award distribution."
  },
  {
    "id": "gal-53",
    "title": "Winter Session III Award Distribution & Honors (Photo 35)",
    "session": "Winter Session III & Ceremony",
    "category": "Ceremony",
    "image": "/pictures/Winter Session 3 and ceremony/WhatsApp Image 2026-07-14 at 2.48.41 PM (2).jpeg",
    "description": "Official felicitation of position holders, laptop presentations, and scholarship award distribution."
  },
  {
    "id": "gal-54",
    "title": "Winter Session III Award Distribution & Honors (Photo 36)",
    "session": "Winter Session III & Ceremony",
    "category": "Ceremony",
    "image": "/pictures/Winter Session 3 and ceremony/WhatsApp Image 2026-07-14 at 2.48.41 PM.jpeg",
    "description": "Official felicitation of position holders, laptop presentations, and scholarship award distribution."
  },
  {
    "id": "gal-55",
    "title": "Winter Sessions I & II Academic Testing & Honors (Photo 1)",
    "session": "Winter Sessions I & II",
    "category": "Foundation",
    "image": "/pictures/Winter Session 1 and 2/WhatsApp Image 2026-07-14 at 2.44.13 PM.jpeg",
    "description": "Historic merit evaluation and academic award distribution for deserving students."
  },
  {
    "id": "gal-56",
    "title": "Winter Sessions I & II Academic Testing & Honors (Photo 2)",
    "session": "Winter Sessions I & II",
    "category": "Foundation",
    "image": "/pictures/Winter Session 1 and 2/WhatsApp Image 2026-07-14 at 2.44.14 PM.jpeg",
    "description": "Historic merit evaluation and academic award distribution for deserving students."
  },
  {
    "id": "gal-57",
    "title": "Winter Sessions I & II Academic Testing & Honors (Photo 3)",
    "session": "Winter Sessions I & II",
    "category": "Foundation",
    "image": "/pictures/Winter Session 1 and 2/WhatsApp Image 2026-07-14 at 2.44.15 PM (1).jpeg",
    "description": "Historic merit evaluation and academic award distribution for deserving students."
  },
  {
    "id": "gal-58",
    "title": "Winter Sessions I & II Academic Testing & Honors (Photo 4)",
    "session": "Winter Sessions I & II",
    "category": "Foundation",
    "image": "/pictures/Winter Session 1 and 2/WhatsApp Image 2026-07-14 at 2.44.15 PM.jpeg",
    "description": "Historic merit evaluation and academic award distribution for deserving students."
  },
  {
    "id": "gal-59",
    "title": "Winter Sessions I & II Academic Testing & Honors (Photo 5)",
    "session": "Winter Sessions I & II",
    "category": "Foundation",
    "image": "/pictures/Winter Session 1 and 2/WhatsApp Image 2026-07-14 at 2.44.16 PM.jpeg",
    "description": "Historic merit evaluation and academic award distribution for deserving students."
  },
  {
    "id": "gal-60",
    "title": "Winter Sessions I & II Academic Testing & Honors (Photo 6)",
    "session": "Winter Sessions I & II",
    "category": "Foundation",
    "image": "/pictures/Winter Session 1 and 2/WhatsApp Image 2026-07-14 at 2.44.17 PM (1).jpeg",
    "description": "Historic merit evaluation and academic award distribution for deserving students."
  },
  {
    "id": "gal-61",
    "title": "Winter Sessions I & II Academic Testing & Honors (Photo 7)",
    "session": "Winter Sessions I & II",
    "category": "Foundation",
    "image": "/pictures/Winter Session 1 and 2/WhatsApp Image 2026-07-14 at 2.44.17 PM.jpeg",
    "description": "Historic merit evaluation and academic award distribution for deserving students."
  },
  {
    "id": "gal-62",
    "title": "Winter Sessions I & II Academic Testing & Honors (Photo 8)",
    "session": "Winter Sessions I & II",
    "category": "Foundation",
    "image": "/pictures/Winter Session 1 and 2/WhatsApp Image 2026-07-14 at 2.44.18 PM.jpeg",
    "description": "Historic merit evaluation and academic award distribution for deserving students."
  },
  {
    "id": "gal-63",
    "title": "Winter Sessions I & II Academic Testing & Honors (Photo 9)",
    "session": "Winter Sessions I & II",
    "category": "Foundation",
    "image": "/pictures/Winter Session 1 and 2/WhatsApp Image 2026-07-14 at 2.44.19 PM.jpeg",
    "description": "Historic merit evaluation and academic award distribution for deserving students."
  },
  {
    "id": "gal-64",
    "title": "Winter Sessions I & II Academic Testing & Honors (Photo 10)",
    "session": "Winter Sessions I & II",
    "category": "Foundation",
    "image": "/pictures/Winter Session 1 and 2/WhatsApp Image 2026-07-14 at 2.44.20 PM (1).jpeg",
    "description": "Historic merit evaluation and academic award distribution for deserving students."
  },
  {
    "id": "gal-65",
    "title": "Winter Sessions I & II Academic Testing & Honors (Photo 11)",
    "session": "Winter Sessions I & II",
    "category": "Foundation",
    "image": "/pictures/Winter Session 1 and 2/WhatsApp Image 2026-07-14 at 2.44.20 PM.jpeg",
    "description": "Historic merit evaluation and academic award distribution for deserving students."
  },
  {
    "id": "gal-66",
    "title": "Winter Sessions I & II Academic Testing & Honors (Photo 12)",
    "session": "Winter Sessions I & II",
    "category": "Foundation",
    "image": "/pictures/Winter Session 1 and 2/WhatsApp Image 2026-07-14 at 2.44.21 PM (1).jpeg",
    "description": "Historic merit evaluation and academic award distribution for deserving students."
  },
  {
    "id": "gal-67",
    "title": "Winter Sessions I & II Academic Testing & Honors (Photo 13)",
    "session": "Winter Sessions I & II",
    "category": "Foundation",
    "image": "/pictures/Winter Session 1 and 2/WhatsApp Image 2026-07-14 at 2.44.21 PM.jpeg",
    "description": "Historic merit evaluation and academic award distribution for deserving students."
  },
  {
    "id": "gal-68",
    "title": "Winter Sessions I & II Academic Testing & Honors (Photo 14)",
    "session": "Winter Sessions I & II",
    "category": "Foundation",
    "image": "/pictures/Winter Session 1 and 2/WhatsApp Image 2026-07-14 at 2.44.22 PM.jpeg",
    "description": "Historic merit evaluation and academic award distribution for deserving students."
  }
];

export const SIX_PILLARS = [
  {
    title: 'Pure Meritocracy',
    description: 'Zero nepotism, zero quotas for influence. Every seat is won through verified scores and transparent OMR scanning.',
    icon: 'Award'
  },
  {
    title: '100% Self-Funded',
    description: 'Funded directly by AZM Group of Companies. We do not collect public donations or third-party charity funds.',
    icon: 'ShieldCheck'
  },
  {
    title: 'Question Bank Transparency',
    description: '100% of exam questions are derived directly from published ~1,000 MCQs course books per grade level.',
    icon: 'BookCheck'
  },
  {
    title: 'Electronic OMR Scanning',
    description: 'Objective optical answer sheet scoring with instant result ledger verification and digital carbon verification.',
    icon: 'ScanLine'
  },
  {
    title: '6-Member Panel Scrutiny',
    description: 'Interviews conducted by independent educationists to evaluate critical thinking and verify financial need.',
    icon: 'Users'
  },
  {
    title: 'Direct Award Disbursal',
    description: 'Stipends, laptops, and cash prizes handed directly to students or their institutions with open auditing.',
    icon: 'Gift'
  }
];
