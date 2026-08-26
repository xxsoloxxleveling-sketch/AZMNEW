import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error.middleware';
import { MeritListQuery } from './results.schema';

export class ResultsService {
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
