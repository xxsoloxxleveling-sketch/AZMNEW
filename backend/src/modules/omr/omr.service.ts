import { officialActivation } from './activation';
import { Prisma, PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { requireExam, requireSuper, omrError, OmrActor } from './access';
import { candidateGroup } from './identity';
import { examInput, keyInput, reviewInput, permissionInput, pageInput } from './omr.schema';
import { scoreOmr, OmrOption, OmrResponse } from './scoring';

export const jsonValue = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value));
export async function serial<T>(db: PrismaClient, action: (tx: Prisma.TransactionClient)=>Promise<T>): Promise<T> {
  for (let attempt=0;;attempt++) {
    try { return await db.$transaction(action,{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,timeout:15000}); }
    catch(error) { if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code!=='P2034' || attempt>=2) throw error; }
  }
}
export async function lockScan(tx: Prisma.TransactionClient, id: string) {
  await tx.$queryRaw`SELECT id FROM "OmrScan" WHERE id=${id} FOR UPDATE`;
  const scan=await tx.omrScan.findUnique({where:{id},include:{exam:true,responses:{orderBy:{question:'asc'}}}});
  if(!scan) throw omrError(404,'Scan not found');
  return scan;
}
export async function evaluateDraft(tx: Prisma.TransactionClient, scanId: string, actorId?: string, reason='Initial server evaluation',replaceExisting=false) {
  const scan=await lockScan(tx,scanId);
  if(!scan.studentId || !scan.identityVerified || scan.responses.length!==scan.exam.questionCount || !['A','B','C','D'].includes(scan.paperVersion||'')) return null;
  const key=await tx.omrAnswerKeyRevision.findFirst({where:{examId:scan.examId,candidateGroup:scan.exam.candidateGroup,paperVersion:scan.paperVersion!,status:'APPROVED'},orderBy:{revision:'desc'}});
  if(!key) return null;
  // Unvalidated recognition may exercise synthetic development keys only.
  if(!key.isSynthetic && !officialActivation().approved) throw omrError(409,'Official scanning remains disabled pending physical validation and release approval');
  const existing=await tx.omrExamResult.findUnique({where:{examId_studentId:{examId:scan.examId,studentId:scan.studentId}}});
  if(existing && ((!replaceExisting && existing.sourceScanId!==scan.id) || existing.status!=='DRAFT')) throw omrError(409,'An existing result requires an explicit audited replacement workflow');
  const answers=scan.responses.map(row=>(row.reviewedAnswer||row.detectedAnswer) as OmrResponse);
  const grade=scoreOmr(answers,{id:key.id,revision:key.revision,status:'APPROVED',examId:key.examId,candidateGroup:key.candidateGroup,paperVersion:key.paperVersion as OmrOption,answers:z.array(z.enum(['A','B','C','D'])).length(100).parse(key.answers)},
    {questionCount:scan.exam.questionCount,correctMarks:Number(scan.exam.correctMarks),incorrectPenalty:Number(scan.exam.incorrectPenalty),minimumScore:scan.exam.minimumScore===null?undefined:Number(scan.exam.minimumScore)},
    {examId:scan.examId,candidateGroup:scan.exam.candidateGroup,paperVersion:scan.paperVersion as OmrOption});
  if(existing && actorId) await tx.omrPublicationAudit.create({data:{resultId:existing.id,actorId,action:'REEVALUATED',reason,snapshot:jsonValue({previous:existing,next:grade})}});
  const data={sourceScanId:scan.id,answerKeyId:key.id,grade:jsonValue(grade),score:grade.adjustedScore,maximumScore:grade.maximumScore};
  return existing ? tx.omrExamResult.update({where:{id:existing.id},data}) : tx.omrExamResult.create({data:{...data,examId:scan.examId,studentId:scan.studentId}});
}

export class OmrService {
  constructor(readonly db: PrismaClient=prisma) {}
  async groups(actor:OmrActor) {
    requireSuper(actor);
    const rows=await this.db.student.groupBy({by:['currentClass','hsscGroup'],where:{status:'ACTIVE'},_count:true});
    return rows.map(row=>({group:candidateGroup(row),count:row._count})).filter(row=>row.group!==null);
  }
  async exams(actor:OmrActor) {
    if(!['SUPER_ADMIN','ADMIN','TEACHER'].includes(actor.role)) throw omrError(403,'OMR staff access required');
    return this.db.omrExam.findMany({where:actor.role==='SUPER_ADMIN'?{}:{permissions:{some:{userId:actor.id,OR:[{canScan:true},{canReview:true},{canManage:true}]}}},include:{permissions:{where:{userId:actor.id},select:{canScan:true,canReview:true,canManage:true}}},orderBy:{createdAt:'desc'},take:100});
  }
  async createExam(actor:OmrActor,input:unknown) {
    requireSuper(actor); const value=examInput.parse(input);
    return this.db.omrExam.create({data:{...value,examDate:new Date(value.examDate),releaseAt:value.releaseAt?new Date(value.releaseAt):null,createdBy:actor.id}});
  }
  async updateExam(actor:OmrActor,id:string,input:unknown) {
    await requireExam(this.db,actor,id,'manage'); const value=examInput.parse(input);
    return serial(this.db,async tx=>{
      await tx.$queryRaw`SELECT id FROM "OmrExam" WHERE id=${id} FOR UPDATE`;
      const exam=await tx.omrExam.findUniqueOrThrow({where:{id}});
      if(exam.status!=='DRAFT') throw omrError(409,'Approved examination settings are locked');
      return tx.omrExam.update({where:{id},data:{...value,examDate:new Date(value.examDate),releaseAt:value.releaseAt?new Date(value.releaseAt):null}});
    });
  }
  async approveExam(actor:OmrActor,id:string) {
    await requireExam(this.db,actor,id,'manage');
    const changed=await this.db.omrExam.updateMany({where:{id,status:'DRAFT'},data:{status:'APPROVED'}});
    if(changed.count!==1) throw omrError(409,'Examination is not a draft');
    return {id,status:'APPROVED'};
  }
  async permission(actor:OmrActor,examId:string,input:unknown) {
    requireSuper(actor); await requireExam(this.db,actor,examId,'manage');
    const value=permissionInput.parse(input);
    const user=await this.db.user.findUnique({where:{id:value.userId}});
    if(!user || user.status!=='ACTIVE' || !['ADMIN','TEACHER'].includes(user.role) || (value.canManage && user.role!=='ADMIN')) throw omrError(400,'Invalid examination operator permissions');
    return this.db.omrExamPermission.upsert({where:{examId_userId:{examId,userId:value.userId}},create:{...value,examId},update:value});
  }
  async keys(actor:OmrActor,examId:string) {
    await requireExam(this.db,actor,examId,'manage');
    return this.db.omrAnswerKeyRevision.findMany({where:{examId},orderBy:[{paperVersion:'asc'},{revision:'desc'}]});
  }
  async createKey(actor:OmrActor,examId:string,input:unknown) {
    const exam=await requireExam(this.db,actor,examId,'manage'); const value=keyInput.parse(input);
    if(!exam.allowedVersions.includes(value.paperVersion)) throw omrError(400,'Paper version is not assigned to this examination');
    return serial(this.db,async tx=>{
      await tx.$queryRaw`SELECT id FROM "OmrExam" WHERE id=${examId} FOR UPDATE`;
      const last=await tx.omrAnswerKeyRevision.findFirst({where:{examId,paperVersion:value.paperVersion,candidateGroup:exam.candidateGroup},orderBy:{revision:'desc'}});
      return tx.omrAnswerKeyRevision.create({data:{...value,answers:jsonValue(value.answers),examId,candidateGroup:exam.candidateGroup,revision:(last?.revision||0)+1,createdBy:actor.id}});
    });
  }
  async approveKey(actor:OmrActor,examId:string,keyId:string) {
    const exam=await requireExam(this.db,actor,examId,'manage');
    if(exam.status!=='APPROVED') throw omrError(409,'Approve the examination configuration first');
    const changed=await this.db.omrAnswerKeyRevision.updateMany({where:{id:keyId,examId,status:'DRAFT'},data:{status:'APPROVED',approvedBy:actor.id,approvedAt:new Date()}});
    if(changed.count!==1) throw omrError(409,'Answer key is not a draft');
    return {id:keyId,status:'APPROVED'};
  }
  async scans(actor:OmrActor,examId:string,query:unknown) {
    await requireExam(this.db,actor,examId); const value=pageInput.parse(query);
    const where:Prisma.OmrScanWhereInput={examId,...(value.status?{status:value.status}:{}),...(value.search?{student:{OR:[{rollNumber:{contains:value.search,mode:'insensitive'}},{applicationNo:{contains:value.search,mode:'insensitive'}}]}}:{})};
    const [total,items]=await this.db.$transaction(async tx=>Promise.all([tx.omrScan.count({where}),tx.omrScan.findMany({where,select:{id:true,status:true,paperVersion:true,identityVerified:true,errorCode:true,createdAt:true,processedAt:true,student:{select:{id:true,fullName:true,rollNumber:true,applicationNo:true}}},orderBy:{createdAt:'desc'},skip:(value.page-1)*25,take:25})]));
    return {items,total,page:value.page,pageSize:25};
  }
  async scan(actor:OmrActor,id:string) {
    const scan=await this.db.omrScan.findUnique({where:{id},include:{responses:{orderBy:{question:'asc'}},student:{select:{id:true,fullName:true,rollNumber:true,applicationNo:true}},corrections:{orderBy:{createdAt:'asc'}},results:{select:{id:true,status:true,score:true,maximumScore:true,answerKeyId:true}}}});
    if(!scan) throw omrError(404,'Scan not found'); await requireExam(this.db,actor,scan.examId);
    const {rawDetection,originalObjectKey,annotationObjectKey,fileHash,lockedBy,...safe}=scan;
    return {...safe,results:actor.role==='TEACHER'?safe.results.map(result=>({id:result.id,status:result.status})):safe.results,quality:(rawDetection as Prisma.JsonObject|null)?.quality||null,hasAnnotation:!!annotationObjectKey};
  }
  async stats(actor:OmrActor,examId:string) {
    await requireExam(this.db,actor,examId);
    const [scans,results,batches]=await this.db.$transaction(async tx=>Promise.all([tx.omrScan.groupBy({by:['status'],where:{examId},orderBy:{status:'asc'},_count:true}),tx.omrExamResult.groupBy({by:['status'],where:{examId},orderBy:{status:'asc'},_count:true}),tx.omrScanBatch.count({where:{examId}})]));
    return {scans,results,batches,officialRecognitionEnabled:officialActivation().approved,offlineCaptureEnabled:false};
  }
  async review(actor:OmrActor,id:string,input:unknown) {
    const value=reviewInput.parse(input); const before=await this.db.omrScan.findUnique({where:{id}});
    if(!before) throw omrError(404,'Scan not found'); const exam=await requireExam(this.db,actor,before.examId,'review');
    return serial(this.db,async tx=>{
      const scan=await lockScan(tx,id);
      if(!['REVIEW_REQUIRED','RECOGNIZED'].includes(scan.status)) throw omrError(409,'Scan is not open for review');
      for(const correction of value.answers) {
        const previous=scan.responses.find(row=>row.question===correction.question);
        if(!previous) throw omrError(409,'Recognition evidence is incomplete');
        await tx.omrCorrectionAudit.create({data:{scanId:id,actorId:actor.id,question:correction.question,previous:jsonValue({answer:previous.reviewedAnswer||previous.detectedAnswer}),next:jsonValue({answer:correction.answer}),reason:value.reason}});
        await tx.omrDetectedResponse.update({where:{scanId_question:{scanId:id,question:correction.question}},data:{reviewedAnswer:correction.answer}});
      }
      if(value.paperVersion) {
        if(!exam.allowedVersions.includes(value.paperVersion)) throw omrError(400,'Unsupported paper version');
        await tx.omrCorrectionAudit.create({data:{scanId:id,actorId:actor.id,previous:jsonValue({paperVersion:scan.paperVersion}),next:{paperVersion:value.paperVersion},reason:value.reason}});
        await tx.omrScan.update({where:{id},data:{paperVersion:value.paperVersion}});
      }
      if(value.identityLookup) {
        if(scan.errorCode==='EXAM_IDENTITY_REVIEW_REQUIRED' && !value.examConfirmed) throw omrError(409,'Confirm the selected examination against the printed sheet');
        const students=await tx.student.findMany({where:{OR:[{rollNumber:value.identityLookup},{applicationNo:value.identityLookup}]},take:2});
        const student=students[0];
        if(students.length!==1 || !student?.rollNumber || student.status!=='ACTIVE' || student.rollNumber!==value.printedRollNumber || value.identityConfirmed!==true || candidateGroup(student)!==exam.candidateGroup) throw omrError(409,'Candidate identity or examination eligibility does not match');
        if(await tx.omrExamResult.findFirst({where:{sourceScanId:id,studentId:{not:student.id}}})) throw omrError(409,'This evidence is already attached to a different candidate result; retain it and use a new capture');
        await tx.omrCorrectionAudit.create({data:{scanId:id,actorId:actor.id,previous:jsonValue({studentId:scan.studentId}),next:{studentId:student.id,examId:exam.id,session:exam.session,examConfirmed:value.examConfirmed||false},reason:value.reason}});
        await tx.omrScan.update({where:{id},data:{studentId:student.id,identityVerified:true,identityOverrideReason:value.reason}});
      }
      const refreshed=await tx.omrScan.findUniqueOrThrow({where:{id}});
      const existing=refreshed.studentId?await tx.omrExamResult.findUnique({where:{examId_studentId:{examId:scan.examId,studentId:refreshed.studentId}}}):null;
      if(existing&&(existing.sourceScanId!==id||existing.status!=='DRAFT')) return {scanId:id,resultId:existing.id,requiresReplacement:true};
      const result=await evaluateDraft(tx,id,actor.id,value.reason);
      return {scanId:id,resultId:result?.id||null};
    });
  }
  async decide(actor:OmrActor,id:string,approve:boolean,reason:string) {
    const scan=await this.db.omrScan.findUnique({where:{id}}); if(!scan) throw omrError(404,'Scan not found');
    await requireExam(this.db,actor,scan.examId,'review');
    return serial(this.db,async tx=>{
      const locked=await lockScan(tx,id);
      if(!['REVIEW_REQUIRED','RECOGNIZED'].includes(locked.status)) throw omrError(409,'Scan is not open for approval');
      if(approve && (!locked.identityVerified || locked.responses.length!==100 || locked.responses.some(row=>(row.reviewedAnswer||row.detectedAnswer)==='UNCERTAIN' || (row.detectedAnswer==='MULTIPLE'&&!row.reviewedAnswer)))) throw omrError(409,'Confirm identity and resolve uncertain responses before approval');
      const result=approve?await evaluateDraft(tx,id,actor.id,reason):null;
      if(approve&&!result) throw omrError(409,'An approved matching answer key and verified identity are required');
      await tx.omrCorrectionAudit.create({data:{scanId:id,actorId:actor.id,previous:{status:locked.status},next:{status:approve?'VERIFIED':'REJECTED'},reason}});
      await tx.omrScan.update({where:{id},data:{status:approve?'VERIFIED':'REJECTED'}});
      if(result) {
        await tx.omrPublicationAudit.create({data:{resultId:result.id,actorId:actor.id,action:'APPROVED',snapshot:jsonValue(result),reason}});
        await tx.omrExamResult.update({where:{id:result.id},data:{status:'VERIFIED',approvedBy:actor.id,approvedAt:new Date()}});
      }
      return {scanId:id,status:approve?'VERIFIED':'REJECTED'};
    });
  }
  async results(actor:OmrActor,examId:string,query:unknown) {
    if(actor.role==='TEACHER') throw omrError(403,'Internal marks are restricted to authorized administrators');
    await requireExam(this.db,actor,examId,'review'); const value=pageInput.parse(query);
    const where={examId,...(value.status?{status:value.status}:{})};
    const [total,items]=await this.db.$transaction(async tx=>Promise.all([tx.omrExamResult.count({where}),tx.omrExamResult.findMany({where,include:{student:{select:{fullName:true,rollNumber:true,applicationNo:true}},publications:{orderBy:{createdAt:'asc'}}},skip:(value.page-1)*25,take:25,orderBy:{createdAt:'desc'}})]));
    return {items,total,page:value.page,pageSize:25};
  }
  async approveResults(actor:OmrActor,examId:string,resultIds:string[],reason:string) {
    if(actor.role==='TEACHER') throw omrError(403,'Result administration is restricted to administrators');
    await requireExam(this.db,actor,examId,'review');
    const approved:string[]=[],failed:Array<{id:string;reason:string}>=[];
    for(const id of resultIds) {
      const result=await this.db.omrExamResult.findFirst({where:{id,examId}});
      if(!result || result.status!=='DRAFT') {failed.push({id,reason:'Result is not a draft in this examination'});continue;}
      try { await this.decide(actor,result.sourceScanId,true,reason);approved.push(id); }
      catch(error) {failed.push({id,reason:error instanceof Error && 'statusCode' in error?error.message:'Verification failed; original result retained'});}
    }
    return {approved,failed};
  }
  async withdraw(actor:OmrActor,examId:string,resultId:string,reason:string) {
    requireSuper(actor); await requireExam(this.db,actor,examId,'manage');
    return serial(this.db,async tx=>{
      await tx.$queryRaw`SELECT id FROM "OmrExamResult" WHERE id=${resultId} FOR UPDATE`;
      const result=await tx.omrExamResult.findFirst({where:{id:resultId,examId}});
      if(!result || result.status!=='PUBLISHED') throw omrError(409,'Only a published result can be withdrawn');
      await tx.omrPublicationAudit.create({data:{resultId,actorId:actor.id,action:'WITHDRAWN',reason,snapshot:jsonValue(result)}});
      return tx.omrExamResult.update({where:{id:resultId},data:{status:'WITHDRAWN'}});
    });
  }
  async reevaluate(actor:OmrActor,examId:string,resultId:string,sourceScanId:string|undefined,reason:string) {
    await requireExam(this.db,actor,examId,'manage');
    return serial(this.db,async tx=>{
      await tx.$queryRaw`SELECT id FROM "OmrExamResult" WHERE id=${resultId} FOR UPDATE`;
      const result=await tx.omrExamResult.findFirst({where:{id:resultId,examId}});
      if(!result || result.status==='PUBLISHED') throw omrError(409,'Withdraw published marks before an explicit reevaluation');
      const scan=await lockScan(tx,sourceScanId||result.sourceScanId);
      if(scan.examId!==examId || scan.studentId!==result.studentId || !scan.identityVerified || scan.responses.length!==100 || ['INVALID','FAILED','QUEUED','PROCESSING','REJECTED'].includes(scan.status)) throw omrError(409,'Replacement evidence does not match the verified candidate');
      await tx.omrPublicationAudit.create({data:{resultId,actorId:actor.id,action:'CORRECTED',reason,snapshot:jsonValue({previous:result,replacementScanId:scan.id})}});
      await tx.omrExamResult.update({where:{id:resultId},data:{status:'DRAFT',approvedBy:null,approvedAt:null,publishedAt:null,rank:null}});
      const next=await evaluateDraft(tx,scan.id,actor.id,reason,true);
      if(!next) throw omrError(409,'A matching approved key is required');
      await tx.omrScan.update({where:{id:scan.id},data:{status:'REVIEW_REQUIRED'}});
      return {resultId,scanId:scan.id,status:'DRAFT'};
    });
  }
  async publish(actor:OmrActor,examId:string,resultIds:string[],reason:string) {
    requireSuper(actor); await requireExam(this.db,actor,examId,'manage');
    const activation=officialActivation();
    if(!activation.approved || !activation.receipt) throw omrError(409,'Official publication is disabled pending signed physical-validation and release evidence');
    if(!resultIds.length || resultIds.length>500 || new Set(resultIds).size!==resultIds.length) throw omrError(400,'Select distinct verified results');
    return serial(this.db,async tx=>{
      await tx.$queryRaw`SELECT id FROM "OmrExam" WHERE id=${examId} FOR UPDATE`;
      const exam=await tx.omrExam.findUniqueOrThrow({where:{id:examId}});
      if(!await tx.user.findFirst({where:{id:actor.id,role:'SUPER_ADMIN',status:'ACTIVE'}})) throw omrError(403,'Active Super Admin authorization is required');
      if(exam.status!=='APPROVED' || !exam.releaseAt || exam.releaseAt>new Date()) throw omrError(409,'The examination release gate is closed');
      const results=await tx.omrExamResult.findMany({where:{id:{in:resultIds},examId},include:{key:true,scan:true}});
      if(results.length!==resultIds.length) throw omrError(404,'Result set does not match this examination');
      for(const result of results) {
        const evidence=result.scan.rawDetection as Prisma.JsonObject|null;
        const latest=await tx.omrAnswerKeyRevision.findFirst({where:{examId,paperVersion:result.key.paperVersion,candidateGroup:exam.candidateGroup,status:'APPROVED'},orderBy:{revision:'desc'}});
        if(result.status!=='VERIFIED' || result.key.isSynthetic || !result.scan.identityVerified || result.scan.status!=='VERIFIED' || evidence?.activationReceipt!==activation.receipt || latest?.id!==result.answerKeyId) throw omrError(409,'All results must be verified under the current official key and validated recognition release');
        const {key,scan,...snapshot}=result;
        await tx.omrPublicationAudit.create({data:{resultId:result.id,actorId:actor.id,action:'PUBLISHED',reason,snapshot:jsonValue({result:snapshot,activationReceipt:activation.receipt})}});
      }
      const changed=await tx.omrExamResult.updateMany({where:{id:{in:resultIds},examId,status:'VERIFIED'},data:{status:'PUBLISHED',publishedAt:new Date()}});
      if(changed.count!==results.length) throw omrError(409,'Results changed during publication; retry');
      await tx.omrExam.update({where:{id:examId},data:{publicationStatus:'PUBLISHED'}});
      return {published:changed.count,resultIds};
    });
  }
}
export const omrService=new OmrService();
