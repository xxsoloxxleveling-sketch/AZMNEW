import { PrismaClient, Role, StudentStatus, Gender, ScholarshipCategory, AttendanceStatus, AttendanceMethod, FeeStatus, StaffStatus, PayrollStatus, TransactionType, EligibilityStatus, FinalStatus, InstitutionType, PartnerStatus, GrievanceStatus } from '@prisma/client';
import { logger } from './logger';

// In-memory fallback store for local development when Postgres is offline
class MemoryStore {
  users: Map<string, any> = new Map();
  students: Map<string, any> = new Map();
  academicRecords: Map<string, any> = new Map();
  documentChecklists: Map<string, any> = new Map();
  officeUseRecords: Map<string, any> = new Map();
  partnerInstitutions: Map<string, any> = new Map();
  attendances: Map<string, any> = new Map();
  feeRecords: Map<string, any> = new Map();
  staffs: Map<string, any> = new Map();
  payrollRecords: Map<string, any> = new Map();
  transactions: Map<string, any> = new Map();

  createInMemoryPrismaClient() {
    let idCounter = 1;
    const generateId = () => `cuid_${Date.now()}_${idCounter++}`;

    const attachRelations = (student: any) => {
      if (!student) return null;
      const records = Array.from(this.academicRecords.values()).filter(
        (r) => r.studentId === student.id
      );
      const docs = Array.from(this.documentChecklists.values()).find(
        (d) => d.studentId === student.id
      ) || null;
      const office = Array.from(this.officeUseRecords.values()).find(
        (o) => o.studentId === student.id
      ) || null;

      return {
        ...student,
        academicRecords: records,
        documents: docs,
        officeUse: office,
      };
    };

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
        findUnique: async ({ where, include }: { where: any; include?: any }) => {
          for (const s of this.students.values()) {
            if (where.id && s.id === where.id) return include ? attachRelations(s) : { ...s };
            if (where.qrToken && s.qrToken === where.qrToken) return include ? attachRelations(s) : { ...s };
            if (where.rollNumber && s.rollNumber === where.rollNumber) return include ? attachRelations(s) : { ...s };
            if (where.cnicOrBForm && s.cnicOrBForm === where.cnicOrBForm) return include ? attachRelations(s) : { ...s };
            if (where.applicationNo && s.applicationNo === where.applicationNo) return include ? attachRelations(s) : { ...s };
          }
          return null;
        },
        findFirst: async ({ where, orderBy, include }: { where?: any; orderBy?: any; include?: any } = {}) => {
          let list = Array.from(this.students.values());
          if (where) {
            if (where.rollNumber?.startsWith) {
              list = list.filter((s) => s.rollNumber?.startsWith(where.rollNumber.startsWith));
            }
            if (where.applicationNo?.startsWith) {
              list = list.filter((s) => s.applicationNo?.startsWith(where.applicationNo.startsWith));
            }
          }
          if (orderBy) {
            const key = Object.keys(orderBy)[0];
            const dir = orderBy[key] === 'desc' ? -1 : 1;
            list.sort((a, b) => (a[key] > b[key] ? dir : -dir));
          }
          if (list.length === 0) return null;
          return include ? attachRelations(list[0]) : { ...list[0] };
        },
        findMany: async (args: { where?: any; skip?: number; take?: number; orderBy?: any; include?: any } = {}) => {
          let list = Array.from(this.students.values());
          const { where, skip = 0, take, orderBy, include } = args;

          if (where) {
            if (where.status) {
              list = list.filter((s) => s.status === where.status);
            }
            if (where.currentClass) {
              if (typeof where.currentClass === 'object' && where.currentClass.contains) {
                list = list.filter((s) => (s.currentClass || '').toLowerCase().includes(where.currentClass.contains.toLowerCase()));
              } else {
                list = list.filter((s) => s.currentClass === where.currentClass);
              }
            }
            if (where.gender) {
              list = list.filter((s) => s.gender === where.gender);
            }
            if (where.scholarshipCategory) {
              list = list.filter((s) => s.scholarshipCategory === where.scholarshipCategory);
            }
            if (where.OR && Array.isArray(where.OR)) {
              list = list.filter((s) =>
                where.OR.some((cond: any) => {
                  if (cond.fullName?.contains) {
                    return s.fullName?.toLowerCase().includes(cond.fullName.contains.toLowerCase());
                  }
                  if (cond.rollNumber?.contains) {
                    return s.rollNumber?.toLowerCase().includes(cond.rollNumber.contains.toLowerCase());
                  }
                  if (cond.cnicOrBForm?.contains) {
                    return s.cnicOrBForm?.toLowerCase().includes(cond.cnicOrBForm.contains.toLowerCase());
                  }
                  if (cond.applicationNo?.contains) {
                    return s.applicationNo?.toLowerCase().includes(cond.applicationNo.contains.toLowerCase());
                  }
                  return false;
                })
              );
            }
          }

          if (orderBy) {
            const key = Object.keys(orderBy)[0];
            const dir = orderBy[key] === 'desc' ? -1 : 1;
            list.sort((a, b) => {
              const valA = a[key] instanceof Date ? a[key].getTime() : a[key];
              const valB = b[key] instanceof Date ? b[key].getTime() : b[key];
              return valA > valB ? dir : -dir;
            });
          }

          const start = skip;
          const end = take !== undefined ? start + take : list.length;
          const sliced = list.slice(start, end);
          return include ? sliced.map((s) => attachRelations(s)) : sliced.map((s) => ({ ...s }));
        },
        create: async ({ data, include }: { data: any; include?: any }) => {
          const id = data.id || generateId();
          const { academicRecords, documents, officeUse, ...baseData } = data;

          const record = {
            id,
            status: 'ACTIVE',
            nationality: 'Pakistani',
            ...baseData,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          this.students.set(id, record);

          if (academicRecords?.create) {
            const items = Array.isArray(academicRecords.create)
              ? academicRecords.create
              : [academicRecords.create];
            for (const item of items) {
              const rId = generateId();
              this.academicRecords.set(rId, { id: rId, studentId: id, ...item });
            }
          }

          if (documents?.create) {
            const dId = generateId();
            this.documentChecklists.set(dId, { id: dId, studentId: id, ...documents.create });
          }

          if (officeUse?.create) {
            const oId = generateId();
            this.officeUseRecords.set(oId, { id: oId, studentId: id, ...officeUse.create });
          }

          return include ? attachRelations(record) : { ...record };
        },
        update: async ({ where, data, include }: { where: { id?: string; qrToken?: string }; data: any; include?: any }) => {
          let target = null;
          for (const s of this.students.values()) {
            if (where.id && s.id === where.id) target = s;
            if (where.qrToken && s.qrToken === where.qrToken) target = s;
          }
          if (!target) throw new Error('Student not found for update');
          const updated = {
            ...target,
            ...data,
            updatedAt: new Date(),
          };
          this.students.set(target.id, updated);
          return include ? attachRelations(updated) : { ...updated };
        },
        delete: async ({ where }: { where: { id: string } }) => {
          const target = this.students.get(where.id);
          if (!target) throw new Error('Student not found for deletion');
          this.students.delete(where.id);
          return { ...target };
        },
        count: async (args: { where?: any } = {}) => {
          if (!args.where) return this.students.size;
          const matching = await (this.createInMemoryPrismaClient().student.findMany({ where: args.where }));
          return matching.length;
        },
      },
      academicRecord: {
        create: async ({ data }: { data: any }) => {
          const id = data.id || generateId();
          const rec = { id, ...data };
          this.academicRecords.set(id, rec);
          return { ...rec };
        },
        findMany: async ({ where }: { where?: any } = {}) => {
          let list = Array.from(this.academicRecords.values());
          if (where?.studentId) list = list.filter((r) => r.studentId === where.studentId);
          return list.map((r) => ({ ...r }));
        },
        deleteMany: async ({ where }: { where?: any } = {}) => {
          let count = 0;
          for (const [id, r] of this.academicRecords.entries()) {
            if (where?.studentId && r.studentId === where.studentId) {
              this.academicRecords.delete(id);
              count++;
            }
          }
          return { count };
        },
      },
      documentChecklist: {
        findUnique: async ({ where }: { where: { studentId?: string; id?: string } }) => {
          for (const d of this.documentChecklists.values()) {
            if (where.studentId && d.studentId === where.studentId) return { ...d };
            if (where.id && d.id === where.id) return { ...d };
          }
          return null;
        },
        create: async ({ data }: { data: any }) => {
          const id = data.id || generateId();
          const rec = { id, ...data };
          this.documentChecklists.set(id, rec);
          return { ...rec };
        },
        upsert: async ({ where, update, create }: { where: any; update: any; create: any }) => {
          let existing = null;
          for (const d of this.documentChecklists.values()) {
            if (where.studentId && d.studentId === where.studentId) existing = d;
          }
          if (existing) {
            const updated = { ...existing, ...update };
            this.documentChecklists.set(existing.id, updated);
            return { ...updated };
          } else {
            const id = create.id || generateId();
            const record = { id, ...create };
            this.documentChecklists.set(id, record);
            return { ...record };
          }
        },
      },
      officeUseRecord: {
        findUnique: async ({ where }: { where: { studentId?: string; id?: string } }) => {
          for (const o of this.officeUseRecords.values()) {
            if (where.studentId && o.studentId === where.studentId) return { ...o };
            if (where.id && o.id === where.id) return { ...o };
          }
          return null;
        },
        create: async ({ data }: { data: any }) => {
          const id = data.id || generateId();
          const rec = { id, ...data };
          this.officeUseRecords.set(id, rec);
          return { ...rec };
        },
        upsert: async ({ where, update, create }: { where: any; update: any; create: any }) => {
          let existing = null;
          for (const o of this.officeUseRecords.values()) {
            if (where.studentId && o.studentId === where.studentId) existing = o;
          }
          if (existing) {
            const updated = { ...existing, ...update };
            this.officeUseRecords.set(existing.id, updated);
            return { ...updated };
          } else {
            const id = create.id || generateId();
            const record = { id, ...create };
            this.officeUseRecords.set(id, record);
            return { ...record };
          }
        },
      },
      partnerInstitution: {
        findUnique: async ({ where }: { where: { id?: string; partnerCode?: string } }) => {
          for (const p of this.partnerInstitutions.values()) {
            if (where.id && p.id === where.id) return { ...p };
            if (where.partnerCode && p.partnerCode === where.partnerCode) return { ...p };
          }
          return null;
        },
        findMany: async ({ where, skip = 0, take, orderBy }: any = {}) => {
          let list = Array.from(this.partnerInstitutions.values());
          if (where?.status) list = list.filter((p) => p.status === where.status);
          if (where?.institutionType) list = list.filter((p) => p.institutionType === where.institutionType);
          if (where?.search) {
            const s = where.search.toLowerCase();
            list = list.filter(
              (p) =>
                p.institutionName.toLowerCase().includes(s) ||
                p.contactName.toLowerCase().includes(s) ||
                p.district.toLowerCase().includes(s)
            );
          }
          if (orderBy) {
            const key = Object.keys(orderBy)[0];
            const dir = orderBy[key] === 'desc' ? -1 : 1;
            list.sort((a, b) => (a[key] > b[key] ? dir : -dir));
          }
          const start = skip;
          const end = take !== undefined ? start + take : list.length;
          return list.slice(start, end).map((p) => ({ ...p }));
        },
        create: async ({ data }: { data: any }) => {
          const id = data.id || generateId();
          const record = {
            id,
            status: 'PENDING',
            agreedToTerms: true,
            applicationDate: new Date(),
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          this.partnerInstitutions.set(id, record);
          return { ...record };
        },
        update: async ({ where, data }: { where: { id: string }; data: any }) => {
          const target = this.partnerInstitutions.get(where.id);
          if (!target) throw new Error('Partner institution not found for update');
          const updated = { ...target, ...data, updatedAt: new Date() };
          this.partnerInstitutions.set(where.id, updated);
          return { ...updated };
        },
        count: async ({ where }: any = {}) => {
          if (!where) return this.partnerInstitutions.size;
          const list = await (this.createInMemoryPrismaClient().partnerInstitution.findMany({ where }));
          return list.length;
        },
      },
      attendance: {
        findUnique: async ({ where, include }: { where: any; include?: any }) => {
          for (const a of this.attendances.values()) {
            if (where.id && a.id === where.id) {
              return include?.student ? { ...a, student: this.students.get(a.studentId) } : { ...a };
            }
            if (where.studentId_date) {
              if (a.studentId === where.studentId_date.studentId) {
                const aDate = new Date(a.date).toISOString().split('T')[0];
                const targetDate = new Date(where.studentId_date.date).toISOString().split('T')[0];
                if (aDate === targetDate) {
                  return include?.student ? { ...a, student: this.students.get(a.studentId) } : { ...a };
                }
              }
            }
          }
          return null;
        },
        findFirst: async ({ where, include, orderBy }: any = {}) => {
          let list = Array.from(this.attendances.values());
          if (where?.studentId) list = list.filter((a) => a.studentId === where.studentId);
          if (where?.date) {
            if (where.date.gte && where.date.lte) {
              list = list.filter((a) => new Date(a.date) >= where.date.gte && new Date(a.date) <= where.date.lte);
            }
          }
          if (list.length === 0) return null;
          return include?.student ? { ...list[0], student: this.students.get(list[0].studentId) } : { ...list[0] };
        },
        findMany: async ({ where, include, orderBy }: any = {}) => {
          let list = Array.from(this.attendances.values());
          if (where?.studentId) list = list.filter((a) => a.studentId === where.studentId);
          if (where?.status) list = list.filter((a) => a.status === where.status);
          if (where?.method) list = list.filter((a) => a.method === where.method);
          if (where?.date) {
            if (where.date.gte && where.date.lte) {
              list = list.filter((a) => new Date(a.date) >= where.date.gte && new Date(a.date) <= where.date.lte);
            } else if (where.date instanceof Date) {
              const targetStr = where.date.toISOString().split('T')[0];
              list = list.filter((a) => new Date(a.date).toISOString().split('T')[0] === targetStr);
            }
          }
          if (orderBy) {
            const key = Object.keys(orderBy)[0];
            const dir = orderBy[key] === 'desc' ? -1 : 1;
            list.sort((a, b) => (a[key] > b[key] ? dir : -dir));
          }
          return list.map((a) =>
            include?.student ? { ...a, student: this.students.get(a.studentId) } : { ...a }
          );
        },
        create: async ({ data, include }: { data: any; include?: any }) => {
          const dateStr = (data.date ? new Date(data.date) : new Date()).toISOString().split('T')[0];
          for (const existing of this.attendances.values()) {
            if (existing.studentId === data.studentId) {
              const exStr = new Date(existing.date).toISOString().split('T')[0];
              if (exStr === dateStr) {
                const err: any = new Error('Unique constraint failed on the fields: (`studentId`, `date`)');
                err.code = 'P2002';
                throw err;
              }
            }
          }
          const id = data.id || generateId();
          const record = {
            id,
            status: 'PRESENT',
            method: 'QR_SCAN',
            ...data,
            date: data.date ? new Date(data.date) : new Date(),
            createdAt: new Date(),
          };
          this.attendances.set(id, record);
          return include?.student ? { ...record, student: this.students.get(record.studentId) } : { ...record };
        },
        count: async ({ where }: any = {}) => {
          if (!where) return this.attendances.size;
          const list = await (this.createInMemoryPrismaClient().attendance.findMany({ where }));
          return list.length;
        },
      },
      feeRecord: {
        findUnique: async ({ where, include }: { where: { id?: string; challanNumber?: string }; include?: any }) => {
          for (const f of this.feeRecords.values()) {
            if (where.id && f.id === where.id) {
              return include?.student ? { ...f, student: this.students.get(f.studentId) } : { ...f };
            }
            if (where.challanNumber && f.challanNumber === where.challanNumber) {
              return include?.student ? { ...f, student: this.students.get(f.studentId) } : { ...f };
            }
          }
          return null;
        },
        findFirst: async ({ where, include, orderBy }: any = {}) => {
          let list = Array.from(this.feeRecords.values());
          if (where?.studentId) list = list.filter((f) => f.studentId === where.studentId);
          if (where?.month) list = list.filter((f) => f.month === where.month);
          if (where?.challanNumber) list = list.filter((f) => f.challanNumber === where.challanNumber);
          if (list.length === 0) return null;
          return include?.student ? { ...list[0], student: this.students.get(list[0].studentId) } : { ...list[0] };
        },
        findMany: async ({ where, skip = 0, take, orderBy, include }: any = {}) => {
          let list = Array.from(this.feeRecords.values());
          if (where?.studentId) list = list.filter((f) => f.studentId === where.studentId);
          if (where?.month) list = list.filter((f) => f.month === where.month);
          if (where?.status) list = list.filter((f) => f.status === where.status);
          if (where?.challanNumber?.startsWith) {
            list = list.filter((f) => f.challanNumber.startsWith(where.challanNumber.startsWith));
          }
          if (orderBy) {
            const key = Object.keys(orderBy)[0];
            const dir = orderBy[key] === 'desc' ? -1 : 1;
            list.sort((a, b) => (a[key] > b[key] ? dir : -dir));
          }
          const start = skip;
          const end = take !== undefined ? start + take : list.length;
          return list.slice(start, end).map((f) =>
            include?.student ? { ...f, student: this.students.get(f.studentId) } : { ...f }
          );
        },
        create: async ({ data, include }: { data: any; include?: any }) => {
          const id = data.id || generateId();
          const record = {
            id,
            amountPaid: 0,
            status: 'UNPAID',
            ...data,
            dueDate: data.dueDate ? new Date(data.dueDate) : new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          this.feeRecords.set(id, record);
          return include?.student ? { ...record, student: this.students.get(record.studentId) } : { ...record };
        },
        update: async ({ where, data, include }: { where: { id: string }; data: any; include?: any }) => {
          const target = this.feeRecords.get(where.id);
          if (!target) throw new Error('Fee record not found for update');
          const updated = {
            ...target,
            ...data,
            updatedAt: new Date(),
          };
          this.feeRecords.set(where.id, updated);
          return include?.student ? { ...updated, student: this.students.get(updated.studentId) } : { ...updated };
        },
        count: async ({ where }: any = {}) => {
          if (!where) return this.feeRecords.size;
          const list = await (this.createInMemoryPrismaClient().feeRecord.findMany({ where }));
          return list.length;
        },
        aggregate: async ({ _sum, where }: any = {}) => {
          const list = await (this.createInMemoryPrismaClient().feeRecord.findMany({ where }));
          const sumDue = list.reduce((acc, curr) => acc + Number(curr.amountDue || 0), 0);
          const sumPaid = list.reduce((acc, curr) => acc + Number(curr.amountPaid || 0), 0);
          return {
            _sum: {
              amountDue: sumDue,
              amountPaid: sumPaid,
            },
          };
        },
      },
      staff: {
        findUnique: async ({ where, include }: { where: { id?: string; cnic?: string }; include?: any }) => {
          for (const s of this.staffs.values()) {
            if (where.id && s.id === where.id) {
              const payroll = Array.from(this.payrollRecords.values()).filter((p) => p.staffId === s.id);
              return include?.payroll ? { ...s, payroll } : { ...s };
            }
            if (where.cnic && s.cnic === where.cnic) {
              const payroll = Array.from(this.payrollRecords.values()).filter((p) => p.staffId === s.id);
              return include?.payroll ? { ...s, payroll } : { ...s };
            }
          }
          return null;
        },
        findFirst: async ({ where }: any = {}) => {
          for (const s of this.staffs.values()) {
            if (!where) return { ...s };
            if (where.cnic && s.cnic === where.cnic) return { ...s };
          }
          return null;
        },
        findMany: async ({ where, skip = 0, take, orderBy, include }: any = {}) => {
          let list = Array.from(this.staffs.values());
          if (where?.status) list = list.filter((s) => s.status === where.status);
          if (where?.role) list = list.filter((s) => s.role === where.role);
          if (where?.search) {
            const str = where.search.toLowerCase();
            list = list.filter(
              (s) =>
                s.fullName.toLowerCase().includes(str) ||
                s.role.toLowerCase().includes(str) ||
                s.cnic.includes(str)
            );
          }
          if (orderBy) {
            const key = Object.keys(orderBy)[0];
            const dir = orderBy[key] === 'desc' ? -1 : 1;
            list.sort((a, b) => (a[key] > b[key] ? dir : -dir));
          }
          const start = skip;
          const end = take !== undefined ? start + take : list.length;
          return list.slice(start, end).map((s) => {
            const payroll = Array.from(this.payrollRecords.values()).filter((p) => p.staffId === s.id);
            return include?.payroll ? { ...s, payroll } : { ...s };
          });
        },
        create: async ({ data }: { data: any }) => {
          const id = data.id || generateId();
          const record = {
            id,
            status: 'ACTIVE',
            ...data,
            salary: Number(data.salary),
            joinDate: data.joinDate ? new Date(data.joinDate) : new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          this.staffs.set(id, record);
          return { ...record };
        },
        update: async ({ where, data }: { where: { id: string }; data: any }) => {
          const target = this.staffs.get(where.id);
          if (!target) throw new Error('Staff not found for update');
          const updated = {
            ...target,
            ...data,
            ...(data.salary !== undefined ? { salary: Number(data.salary) } : {}),
            updatedAt: new Date(),
          };
          this.staffs.set(where.id, updated);
          return { ...updated };
        },
        delete: async ({ where }: { where: { id: string } }) => {
          const target = this.staffs.get(where.id);
          if (!target) throw new Error('Staff not found for deletion');
          this.staffs.delete(where.id);
          return { ...target };
        },
        count: async ({ where }: any = {}) => {
          if (!where) return this.staffs.size;
          const list = await (this.createInMemoryPrismaClient().staff.findMany({ where }));
          return list.length;
        },
      },
      payrollRecord: {
        findUnique: async ({ where, include }: { where: { id: string }; include?: any }) => {
          for (const p of this.payrollRecords.values()) {
            if (p.id === where.id) {
              return include?.staff ? { ...p, staff: this.staffs.get(p.staffId) } : { ...p };
            }
          }
          return null;
        },
        findFirst: async ({ where, include }: any = {}) => {
          for (const p of this.payrollRecords.values()) {
            if (where?.staffId && p.staffId !== where.staffId) continue;
            if (where?.month && p.month !== where.month) continue;
            return include?.staff ? { ...p, staff: this.staffs.get(p.staffId) } : { ...p };
          }
          return null;
        },
        findMany: async ({ where, skip = 0, take, orderBy, include }: any = {}) => {
          let list = Array.from(this.payrollRecords.values());
          if (where?.staffId) list = list.filter((p) => p.staffId === where.staffId);
          if (where?.month) list = list.filter((p) => p.month === where.month);
          if (where?.status) list = list.filter((p) => p.status === where.status);
          if (orderBy) {
            const key = Object.keys(orderBy)[0];
            const dir = orderBy[key] === 'desc' ? -1 : 1;
            list.sort((a, b) => (a[key] > b[key] ? dir : -dir));
          }
          const start = skip;
          const end = take !== undefined ? start + take : list.length;
          return list.slice(start, end).map((p) =>
            include?.staff ? { ...p, staff: this.staffs.get(p.staffId) } : { ...p }
          );
        },
        create: async ({ data, include }: { data: any; include?: any }) => {
          const id = data.id || generateId();
          const record = {
            id,
            status: 'PENDING',
            ...data,
            amount: Number(data.amount),
            paidAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          this.payrollRecords.set(id, record);
          return include?.staff ? { ...record, staff: this.staffs.get(record.staffId) } : { ...record };
        },
        update: async ({ where, data, include }: { where: { id: string }; data: any; include?: any }) => {
          const target = this.payrollRecords.get(where.id);
          if (!target) throw new Error('Payroll record not found for update');
          const updated = {
            ...target,
            ...data,
            updatedAt: new Date(),
          };
          this.payrollRecords.set(where.id, updated);
          return include?.staff ? { ...updated, staff: this.staffs.get(updated.staffId) } : { ...updated };
        },
        count: async ({ where }: any = {}) => {
          if (!where) return this.payrollRecords.size;
          const list = await (this.createInMemoryPrismaClient().payrollRecord.findMany({ where }));
          return list.length;
        },
        aggregate: async ({ _sum, where }: any = {}) => {
          const list = await (this.createInMemoryPrismaClient().payrollRecord.findMany({ where }));
          const sum = list.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
          return {
            _sum: {
              amount: sum,
            },
          };
        },
      },
      transaction: {
        findUnique: async ({ where }: { where: { id: string } }) => {
          return this.transactions.get(where.id) || null;
        },
        findFirst: async ({ where }: any = {}) => {
          for (const t of this.transactions.values()) {
            if (where?.relatedFeeId && t.relatedFeeId === where.relatedFeeId) return { ...t };
            if (where?.type && t.type === where.type) return { ...t };
          }
          return null;
        },
        findMany: async ({ where, skip = 0, take, orderBy }: any = {}) => {
          let list = Array.from(this.transactions.values());
          if (where?.type) list = list.filter((t) => t.type === where.type);
          if (where?.relatedFeeId) list = list.filter((t) => t.relatedFeeId === where.relatedFeeId);
          if (where?.relatedPayrollId) list = list.filter((t) => t.relatedPayrollId === where.relatedPayrollId);
          if (orderBy) {
            const key = Object.keys(orderBy)[0];
            const dir = orderBy[key] === 'desc' ? -1 : 1;
            list.sort((a, b) => (a[key] > b[key] ? dir : -dir));
          }
          const start = skip;
          const end = take !== undefined ? start + take : list.length;
          return list.slice(start, end).map((t) => ({ ...t }));
        },
        create: async ({ data }: { data: any }) => {
          const id = data.id || generateId();
          const record = {
            id,
            ...data,
            amount: Number(data.amount),
            createdAt: new Date(),
          };
          this.transactions.set(id, record);
          return { ...record };
        },
        count: async ({ where }: any = {}) => {
          if (!where) return this.transactions.size;
          const list = await (this.createInMemoryPrismaClient().transaction.findMany({ where }));
          return list.length;
        },
        aggregate: async ({ _sum, where }: any = {}) => {
          const list = await (this.createInMemoryPrismaClient().transaction.findMany({ where }));
          const sum = list.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
          return {
            _sum: {
              amount: sum,
            },
          };
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
    const isProduction = process.env.NODE_ENV === 'production';

    if (prop === '$queryRaw' || prop === '$connect' || prop === '$disconnect') {
      return async (...args: any[]) => {
        try {
          return await target[prop](...args);
        } catch (err: any) {
          if (isProduction) {
            logger.error(`🚨 CRITICAL: Database operation "${String(prop)}" failed in production:`, err.message || err);
            throw err;
          }
          return (memoryPrisma as any)[prop]?.(...args);
        }
      };
    }

    const targetModel = target[prop];
    const memoryModel = (memoryPrisma as any)[prop];

    if (typeof targetModel === 'object' && targetModel !== null) {
      // In production, execute against real database directly with critical alert logging on failure
      if (isProduction) {
        return new Proxy(targetModel, {
          get(mTarget: any, mProp: string | symbol) {
            const realMethod = mTarget[mProp];
            if (typeof realMethod === 'function') {
              return async (...args: any[]) => {
                try {
                  return await realMethod.apply(mTarget, args);
                } catch (err: any) {
                  logger.error(
                    `🚨 CRITICAL: Database query failed in production on ${String(prop)}.${String(mProp)}:`,
                    err.message || err
                  );
                  throw err;
                }
              };
            }
            return realMethod;
          },
        });
      }

      // In non-production (local development / testing offline), support memory store fallback
      if (memoryModel) {
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
                    if (err.message && (err.message.includes("Can't reach database server") || err.code === 'P1001')) {
                      isDbAvailable = false;
                      logger.warn(
                        `⚠️ Postgres unreachable in development mode. Falling back to in-memory store for ${String(prop)}.${String(mProp)}`
                      );
                      return memMethod ? memMethod.apply(memoryModel, args) : null;
                    }
                    throw err;
                  }
                } else if (isDbAvailable === false) {
                  return memMethod ? memMethod.apply(memoryModel, args) : null;
                } else {
                  const available = await checkDbAvailability();
                  if (available) {
                    return realMethod.apply(mTarget, args);
                  } else {
                    logger.warn(
                      `⚠️ Postgres unreachable on startup in development mode. Using in-memory store for ${String(prop)}.${String(mProp)}`
                    );
                    return memMethod ? memMethod.apply(memoryModel, args) : null;
                  }
                }
              };
            }
            return realMethod;
          },
        });
      }
    }

    return targetModel;
  },
}) as unknown as PrismaClient;

export { Role, StudentStatus, Gender, ScholarshipCategory, AttendanceStatus, AttendanceMethod, FeeStatus, StaffStatus, PayrollStatus, TransactionType, EligibilityStatus, FinalStatus, InstitutionType, PartnerStatus, GrievanceStatus };
