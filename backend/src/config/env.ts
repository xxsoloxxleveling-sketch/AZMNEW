import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('5000').transform((v) => parseInt(v, 10)),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DIRECT_URL: z.string().optional(),
  JWT_ACCESS_SECRET: z.string().default('azm-aio-production-jwt-access-secret-2026-v1'),
  JWT_REFRESH_SECRET: z.string().default('azm-aio-production-jwt-refresh-secret-2026-v1'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('30d'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('90d'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  FRONTEND_URL: z.string().optional(),
  QR_SECRET: z.string().default('azm-aio-production-qr-biometric-secret-2026-v1'),
  SUPABASE_URL: z.string().optional().default('https://amteshciynijqkxapjwd.supabase.co'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', JSON.stringify(parsed.error.format(), null, 2));
  process.exit(1);
}

export const env = parsed.data;
