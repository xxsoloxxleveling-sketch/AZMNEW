import { seedDatabase } from '../src/lib/seed';
import { prisma } from '../src/lib/prisma';
import { logger } from '../src/lib/logger';

async function main() {
  await seedDatabase();
}

main()
  .catch((e) => {
    logger.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
