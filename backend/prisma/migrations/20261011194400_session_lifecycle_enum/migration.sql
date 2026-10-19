-- Separate transaction is required before the new enum value can be used.
ALTER TYPE "AttendanceSessionStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
