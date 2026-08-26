import fetch from 'node-fetch';

const API_BASE = 'http://localhost:5000/api';

async function runLiveIntegrationTest() {
  console.log('=== STARTING PHASE 7 LIVE BACKEND INTEGRATION TEST ===\n');

  // 1. Health check
  console.log('1. Checking backend health...');
  const healthRes = await fetch(`${API_BASE.replace('/api', '')}/api/health`);
  const health = (await healthRes.json()) as any;
  console.log('✓ Health status:', health.status, '| Database:', health.database?.status);

  // 2. Authentication
  console.log('\n2. Testing POST /api/auth/login with Super Admin credentials...');
  const loginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'superadmin@azmaio.com',
      password: 'AdminPassword123!',
    }),
  });
  const loginData = (await loginRes.json()) as any;
  if (!loginData.success) throw new Error('Login failed: ' + JSON.stringify(loginData));
  const token = loginData.data.accessToken;
  console.log('✓ Login successful! Issued JWT Access Token:', token.substring(0, 30) + '...');
  console.log('✓ User:', loginData.data.user.name, 'Role:', loginData.data.user.role);

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  // 3. Overview Dashboard
  console.log('\n3. Testing GET /api/dashboard/overview...');
  const dashRes = await fetch(`${API_BASE}/dashboard/overview`, { headers: authHeaders });
  const dashData = (await dashRes.json()) as any;
  console.log('✓ Dashboard Overview Response:', {
    totalStudents: dashData.data?.stats?.totalStudents,
    activeStaff: dashData.data?.stats?.activeStaffCount,
    attendanceToday: dashData.data?.attendanceToday?.attendancePercentage + '%',
    feeCollection: dashData.data?.feeCollection?.collectionPercentage + '%',
    netCashFlow: 'PKR ' + dashData.data?.financialFlow?.netCashFlow,
  });

  // 4. Public Student Registration
  console.log('\n4. Testing POST /api/students/register (Candidate Form)...');
  const studentPayload = {
    fullName: 'Hamza Khan Integration Test',
    fatherName: 'Tariq Khan',
    gender: 'MALE',
    dateOfBirth: '2009-05-15',
    age: 17,
    cnicOrBForm: `13101-${Date.now().toString().slice(-7)}-1`,
    nationality: 'Pakistani',
    religion: 'Islam',
    address: 'PMA Road, Abbottabad',
    district: 'Abbottabad',
    province: 'Khyber Pakhtunkhwa',
    parentMobile: '0300-9988776',
    currentClass: 'SSC-II (Class 10th)',
    schoolName: 'Govt Post Graduate College',
    boardOrUniversity: 'BISE Abbottabad',
    scholarshipCategory: 'GENERAL_MERIT',
    emergencyContact: '0300-9988776',
    emergencyRelation: 'Father',
    referralSource: 'Social Media & Campus Banner',
    academicRecords: [
      {
        examLevel: 'SSC-I (Class 9th)',
        boardOrUni: 'BISE Abbottabad',
        yearOfPassing: '2025',
        totalMarks: 550,
        obtainedMarks: 495,
        percentage: 90,
      },
    ],
    documents: {
      bformCnicCopy: true,
      fatherCnicCopy: true,
      passportPhotos: true,
      previousResultCard: true,
      domicileCertificate: true,
      incomeCertificate: false,
    },
  };

  const regRes = await fetch(`${API_BASE}/students/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(studentPayload),
  });
  const regData = (await regRes.json()) as any;
  if (!regData.success) throw new Error('Student registration failed: ' + JSON.stringify(regData));
  const newStudent = regData.data;
  console.log('✓ Student registered! ID:', newStudent.id, '| Roll No:', newStudent.rollNumber, '| App No:', newStudent.applicationNo);
  console.log('✓ Signed QR Token:', newStudent.qrToken);

  // 5. Test Biometric QR Scan
  console.log('\n5. Testing POST /api/attendance/scan with signed QR token...');
  const scanRes = await fetch(`${API_BASE}/attendance/scan`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      qrToken: newStudent.qrToken,
      status: 'PRESENT',
    }),
  });
  const scanData = (await scanRes.json()) as any;
  if (!scanData.success) throw new Error('Attendance scan failed: ' + JSON.stringify(scanData));
  console.log('✓ Biometric QR Attendance marked:', scanData.data?.attendance?.status, 'for', scanData.data?.student?.fullName);

  // 6. Test PDF export for Student
  console.log('\n6. Testing GET /api/students/:id/registration-pdf (Puppeteer Stream)...');
  const pdfRes = await fetch(`${API_BASE}/students/${newStudent.id}/registration-pdf`);
  const contentType = pdfRes.headers.get('content-type');
  const pdfBuffer = await pdfRes.arrayBuffer();
  console.log('✓ Student PDF generated! Content-Type:', contentType, '| Buffer Size:', pdfBuffer.byteLength, 'bytes');

  // 7. Test Partner Registration & PDF
  console.log('\n7. Testing POST /api/partners/register & GET /api/partners/:id/registration-pdf...');
  const partnerPayload = {
    institutionName: 'Apex College Abbottabad',
    institutionType: 'COLLEGE',
    campus: 'Main Campus',
    address: 'Supply Bazaar, Abbottabad',
    district: 'Abbottabad',
    province: 'Khyber Pakhtunkhwa',
    contactName: 'Prof. Aslam Khan',
    contactDesignation: 'Director Admissions',
    contactMobile: '0300-5544332',
    contactEmail: 'admissions@apex.edu.pk',
    classesOffered: ['SSC', 'HSSC'],
    studentStrength: 800,
    expectedApplicants: 120,
    agreedToTerms: true,
  };
  const partnerRes = await fetch(`${API_BASE}/partners/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(partnerPayload),
  });
  const partnerData = (await partnerRes.json()) as any;
  const newPartner = partnerData.data;
  console.log('✓ Partner Registered! ID:', newPartner.id, '| Partner Code:', newPartner.partnerCode);

  const partnerPdfRes = await fetch(`${API_BASE}/partners/${newPartner.id}/registration-pdf`);
  const partnerPdfBuffer = await partnerPdfRes.arrayBuffer();
  console.log('✓ Partner PDF generated! Buffer Size:', partnerPdfBuffer.byteLength, 'bytes');

  console.log('\n=== ALL PHASE 7 LIVE BACKEND INTEGRATION TESTS PASSED! ===');
}

if (require.main === module) {
  runLiveIntegrationTest().catch((err) => {
    console.error('❌ Integration Test Failed:', err);
    process.exit(1);
  });
}
