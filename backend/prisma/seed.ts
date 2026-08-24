import { prisma, Role } from '../src/lib/prisma';
import { hashPassword } from '../src/lib/hash';
import { logger } from '../src/lib/logger';

export async function seedDatabase() {
  logger.info('🌱 Seeding default accounts...');

  const superAdminPassword = 'AdminPassword123!';
  const passwordHash = await hashPassword(superAdminPassword);

  const superAdmin = await prisma.user.upsert({
    where: { email: 'superadmin@jadoon.edu.pk' },
    update: {
      passwordHash,
      role: Role.SUPER_ADMIN,
      name: 'Jadoon Super Admin',
    },
    create: {
      email: 'superadmin@jadoon.edu.pk',
      name: 'Jadoon Super Admin',
      passwordHash,
      role: Role.SUPER_ADMIN,
    },
  });

  // Seed a sample Teacher for testing role-based restrictions
  const teacherPassword = 'TeacherPassword123!';
  const teacherHash = await hashPassword(teacherPassword);
  const teacher = await prisma.user.upsert({
    where: { email: 'teacher@jadoon.edu.pk' },
    update: {
      passwordHash: teacherHash,
      role: Role.TEACHER,
      name: 'Ahmad Khan',
    },
    create: {
      email: 'teacher@jadoon.edu.pk',
      name: 'Ahmad Khan',
      passwordHash: teacherHash,
      role: Role.TEACHER,
    },
  });

  // Seed Admin
  const adminPassword = 'Admin123!';
  const adminHash = await hashPassword(adminPassword);
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@jadoon.edu.pk' },
    update: {
      passwordHash: adminHash,
      role: Role.ADMIN,
      name: 'Muhammad Rashid (Admin)',
    },
    create: {
      email: 'admin@jadoon.edu.pk',
      name: 'Muhammad Rashid (Admin)',
      passwordHash: adminHash,
      role: Role.ADMIN,
    },
  });

  // Seed Accountant
  const accountantPassword = 'Accountant123!';
  const accountantHash = await hashPassword(accountantPassword);
  const accountantUser = await prisma.user.upsert({
    where: { email: 'accountant@jadoon.edu.pk' },
    update: {
      passwordHash: accountantHash,
      role: Role.ACCOUNTANT,
      name: 'Kashif Finance',
    },
    create: {
      email: 'accountant@jadoon.edu.pk',
      name: 'Kashif Finance',
      passwordHash: accountantHash,
      role: Role.ACCOUNTANT,
    },
  });

  // Seed Test Centers
  logger.info('🏛️ Seeding default examination test centers...');
  const tcMansehra = await prisma.testCenter.upsert({
    where: { code: 'TC-MHR-01' },
    update: {
      name: 'AZM Examination Center - Mansehra Main Campus',
      campus: 'Main Academic Complex',
      address: 'Near College Chowk, Karakoram Highway, Mansehra',
      district: 'Mansehra',
      capacity: 450,
      reportingTime: '09:00 AM',
      testDate: 'Sunday, 15 November 2026',
      contactPerson: 'Prof. Dr. Sumama Khan',
      contactPhone: '0305-1755551',
      status: 'ACTIVE',
    },
    create: {
      name: 'AZM Examination Center - Mansehra Main Campus',
      code: 'TC-MHR-01',
      campus: 'Main Academic Complex',
      address: 'Near College Chowk, Karakoram Highway, Mansehra',
      district: 'Mansehra',
      capacity: 450,
      reportingTime: '09:00 AM',
      testDate: 'Sunday, 15 November 2026',
      contactPerson: 'Prof. Dr. Sumama Khan',
      contactPhone: '0305-1755551',
      status: 'ACTIVE',
    },
  });

  const tcAbbottabad = await prisma.testCenter.upsert({
    where: { code: 'TC-ATD-01' },
    update: {
      name: 'Govt. Post Graduate College No. 1, Abbottabad',
      campus: 'Science Block',
      address: 'Link Road, Mandian, Abbottabad',
      district: 'Abbottabad',
      capacity: 350,
      reportingTime: '09:00 AM',
      testDate: 'Sunday, 15 November 2026',
      contactPerson: 'Prof. Tariq Jadoon',
      contactPhone: '0305-1755551',
      status: 'ACTIVE',
    },
    create: {
      name: 'Govt. Post Graduate College No. 1, Abbottabad',
      code: 'TC-ATD-01',
      campus: 'Science Block',
      address: 'Link Road, Mandian, Abbottabad',
      district: 'Abbottabad',
      capacity: 350,
      reportingTime: '09:00 AM',
      testDate: 'Sunday, 15 November 2026',
      contactPerson: 'Prof. Tariq Jadoon',
      contactPhone: '0305-1755551',
      status: 'ACTIVE',
    },
  });

  const tcHaripur = await prisma.testCenter.upsert({
    where: { code: 'TC-HRP-01' },
    update: {
      name: 'Hazara Public School & College, Haripur',
      campus: 'Main Campus Hall',
      address: 'GT Road, Near Central Hospital, Haripur',
      district: 'Haripur',
      capacity: 300,
      reportingTime: '09:00 AM',
      testDate: 'Sunday, 15 November 2026',
      contactPerson: 'Sir Naveed Qureshi',
      contactPhone: '0305-1755551',
      status: 'ACTIVE',
    },
    create: {
      name: 'Hazara Public School & College, Haripur',
      code: 'TC-HRP-01',
      campus: 'Main Campus Hall',
      address: 'GT Road, Near Central Hospital, Haripur',
      district: 'Haripur',
      capacity: 300,
      reportingTime: '09:00 AM',
      testDate: 'Sunday, 15 November 2026',
      contactPerson: 'Sir Naveed Qureshi',
      contactPhone: '0305-1755551',
      status: 'ACTIVE',
    },
  });

  const tcBattagram = await prisma.testCenter.upsert({
    where: { code: 'TC-BTM-01' },
    update: {
      name: 'Regional Community Model College, Battagram',
      campus: 'Academic Hall',
      address: 'Bana Road, Battagram',
      district: 'Battagram',
      capacity: 250,
      reportingTime: '09:00 AM',
      testDate: 'Sunday, 15 November 2026',
      contactPerson: 'Madam Samina Bibi',
      contactPhone: '0305-1755551',
      status: 'ACTIVE',
    },
    create: {
      name: 'Regional Community Model College, Battagram',
      code: 'TC-BTM-01',
      campus: 'Academic Hall',
      address: 'Bana Road, Battagram',
      district: 'Battagram',
      capacity: 250,
      reportingTime: '09:00 AM',
      testDate: 'Sunday, 15 November 2026',
      contactPerson: 'Madam Samina Bibi',
      contactPhone: '0305-1755551',
      status: 'ACTIVE',
    },
  });

  // Seed Default Exam Halls linked to Main Campus
  logger.info('🏢 Seeding default examination rooms & halls...');
  const defaultHalls = [
    {
      name: 'Hall A (Junior Examination Wing)',
      roomNumber: 'Room 101-A',
      targetClass: 'Class 6th',
      wing: 'Ground Floor, East Wing',
      capacity: 60,
      invigilatorName: 'Prof. Asim Khan',
      invigilatorPhone: '0305-1755551',
      reportingTime: '09:00 AM',
      examDate: 'Sunday, 15 Nov 2026',
      testCenterId: tcMansehra.id,
    },
    {
      name: 'Hall B (Middle Standard Wing)',
      roomNumber: 'Room 102-B',
      targetClass: 'Class 7th',
      wing: 'Ground Floor, West Wing',
      capacity: 60,
      invigilatorName: 'Madam Samina Bibi',
      invigilatorPhone: '0305-1755551',
      reportingTime: '09:00 AM',
      examDate: 'Sunday, 15 Nov 2026',
      testCenterId: tcMansehra.id,
    },
    {
      name: 'Hall C (Middle Assessment Hall)',
      roomNumber: 'Room 201-C',
      targetClass: 'Class 8th',
      wing: '1st Floor, Academic Block',
      capacity: 75,
      invigilatorName: 'Sir Tariq Mahmood',
      invigilatorPhone: '0305-1755551',
      reportingTime: '09:00 AM',
      examDate: 'Sunday, 15 Nov 2026',
      testCenterId: tcMansehra.id,
    },
    {
      name: 'Hall D (Matric SSC-I Hall)',
      roomNumber: 'Room 202-D',
      targetClass: 'Class 9th',
      wing: '1st Floor, Science Wing',
      capacity: 80,
      invigilatorName: 'Sir Naveed Qureshi',
      invigilatorPhone: '0305-1755551',
      reportingTime: '09:00 AM',
      examDate: 'Sunday, 15 Nov 2026',
      testCenterId: tcMansehra.id,
    },
    {
      name: 'Hall E (Matric SSC-II Main Examination Hall)',
      roomNumber: 'Hall 301-E',
      targetClass: 'Class 10th',
      wing: '2nd Floor, Central Wing',
      capacity: 90,
      invigilatorName: 'Dr. Sumama Khan',
      invigilatorPhone: '0305-1755551',
      reportingTime: '09:00 AM',
      examDate: 'Sunday, 15 Nov 2026',
      testCenterId: tcMansehra.id,
    },
    {
      name: 'Hall F (Intermediate / College Wing)',
      roomNumber: 'Auditorium Hall',
      targetClass: '1st Year / 2nd Year',
      wing: 'Main Campus Central Auditorium',
      capacity: 150,
      invigilatorName: 'Prof. Dr. M. Jadoon (Chief Supt.)',
      invigilatorPhone: '0305-1755551',
      reportingTime: '09:00 AM',
      examDate: 'Sunday, 15 Nov 2026',
      testCenterId: tcMansehra.id,
    },
  ];

  for (const hall of defaultHalls) {
    const existing = await prisma.examHall.findFirst({
      where: { roomNumber: hall.roomNumber, testCenterId: hall.testCenterId },
    });
    if (!existing) {
      await prisma.examHall.create({ data: hall });
    }
  }

  logger.info('✅ Seed completed successfully:');
  logger.info(`   - Super Admin: ${superAdmin.email} (Password: ${superAdminPassword})`);
  logger.info(`   - Admin:       ${adminUser.email} (Password: ${adminPassword})`);
  logger.info(`   - Teacher:     ${teacher.email} (Password: ${teacherPassword})`);
  logger.info(`   - Accountant:  ${accountantUser.email} (Password: ${accountantPassword})`);
  logger.info(`   - Test Centers: 4 regional centers created`);
  logger.info(`   - Exam Halls:   6 examination halls created`);

  return { superAdmin, adminUser, teacher, accountantUser, tcMansehra, tcAbbottabad, tcHaripur, tcBattagram };
}

async function main() {
  await seedDatabase();
}

// When run directly as a script (e.g. `npx prisma db seed` or `npm run seed`)
if (require.main === module || !process.env.TEST_ENV) {
  main()
    .catch((e) => {
      logger.error('Seed error:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
