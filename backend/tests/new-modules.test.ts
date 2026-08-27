import http from 'http';
import app from '../src/app';
import { signAccessToken } from '../src/lib/jwt';
import { Role } from '@prisma/client';

async function runTests() {
  console.log('🚀 Running Integration Tests for New Modules (Users, Test Centers, Exam Halls, Grievances, Results)...\n');

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const port = address.port;
  const baseUrl = `http://localhost:${port}`;
  console.log(`Test server running at ${baseUrl}\n`);

  let testsPassed = 0;
  let testsFailed = 0;

  function assert(condition: boolean, testName: string, detail?: any) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      testsPassed++;
    } else {
      console.error(`❌ FAIL: ${testName}`, detail || '');
      testsFailed++;
    }
  }

  // Generate tokens for Super Admin, Admin, and Teacher
  const superAdminToken = signAccessToken({
    userId: 'test-superadmin-id',
    email: 'chief.admin@azmaio.com',
    role: Role.SUPER_ADMIN,
    name: 'Super Admin',
  });

  const adminToken = signAccessToken({
    userId: 'test-admin-id',
    email: 'exam.controller@azmaio.com',
    role: Role.ADMIN,
    name: 'Admin User',
  });

  const teacherToken = signAccessToken({
    userId: 'test-teacher-id',
    email: 'invigilator.lead@azmaio.com',
    role: Role.TEACHER,
    name: 'Teacher User',
  });

  try {
    // -------------------------------------------------------------
    // 1. User Management Tests (SUPER_ADMIN only)
    // -------------------------------------------------------------
    console.log('--- 1. Testing User Management ---');

    // 1.1 Forbidden for Teacher
    const teacherUsersRes = await fetch(`${baseUrl}/api/users`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    assert(teacherUsersRes.status === 403, 'Teacher cannot access /api/users (403 Forbidden)');

    // 1.2 Forbidden for Admin
    const adminUsersRes = await fetch(`${baseUrl}/api/users`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(adminUsersRes.status === 403, 'Admin cannot access /api/users (403 Forbidden)');

    // 1.3 Allowed for Super Admin
    const superAdminUsersRes = await fetch(`${baseUrl}/api/users`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    const usersData = (await superAdminUsersRes.json()) as any;
    assert(superAdminUsersRes.status === 200 && Array.isArray(usersData.data), 'Super Admin can list all users');
    assert(usersData.data.length >= 4, 'Users list includes seeded accounts (Super Admin, Admin, Teacher, Accountant)');

    // 1.4 Create New User
    const testEmail = `test_examiner_${Date.now()}@azmaio.com`;
    const createRes = await fetch(`${baseUrl}/api/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        name: 'New Test Examiner',
        email: testEmail,
        password: 'Password123!',
        role: 'TEACHER',
        status: 'ACTIVE',
      }),
    });
    const createData = (await createRes.json()) as any;
    assert(createRes.status === 201 && createData.success === true, 'Super Admin can create a new user account');
    const createdUserId = createData.data?.id;

    // 1.5 Update User Role / Name
    if (createdUserId) {
      const updateRes = await fetch(`${baseUrl}/api/users/${createdUserId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({
          name: 'Updated Examiner Name',
          role: 'ACCOUNTANT',
        }),
      });
      const updateData = (await updateRes.json()) as any;
      assert(
        updateRes.status === 200 && updateData.data?.name === 'Updated Examiner Name' && updateData.data?.role === 'ACCOUNTANT',
        'Super Admin can update user details and role'
      );

      // 1.6 Delete User
      const deleteRes = await fetch(`${baseUrl}/api/users/${createdUserId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${superAdminToken}` },
      });
      assert(deleteRes.status === 200, 'Super Admin can delete user account');
    }

    // -------------------------------------------------------------
    // 2. Test Centers Tests
    // -------------------------------------------------------------
    console.log('\n--- 2. Testing Test Centers ---');

    // 2.1 Public listing
    const getCentersRes = await fetch(`${baseUrl}/api/test-centers`);
    const centersData = (await getCentersRes.json()) as any;
    assert(getCentersRes.status === 200 && Array.isArray(centersData.data), 'Public / authenticated listing of test centers');
    assert(centersData.data.length >= 4, 'Includes 4 seeded regional test centers (Mansehra, Abbottabad, Haripur, Battagram)');

    // 2.2 Create Test Center (Admin)
    const testCode = `TC-TEST-${Date.now().toString().slice(-4)}`;
    const createCenterRes = await fetch(`${baseUrl}/api/test-centers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'New Custom Test Center',
        code: testCode,
        campus: 'West Wing Campus',
        address: 'Balan Road, Mansehra',
        district: 'Mansehra',
        capacity: 200,
        reportingTime: '08:30 AM',
      }),
    });
    const createCenterData = (await createCenterRes.json()) as any;
    assert(createCenterRes.status === 201 && createCenterData.success === true, 'Admin can create a new Test Center');
    const createdCenterId = createCenterData.data?.id;

    // 2.3 Update Test Center
    if (createdCenterId) {
      const updateCenterRes = await fetch(`${baseUrl}/api/test-centers/${createdCenterId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ capacity: 250 }),
      });
      const updateCenterData = (await updateCenterRes.json()) as any;
      assert(updateCenterRes.status === 200 && updateCenterData.data?.capacity === 250, 'Admin can update Test Center capacity');

      // 2.4 Delete Test Center
      const deleteCenterRes = await fetch(`${baseUrl}/api/test-centers/${createdCenterId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert(deleteCenterRes.status === 200, 'Admin can delete Test Center');
    }

    // -------------------------------------------------------------
    // 3. Exam Halls Tests
    // -------------------------------------------------------------
    console.log('\n--- 3. Testing Exam Halls ---');

    // 3.1 Listing halls
    const getHallsRes = await fetch(`${baseUrl}/api/exam-halls`);
    const hallsData = (await getHallsRes.json()) as any;
    assert(getHallsRes.status === 200 && Array.isArray(hallsData.data), 'Can fetch exam halls list');
    assert(hallsData.data.length >= 6, 'Includes 6 seeded examination halls (Hall A through Hall F)');

    // 3.2 Create Custom Room
    const createHallRes = await fetch(`${baseUrl}/api/exam-halls`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Hall G (Special Needs Assessment Room)',
        roomNumber: `Room-${Date.now().toString().slice(-3)}`,
        targetClass: 'Class 9th',
        wing: 'Ground Floor',
        capacity: 40,
        invigilatorName: 'Dr. Sumama Khan',
      }),
    });
    const createHallData = (await createHallRes.json()) as any;
    assert(createHallRes.status === 201 && createHallData.success === true, 'Admin can create a custom exam hall');
    const createdHallId = createHallData.data?.id;

    if (createdHallId) {
      // Clean up created hall
      await fetch(`${baseUrl}/api/exam-halls/${createdHallId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
    }

    // -------------------------------------------------------------
    // 4. Grievance Desk Tests
    // -------------------------------------------------------------
    console.log('\n--- 4. Testing Grievance Ticketing ---');

    // 4.1 Public Submit Grievance
    const createGrievanceRes = await fetch(`${baseUrl}/api/grievances`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Asad Ali',
        phone: '03001234567',
        email: 'candidate@example.com',
        category: 'Roll Number Slip Issue',
        cnicOrRollNo: '13503-1234567-1',
        message: 'Need help retrieving my roll number slip for Session V examination.',
      }),
    });
    const grievanceData = (await createGrievanceRes.json()) as any;
    assert(
      createGrievanceRes.status === 201 &&
        grievanceData.success === true &&
        grievanceData.data?.ticketId?.startsWith('TKT-2026-'),
      'Public applicant can submit a grievance ticket and receives a tracking ticketId'
    );
    const createdGrievanceId = grievanceData.data?.id;

    // 4.2 Admin List Grievances
    const adminGrievancesRes = await fetch(`${baseUrl}/api/grievances`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const adminGrievanceData = (await adminGrievancesRes.json()) as any;
    assert(
      adminGrievancesRes.status === 200 && Array.isArray(adminGrievanceData.data),
      'Admin can list and view candidate grievance tickets'
    );

    // 4.3 Admin Update Ticket Status
    if (createdGrievanceId) {
      const updateTicketRes = await fetch(`${baseUrl}/api/grievances/${createdGrievanceId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          status: 'RESOLVED',
          response: 'Roll number slip has been emailed and sent via WhatsApp.',
        }),
      });
      const updateTicketData = (await updateTicketRes.json()) as any;
      assert(updateTicketRes.status === 200 && updateTicketData.data?.status === 'RESOLVED', 'Admin can resolve grievance ticket');
    }

    // -------------------------------------------------------------
    // 5. Results & Merit Desk Tests
    // -------------------------------------------------------------
    console.log('\n--- 5. Testing Results & Merit Desk ---');

    // 5.1 Public Merit List
    const meritRes = await fetch(`${baseUrl}/api/results/merit-list`);
    const meritData = (await meritRes.json()) as any;
    assert(meritRes.status === 200 && Array.isArray(meritData.data), 'Public merit list returns array of candidate records');

    // 5.2 Result Search by non-existent roll returns 404 with helpful message
    const searchRes = await fetch(`${baseUrl}/api/results/search?query=NONEXISTENT_ROLL_9999`);
    const searchData = (await searchRes.json()) as any;
    assert(
      searchRes.status === 404 && searchData.error?.message?.includes('20 November 2026'),
      'Searching unknown candidate result returns clean 404 notification of upcoming result announcement'
    );

  } finally {
    server.close();
  }

  console.log(`\n========================================`);
  console.log(`New Modules Tests Completed: ${testsPassed} Passed, ${testsFailed} Failed`);
  console.log(`========================================\n`);

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
