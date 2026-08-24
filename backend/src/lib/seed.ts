import { prisma, Role } from './prisma';
import { hashPassword } from './hash';
import { logger } from './logger';

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

  logger.info('✅ Seed completed successfully:');
  logger.info(`   - Super Admin: ${superAdmin.email} (Password: ${superAdminPassword})`);
  logger.info(`   - Admin:       ${adminUser.email} (Password: ${adminPassword})`);
  logger.info(`   - Teacher:     ${teacher.email} (Password: ${teacherPassword})`);
  logger.info(`   - Accountant:  ${accountantUser.email} (Password: ${accountantPassword})`);

  return { superAdmin, adminUser, teacher, accountantUser };
}
