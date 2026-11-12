import { randomUUID, createHash } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { requireExam, OmrActor, omrError } from './access';
import { storePrivate, readPrivate, fileType } from './storage';
import { runRecognition } from './runner';
import { decodeIdentity, reconcileIdentity } from './identity';
import { serial, jsonValue, evaluateDraft } from './omr.service';
import { officialActivation, recognitionHashes } from './activation';
import { invalidCaptureCode } from './capture-diagnostics';

const LEASE_MS=180000;
export class OmrQueue {
  private busy=false;
  constructor(readonly db:PrismaClient=prisma,private recognize:typeof runRecognition=runRecognition) {}
  async upload(actor:OmrActor,examId:string,bytes:Buffer,mime:string,source:string) {
    const exam=await requireExam(this.db,actor,examId,'scan');
    if(exam.status!=='APPROVED') throw omrError(409,'Scanning requires an approved examination');
    const type=fileType(bytes);
    if(type.mime!==mime.split(';')[0].trim().toLowerCase()) throw omrError(415,'File contents and MIME type disagree');
    const fileHash=createHash('sha256').update(bytes).digest('hex');
    const originalObjectKey=await storePrivate(bytes);
    return this.db.omrScanBatch.create({data:{examId,uploadedBy:actor.id,source:source==='mobile'?'MOBILE':'WEB',fileHash,originalObjectKey},select:{id:true,status:true,createdAt:true}});
  }
  async batch(actor:OmrActor,id:string) {
    const batch=await this.db.omrScanBatch.findUnique({where:{id},include:{items:{orderBy:{pageIndex:'asc'},include:{scan:{select:{id:true,status:true,errorCode:true}}}}}});
    if(!batch) throw omrError(404,'Batch not found'); await requireExam(this.db,actor,batch.examId);
    const {originalObjectKey,fileHash,lockedBy,...safe}=batch;
    const processed=safe.items.filter(item=>item.scan && !['QUEUED','PROCESSING'].includes(item.scan.status)).length;
    return {...safe,status:safe.status==='READY' && processed===safe.items.length?'COMPLETE':safe.status,progress:{processed,total:safe.items.length,duplicates:safe.items.filter(item=>item.status==='DUPLICATE').length}};
  }
  async list(actor:OmrActor,examId:string,page:number) {
    await requireExam(this.db,actor,examId);
    const [total,items]=await this.db.$transaction(async tx=>Promise.all([tx.omrScanBatch.count({where:{examId}}),tx.omrScanBatch.findMany({where:{examId},select:{id:true,status:true,source:true,errorCode:true,createdAt:true,_count:{select:{items:true}}},orderBy:{createdAt:'desc'},skip:(page-1)*25,take:25})]));
    return {total,items,page,pageSize:25};
  }
  async retry(actor:OmrActor,id:string) {
    const scan=await this.db.omrScan.findUnique({where:{id}}); if(!scan) throw omrError(404,'Scan not found');
    await requireExam(this.db,actor,scan.examId,'review');
    if(scan.status!=='FAILED' || scan.rawDetection!==null || scan.attempts>=3) throw omrError(409,'This scan cannot be retried; retain it and upload a new capture');
    await this.db.omrScan.update({where:{id},data:{status:'QUEUED',nextAttemptAt:new Date(),lockedAt:null,lockedBy:null}});
    return {id,status:'QUEUED'};
  }
  private async batches() {
    const claim=randomUUID(),expired=new Date(Date.now()-LEASE_MS);
    const batch=await serial(this.db,async tx=>{
      const rows=await tx.$queryRaw<Array<{id:string}>>`SELECT id FROM "OmrScanBatch" WHERE attempts<3 AND "nextAttemptAt"<=CURRENT_TIMESTAMP AND (status='QUEUED' OR (status='PROCESSING' AND "lockedAt"<${expired})) ORDER BY "createdAt" FOR UPDATE SKIP LOCKED LIMIT 1`;
      return rows[0]?tx.omrScanBatch.update({where:{id:rows[0].id},data:{status:'PROCESSING',lockedAt:new Date(),lockedBy:claim,attempts:{increment:1}}}):null;
    });
    if(!batch) return false;
    try {
      const bytes=await readPrivate(batch.originalObjectKey);
      const inspection=(await this.recognize(bytes)).inspection!;
      await serial(this.db,async tx=>{
        await tx.$queryRaw`SELECT id FROM "OmrScanBatch" WHERE id=${batch.id} FOR UPDATE`;
        const current=await tx.omrScanBatch.findUniqueOrThrow({where:{id:batch.id}});
        if(current.lockedBy!==claim || current.status!=='PROCESSING') return;
        for(let pageIndex=1;pageIndex<=inspection.pages;pageIndex++) {
          const existing=await tx.omrScan.findUnique({where:{examId_fileHash_pageIndex:{examId:batch.examId,fileHash:batch.fileHash,pageIndex}}});
          const scan=existing||await tx.omrScan.create({data:{examId:batch.examId,fileHash:batch.fileHash,pageIndex,originalObjectKey:batch.originalObjectKey}});
          await tx.omrScanBatchItem.upsert({where:{batchId_pageIndex:{batchId:batch.id,pageIndex}},create:{batchId:batch.id,pageIndex,scanId:scan.id,status:existing?'DUPLICATE':'QUEUED'},update:{}});
        }
        await tx.omrScanBatch.update({where:{id:batch.id},data:{status:'READY',lockedAt:null,lockedBy:null,errorCode:null}});
      });
    } catch {
      await this.db.omrScanBatch.updateMany({where:{id:batch.id,lockedBy:claim},data:{status:batch.attempts>=3?'FAILED':'QUEUED',lockedAt:null,lockedBy:null,nextAttemptAt:new Date(Date.now()+batch.attempts*10000),errorCode:'FILE_INSPECTION_FAILED'}});
    }
    return true;
  }
  private async scans() {
    const claim=randomUUID(),expired=new Date(Date.now()-LEASE_MS);
    const scan=await serial(this.db,async tx=>{
      const rows=await tx.$queryRaw<Array<{id:string}>>`SELECT id FROM "OmrScan" WHERE attempts<3 AND "nextAttemptAt"<=CURRENT_TIMESTAMP AND (status='QUEUED' OR (status='PROCESSING' AND "lockedAt"<${expired})) ORDER BY "createdAt" FOR UPDATE SKIP LOCKED LIMIT 1`;
      return rows[0]?tx.omrScan.update({where:{id:rows[0].id},data:{status:'PROCESSING',lockedAt:new Date(),lockedBy:claim,attempts:{increment:1}}}):null;
    });
    if(!scan) return false;
    try {
      const output=await this.recognize(await readPrivate(scan.originalObjectKey),scan.pageIndex),observation=output.observation!;
      const annotationObjectKey=output.annotation?await storePrivate(output.annotation):null;
      const activation=officialActivation(),hashes=recognitionHashes();
      await serial(this.db,async tx=>{
        await tx.$queryRaw`SELECT id FROM "OmrScan" WHERE id=${scan.id} FOR UPDATE`;
        const current=await tx.omrScan.findUniqueOrThrow({where:{id:scan.id},include:{exam:true}});
        if(current.lockedBy!==claim || current.status!=='PROCESSING' || current.rawDetection!==null) return;
        const qr=decodeIdentity(observation.qrEnvelope||observation.identity);
        const student=qr?await tx.student.findUnique({where:{id:qr.studentId}}):null;
        const qrMatches=reconcileIdentity(observation.qrEnvelope||observation.identity,student,current.exam);
        const eligibleExams=qr?.examId?1:await tx.omrExam.count({where:{status:'APPROVED',session:current.exam.session,candidateGroup:current.exam.candidateGroup}});
        const matches=eligibleExams===1 && qrMatches && !!observation.printedRollNumber && observation.printedRollNumber===student?.rollNumber;
        const status=observation.status==='INVALID'?'INVALID':matches?observation.status:'REVIEW_REQUIRED';
        const captureError=invalidCaptureCode(observation);
        const version=observation.paperVersion?.answer;
        await tx.omrScan.update({where:{id:scan.id},data:{status,templateVersion:observation.template,paperVersion:version&&['A','B','C','D'].includes(version)?version:null,studentId:matches?student!.id:null,identityVerified:matches,rawDetection:jsonValue({...observation,...hashes,activationReceipt:activation.receipt}),annotationObjectKey,errorCode:observation.status==='INVALID'?captureError:matches?null:eligibleExams!==1?'EXAM_IDENTITY_REVIEW_REQUIRED':'IDENTITY_REVIEW_REQUIRED',processedAt:new Date(),lockedAt:null,lockedBy:null}});
        if(observation.responses) await tx.omrDetectedResponse.createMany({data:observation.responses.map(row=>({scanId:scan.id,question:row.question,detectedAnswer:row.answer,evidence:jsonValue({darkness:row.darkness,rawDarkness:row.rawDarkness,paperReference:row.paperReference,measurementMethod:row.measurementMethod,coreDarkness:row.coreDarkness,innerDarkness:row.innerDarkness,innerPaperQuantile20:row.innerPaperQuantile20,innerTextureStd:row.innerTextureStd,innerTextureSpan:row.innerTextureSpan,reviewRequired:row.reviewRequired,outlineSupport:row.outlineSupport,reason:row.reason})}))});
        if(status==='RECOGNIZED'&&matches) {
          const existing=await tx.omrExamResult.findUnique({where:{examId_studentId:{examId:scan.examId,studentId:student!.id}}});
          const key=await tx.omrAnswerKeyRevision.findFirst({where:{examId:scan.examId,paperVersion:version,status:'APPROVED',candidateGroup:current.exam.candidateGroup},orderBy:{revision:'desc'}});
          if(!existing && key && (key.isSynthetic||activation.approved)) await evaluateDraft(tx,scan.id);
          else await tx.omrScan.update({where:{id:scan.id},data:{status:'REVIEW_REQUIRED',errorCode:existing?'EXISTING_RESULT':!key?'ANSWER_KEY_REQUIRED':'PHYSICAL_VALIDATION_REQUIRED'}});
        }
      });
    } catch {
      await this.db.omrScan.updateMany({where:{id:scan.id,lockedBy:claim,rawDetection:{equals:Prisma.DbNull}},data:{status:scan.attempts>=3?'FAILED':'QUEUED',lockedAt:null,lockedBy:null,nextAttemptAt:new Date(Date.now()+scan.attempts*10000),errorCode:'WORKER_FAILED'}});
    }
    return true;
  }
  async tick() {
    if(this.busy) return false;
    this.busy=true;
    try {
      // A crashed third/final claim becomes terminal instead of remaining PROCESSING forever.
      const expired=new Date(Date.now()-LEASE_MS);
      await this.db.omrScan.updateMany({where:{status:'PROCESSING',attempts:{gte:3},lockedAt:{lt:expired},rawDetection:{equals:Prisma.DbNull}},data:{status:'FAILED',lockedBy:null,lockedAt:null,errorCode:'WORKER_LEASE_EXHAUSTED'}});
      await this.db.omrScanBatch.updateMany({where:{status:'PROCESSING',attempts:{gte:3},lockedAt:{lt:expired}},data:{status:'FAILED',lockedBy:null,lockedAt:null,errorCode:'WORKER_LEASE_EXHAUSTED'}});
      await this.db.omrScanBatch.updateMany({where:{status:'READY',items:{some:{},every:{scan:{is:{status:{notIn:['QUEUED','PROCESSING']}}}}}},data:{status:'COMPLETE'}});
      const work=await this.scans();
      if(!work) return await this.batches();
      return work;
    } finally { this.busy=false; }
  }
}
export const omrQueue=new OmrQueue();
