import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('5000').transform((v) => parseInt(v, 10)),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DIRECT_URL: z.string().optional(),
  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be at least 16 characters').default('azm-aio-dev-access-secret-key-32chars!!'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 characters').default('azm-aio-dev-refresh-secret-key-32chars!!'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('30d'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('90d'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  FRONTEND_URL: z.string().optional(),
  QR_SECRET: z.string().min(16, 'QR_SECRET must be at least 16 characters').default('azm-aio-dev-qr-biometric-secret-32chars!!'),
  SUPABASE_URL: z.string().optional().default('https://amteshciynijqkxapjwd.supabase.co'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', JSON.stringify(parsed.error.format(), null, 2));
  process.exit(1);
}

// Production safety assertions: fail immediately if production uses development fallback secrets
if (parsed.data.NODE_ENV === 'production') {
  if (
    !process.env.JWT_ACCESS_SECRET ||
    parsed.data.JWT_ACCESS_SECRET.includes('dev-access-secret')
  ) {
    console.error('❌ CRITICAL SECURITY ALERT: JWT_ACCESS_SECRET is required and cannot be a default development secret in production.');
    process.exit(1);
  }

  if (
    !process.env.JWT_REFRESH_SECRET ||
    parsed.data.JWT_REFRESH_SECRET.includes('dev-refresh-secret')
  ) {
    console.error('❌ CRITICAL SECURITY ALERT: JWT_REFRESH_SECRET is required and cannot be a default development secret in production.');
    process.exit(1);
  }

  if (
    !process.env.QR_SECRET ||
    parsed.data.QR_SECRET.includes('dev-qr-biometric')
  ) {
    console.error('❌ CRITICAL SECURITY ALERT: QR_SECRET is required and cannot be a default development secret in production.');
    process.exit(1);
  }
}

export const env = parsed.data;
