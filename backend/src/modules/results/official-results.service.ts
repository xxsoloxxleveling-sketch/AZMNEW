import { randomBytes, randomUUID } from 'node:crypto';
import {
  DmcDocumentType,
  DmcIssuanceEventType,
  ExaminationPublicationStatus,
  ExaminationResultPublicationStatus,
  ExaminationResultScoringStatus,
  ExaminationResultVerificationStatus,
  Prisma,
  PrismaClient,
  ResultResponseClassification,
  ResultResponseSource,
} from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { examLock } from '../attendance/examControl.service';
import {
  OfficialDmcPdfData,
  OfficialResultDetail,
  OfficialResultSummary,
} from './official-results.dto';
import {
  CreateDraftResultRequest,
  CreateExaminationRequest,
  CorrectResultRequest,
  ExaminationPublicationRequest,
  OfficialResultsPageQuery,
} from './results.schema';
import { renderElectronicDmcPdf, renderOfficialDmcPdf } from './dmc-pdf';

type Actor = { id: string; name: string };
type PrismaLike = PrismaClient;

const resultInclude = {
  attendanceSession: { select: { id: true, attemptNumber: true, businessDate: true, isCurrent: true } },
  attemptBinding: { select: { sessionId: true, studentId: true, boundAt: true } },
  student: {
    select: {
      id: true,
      fullName: true,
      rollNumber: true,
      applicationNo: true,
      currentClass: true,
      hsscGroup: true,
      bsDepartment: true,
      bsSemester: true,
      fatherName: true,
      assignedHall: true,
    },
  },
  examination: {
    include: { paperKeyRevisions: { select: { paperVersion: true } } },
  },
  responses: { orderBy: { questionNumber: 'asc' as const } },
  dmcIssuances: {
    where: { documentType: DmcDocumentType.OFFICIAL },
    orderBy: { issuedAt: 'desc' as const },
    take: 1,
    include: { events: { orderBy: [{ occurredAt: 'desc' as const }, { id: 'desc' as const }], take: 1 } },
  },
  _count: { select: { dmcIssuances: true } },
};

function serviceError(statusCode: number, message: string, code: string) {
  const error: any = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function decimal(value: string | number | Prisma.Decimal) {
  return new Prisma.Decimal(value);
}

function decimalString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return value instanceof Prisma.Decimal ? value.toString() : String(value);
}

function classGroup(student: any): string {
  const academicGroup = student.hsscGroup || student.bsDepartment;
  const className = String(student.currentClass || '').trim();
  return academicGroup ? `${className} · ${academicGroup}${student.bsSemester ? ` · ${student.bsSemester}` : ''}` : className;
}

function normalizeGroup(value: string): string {
  return value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

function latestIssuanceStatus(issuances: any[], sessionId: string | null): 'NONE' | 'ISSUED' | 'SUPERSEDED' | 'REVOKED' | 'ATTEMPT_UNVERIFIED' {
  const event = issuances?.[0]?.events?.[0]?.eventType;
  if (event === DmcIssuanceEventType.ISSUED) return sessionId && (issuances?.[0]?.snapshot as any)?.attemptAssociation?.sessionId===sessionId ? 'ISSUED' : 'ATTEMPT_UNVERIFIED';
  if (event === DmcIssuanceEventType.SUPERSEDED) return 'SUPERSEDED';
  if (event === DmcIssuanceEventType.REVOKED) return 'REVOKED';
  return 'NONE';
}

function toSummary(row: any): OfficialResultSummary {
  const paperVersions = (row.examination.paperKeyRevisions || []).map((item: any) => item.paperVersion).sort();
  const summary: OfficialResultSummary = {
    id: row.id,
    resultReference: row.resultReference,
    studentId: row.studentId,
    examinationId: row.examinationId,
    attempt: row.attendanceSession && row.attemptBinding && row.attendanceSessionId===row.attemptBinding.sessionId && row.attemptBinding.studentId===row.studentId ? {
      id: row.attendanceSession.id, attemptNumber: row.attendanceSession.attemptNumber,
      businessDate: row.attendanceSession.businessDate.toISOString().slice(0,10),
      state: row.attendanceSession.isCurrent ? 'CURRENT' : 'HISTORICAL', boundAt: row.attemptBinding.boundAt.toISOString(),
    } : null,
    student: {
      id: row.student.id,
      fullName: row.student.fullName,
      rollNumber: row.student.rollNumber,
      applicationNo: row.student.applicationNo,
      classGroup: classGroup(row.student),
    },
    examination: {
      id: row.examination.id,
      reference: row.examination.reference,
      title: row.examination.title,
      sessionReference: row.examination.sessionReference,
      examDate: row.examination.examDate ? row.examination.examDate.toISOString().slice(0, 10) : null,
      classGroup: row.examination.classGroup,
      maximumMarks: decimalString(row.examination.maximumMarks) || '0',
      questionCount: row.examination.questionCount,
      paperVersions,
      publicationStatus: row.examination.publicationStatus,
      revision: row.examination.revision,
    },
    paperVersion: row.paperVersion,
    obtainedMarks: decimalString(row.obtainedMarks),
    maximumMarks: decimalString(row.maximumMarks) || '0',
    correctCount: row.correctCount,
    wrongCount: row.wrongCount,
    blankCount: row.blankCount,
    multipleCount: row.multipleCount,
    uncertainCount: row.uncertainCount,
    identityStatus: row.identityStatus,
    scoringStatus: row.scoringStatus,
    verificationStatus: row.verificationStatus,
    publicationStatus: row.publicationStatus,
    resultRevision: row.resultRevision,
    administrativelyAdjusted: row.administrativelyAdjusted,
    administrativeAdjustmentReason: row.administrativeAdjustmentReason,
    verifiedAt: row.verifiedAt?.toISOString() ?? null,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    documents: {
      electronicAvailable: isDmcEligible(row),
      latestOfficialIssuanceStatus: latestIssuanceStatus(row.dmcIssuances,row.attendanceSessionId),
      officialIssuanceCount: row._count?.dmcIssuances ?? 0,
    },
  };
  return summary;
}

function toDetail(row: any): OfficialResultDetail {
  const summary = toSummary(row);
  return {
    ...summary,
    sourceScanReference: row.sourceScanReference,
    responses: (row.responses || []).map((response: any) => ({
      questionNumber: response.questionNumber,
      detectedAnswer: response.detectedAnswer,
      reviewedAnswer: response.reviewedAnswer,
      classification: response.classification,
      marksAwarded: decimalString(response.marksAwarded),
      responseSource: response.responseSource,
    })),
    administrativeRemarks: row.administrativeRemarks,
  };
}

function keyRevisionFor(examination: any, paperVersion: string | null | undefined) {
  if (!paperVersion) return null;
  return (examination.paperKeyRevisions || []).find((entry: any) => entry.paperVersion.toUpperCase() === paperVersion.toUpperCase()) || null;
}

function examinationSummary(exam: any) {
  return {
    id: exam.id,
    reference: exam.reference,
    title: exam.title,
    sessionReference: exam.sessionReference,
    examDate: exam.examDate?.toISOString().slice(0, 10) ?? null,
    classGroup: exam.classGroup,
    maximumMarks: decimalString(exam.maximumMarks) || '0',
    questionCount: exam.questionCount,
    paperVersions: (exam.paperKeyRevisions || []).map((item: any) => item.paperVersion).sort(),
    publicationStatus: exam.publicationStatus,
    revision: exam.revision,
  };
}

export function hasCompleteResponseEvidence(result: any): boolean {
  const questionCount = result.examination?.questionCount;
  if (!Number.isInteger(questionCount) || questionCount <= 0) return false;
  const counts = [result.correctCount, result.wrongCount, result.blankCount, result.multipleCount, result.uncertainCount];
  if (counts.some((value) => !Number.isInteger(value) || value < 0)) return false;
  const total = counts.reduce((sum, value) => sum + Number(value), 0);
  if (total !== questionCount || !Array.isArray(result.responses) || result.responses.length !== questionCount) return false;
  const actual = { CORRECT: 0, WRONG: 0, BLANK: 0, MULTIPLE: 0, UNCERTAIN: 0 };
  const questionNumbers = new Set<number>();
  for (const response of result.responses) {
    if (!Number.isInteger(response.questionNumber) || response.questionNumber < 1 || response.questionNumber > questionCount || questionNumbers.has(response.questionNumber)) return false;
    questionNumbers.add(response.questionNumber);
    if (!Object.prototype.hasOwnProperty.call(actual, response.classification)) return false;
    actual[response.classification as keyof typeof actual]++;
  }
  return questionNumbers.size === questionCount
    && actual.CORRECT === result.correctCount
    && actual.WRONG === result.wrongCount
    && actual.BLANK === result.blankCount
    && actual.MULTIPLE === result.multipleCount
    && actual.UNCERTAIN === result.uncertainCount;
}

export function isDmcEligible(result: any): boolean {
  if (!result.attendanceSessionId || !result.attemptBinding || result.attemptBinding.sessionId !== result.attendanceSessionId || result.attemptBinding.studentId !== result.studentId) return false;
  if (result.examination?.publicationStatus !== ExaminationPublicationStatus.PUBLISHED) return false;
  if (result.publicationStatus !== ExaminationResultPublicationStatus.PUBLISHED) return false;
  if (result.verificationStatus !== ExaminationResultVerificationStatus.VERIFIED) return false;
  if (result.scoringStatus !== ExaminationResultScoringStatus.VERIFIED || result.identityStatus !== 'VERIFIED') return false;
  if (result.obtainedMarks === null || result.obtainedMarks === undefined || result.uncertainCount !== 0) return false;
  if (!keyRevisionFor(result.examination, result.paperVersion)) return false;
  if (!hasCompleteResponseEvidence(result)) return false;
  return true;
}

function scoringPolicy(examination: any) {
  const policy = examination.scoringPolicy as Record<string, unknown>;
  return {
    CORRECT: decimal(String(policy.correctMarks)),
    WRONG: decimal(String(policy.wrongMarks)),
    BLANK: decimal(String(policy.blankMarks)),
    MULTIPLE: decimal(String(policy.multipleMarks)),
  };
}

function calculateCountsAndMarks(responses: any[], examination: any) {
  const questionCount = examination.questionCount;
  const questionNumbers = new Set(responses.map((response) => response.questionNumber));
  if (responses.length !== questionCount || questionNumbers.size !== questionCount
    || Array.from({ length: questionCount }, (_, index) => index + 1).some((number) => !questionNumbers.has(number))) {
    return { complete: false, counts: null, obtainedMarks: null, hasUncertain: true };
  }
  const counts = { correctCount: 0, wrongCount: 0, blankCount: 0, multipleCount: 0, uncertainCount: 0 };
  const marks = scoringPolicy(examination);
  let totalMarks = decimal(0);
  for (const response of responses) {
    switch (response.classification) {
      case ResultResponseClassification.CORRECT: counts.correctCount++; totalMarks = totalMarks.plus(marks.CORRECT); break;
      case ResultResponseClassification.WRONG: counts.wrongCount++; totalMarks = totalMarks.plus(marks.WRONG); break;
      case ResultResponseClassification.BLANK: counts.blankCount++; totalMarks = totalMarks.plus(marks.BLANK); break;
      case ResultResponseClassification.MULTIPLE: counts.multipleCount++; totalMarks = totalMarks.plus(marks.MULTIPLE); break;
      case ResultResponseClassification.UNCERTAIN: counts.uncertainCount++; break;
      default: throw serviceError(400, 'Question classification is invalid.', 'INVALID_CLASSIFICATION');
    }
  }
  const obtainedMarks = counts.uncertainCount > 0 ? null : totalMarks;
  return { complete: true, counts, obtainedMarks, hasUncertain: counts.uncertainCount > 0 };
}

function assertDmcEligible(result: any) {
  if (!isDmcEligible(result)) {
    throw serviceError(409, 'A DMC is unavailable until the result has a verified examination attempt, verified identity, an exact paper version, a verified score, and complete resolved response counts.', 'DMC_NOT_AVAILABLE');
  }
}

function normalizeReason(reason: string) {
  const normalized = reason.trim();
  if (normalized.length < 12 || normalized.length > 1000) {
    throw serviceError(400, 'Provide a correction reason between 12 and 1000 characters.', 'INVALID_CORRECTION_REASON');
  }
  return normalized;
}

function sanitizeFilenamePart(value: string) {
  return value.normalize('NFKD').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'result';
}

function latestEvent(events: any[]) {
  return [...(events || [])].sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime() || b.id.localeCompare(a.id))[0];
}

function preparePdfData(snapshot: any): OfficialDmcPdfData {
  return snapshot as OfficialDmcPdfData;
}

export class OfficialResultsService {
  constructor(private readonly db: PrismaLike = prisma) {}

  async listStudentAttempts(studentId: string) {
    const rows=await this.db.attendanceSessionCandidate.findMany({where:{studentId},take:100,orderBy:{createdAt:'desc'},select:{session:{select:{id:true,attemptNumber:true,businessDate:true,isCurrent:true,status:true,hallNameSnapshot:true,testCenterNameSnapshot:true}}}});
    return rows.map(({session})=>({id:session.id,attemptNumber:session.attemptNumber,businessDate:session.businessDate.toISOString().slice(0,10),state:session.isCurrent?'CURRENT':'HISTORICAL',status:session.status,hall:session.hallNameSnapshot,center:session.testCenterNameSnapshot}));
  }

  private async findResult(resultId: string, db: any = this.db) {
    const result = await db.examinationResult.findUnique({ where: { id: resultId }, include: resultInclude });
    if (!result) throw serviceError(404, 'Examination result not found.', 'RESULT_NOT_FOUND');
    return result;
  }

  private async findDmcPdfData(result: any, documentType: 'ELECTRONIC' | 'OFFICIAL', certificate?: any): Promise<OfficialDmcPdfData> {
    const detail = toDetail(result);
    return {
      documentType,
      documentNumber: certificate?.certificateNumber || `AZM-EDMC-${sanitizeFilenamePart(result.resultReference)}-R${result.resultRevision}`,
      resultRevision: result.resultRevision,
      generatedAt: (certificate?.issuedAt || new Date()).toISOString(),
      issuedByName: certificate?.issuedByName ?? null,
      verificationReference: certificate?.verificationReference ?? null,
      fatherName: documentType === 'OFFICIAL' ? result.student.fatherName : null,
      examinationCenter: null,
      result: detail,
    };
  }

  private async supersedeCurrentDmcIssuances(tx: any, resultId: string, actor: Actor, reason: string) {
    const documents = await tx.dmcIssuance.findMany({
      where: { resultId },
      include: { events: { orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }], take: 1 } },
    });
    for (const document of documents) {
      if (latestEvent(document.events)?.eventType !== DmcIssuanceEventType.ISSUED) continue;
      await tx.dmcIssuanceEvent.create({ data: {
        issuanceId: document.id,
        eventType: DmcIssuanceEventType.SUPERSEDED,
        reason,
        actorId: actor.id,
        actorName: actor.name,
      } });
    }
  }

  async listExaminations(query: { search?: string; limit: number }) {
    const where = query.search ? {
      OR: [
        { title: { contains: query.search, mode: 'insensitive' as const } },
        { reference: { contains: query.search, mode: 'insensitive' as const } },
        { sessionReference: { contains: query.search, mode: 'insensitive' as const } },
        { classGroup: { contains: query.search, mode: 'insensitive' as const } },
      ],
    } : {};
    const examinations = await this.db.examination.findMany({
      where,
      orderBy: [{ examDate: 'desc' }, { reference: 'asc' }],
      take: query.limit,
      include: { paperKeyRevisions: { select: { paperVersion: true }, orderBy: { paperVersion: 'asc' } } },
    });
    return examinations.map(examinationSummary);
  }

  async listStudentResults(studentId: string): Promise<OfficialResultSummary[]> {
    const student = await this.db.student.findUnique({ where: { id: studentId }, select: { id: true } });
    if (!student) throw serviceError(404, 'Student not found.', 'STUDENT_NOT_FOUND');
    const results = await this.db.examinationResult.findMany({
      where: { studentId },
      include: resultInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: 100,
    });
    return results.map(toSummary);
  }

  async listOfficialResults(query: OfficialResultsPageQuery) {
    const where: any = {};
    const andFilters: any[] = [];
    if (query.examinationId) where.examinationId = query.examinationId;
    if (query.classGroup) {
      where.examination = { ...(where.examination || {}), classGroup: query.classGroup };
    }
    if (query.search) {
      andFilters.push({ OR: [
        { resultReference: { contains: query.search, mode: 'insensitive' } },
        { student: { fullName: { contains: query.search, mode: 'insensitive' } } },
        { student: { rollNumber: { contains: query.search, mode: 'insensitive' } } },
        { student: { applicationNo: { contains: query.search, mode: 'insensitive' } } },
        { examination: { title: { contains: query.search, mode: 'insensitive' } } },
        { examination: { reference: { contains: query.search, mode: 'insensitive' } } },
      ] });
    }
    switch (query.status) {
      case 'NO_SCORE': where.obtainedMarks = null; break;
      case 'PROVISIONAL': where.scoringStatus = 'PROVISIONAL'; break;
      case 'VERIFIED': where.verificationStatus = 'VERIFIED'; break;
      case 'PUBLISHED': where.publicationStatus = 'PUBLISHED'; break;
      case 'WITHHELD': andFilters.push({ OR: [{ publicationStatus: 'WITHHELD' }, { verificationStatus: 'WITHHELD' }] }); break;
      case 'CORRECTED': where.resultRevision = { gt: 1 }; break;
      case 'OFFICIAL_DMC_ISSUED':
        where.dmcIssuances = { some: {
          documentType: DmcDocumentType.OFFICIAL,
          events: { some: { eventType: DmcIssuanceEventType.ISSUED } },
          NOT: { events: { some: { eventType: { in: [DmcIssuanceEventType.SUPERSEDED, DmcIssuanceEventType.REVOKED] } } } },
        } };
        break;
    }
    if (andFilters.length) where.AND = andFilters;
    const orderBy: any = query.sortBy === 'studentName'
      ? [{ student: { fullName: query.sortOrder } }, { id: 'asc' }]
      : query.sortBy === 'classGroup'
        ? [{ examination: { classGroup: query.sortOrder } }, { id: 'asc' }]
        : query.sortBy === 'examDate'
          ? [{ examination: { examDate: { sort: query.sortOrder, nulls: 'last' } } }, { id: 'asc' }]
          : query.sortBy === 'obtainedMarks'
            ? [{ obtainedMarks: { sort: query.sortOrder, nulls: 'last' } }, { id: 'asc' }]
            : [{ student: { rollNumber: { sort: query.sortOrder, nulls: 'last' } } }, { id: 'asc' }];
    const [rows, total] = await Promise.all([
      this.db.examinationResult.findMany({ where, include: resultInclude, orderBy, skip: (query.page - 1) * query.limit, take: query.limit }),
      this.db.examinationResult.count({ where }),
    ]);
    return {
      results: rows.map(toSummary),
      pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
    };
  }

  async getResult(resultId: string): Promise<OfficialResultDetail> {
    return toDetail(await this.findResult(resultId));
  }

  async listCorrections(resultId: string) {
    await this.findResult(resultId);
    return this.db.resultCorrectionAudit.findMany({ where: { resultId }, orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }], take: 100 });
  }

  async createExamination(input: CreateExaminationRequest, actor: Actor) {
    const maxMarks = decimal(input.maximumMarks);
    const correctMarks = decimal(input.scoringPolicy.correctMarks);
    if (correctMarks.times(input.questionCount).lt(maxMarks)) {
      throw serviceError(400, 'Correct-answer marks cannot cover the configured maximum marks.', 'INVALID_MARKING_POLICY');
    }
    const examDate = input.examDate ? new Date(`${input.examDate}T00:00:00.000Z`) : null;
    try {
      return await this.db.$transaction(async (tx) => {
        const exam = await tx.examination.create({ data: {
          reference: input.reference,
          title: input.title,
          sessionReference: input.sessionReference,
          examDate,
          classGroup: input.classGroup,
          maximumMarks: maxMarks,
          questionCount: input.questionCount,
          scoringPolicy: input.scoringPolicy as Prisma.InputJsonValue,
          createdById: actor.id,
          paperKeyRevisions: { create: input.paperKeyRevisions.map(({ paperVersion, answerKeyRevision }) => ({
            paperVersion: paperVersion.trim().toUpperCase(), answerKeyRevision: answerKeyRevision.trim(), createdById: actor.id,
          })) },
        }, include: { paperKeyRevisions: { select: { paperVersion: true } } } });
        await tx.examinationAudit.create({ data: {
          examinationId: exam.id,
          previousValues: {} as Prisma.InputJsonValue,
          newValues: { reference: exam.reference, sessionReference: exam.sessionReference, classGroup: exam.classGroup, questionCount: exam.questionCount, maximumMarks: exam.maximumMarks.toString(), publicationStatus: exam.publicationStatus } as Prisma.InputJsonValue,
          reason: 'Initial examination configuration.',
          actorId: actor.id,
          actorName: actor.name,
          source: 'EXAM_CONFIGURATION',
        } });
        return examinationSummary(exam);
      });
    } catch (error: any) {
      if (error?.code === 'P2002') throw serviceError(409, 'An examination with this reference or paper version already exists.', 'EXAMINATION_CONFLICT');
      throw error;
    }
  }

  async publishExamination(examinationId: string, input: ExaminationPublicationRequest, actor: Actor) {
    const reason = normalizeReason(input.reason);
    return this.db.$transaction(async (tx) => {
      const current = await tx.examination.findUnique({ where: { id: examinationId }, include: { paperKeyRevisions: true } });
      if (!current) throw serviceError(404, 'Examination not found.', 'EXAMINATION_NOT_FOUND');
      if (current.revision !== input.expectedRevision) throw serviceError(409, 'The examination changed. Refresh it before publishing.', 'STALE_EXAMINATION_REVISION');
      if (input.action === 'PUBLISH' && !current.paperKeyRevisions.length) {
        throw serviceError(409, 'Register the approved paper-version key revision identifiers before publishing this examination.', 'PAPER_VERSIONS_REQUIRED');
      }
      const nextStatus = input.action === 'PUBLISH' ? ExaminationPublicationStatus.PUBLISHED : ExaminationPublicationStatus.WITHHELD;
      const updated = await tx.examination.updateMany({
        where: { id: examinationId, revision: input.expectedRevision },
        data: {
          publicationStatus: nextStatus,
          revision: { increment: 1 },
          publishedAt: input.action === 'PUBLISH' ? new Date() : null,
          publishedById: input.action === 'PUBLISH' ? actor.id : null,
        },
      });
      if (updated.count !== 1) throw serviceError(409, 'The examination changed. Refresh it before publishing.', 'STALE_EXAMINATION_REVISION');
      await tx.examinationPublicationAudit.create({ data: {
        examinationId,
        previousStatus: current.publicationStatus,
        newStatus: nextStatus,
        previousRevision: current.revision,
        newRevision: current.revision + 1,
        reason,
        actorId: actor.id,
        actorName: actor.name,
      } });
      if (input.action === 'WITHHOLD') {
        const results = await tx.examinationResult.findMany({ where: { examinationId }, select: { id: true } });
        for (const result of results) await this.supersedeCurrentDmcIssuances(tx, result.id, actor, `Examination withheld: ${reason}`);
      }
      const published = await tx.examination.findUnique({ where: { id: examinationId }, include: { paperKeyRevisions: { select: { paperVersion: true } } } });
      return published ? examinationSummary(published) : null;
    });
  }

  async createDraftResult(examinationId: string, input: CreateDraftResultRequest, actor: Actor) {
    try {
      return await this.db.$transaction(async (tx) => {
        // Serialize result creation with attempt resets so an unbound draft
        // cannot appear between the reset's safety check and the reset itself.
        await examLock(tx);
        const [exam, student] = await Promise.all([
          tx.examination.findUnique({ where: { id: examinationId }, include: { paperKeyRevisions: true } }),
          tx.student.findUnique({ where: { id: input.studentId }, select: {
            id: true, fullName: true, rollNumber: true, applicationNo: true, currentClass: true, hsscGroup: true, bsDepartment: true, bsSemester: true,
          } }),
        ]);
        if (!exam) throw serviceError(404, 'Examination not found.', 'EXAMINATION_NOT_FOUND');
        if (!student) throw serviceError(404, 'Student not found.', 'STUDENT_NOT_FOUND');
        if (normalizeGroup(classGroup(student)) !== normalizeGroup(exam.classGroup)) {
          throw serviceError(409, 'The student does not belong to the examination class/group.', 'CLASS_GROUP_MISMATCH');
        }
        if (input.paperVersion && !keyRevisionFor(exam, input.paperVersion)) throw serviceError(400, 'Select a paper version registered for this examination.', 'INVALID_PAPER_VERSION');
        const result = await tx.examinationResult.create({ data: {
          resultReference: input.resultReference,
          studentId: input.studentId,
          examinationId,
          sourceScanReference: input.sourceScanReference || null,
          paperVersion: input.paperVersion?.toUpperCase() || null,
          maximumMarks: exam.maximumMarks,
          administrativeRemarks: input.administrativeRemarks || null,
          identityStatus: 'PENDING',
          scoringStatus: 'PROVISIONAL',
          verificationStatus: 'PENDING',
          publicationStatus: 'UNPUBLISHED',
          createdById: actor.id,
        }, include: resultInclude });
        await tx.resultCorrectionAudit.create({ data: {
          resultId: result.id,
          studentId: result.studentId,
          examinationId: result.examinationId,
          previousRevision: 0,
          newRevision: result.resultRevision,
          oldValues: {} as Prisma.InputJsonValue,
          newValues: { resultReference: result.resultReference, identityStatus: result.identityStatus, scoringStatus: result.scoringStatus, verificationStatus: result.verificationStatus, publicationStatus: result.publicationStatus } as Prisma.InputJsonValue,
          reason: 'Initial Super Admin draft result entry.',
          actorId: actor.id,
          actorName: actor.name,
          source: 'MANUAL_ENTRY',
          publicationImpact: 'No public or document access enabled.',
        } });
        return toDetail(result);
      });
    } catch (error: any) {
      if (error?.code === 'P2002') throw serviceError(409, 'A result with this reference or student/examination pair already exists.', 'RESULT_CONFLICT');
      throw error;
    }
  }

  async correctResult(resultId: string, input: CorrectResultRequest, actor: Actor): Promise<OfficialResultDetail> {
    const reason = normalizeReason(input.reason);
    return this.db.$transaction(async (tx) => {
      await examLock(tx);
      const current = await tx.examinationResult.findUnique({ where: { id: resultId }, include: resultInclude });
      if (!current) throw serviceError(404, 'Examination result not found.', 'RESULT_NOT_FOUND');
      if (current.resultRevision !== input.expectedRevision) throw serviceError(409, 'This result changed. Refresh it before submitting the correction.', 'STALE_RESULT_REVISION');
      if (!current.attendanceSessionId || !current.attemptBinding || current.attemptBinding.sessionId!==current.attendanceSessionId || current.attemptBinding.studentId!==current.studentId)
        throw serviceError(409, 'Verify the examination attempt and roster before changing this result.', 'ATTEMPT_BINDING_REQUIRED');
      if (!current.attendanceSession?.isCurrent)
        throw serviceError(409, 'Historical examination results cannot be changed.', 'HISTORICAL_RESULT_IMMUTABLE');
      const changes = input.changes;
      const oldValues: Record<string, unknown> = {};
      const newValues: Record<string, unknown> = {};
      const scalarChanges = ['paperVersion', 'obtainedMarks', 'identityStatus', 'scoringStatus', 'verificationStatus', 'publicationStatus', 'administrativeRemarks'] as const;
      for (const key of scalarChanges) {
        if (Object.prototype.hasOwnProperty.call(changes, key)) {
          const oldValue = key === 'obtainedMarks' ? decimalString(current.obtainedMarks) : current[key];
          const newValue = key === 'obtainedMarks' && changes[key] !== null ? decimalString(decimal(changes[key] as string)) : changes[key];
          oldValues[key] = oldValue ?? null;
          newValues[key] = newValue ?? null;
        }
      }
      if (changes.responses?.length) {
        oldValues.responses = changes.responses.map((item) => {
          const before = current.responses.find((response: any) => response.questionNumber === item.questionNumber);
          return { questionNumber: item.questionNumber, detectedAnswer: before?.detectedAnswer ?? null, reviewedAnswer: before?.reviewedAnswer ?? null, classification: before?.classification ?? null };
        });
        newValues.responses = changes.responses.map((item) => ({
          questionNumber: item.questionNumber,
          ...(item.detectedAnswer !== undefined ? { detectedAnswer: item.detectedAnswer } : {}),
          ...(item.reviewedAnswer !== undefined ? { reviewedAnswer: item.reviewedAnswer } : {}),
          classification: item.classification,
        }));
      }
      const evidenceChanged = changes.paperVersion !== undefined || changes.obtainedMarks !== undefined || changes.responses !== undefined || changes.identityStatus !== undefined || changes.scoringStatus !== undefined;
      const paperVersion = changes.paperVersion !== undefined ? changes.paperVersion?.toUpperCase() ?? null : current.paperVersion;
      if (paperVersion && !keyRevisionFor(current.examination, paperVersion)) throw serviceError(400, 'Select a paper version registered for this examination.', 'INVALID_PAPER_VERSION');
      const responsePatches = changes.responses || [];
      for (const response of responsePatches) {
        if (response.questionNumber > current.examination.questionCount) throw serviceError(400, 'A question number is outside this examination.', 'QUESTION_OUT_OF_RANGE');
        if (['CORRECT', 'WRONG'].includes(response.classification)) {
          const existing = current.responses.find((item: any) => item.questionNumber === response.questionNumber);
          const answer = response.reviewedAnswer !== undefined ? response.reviewedAnswer : existing?.reviewedAnswer;
          if (!answer) throw serviceError(400, 'A reviewed A/B/C/D answer is required for a correct or wrong response.', 'REVIEWED_ANSWER_REQUIRED');
        }
      }

      let countsAndMarks: ReturnType<typeof calculateCountsAndMarks> | null = null;
      let candidateResponses: any[] = current.responses;
      if (responsePatches.length) {
        for (const patch of responsePatches) {
          const existing = current.responses.find((item: any) => item.questionNumber === patch.questionNumber);
          const classification = patch.classification as ResultResponseClassification;
          const marksByClassification = scoringPolicy(current.examination);
          const marksAwarded = classification === ResultResponseClassification.UNCERTAIN ? null : marksByClassification[classification];
          await tx.resultQuestionResponse.upsert({
            where: { resultId_questionNumber: { resultId, questionNumber: patch.questionNumber } },
            create: {
              resultId,
              questionNumber: patch.questionNumber,
              detectedAnswer: patch.detectedAnswer !== undefined ? patch.detectedAnswer : null,
              reviewedAnswer: patch.reviewedAnswer !== undefined ? patch.reviewedAnswer : null,
              classification,
              marksAwarded,
              responseSource: ResultResponseSource.ADMIN_CORRECTION,
            },
            update: {
              detectedAnswer: patch.detectedAnswer !== undefined ? patch.detectedAnswer : existing?.detectedAnswer ?? null,
              reviewedAnswer: patch.reviewedAnswer !== undefined ? patch.reviewedAnswer : existing?.reviewedAnswer ?? null,
              classification,
              marksAwarded,
              responseSource: ResultResponseSource.ADMIN_CORRECTION,
            },
          });
        }
        candidateResponses = await tx.resultQuestionResponse.findMany({ where: { resultId }, orderBy: { questionNumber: 'asc' } });
      }
      countsAndMarks = calculateCountsAndMarks(candidateResponses, current.examination);
      const evidenceForVerification = {
        ...current,
        responses: candidateResponses,
        ...(responsePatches.length && countsAndMarks.counts ? countsAndMarks.counts : {}),
      };
      const questionEvidenceComplete = countsAndMarks.complete && hasCompleteResponseEvidence(evidenceForVerification);

      const isManualScoreAdjustment = changes.obtainedMarks !== undefined;
      const nextScoringStatus = changes.scoringStatus ?? (responsePatches.length ? (countsAndMarks?.complete && !countsAndMarks.hasUncertain ? 'VERIFIED' : 'PROVISIONAL') : isManualScoreAdjustment ? 'PROVISIONAL' : current.scoringStatus);
      const nextIdentityStatus = changes.identityStatus ?? (changes.paperVersion !== undefined && paperVersion !== current.paperVersion ? 'PENDING' : current.identityStatus);
      const nextVerificationStatus = changes.verificationStatus ?? (evidenceChanged ? 'PENDING' : current.verificationStatus);
      let nextPublicationStatus = changes.publicationStatus ?? (evidenceChanged ? 'UNPUBLISHED' : current.publicationStatus);
      if (nextVerificationStatus === 'WITHHELD') nextPublicationStatus = 'WITHHELD';

      let computedCounts: any = {};
      let computedScore: Prisma.Decimal | null = changes.obtainedMarks === undefined ? current.obtainedMarks : changes.obtainedMarks === null ? null : decimal(changes.obtainedMarks);
      if (responsePatches.length) {
        computedCounts = countsAndMarks?.counts || { correctCount: null, wrongCount: null, blankCount: null, multipleCount: null, uncertainCount: null };
        computedScore = countsAndMarks?.complete && !countsAndMarks.hasUncertain ? countsAndMarks.obtainedMarks : null;
        if (computedScore && (computedScore.lt(0) || computedScore.gt(current.maximumMarks))) throw serviceError(400, 'Question marks exceed the result maximum or fall below zero.', 'RESULT_SCORE_OUT_OF_RANGE');
        newValues.computedCounts = computedCounts;
        newValues.computedObtainedMarks = decimalString(computedScore);
      }
      const authorizedScoreAdjustment = isManualScoreAdjustment
        || (current.administrativelyAdjusted && Boolean(current.administrativeAdjustmentReason));
      if (nextScoringStatus === 'VERIFIED' || nextVerificationStatus === 'VERIFIED' || nextPublicationStatus === 'PUBLISHED') {
        if (!questionEvidenceComplete) {
          throw serviceError(409, 'Complete, internally consistent question-level response evidence is required before verifying or publishing a result.', 'QUESTION_EVIDENCE_INCOMPLETE');
        }
        if (countsAndMarks.hasUncertain) {
          throw serviceError(409, 'Resolve uncertain responses before verifying or publishing a result.', 'UNCERTAIN_RESPONSES_REMAIN');
        }
        if (!authorizedScoreAdjustment && (computedScore === null || countsAndMarks.obtainedMarks === null || computedScore.comparedTo(countsAndMarks.obtainedMarks) !== 0)) {
          throw serviceError(409, 'The stored score does not match the confirmed question responses.', 'QUESTION_SCORE_MISMATCH');
        }
      }
      if (nextVerificationStatus === 'VERIFIED') {
        if (nextIdentityStatus !== 'VERIFIED') throw serviceError(409, 'Verify the roster identity before verifying the result.', 'IDENTITY_NOT_VERIFIED');
        if (nextScoringStatus !== 'VERIFIED') throw serviceError(409, 'Verify the score before verifying the result.', 'SCORE_NOT_VERIFIED');
        if (!paperVersion || !keyRevisionFor(current.examination, paperVersion)) throw serviceError(409, 'Confirm a registered paper version before verifying the result.', 'PAPER_VERSION_NOT_VERIFIED');
      }
      if (nextPublicationStatus === 'PUBLISHED') {
        if (current.examination.publicationStatus !== ExaminationPublicationStatus.PUBLISHED) throw serviceError(409, 'Publish the examination first.', 'EXAMINATION_NOT_PUBLISHED');
        if (nextIdentityStatus !== 'VERIFIED' || nextScoringStatus !== 'VERIFIED' || nextVerificationStatus !== 'VERIFIED') throw serviceError(409, 'Verify identity and score before publishing this result.', 'RESULT_NOT_VERIFIED');
        if (!paperVersion || !keyRevisionFor(current.examination, paperVersion)) throw serviceError(409, 'Confirm a registered paper version before publishing this result.', 'PAPER_VERSION_NOT_VERIFIED');
        if (computedScore === null) throw serviceError(409, 'A verified score is required before publication.', 'SCORE_NOT_AVAILABLE');
        if (computedScore.lt(0) || computedScore.gt(current.maximumMarks)) throw serviceError(400, 'The score is outside the approved marks range.', 'RESULT_SCORE_OUT_OF_RANGE');
      }
      if (isManualScoreAdjustment) {
        if (computedScore !== null && (computedScore.lt(0) || computedScore.gt(current.maximumMarks))) throw serviceError(400, 'The score is outside the approved marks range.', 'RESULT_SCORE_OUT_OF_RANGE');
        newValues.administrativelyAdjusted = true;
        newValues.administrativeAdjustmentReason = reason;
      }
      const publicationImpact = current.publicationStatus === 'PUBLISHED'
        ? `Previously published revision ${current.resultRevision} is superseded; new publication state: ${nextPublicationStatus}.`
        : `Publication state: ${current.publicationStatus} → ${nextPublicationStatus}.`;
      const nextRevision = current.resultRevision + 1;
      const updated = await tx.examinationResult.updateMany({
        where: { id: resultId, resultRevision: input.expectedRevision },
        data: {
          paperVersion,
          obtainedMarks: computedScore,
          ...(responsePatches.length ? computedCounts : {}),
          identityStatus: nextIdentityStatus,
          scoringStatus: nextScoringStatus,
          verificationStatus: nextVerificationStatus,
          publicationStatus: nextPublicationStatus,
          resultRevision: { increment: 1 },
          administrativelyAdjusted: responsePatches.length ? false : isManualScoreAdjustment ? true : current.administrativelyAdjusted,
          administrativeAdjustmentReason: responsePatches.length ? null : isManualScoreAdjustment ? reason : current.administrativeAdjustmentReason,
          ...(changes.administrativeRemarks !== undefined ? { administrativeRemarks: changes.administrativeRemarks } : {}),
          verifiedAt: nextVerificationStatus === 'VERIFIED' ? new Date() : null,
          verifiedById: nextVerificationStatus === 'VERIFIED' ? actor.id : null,
          publishedAt: nextPublicationStatus === 'PUBLISHED' ? new Date() : null,
          publishedById: nextPublicationStatus === 'PUBLISHED' ? actor.id : null,
        },
      });
      if (updated.count !== 1) throw serviceError(409, 'This result changed. Refresh it before submitting the correction.', 'STALE_RESULT_REVISION');
      const oldJson = { resultRevision: current.resultRevision, ...oldValues } as Prisma.InputJsonValue;
      const newJson = { resultRevision: nextRevision, ...newValues, identityStatus: nextIdentityStatus, scoringStatus: nextScoringStatus, verificationStatus: nextVerificationStatus, publicationStatus: nextPublicationStatus } as Prisma.InputJsonValue;
      await tx.resultCorrectionAudit.create({ data: {
        resultId,
        studentId: current.studentId,
        examinationId: current.examinationId,
        previousRevision: current.resultRevision,
        newRevision: nextRevision,
        oldValues: oldJson,
        newValues: newJson,
        reason,
        actorId: actor.id,
        actorName: actor.name,
        source: input.source,
        publicationImpact,
      } });
      if (current.publicationStatus === 'PUBLISHED' || nextPublicationStatus !== 'PUBLISHED') {
        await this.supersedeCurrentDmcIssuances(tx, resultId, actor, reason);
      }
      const updatedResult = await tx.examinationResult.findUnique({ where: { id: resultId }, include: resultInclude });
      return toDetail(updatedResult);
    });
  }

  async listCorrectionHistory(resultId: string) {
    await this.findResult(resultId);
    return this.db.resultCorrectionAudit.findMany({
      where: { resultId },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: 100,
      select: { id: true, resultId: true, studentId: true, examinationId: true, previousRevision: true, newRevision: true, oldValues: true, newValues: true, reason: true, actorId: true, actorName: true, source: true, publicationImpact: true, occurredAt: true },
    });
  }

  async prepareOfficialDmc(resultId: string, expectedRevision: number, actor: Actor) {
    return this.db.$transaction(async (tx) => {
      const result = await this.findResult(resultId, tx);
      if (result.resultRevision !== expectedRevision) throw serviceError(409, 'This result changed. Refresh it before preparing the document.', 'STALE_RESULT_REVISION');
      assertDmcEligible(result);
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 15 * 60 * 1000);
      await tx.dmcIssuancePreparation.deleteMany({ where: { expiresAt: { lt: now } } });
      const [issuanceCount, activePreparationCount] = await Promise.all([
        tx.dmcIssuance.count({ where: { resultId, documentType: DmcDocumentType.OFFICIAL } }),
        tx.dmcIssuancePreparation.count({ where: { resultId, expiresAt: { gt: now } } }),
      ]);
      const issueNumber = issuanceCount + activePreparationCount + 1;
      const preparationId = randomBytes(24).toString('base64url');
      const verificationReference = randomBytes(32).toString('base64url');
      const docNumber = `AZM-DMC-${sanitizeFilenamePart(result.examination.reference)}-${sanitizeFilenamePart(result.student.rollNumber || result.student.applicationNo)}-${issueNumber}`;
      const pdfData = await this.findDmcPdfData(result, 'OFFICIAL');
      pdfData.documentNumber = docNumber;
      pdfData.generatedAt = now.toISOString();
      pdfData.issuedByName = actor.name;
      pdfData.verificationReference = verificationReference;
      const snapshot = { ...pdfData, issueNumber, attemptAssociation: { sessionId: result.attendanceSessionId, boundAt: result.attemptBinding!.boundAt.toISOString() } } as unknown as Prisma.InputJsonValue;
      await tx.dmcIssuancePreparation.create({ data: {
        id: preparationId,
        resultId,
        resultRevision: expectedRevision,
        snapshot,
        actorId: actor.id,
        actorName: actor.name,
        expiresAt,
      } });
      return { preparationId, expiresAt: expiresAt.toISOString() };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async renderOfficialPreparationPreview(resultId: string, preparationId: string, actor: Actor) {
    const prep = await this.db.dmcIssuancePreparation.findFirst({ where: { id: preparationId, resultId, actorId: actor.id } });
    if (!prep || prep.expiresAt <= new Date()) throw serviceError(404, 'The document preview expired. Prepare it again.', 'DMC_PREPARATION_NOT_FOUND');
    const result = await this.findResult(resultId);
    if (result.resultRevision !== prep.resultRevision) throw serviceError(409, 'The result changed. Prepare a new document preview.', 'STALE_RESULT_REVISION');
    assertDmcEligible(result);
    if ((prep.snapshot as any)?.attemptAssociation?.sessionId !== result.attendanceSessionId) throw serviceError(409, 'Prepare a new preview for the verified examination attempt.', 'DMC_ATTEMPT_MISMATCH');
    return { pdf: await renderOfficialDmcPdf(preparePdfData(prep.snapshot)), documentNumber: (prep.snapshot as any).documentNumber };
  }

  async issueOfficialDmc(resultId: string, input: { preparationId: string; expectedRevision: number; idempotencyKey: string }, actor: Actor) {
    const existing = await this.db.dmcIssuance.findUnique({ where: { issuedById_idempotencyKey: { issuedById: actor.id, idempotencyKey: input.idempotencyKey } }, include: { events: true } });
    if (existing) {
      if (existing.resultId !== resultId) throw serviceError(409, 'This idempotency key was used for another document.', 'IDEMPOTENCY_KEY_REUSED');
      return { id: existing.id, documentNumber: existing.certificateNumber, resultRevision: existing.resultRevision, issuedAt: existing.issuedAt.toISOString(), status: latestEvent(existing.events)?.eventType || 'ISSUED' };
    }
    return this.db.$transaction(async (tx) => {
      const preparation = await tx.dmcIssuancePreparation.findFirst({ where: { id: input.preparationId, resultId, actorId: actor.id } });
      if (!preparation || preparation.expiresAt <= new Date()) throw serviceError(404, 'The document preview expired. Prepare it again.', 'DMC_PREPARATION_NOT_FOUND');
      if (preparation.resultRevision !== input.expectedRevision) throw serviceError(409, 'The prepared document revision does not match the confirmation.', 'STALE_RESULT_REVISION');
      const result = await tx.examinationResult.findUnique({ where: { id: resultId }, include: resultInclude });
      if (!result || result.resultRevision !== input.expectedRevision) throw serviceError(409, 'The result changed. Prepare a new document preview.', 'STALE_RESULT_REVISION');
      assertDmcEligible(result);
      if ((preparation.snapshot as any)?.attemptAssociation?.sessionId !== result.attendanceSessionId)
        throw serviceError(409, 'The document preview does not verify this examination attempt. Prepare it again.', 'DMC_ATTEMPT_MISMATCH');
      const data = preparePdfData(preparation.snapshot);
      const certificate = await tx.dmcIssuance.create({ data: {
        id: randomUUID(),
        resultId,
        documentType: DmcDocumentType.OFFICIAL,
        resultRevision: input.expectedRevision,
        issueNumber: Number((preparation.snapshot as any).issueNumber),
        certificateNumber: data.documentNumber,
        verificationReference: String(data.verificationReference),
        snapshot: preparation.snapshot as Prisma.InputJsonValue,
        idempotencyKey: input.idempotencyKey,
        issuedById: actor.id,
        issuedByName: actor.name,
      } });
      await tx.dmcIssuanceEvent.create({ data: { issuanceId: certificate.id, eventType: DmcIssuanceEventType.ISSUED, actorId: actor.id, actorName: actor.name } });
      await tx.dmcIssuancePreparation.delete({ where: { id: preparation.id } });
      return { id: certificate.id, documentNumber: certificate.certificateNumber, resultRevision: certificate.resultRevision, issuedAt: certificate.issuedAt.toISOString(), status: 'ISSUED' as const };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async renderElectronicDmc(resultId: string) {
    const result = await this.findResult(resultId);
    assertDmcEligible(result);
    const data = await this.findDmcPdfData(result, 'ELECTRONIC');
    const pdf = await renderElectronicDmcPdf(data);
    const current = await this.db.examinationResult.findUnique({ where: { id: resultId }, select: { resultRevision: true, publicationStatus: true } });
    if (!current || current.resultRevision !== result.resultRevision || current.publicationStatus !== 'PUBLISHED') throw serviceError(409, 'The result changed while the document was being prepared. Retry with the current published revision.', 'STALE_RESULT_REVISION');
    return { pdf, filename: `${sanitizeFilenamePart(result.examination.reference)}_${sanitizeFilenamePart(result.student.rollNumber || result.student.applicationNo)}_E-DMC.pdf` };
  }

  async renderOfficialDmc(resultId: string, issuanceId: string) {
    const issuance = await this.db.dmcIssuance.findFirst({
      where: { id: issuanceId, resultId, documentType: DmcDocumentType.OFFICIAL },
      include: { events: { orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }] }, result: { select: { resultRevision: true, attendanceSessionId: true, publicationStatus: true, verificationStatus: true, examination: { select: { publicationStatus: true } } } } },
    });
    if (!issuance || !issuance.result.attendanceSessionId || (issuance.snapshot as any)?.attemptAssociation?.sessionId !== issuance.result.attendanceSessionId || latestEvent(issuance.events)?.eventType !== DmcIssuanceEventType.ISSUED || issuance.resultRevision !== issuance.result.resultRevision || issuance.result.publicationStatus !== 'PUBLISHED' || issuance.result.verificationStatus !== 'VERIFIED' || issuance.result.examination.publicationStatus !== 'PUBLISHED') {
      throw serviceError(404, 'The requested Official DMC is not current and available.', 'DMC_NOT_AVAILABLE');
    }
    const data = preparePdfData(issuance.snapshot);
    return { pdf: await renderOfficialDmcPdf(data), filename: `${sanitizeFilenamePart(issuance.certificateNumber)}.pdf` };
  }

  async listOfficialDmcIssuances(resultId: string) {
    const result=await this.findResult(resultId);
    const issuances = await this.db.dmcIssuance.findMany({
      where: { resultId, documentType: DmcDocumentType.OFFICIAL },
      include: { events: { orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }], take: 1 } },
      orderBy: [{ issuedAt: 'desc' }, { id: 'desc' }],
      take: 50,
    });
    return issuances.map((issuance: any) => ({
      id: issuance.id,
      documentNumber: issuance.certificateNumber,
      resultRevision: issuance.resultRevision,
      status: latestIssuanceStatusFromEvents(issuance.events)==='ISSUED' && (!result.attendanceSessionId || (issuance.snapshot as any)?.attemptAssociation?.sessionId!==result.attendanceSessionId) ? 'ATTEMPT_UNVERIFIED' : latestIssuanceStatusFromEvents(issuance.events),
      issuedAt: issuance.issuedAt.toISOString(),
      issuer: issuance.issuedByName,
      verificationReference: issuance.verificationReference,
      reason: issuance.events?.[0]?.reason ?? null,
    }));
  }

  async revokeOfficialDmc(resultId: string, issuanceId: string, rawReason: string, actor: Actor) {
    const reason = normalizeReason(rawReason);
    return this.db.$transaction(async (tx) => {
      const issuance = await tx.dmcIssuance.findFirst({ where: { id: issuanceId, resultId }, include: { events: { orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }], take: 1 } } });
      if (!issuance) throw serviceError(404, 'Official DMC issuance not found.', 'DMC_ISSUANCE_NOT_FOUND');
      if (latestEvent(issuance.events)?.eventType !== DmcIssuanceEventType.ISSUED) throw serviceError(409, 'Only a current issued DMC can be revoked.', 'DMC_NOT_CURRENT');
      const event = await tx.dmcIssuanceEvent.create({ data: { issuanceId, eventType: DmcIssuanceEventType.REVOKED, reason, actorId: actor.id, actorName: actor.name } });
      return { issuanceId, status: event.eventType, reason: event.reason, occurredAt: event.occurredAt.toISOString() };
    });
  }

  async verifyDmc(reference: string) {
    const issuance = await this.db.dmcIssuance.findUnique({
      where: { verificationReference: reference },
      include: { events: { orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }], take: 1 }, result: { select: { resultRevision: true, attendanceSessionId: true, publicationStatus: true, verificationStatus: true, examination: { select: { title: true, examDate: true, publicationStatus: true } } } } },
    });
    if (!issuance) return { valid: false, status: 'INVALID' as const, examinationTitle: null, examinationDate: null };
    if (!issuance.result.attendanceSessionId || (issuance.snapshot as any)?.attemptAssociation?.sessionId !== issuance.result.attendanceSessionId)
      return { valid: false, status: 'INVALID' as const, examinationTitle: null, examinationDate: null };
    let status = latestIssuanceStatusFromEvents(issuance.events);
    const current = !!issuance.result.attendanceSessionId && (issuance.snapshot as any)?.attemptAssociation?.sessionId === issuance.result.attendanceSessionId
      && issuance.resultRevision === issuance.result.resultRevision
      && issuance.result.publicationStatus === 'PUBLISHED'
      && issuance.result.verificationStatus === 'VERIFIED'
      && issuance.result.examination.publicationStatus === 'PUBLISHED';
    if (status === 'ISSUED' && !current) status = 'SUPERSEDED';
    return {
      valid: status === 'ISSUED',
      status,
      examinationTitle: issuance.result.examination.title,
      examinationDate: issuance.result.examination.examDate?.toISOString().slice(0, 10) ?? null,
    };
  }
}

function latestIssuanceStatusFromEvents(events: any[]): 'ISSUED' | 'SUPERSEDED' | 'REVOKED' | 'NONE' {
  const event = latestEvent(events);
  return event?.eventType || 'NONE';
}

export const officialResultsService = new OfficialResultsService();
