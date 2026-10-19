-- Enum must commit before subsequent migration uses PRE_OPEN.
ALTER TYPE "AttendanceSessionStatus" ADD VALUE 'PRE_OPEN';
