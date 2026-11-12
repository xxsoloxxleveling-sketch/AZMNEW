import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error.middleware';
import { AdminResultsPageQuery, MeritListQuery } from './results.schema';
import { Prisma, PrismaClient } from '@prisma/client';

export class ResultsService {
  constructor(private readonly db: PrismaClient = prisma) {}

  async listAdminResultSessions() {
    const assignments = await this.db.student.findMany({
      where: { resultSessionId: { not: null } },
      select: { resultSessionId: true },
      distinct: ['resultSessionId'],
    });
    const sessionIds = assignments
      .map((item) => item.resultSessionId)
      .filter((id): id is string => Boolean(id));
    if (!sessionIds.length) return [];

    const [sessions, counts] = await Promise.all([
      this.db.attendanceSession.findMany({
        where: { id: { in: sessionIds } },
        select: {
          id: true,
          businessDate: true,
          examDateSnapshot: true,
          hallNameSnapshot: true,
          roomNumberSnapshot: true,
          testCenterNameSnapshot: true,
          status: true,
          attemptNumber: true,
          isCurrent: true,
          _count: { select: { candidates: true } },
        },
        orderBy: [{ businessDate: 'desc' }, { id: 'asc' }],
      }),
      this.db.student.groupBy({
        by: ['resultSessionId'],
        where: { resultSessionId: { in: sessionIds } },
        _count: { _all: true, testScore: true },
      }),
    ]);
    const countBySession = new Map(counts.map((row) => [row.resultSessionId, row._count]));

    return sessions.map(({ _count, ...session }) => {
      const count = countBySession.get(session.id);
      return {
        id: session.id,
        businessDate: session.businessDate.toISOString().slice(0, 10),
        examDate: session.examDateSnapshot,
        hallName: session.hallNameSnapshot,
        roomNumber: session.roomNumberSnapshot,
        testCenterName: session.testCenterNameSnapshot,
        sessionStatus: session.status,
        attemptNumber: session.attemptNumber,
        isCurrent: session.isCurrent,
        recordCount: count?._all ?? 0,
        legacyScoreCount: count?.testScore ?? 0,
        rosterCount: _count.candidates,
      };
    });
  }

  async listAdminSessionResults(sessionId: string, query: AdminResultsPageQuery) {
    const session = await this.db.attendanceSession.findUnique({
      where: { id: sessionId },
      select: { id: true },
    });
    if (!session) {
      const error: AppError = new Error('Examination session not found.');
      error.statusCode = 404;
      throw error;
    }

    const search = query.search?.trim();
    const where: Prisma.StudentWhereInput = {
      resultSessionId: sessionId,
      ...(query.className ? { currentClass: query.className } : {}),
      ...(search ? {
        OR: [
          { rollNumber: { contains: search, mode: 'insensitive' as const } },
          { fullName: { contains: search, mode: 'insensitive' as const } },
        ],
      } : {}),
      ...(query.scoreAvailability === 'with-score' ? { testScore: { not: null } } : {}),
      ...(query.scoreAvailability === 'without-score' ? { testScore: null } : {}),
      ...((query.minimumScore !== undefined || query.maximumScore !== undefined) ? {
        testScore: {
          not: null,
          ...(query.minimumScore !== undefined ? { gte: query.minimumScore } : {}),
          ...(query.maximumScore !== undefined ? { lte: query.maximumScore } : {}),
        },
      } : {}),
    };
    const orderBy: Prisma.StudentOrderByWithRelationInput[] = query.sortBy === 'studentName'
      ? [{ fullName: query.sortOrder }, { id: 'asc' }]
      : query.sortBy === 'className'
        ? [{ currentClass: query.sortOrder }, { id: 'asc' }]
        : query.sortBy === 'legacyScore'
          ? [{ testScore: { sort: query.sortOrder, nulls: 'last' } }, { id: 'asc' }]
          : [{ rollNumber: { sort: query.sortOrder, nulls: 'last' } }, { id: 'asc' }];
    const classOptions = await this.db.student.findMany({
      where: { resultSessionId: sessionId },
      select: { currentClass: true },
      distinct: ['currentClass'],
      orderBy: { currentClass: 'asc' },
    });
    const [students, total] = await Promise.all([
      this.db.student.findMany({
        where,
        select: {
          id: true,
          rollNumber: true,
          fullName: true,
          currentClass: true,
          testScore: true,
          overallRank: true,
        },
        orderBy,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.db.student.count({ where }),
    ]);

    return {
      sessionId,
      verificationStatus: 'UNVERIFIED' as const,
      publicationEnabled: false as const,
      classOptions: classOptions.map((row) => row.currentClass),
      results: students.map((student) => ({
        id: student.id,
        rollNumber: student.rollNumber,
        studentName: student.fullName,
        className: student.currentClass,
        legacyScore: student.testScore,
        legacyRank: student.overallRank,
        percentage: null,
        maximumMarks: null,
        questionCounts: null,
        resultReference: null,
        status: 'LEGACY_UNVERIFIED' as const,
      })),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async searchCandidateResult(rawQuery: string) {
    const query = rawQuery.trim();
    const cleanDigits = query.replace(/\D/g, '');

    const student = await prisma.student.findFirst({
      where: {
        OR: [
          { rollNumber: { equals: query, mode: 'insensitive' as const } },
          { applicationNo: { equals: query, mode: 'insensitive' as const } },
          { cnicOrBForm: { equals: query, mode: 'insensitive' as const } },
          ...(cleanDigits.length >= 5
            ? [{ cnicOrBForm: { contains: cleanDigits, mode: 'insensitive' as const } }]
            : []),
        ],
      },
      include: {
        officeUse: true,
      },
    });

    if (!student) {
      const error: AppError = new Error(
        `No evaluated test record found matching "${query}". Session V results will be announced on 20 November 2026.`
      );
      error.statusCode = 404;
      throw error;
    }

    const hasTestScore = student.testScore !== null && student.testScore !== undefined;
    const score = hasTestScore ? student.testScore! : 0;
    const isQualified = score >= 60;

    // Masked CNIC for privacy
    const rawCnic = student.cnicOrBForm || '13503-0000000-0';
    const parts = rawCnic.split('-');
    const maskedCnic = parts.length === 3 ? `${parts[0]}-******-${parts[2]}` : `${rawCnic.slice(0, 5)}******${rawCnic.slice(-1)}`;

    return {
      rollNo: student.rollNumber || student.applicationNo,
      candidateName: student.fullName,
      fatherName: student.fatherName,
      classLevel: student.currentClass || 'SSC-II (Class 10th)',
      cnicBForm: maskedCnic,
      obtainedScore: hasTestScore ? score : null,
      percentage: hasTestScore ? Math.round((score / 100) * 100) : null,
      overallRank: student.overallRank || (hasTestScore ? 12 : null),
      percentileRank: hasTestScore ? Math.min(99, Math.max(50, score)) : null,
      category: student.scholarshipCategory ? `Category ${student.scholarshipCategory.slice(0, 1)}` : 'Category A',
      status: hasTestScore
        ? isQualified
          ? 'QUALIFIED FOR INTERVIEW'
          : 'AWAITING FURTHER MERIT'
        : 'REGISTERED FOR SESSION V EXAM',
      isEvaluated: hasTestScore,
      announcementDate: '20 November 2026',
      examVenue: (student as any).officeUse?.testCentre || student.assignedHall || 'AZM Examination Center - Mansehra Main Campus',
      reportingSlot: (student as any).officeUse?.testReportingTime || '09:00 AM',
      interviewDate: isQualified ? (student as any).officeUse?.interviewDate || '25 November 2026' : undefined,
      interviewVenue: isQualified ? 'AZM Central Secretariat, Jaddoon Plaza, Karakoram Highway, Mansehra' : undefined,
      subjectScores: [
        { subject: 'English Language & Comprehension', obtained: Math.round(score * 0.25), total: 25, accuracy: Math.round((score / 100) * 100) },
        { subject: 'Mathematics & Analytical Reasoning', obtained: Math.round(score * 0.25), total: 25, accuracy: Math.round((score / 100) * 100) },
        { subject: 'General Science & ICT', obtained: Math.round(score * 0.25), total: 25, accuracy: Math.round((score / 100) * 100) },
        { subject: 'Islamic Studies & Pakistan Affairs', obtained: Math.round(score * 0.25), total: 25, accuracy: Math.round((score / 100) * 100) },
      ],
    };
  }

  async getPublicMeritList(filters?: MeritListQuery) {
    const where: any = {
      status: 'ACTIVE',
    };

    if (filters?.district && filters.district !== 'all') {
      where.district = { equals: filters.district, mode: 'insensitive' as const };
    }

    if (filters?.search) {
      where.OR = [
        { fullName: { contains: filters.search, mode: 'insensitive' as const } },
        { rollNumber: { contains: filters.search, mode: 'insensitive' as const } },
        { applicationNo: { contains: filters.search, mode: 'insensitive' as const } },
        { currentClass: { contains: filters.search, mode: 'insensitive' as const } },
      ];
    }

    const students = await prisma.student.findMany({
      where,
      orderBy: [{ testScore: 'desc' }, { createdAt: 'asc' }],
      take: 100,
    });

    return students.map((student, idx) => {
      const rawCnic = student.cnicOrBForm || '13503-0000000-0';
      const parts = rawCnic.split('-');
      const maskedCnic = parts.length === 3 ? `${parts[0]}-******-${parts[2]}` : `${rawCnic.slice(0, 5)}******${rawCnic.slice(-1)}`;

      const score = student.testScore ?? 0;
      const rank = student.overallRank || idx + 1;

      return {
        rank,
        rollNo: student.rollNumber || student.applicationNo,
        candidateName: student.fullName,
        maskedCnic,
        classLevel: student.currentClass || 'SSC-II (Class 10th)',
        district: student.district || 'Mansehra',
        testScore: score,
        category: student.scholarshipCategory ? `Category ${student.scholarshipCategory.slice(0, 1)}` : 'Category A',
        status: score >= 80 ? 'Top Merit Finalist' : score >= 60 ? 'Interview Shortlisted' : 'Scheduled for Exam',
      };
    });
  }
}

export const resultsService = new ResultsService();
