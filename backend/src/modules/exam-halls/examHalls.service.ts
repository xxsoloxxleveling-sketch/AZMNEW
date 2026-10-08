import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { buildStudentClassWhere } from '../students/students.service';
import { AppError } from '../../middleware/error.middleware';
import { CreateExamHallInput, UpdateExamHallInput, BatchAssignInput, UpdateAllocationInput, CandidateQueryInput } from './examHalls.schema';

const candidateSelect = {
  id: true, fullName: true, rollNumber: true, applicationNo: true,
  currentClass: true, assignedHallId: true, assignedRoom: true, seatNo: true,
} satisfies Prisma.StudentSelect;
const centerSelect = { id: true, name: true, reportingTime: true, testDate: true };

function fail(statusCode: number, message: string): never {
  const error: AppError = new Error(message);
  error.statusCode = statusCode;
  throw error;
}

// Convert ISO dates or explicit English month names, without guessing numeric locale
// formats or normalizing invalid days. Keep the original Hall display string.
export function hallDate(value: string): Date | null {
  let iso = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const match = /^(?:(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+)?(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/i.exec(iso);
    if (!match) return null;
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const month = months.findIndex(name => name.toLowerCase() === match[2].toLowerCase() || name.slice(0, 3).toLowerCase() === match[2].toLowerCase());
    if (month < 0) return null;
    iso = match[3] + '-' + String(month + 1).padStart(2, '0') + '-' + match[1].padStart(2, '0');
  }
  const date = new Date(iso + 'T00:00:00.000Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === iso ? date : null;
}

function hallResponse(hall: any, assignedCount: number) {
  return {
    ...hall, assignedCount,
    availableSeats: Math.max(0, hall.capacity - assignedCount),
    utilizationPercent: hall.capacity > 0 ? Math.round(assignedCount / hall.capacity * 100) : null,
    isOverCapacity: assignedCount > hall.capacity,
    centerName: hall.testCenter?.name ?? null,
  };
}

function officeData(hall: any) {
  return {
    testCentre: hall.testCenter?.name ?? null,
    testReportingTime: hall.reportingTime || null,
    testDate: hallDate(hall.examDate),
  };
}

export class ExamHallsService {
  constructor(private readonly db: PrismaClient = prisma) {}

  private async transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.db.$transaction(work, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 5000, timeout: 15000,
        });
      } catch (error: any) {
        if (error.code !== 'P2034') throw error;
        if (attempt >= 2) fail(409, 'A concurrent allocation conflicted with this operation. Please retry.');
        await new Promise(resolve => setTimeout(resolve, 25 * (attempt + 1)));
      }
    }
  }

  private async hall(tx: Prisma.TransactionClient, id: string) {
    const hall = await tx.examHall.findUnique({ where: { id }, include: { testCenter: { select: centerSelect } } });
    if (!hall) fail(404, 'Exam hall not found.');
    return hall;
  }

  private async center(tx: Prisma.TransactionClient, id?: string | null) {
    if (!id) return null;
    const center = await tx.testCenter.findUnique({ where: { id }, select: centerSelect });
    if (!center) fail(404, 'Test center not found.');
    return center;
  }

  async getExamHalls() {
    return this.transaction(async tx => {
      const halls = await tx.examHall.findMany({ include: { testCenter: { select: centerSelect } }, orderBy: { createdAt: 'asc' } });
      const counts = await tx.student.groupBy({ by: ['assignedHallId'], where: { assignedHallId: { in: halls.map(h => h.id) } }, _count: { _all: true } });
      const occupancy = new Map(counts.map(c => [c.assignedHallId, c._count._all]));
      return halls.map(h => hallResponse(h, occupancy.get(h.id) ?? 0));
    });
  }

  async getExamHallById(id: string) {
    return this.transaction(async tx => {
      const hall = await this.hall(tx, id);
      const assignedStudents = await tx.student.findMany({ where: { assignedHallId: id }, select: candidateSelect, orderBy: [{ seatNo: 'asc' }, { id: 'asc' }] });
      return { ...hallResponse(hall, assignedStudents.length), assignedStudents };
    });
  }

  async getCandidates(query: CandidateQueryInput) {
    const { page, limit, search, assignment } = query;
    const where: Prisma.StudentWhereInput = {};
    const classWhere = buildStudentClassWhere(query.class);
    if (classWhere) where.AND = [classWhere];
    if (query.gender) where.gender = query.gender;
    if (assignment === 'assigned') where.assignedHallId = { not: null };
    if (assignment === 'unassigned') where.assignedHallId = null;
    if (search) where.OR = ['fullName', 'rollNumber', 'applicationNo'].map(key => ({ [key]: { contains: search, mode: 'insensitive' } }));
    return this.transaction(async tx => {
      const total = await tx.student.count({ where });
      const candidates = await tx.student.findMany({ where, select: { ...candidateSelect, assignedHall: true }, orderBy: [{ fullName: 'asc' }, { id: 'asc' }], skip: (page - 1) * limit, take: limit });
      const placementCandidates = candidates.map(({ assignedHall, ...candidate }) => ({ ...candidate, legacyAllocationNeedsReview: !candidate.assignedHallId && !!(assignedHall || candidate.assignedRoom || candidate.seatNo) }));
      return { candidates: placementCandidates, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
    });
  }

  async createExamHall(input: CreateExamHallInput) {
    return this.transaction(async tx => {
      const center = await this.center(tx, input.testCenterId);
      const hall = await tx.examHall.create({ data: {
        ...input, name: input.name!, roomNumber: input.roomNumber!, targetClass: input.targetClass!, capacity: input.capacity!,
        reportingTime: input.reportingTime ?? center?.reportingTime ?? '',
        examDate: input.examDate ?? center?.testDate ?? '',
      }, include: { testCenter: { select: centerSelect } } });
      return hallResponse(hall, 0);
    });
  }

  async updateExamHall(id: string, input: UpdateExamHallInput) {
    return this.transaction(async tx => {
      await this.hall(tx, id);
      const assignedCount = await tx.student.count({ where: { assignedHallId: id } });
      if (input.capacity !== undefined && input.capacity < assignedCount) fail(409, 'Capacity cannot be less than the ' + assignedCount + ' assigned candidates.');
      const center = input.testCenterId !== undefined ? await this.center(tx, input.testCenterId) : undefined;
      const data = { ...input };
      if (center !== undefined) {
        data.reportingTime = input.reportingTime ?? center?.reportingTime ?? '';
        data.examDate = input.examDate ?? center?.testDate ?? '';
      }
      const hall = await tx.examHall.update({ where: { id }, data, include: { testCenter: { select: centerSelect } } });
      if (['name', 'roomNumber', 'testCenterId', 'reportingTime', 'examDate'].some(key => key in input)) {
        const students = await tx.student.findMany({ where: { assignedHallId: id }, select: { id: true }, orderBy: { id: 'asc' } });
        for (const student of students) await tx.student.update({ where: { id: student.id }, select: { id: true }, data: {
          assignedHall: hall.name, assignedRoom: hall.roomNumber,
          officeUse: { upsert: { create: officeData(hall), update: officeData(hall) } },
        } });
      }
      return hallResponse(hall, assignedCount);
    });
  }

  async deleteExamHall(id: string) {
    return this.transaction(async tx => {
      await this.hall(tx, id);
      if (await tx.student.count({ where: { assignedHallId: id } })) fail(409, 'This hall has assigned candidates. Reassign or unassign them before deleting the hall.');
      return tx.examHall.delete({ where: { id } });
    });
  }

  private firstSeat(used: Set<string>): string {
    for (let n = 1; ; n++) {
      const seat = 'Seat #' + String(n).padStart(2, '0');
      if (!used.has(seat)) return seat;
    }
  }

  private async guardOpenAttendance(tx: Prisma.TransactionClient, studentIds: string[]) {
    if (!studentIds.length) return;
    const active = await tx.attendanceSessionCandidate.findFirst({
      where: { studentId: { in: studentIds }, session: { status: 'OPEN' } }, select: { id: true },
    });
    if (active) fail(409, 'Candidate belongs to an OPEN examination attendance session. Close that session before moving or unassigning the candidate.');
  }

  private async assign(tx: Prisma.TransactionClient, hallId: string, ids: string[], explicitSeat?: string | null) {
    const hall = await this.hall(tx, hallId);
    const studentIds = [...new Set(ids)].sort();
    const students = await tx.student.findMany({ where: { id: { in: studentIds } }, select: candidateSelect });
    if (students.length !== studentIds.length) fail(404, 'One or more selected candidates do not exist.');
    await this.guardOpenAttendance(tx, students.filter(student => student.assignedHallId !== hallId).map(student => student.id));
    const occupants = await tx.student.findMany({ where: { assignedHallId: hallId }, select: { id: true, seatNo: true } });
    const newcomers = students.filter(s => s.assignedHallId !== hallId).length;
    if (occupants.length + newcomers > hall.capacity) fail(409, 'Hall capacity would be exceeded. ' + occupants.length + ' of ' + hall.capacity + ' seats are currently assigned.');
    const used = new Set(occupants.filter(s => !studentIds.includes(s.id) && s.seatNo).map(s => s.seatNo!));
    // Retain existing seats on repeat batch allocation before filling gaps.
    for (const student of students) {
      if (explicitSeat === undefined && student.assignedHallId === hallId && student.seatNo) {
        if (used.has(student.seatNo)) fail(409, 'This hall has duplicate stored seats. Resolve them before allocating candidates.');
        used.add(student.seatNo);
      }
    }
    const results = [];
    for (const id of studentIds) {
      const student = students.find(s => s.id === id)!;
      const retain = explicitSeat === undefined && student.assignedHallId === hallId && student.seatNo;
      const seatNo = retain || explicitSeat || this.firstSeat(used);
      if (!retain && used.has(seatNo)) fail(409, 'This seat is already assigned to another candidate in this hall.');
      used.add(seatNo);
      results.push(await tx.student.update({ where: { id }, select: candidateSelect, data: {
        assignedHallId: hallId, assignedHall: hall.name, assignedRoom: hall.roomNumber, seatNo,
        officeUse: { upsert: { create: officeData(hall), update: officeData(hall) } },
      } }));
    }
    return { students: results, assignedCount: studentIds.length, hallName: hall.name, roomNumber: hall.roomNumber };
  }

  async batchAssign(hallId: string, input: BatchAssignInput) {
    return this.transaction(async tx => {
      const { students: _students, ...result } = await this.assign(tx, hallId, input.studentIds);
      return { success: true, ...result };
    });
  }

  async updateStudentAllocation(studentId: string, input: UpdateAllocationInput) {
    return this.transaction(async tx => {
      const student = await tx.student.findUnique({ where: { id: studentId }, select: candidateSelect });
      if (!student) fail(404, 'Candidate not found.');
      if (input.assignedHallId === null) return this.unassign(tx, studentId);
      const hallId = input.assignedHallId ?? student.assignedHallId;
      if (hallId) {
        if (input.assignedHallId === undefined) {
          const hall = await this.hall(tx, hallId);
          if ((input.assignedHall !== undefined && input.assignedHall !== hall.name) ||
              (input.assignedRoom !== undefined && input.assignedRoom !== hall.roomNumber) ||
              (input.testCenterId !== undefined && input.testCenterId !== hall.testCenterId) ||
              (input.testCenterName !== undefined && input.testCenterName !== (hall.testCenter?.name ?? ''))) {
            fail(409, 'This candidate has an explicit Hall allocation. Use a destination Hall ID to change their examination location.');
          }
        }
        return (await this.assign(tx, hallId, [studentId], input.seatNo)).students[0];
      }
      // Preserve the Students text-only editor; mirrors never create Hall membership.
      await this.center(tx, input.testCenterId);
      return tx.student.update({ where: { id: studentId }, select: candidateSelect, data: {
        ...(input.assignedHall !== undefined ? { assignedHall: input.assignedHall } : {}),
        ...(input.assignedRoom !== undefined ? { assignedRoom: input.assignedRoom } : {}),
        ...(input.seatNo !== undefined ? { seatNo: input.seatNo } : {}),
        ...(input.testCenterName !== undefined ? { officeUse: { upsert: {
          create: { testCentre: input.testCenterName }, update: { testCentre: input.testCenterName },
        } } } : {}),
      } });
    });
  }

  private async unassign(tx: Prisma.TransactionClient, studentId: string) {
    const student = await tx.student.findUnique({ where: { id: studentId }, select: { assignedHallId: true, officeUse: true } });
    if (!student) fail(404, 'Candidate not found.');
    await this.guardOpenAttendance(tx, [studentId]);
    const hall = student.assignedHallId ? await tx.examHall.findUnique({ where: { id: student.assignedHallId }, include: { testCenter: { select: centerSelect } } }) : null;
    // Independent OfficeUse writers exist: clear matching Hall-derived fields only.
    if (hall && student.officeUse) {
      const derived = officeData(hall);
      const data: Prisma.OfficeUseRecordUpdateInput = {};
      if (student.officeUse.testCentre === derived.testCentre) data.testCentre = null;
      if (student.officeUse.testReportingTime === derived.testReportingTime) data.testReportingTime = null;
      if (student.officeUse.testDate?.getTime() === derived.testDate?.getTime()) data.testDate = null;
      await tx.officeUseRecord.update({ where: { studentId }, data });
    }
    return tx.student.update({ where: { id: studentId }, select: candidateSelect, data: { assignedHallId: null, assignedHall: null, assignedRoom: null, seatNo: null } });
  }

  async unassignStudent(studentId: string) {
    return this.transaction(tx => this.unassign(tx, studentId));
  }
}

export const examHallsService = new ExamHallsService();
