import { createHash, randomUUID } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { bindOfficialResultInTransaction, examControlService, examLock } from '../attendance/examControl.service';
import { loadApprovedOmrKeys, OMR_SOURCE_PDF_SHA256, rosterOmrCohort, scoreOmrAnswers } from './omrStudioScoring';
import type { OmrStudioImportRequest } from './results.schema';

const fail = (code: string, message: string): never => { throw Object.assign(new Error(message), { statusCode: 409, code }); };
const norm = (value: string) => value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

/** Atomic official import: no image or private key is stored in the database. */
export class OmrStudioImportService {
  constructor(private db: PrismaClient = prisma, private getKeys = loadApprovedOmrKeys) {}

  async import(input: OmrStudioImportRequest, actorId: string, tokenVersion: number) {
    const keys = this.getKeys();
    const fingerprint = createHash('sha256').update(JSON.stringify(input)).digest('hex');
    const scanRef = `OMR:${input.scanSha256}`;
    for (let attempt = 0; ; attempt++) try {
    return await this.db.$transaction(async tx => {
      await examLock(tx);
      const actor = await examControlService.actor(tx, actorId, tokenVersion);
      const prior = await tx.examinationResult.findUnique({ where: { sourceScanReference: scanRef }, include: { corrections: { orderBy: { occurredAt: 'asc' }, take: 1 } } });
      if (prior) {
        const audit = prior.corrections[0]?.newValues as Record<string, unknown> | undefined;
        if (audit?.omrFingerprint !== fingerprint) fail('OMR_DUPLICATE_SCAN', 'This scan has already been submitted with different details.');
        return { resultId: prior.id, resultReference: prior.resultReference, alreadyImported: true };
      }
      const [student, exam, roster] = await Promise.all([
        tx.student.findUnique({ where: { id: input.studentId } }),
        tx.examination.findUnique({ where: { id: input.examinationId }, include: { paperKeyRevisions: true } }),
        tx.attendanceSessionCandidate.findUnique({ where: { sessionId_studentId: { sessionId: input.attendanceSessionId, studentId: input.studentId } }, include: { session: true } }),
      ]);
      if (!student || student.status !== 'ACTIVE' || !student.rollNumber || student.rollNumber !== input.rollNumber || student.applicationNo !== input.applicationNo)
        return fail('OMR_IDENTITY_MISMATCH', 'The scan identity does not match an active student.');
      if (!roster || !roster.session.isCurrent || !['OPEN', 'CLOSED'].includes(roster.session.status) || roster.rollNumberSnapshot !== student.rollNumber || roster.applicationNoSnapshot !== student.applicationNo)
        return fail('OMR_ATTEMPT_MISMATCH', 'The student is not on the selected current examination roster.');
      if (!exam || exam.publicationStatus !== 'PUBLISHED' || exam.sessionReference !== '2026-V' || exam.questionCount !== 100 || !exam.maximumMarks.equals(100) || !exam.examDate || exam.examDate.toISOString().slice(0, 10) !== roster.session.businessDate.toISOString().slice(0, 10))
        return fail('OMR_EXAMINATION_MISMATCH', 'Select the published Session V examination configured for 100 questions and marks.');
      const cohort = rosterOmrCohort(student.currentClass, student.hsscGroup || student.bsDepartment);
      const examCohort = rosterOmrCohort(exam.classGroup, null);
      const studentGroup = [student.currentClass, student.hsscGroup || student.bsDepartment, student.bsSemester].filter(Boolean).join(' · ');
      if (!cohort || !(examCohort === cohort || norm(exam.classGroup) === norm(cohort) || norm(exam.classGroup) === norm(studentGroup)))
        return fail('OMR_GROUP_MISMATCH', 'The student and examination class/group do not match a supported key.');
      const revision = exam.paperKeyRevisions.find(item => item.paperVersion === input.paperVersion);
      if (!revision || revision.answerKeyRevision !== `sha256:${OMR_SOURCE_PDF_SHA256}`)
        return fail('OMR_KEY_REVISION_MISMATCH', 'The examination paper does not identify the approved answer-key PDF revision.');
      const policy = exam.scoringPolicy as Record<string, unknown>;
      if (policy.correctMarks == null || Number(policy.correctMarks) !== 1 || ['wrongMarks', 'blankMarks', 'multipleMarks'].some(key => policy[key] == null || Number(policy[key]) !== 0))
        return fail('OMR_SCORING_POLICY_MISMATCH', 'The examination must use the approved 1/0 scoring policy.');
      const scored = scoreOmrAnswers(keys, cohort, input.paperVersion, input.answers);
      const result = await tx.examinationResult.create({ data: {
        resultReference: `OMR-${randomUUID()}`, studentId: student.id, examinationId: exam.id,
        sourceScanReference: scanRef, paperVersion: input.paperVersion, maximumMarks: 100, createdById: actor.id,
      } });
      await bindOfficialResultInTransaction(tx, result.id, roster.sessionId, 'Automatic Studio import matched the selected frozen roster.', actor.id, tokenVersion);
      const counts = { CORRECT: 0, WRONG: 0, BLANK: 0, MULTIPLE: 0 };
      for (const response of scored.responses) counts[response.classification]++;
      await tx.resultQuestionResponse.createMany({ data: scored.responses.map(response => ({
        resultId: result.id, questionNumber: response.questionNumber, detectedAnswer: response.detectedAnswer,
        reviewedAnswer: response.detectedAnswer, classification: response.classification, reviewMetadata: { source: 'automated OMR; no human answer review' },
        marksAwarded: response.classification === 'CORRECT' ? 1 : 0, responseSource: 'OMR_DETECTED',
      })) });
      await tx.examinationResult.update({ where: { id: result.id }, data: {
        obtainedMarks: scored.marks, correctCount: counts.CORRECT, wrongCount: counts.WRONG,
        blankCount: counts.BLANK, multipleCount: counts.MULTIPLE, uncertainCount: 0,
        identityStatus: 'VERIFIED', scoringStatus: 'VERIFIED', verificationStatus: 'VERIFIED', publicationStatus: 'PUBLISHED',
        verifiedAt: new Date(), verifiedById: actor.id, publishedAt: new Date(), publishedById: actor.id,
      } });
      await tx.resultCorrectionAudit.create({ data: {
        resultId: result.id, studentId: student.id, examinationId: exam.id, previousRevision: 0, newRevision: 1,
        oldValues: {}, newValues: { omrFingerprint: fingerprint, scanSha256: input.scanSha256, attemptId: roster.sessionId, cohort, paperVersion: input.paperVersion, obtainedMarks: scored.marks, identityBasis: 'Studio-reported identifiers matched to student and frozen roster; QR signature not verified.', responseSource: 'OMR_DETECTED', keyPdfSha256: OMR_SOURCE_PDF_SHA256 } as Prisma.InputJsonValue,
        reason: 'Automated OMR Studio import using approved marking policy.', actorId: actor.id, actorName: actor.name,
        source: 'RESULTS_DASHBOARD', publicationImpact: 'Final result available to authorized administrators.',
      } });
      await tx.$executeRawUnsafe('SET CONSTRAINTS ALL IMMEDIATE');
      return { resultId: result.id, resultReference: result.resultReference, alreadyImported: false };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000 });
    } catch (error: any) {
      if ((error?.code === 'P2034' || (error?.code === 'P2010' && ['40001', '40P01'].includes(error.meta?.code))) && attempt < 3) continue;
      if (error?.code === 'P2002') return fail('OMR_RESULT_CONFLICT', 'A result already exists for this student and examination attempt.');
      if (typeof error?.statusCode === 'number' && error.statusCode < 500) throw error;
      // Prisma errors may embed query values. Do not send scan answers or
      // candidate identifiers to the global error logger on unexpected faults.
      throw Object.assign(new Error('The OMR import could not be completed.'), { statusCode: 500, code: 'OMR_IMPORT_FAILED' });
    }
  }
}
export const omrStudioImportService = new OmrStudioImportService();
