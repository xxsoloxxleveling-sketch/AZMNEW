import { PrismaClient } from '@prisma/client';
export interface OmrActor { id: string; role: string }
export function omrError(statusCode: number, message: string) { return Object.assign(new Error(message), { statusCode }); }
export function requireSuper(actor: OmrActor) { if (actor.role !== 'SUPER_ADMIN') throw omrError(403,'Super Admin permission required'); }
export async function requireExam(db: PrismaClient, actor: OmrActor, examId: string, operation: 'read'|'scan'|'review'|'manage'='read') {
  if (!['SUPER_ADMIN','ADMIN','TEACHER'].includes(actor.role)) throw omrError(403,'OMR staff access required');
  const exam = await db.omrExam.findUnique({ where:{id:examId} });
  if (!exam) throw omrError(404,'Examination not found');
  if (actor.role === 'SUPER_ADMIN') return exam;
  if (operation==='manage' && actor.role!=='ADMIN') throw omrError(403,'Answer keys are confidential');
  const permission = await db.omrExamPermission.findUnique({ where:{examId_userId:{examId,userId:actor.id}} });
  const granted = operation==='manage' ? permission?.canManage : operation==='review' ? permission?.canReview : operation==='scan' ? permission?.canScan : permission?.canScan || permission?.canReview || permission?.canManage;
  if (!granted) throw omrError(403,'Examination permission required');
  return exam;
}
