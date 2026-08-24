import { PrismaClient, Role, StudentStatus, Gender, ScholarshipCategory, AttendanceStatus, AttendanceMethod, FeeStatus, StaffStatus, PayrollStatus, TransactionType } from '@prisma/client';
import { logger } from './logger';

// In-memory fallback store for local development when Postgres is offline
class MemoryStore {
  users: Map<string, any> = new Map();
  students: Map<string, any> = new Map();
  attendances: Map<string, any> = new Map();
  feeRecords: Map<string, any> = new Map();
  staffs: Map<string, any> = new Map();
  payrollRecords: Map<string, any> = new Map();
  transactions: Map<string, any> = new Map();
  partners: Map<string, any> = new Map();

  createInMemoryPrismaClient() {
    let idCounter = 1;
    const generateId = () => `cuid_${Date.now()}_${idCounter++}`;

    return {
      $connect: async () => {},
      $disconnect: async () => {},
      $queryRaw: async () => [{ result: 1 }],
      user: {
        findUnique: async ({ where }: { where: { email?: string; id?: string } }) => {
          for (const u of this.users.values()) {
            if (where.email && u.email.toLowerCase() === where.email.toLowerCase()) return { ...u };
            if (where.id && u.id === where.id) return { ...u };
          }
          return null;
        },
        findFirst: async ({ where }: { where?: any } = {}) => {
          for (const u of this.users.values()) {
            if (!where) return { ...u };
            if (where.email && u.email.toLowerCase() === where.email.toLowerCase()) return { ...u };
            if (where.role && u.role === where.role) return { ...u };
          }
          return null;
        },
        findMany: async ({ where }: { where?: any } = {}) => {
          const results: any[] = [];
          for (const u of this.users.values()) {
            if (!where || (where.role && u.role === where.role)) {
              results.push({ ...u });
            }
          }
          return results;
        },
        create: async ({ data }: { data: any }) => {
          const id = data.id || generateId();
          const record = {
            id,
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          this.users.set(id, record);
          return { ...record };
        },
        upsert: async ({ where, update, create }: { where: any; update: any; create: any }) => {
          let existing = null;
          for (const u of this.users.values()) {
            if (where.email && u.email.toLowerCase() === where.email.toLowerCase()) existing = u;
            if (where.id && u.id === where.id) existing = u;
          }
          if (existing) {
            const updated = { ...existing, ...update, updatedAt: new Date() };
            this.users.set(existing.id, updated);
            return { ...updated };
          } else {
            const id = create.id || generateId();
            const record = { id, ...create, createdAt: new Date(), updatedAt: new Date() };
            this.users.set(id, record);
            return { ...record };
          }
        },
        count: async () => this.users.size,
        deleteMany: async () => {
          const count = this.users.size;
          this.users.clear();
          return { count };
        },
      },
      student: {
        findUnique: async ({ where }: { where: any }) => {
          for (const s of this.students.values()) {
            if (where.id && s.id === where.id) return { ...s };
            if (where.qrToken && s.qrToken === where.qrToken) return { ...s };
            if (where.rollNumber && s.rollNumber === where.rollNumber) return { ...s };
            if (where.cnicOrBForm && s.cnicOrBForm === where.cnicOrBForm) return { ...s };
            if (where.applicationNo && s.applicationNo === where.applicationNo) return { ...s };
          }
          return null;
        },
        findMany: async (_args?: any) => Array.from(this.students.values()),
        create: async ({ data }: { data: any }) => {
          const id = data.id || generateId();
          const record = { id, ...data, createdAt: new Date(), updatedAt: new Date() };
          this.students.set(id, record);
          return { ...record };
        },
        count: async () => this.students.size,
      },
      attendance: {
        findUnique: async ({ where }: { where: any }) => {
          if (where.studentId_date) {
            for (const a of this.attendances.values()) {
              if (a.studentId === where.studentId_date.studentId) {
                const aDate = new Date(a.date).toISOString().split('T')[0];
                const targetDate = new Date(where.studentId_date.date).toISOString().split('T')[0];
                if (aDate === targetDate) return { ...a };
              }
            }
          }
          return null;
        },
        findMany: async () => Array.from(this.attendances.values()),
        create: async ({ data }: { data: any }) => {
          const id = data.id || generateId();
          const record = { id, ...data, createdAt: new Date() };
          this.attendances.set(id, record);
          return { ...record };
        },
      },
      feeRecord: {
        findMany: async () => Array.from(this.feeRecords.values()),
        create: async ({ data }: { data: any }) => {
          const id = data.id || generateId();
          const record = { id, ...data, createdAt: new Date(), updatedAt: new Date() };
          this.feeRecords.set(id, record);
          return { ...record };
        },
      },
      staff: {
        findMany: async () => Array.from(this.staffs.values()),
        create: async ({ data }: { data: any }) => {
          const id = data.id || generateId();
          const record = { id, ...data, createdAt: new Date(), updatedAt: new Date() };
          this.staffs.set(id, record);
          return { ...record };
        },
      },
      payrollRecord: {
        findMany: async () => Array.from(this.payrollRecords.values()),
        create: async ({ data }: { data: any }) => {
          const id = data.id || generateId();
          const record = { id, ...data, createdAt: new Date(), updatedAt: new Date() };
          this.payrollRecords.set(id, record);
          return { ...record };
        },
      },
      transaction: {
        findMany: async () => Array.from(this.transactions.values()),
        create: async ({ data }: { data: any }) => {
          const id = data.id || generateId();
          const record = { id, ...data, createdAt: new Date() };
          this.transactions.set(id, record);
          return { ...record };
        },
      },
    };
  }
}

const memoryStore = new MemoryStore();
const memoryPrisma = memoryStore.createInMemoryPrismaClient();

// Real Prisma client instance
const realPrisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

// Resilient wrapper: routes queries to real DB if reachable, otherwise uses MemoryStore
let isDbAvailable: boolean | null = null;

async function checkDbAvailability(): Promise<boolean> {
  try {
    await realPrisma.$queryRaw`SELECT 1`;
    isDbAvailable = true;
    return true;
  } catch {
    isDbAvailable = false;
    return false;
  }
}

export const prisma = new Proxy(realPrisma, {
  get(target: any, prop: string | symbol) {
    if (prop === '$queryRaw' || prop === '$connect' || prop === '$disconnect') {
      return async (...args: any[]) => {
        try {
          return await target[prop](...args);
        } catch {
          return (memoryPrisma as any)[prop]?.(...args);
        }
      };
    }

    const targetModel = target[prop];
    const memoryModel = (memoryPrisma as any)[prop];

    if (typeof targetModel === 'object' && targetModel !== null && memoryModel) {
      return new Proxy(targetModel, {
        get(mTarget: any, mProp: string | symbol) {
          const realMethod = mTarget[mProp];
          const memMethod = memoryModel[mProp];

          if (typeof realMethod === 'function') {
            return async (...args: any[]) => {
              if (isDbAvailable === true) {
                try {
                  return await realMethod.apply(mTarget, args);
                } catch (err: any) {
                  // If connection error, fall back to memory
                  if (err.message && err.message.includes("Can't reach database server")) {
                    isDbAvailable = false;
                    logger.warn(`Postgres unreachable. Falling back to in-memory store for ${String(prop)}.${String(mProp)}`);
                    return memMethod ? memMethod.apply(memoryModel, args) : null;
                  }
                  throw err;
                }
              } else if (isDbAvailable === false) {
                return memMethod ? memMethod.apply(memoryModel, args) : null;
              } else {
                // Check once
                const available = await checkDbAvailability();
                if (available) {
                  return realMethod.apply(mTarget, args);
                } else {
                  return memMethod ? memMethod.apply(memoryModel, args) : null;
                }
              }
            };
          }
          return realMethod;
        },
      });
    }

    return targetModel;
  },
}) as unknown as PrismaClient;

export { Role, StudentStatus, Gender, ScholarshipCategory, AttendanceStatus, AttendanceMethod, FeeStatus, StaffStatus, PayrollStatus, TransactionType };
