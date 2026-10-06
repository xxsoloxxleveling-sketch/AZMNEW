import '../src/config/env';
import { prisma, Role } from '../src/lib/prisma';
import { hashPassword } from '../src/lib/hash';
import { passwordPolicySchema } from '../src/lib/passwordPolicy';
import { logger } from '../src/lib/logger';
import { z } from 'zod';

const bootstrapSchema = z.object({
  name: z.string().min(1, 'INITIAL_SUPER_ADMIN_NAME is required').trim(),
  email: z.string().email('INITIAL_SUPER_ADMIN_EMAIL must be a valid email address').trim().toLowerCase(),
  password: passwordPolicySchema,
});

export async function bootstrapAdmin(): Promise<void> {
  const rawName = process.env.INITIAL_SUPER_ADMIN_NAME;
  const rawEmail = process.env.INITIAL_SUPER_ADMIN_EMAIL;
  const rawPassword = process.env.INITIAL_SUPER_ADMIN_PASSWORD;

  if (!rawName || !rawEmail || !rawPassword) {
    logger.error(
      'Bootstrap failed: Missing required environment variables: INITIAL_SUPER_ADMIN_NAME, INITIAL_SUPER_ADMIN_EMAIL, INITIAL_SUPER_ADMIN_PASSWORD.'
    );
    process.exit(1);
  }

  const parseResult = bootstrapSchema.safeParse({
    name: rawName,
    email: rawEmail,
    password: rawPassword,
  });

  if (!parseResult.success) {
    const errorMsg = parseResult.error.errors.map((e) => e.message).join('; ');
    logger.error(`Bootstrap failed: Validation error: ${errorMsg}`);
    process.exit(1);
  }

  const { name, email, password } = parseResult.data;

  // Check if ANY SUPER_ADMIN already exists
  const existingSuperAdminCount = await prisma.user.count({
    where: {
      role: Role.SUPER_ADMIN,
    },
  });

  if (existingSuperAdminCount > 0) {
    logger.info(
      `Bootstrap skipped: A SUPER_ADMIN account already exists in the system (${existingSuperAdminCount} found).`
    );
    return;
  }

  // Check if a user with this email already exists under another role
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    logger.error(
      `Bootstrap failed: A user with email "${email}" already exists with role "${existingUser.role}".`
    );
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);

  const newSuperAdmin = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      role: Role.SUPER_ADMIN,
      status: 'ACTIVE',
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      createdAt: true,
    },
  });

  logger.info(
    `✅ Bootstrap completed: Initial SUPER_ADMIN account successfully created for "${newSuperAdmin.email}" (ID: ${newSuperAdmin.id}).`
  );
}

if (require.main === module) {
  bootstrapAdmin()
    .catch((err) => {
      logger.error('Bootstrap script encountered an unexpected error:', err.message || err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
