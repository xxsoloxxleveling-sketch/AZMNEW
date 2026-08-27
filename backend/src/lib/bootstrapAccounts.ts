import { prisma, Role } from './prisma';
import { hashPassword } from './hash';
import { logger } from './logger';

export async function bootstrapAccounts() {
  try {
    // 1. Purge all obsolete / legacy accounts so NO ONE can login with old credentials
    const obsoleteEmails = [
      'superadmin@jadoon.edu.pk',
      'admin@jadoon.edu.pk',
      'teacher@jadoon.edu.pk',
      'accountant@jadoon.edu.pk',
      'superadmin@azmaio.com',
      'admin@azmaio.com',
      'teacher@azmaio.com',
      'accountant@azmaio.com',
    ];

    await prisma.user.deleteMany({
      where: {
        email: { in: obsoleteEmails },
      },
    });

    // 2. Super Admin (Chief Administrator)
    const superAdminEmail = 'chief.admin@azmaio.com';
    const superAdminPassword = 'Azm@Admin#992026!';
    const superAdminHash = await hashPassword(superAdminPassword);

    await prisma.user.upsert({
      where: { email: superAdminEmail },
      update: {
        passwordHash: superAdminHash,
        role: Role.SUPER_ADMIN,
        name: 'AZM.AIO Chief Administrator',
        status: 'ACTIVE',
      },
      create: {
        email: superAdminEmail,
        name: 'AZM.AIO Chief Administrator',
        passwordHash: superAdminHash,
        role: Role.SUPER_ADMIN,
        status: 'ACTIVE',
      },
    });

    // 3. Admin (Examination & Admissions Controller)
    const adminEmail = 'exam.controller@azmaio.com';
    const adminPassword = 'Azm@ExamDesk#2026!';
    const adminHash = await hashPassword(adminPassword);

    await prisma.user.upsert({
      where: { email: adminEmail },
      update: {
        passwordHash: adminHash,
        role: Role.ADMIN,
        name: 'Examination & Admissions Controller',
        status: 'ACTIVE',
      },
      create: {
        email: adminEmail,
        name: 'Examination & Admissions Controller',
        passwordHash: adminHash,
        role: Role.ADMIN,
        status: 'ACTIVE',
      },
    });

    // 4. Accountant (Finance & Accounts Desk)
    const accountantEmail = 'finance.officer@azmaio.com';
    const accountantPassword = 'Azm@Accounts#2026!';
    const accountantHash = await hashPassword(accountantPassword);

    await prisma.user.upsert({
      where: { email: accountantEmail },
      update: {
        passwordHash: accountantHash,
        role: Role.ACCOUNTANT,
        name: 'Finance & Accounts Officer',
        status: 'ACTIVE',
      },
      create: {
        email: accountantEmail,
        name: 'Finance & Accounts Officer',
        passwordHash: accountantHash,
        role: Role.ACCOUNTANT,
        status: 'ACTIVE',
      },
    });

    // 5. Teacher / Lead Invigilator
    const teacherEmail = 'invigilator.lead@azmaio.com';
    const teacherPassword = 'Azm@Invigilation#2026!';
    const teacherHash = await hashPassword(teacherPassword);

    await prisma.user.upsert({
      where: { email: teacherEmail },
      update: {
        passwordHash: teacherHash,
        role: Role.TEACHER,
        name: 'Chief Invigilator & Test Supervisor',
        status: 'ACTIVE',
      },
      create: {
        email: teacherEmail,
        name: 'Chief Invigilator & Test Supervisor',
        passwordHash: teacherHash,
        role: Role.TEACHER,
        status: 'ACTIVE',
      },
    });

    logger.info('🔐 Default accounts synchronized & legacy credentials purged successfully.');
  } catch (err: any) {
    logger.warn('Failed to bootstrap accounts during server startup:', err?.message || err);
  }
}
