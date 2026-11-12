import {createHash} from 'node:crypto';
import {PrismaClient} from '@prisma/client';
import {z} from 'zod';
import {OmrActor,omrError,requireExam} from './access';
import {decodeIdentity,reconcileIdentity,manualQrAgrees} from './identity';
import {runIdentityDetail} from './runner';
import {fileType,storePrivate} from './storage';
import {serial,lockScan,jsonValue} from './omr.service';
let activeAnalyses=0;
const analyzingActors=new Set<string>();

/** Supplemental evidence is bound to a scan/page. It never verifies identity or grades. */
export class IdentityCaptureService {
  constructor(readonly db:PrismaClient,readonly analyze:typeof runIdentityDetail=runIdentityDetail){}
  async access(actor:OmrActor,id:string,sourceHash:unknown){
    const expected=z.string().regex(/^[a-f0-9]{64}$/).parse(sourceHash);
    const scan=await this.db.omrScan.findUnique({where:{id}});
    if(!scan)throw omrError(404,'Scan not found');
    const exam=await requireExam(this.db,actor,scan.examId,'review');
    if(scan.fileHash!==expected)throw omrError(409,'The close-up does not refer to the selected original scan');
    if(!['RECOGNIZED','REVIEW_REQUIRED'].includes(scan.status))throw omrError(409,'Retake the full sheet; this scan is not open for identity review');
    return {scan,exam};
  }
  async capture(actor:OmrActor,id:string,sourceHash:unknown,bytes:Buffer){
    const {scan,exam}=await this.access(actor,id,sourceHash);
    if(fileType(bytes).extension==='pdf')throw omrError(415,'Use an original JPEG or PNG close-up');
    const count=await this.db.omrCorrectionAudit.count({where:{scanId:id,next:{path:['kind'],equals:'IDENTITY_DETAIL_CAPTURE'}}});
    if(count>=5)throw omrError(429,'Five close-ups are already retained for this scan; review the originals before uploading more');
    // Keep the slot until decoding actually ends, even if the HTTP client disconnects.
    if(activeAnalyses>=2||analyzingActors.has(actor.id))throw omrError(429,'An identity close-up is already being read; retry shortly');
    activeAnalyses++;analyzingActors.add(actor.id);
    let detail:Awaited<ReturnType<typeof runIdentityDetail>>;
    try{detail=await this.analyze(bytes).catch(()=>({qrDecoded:false,qrPayload:null,printedRollNumber:null,rollStatus:'DETAIL_PROCESSING_FAILED',width:0,height:0}));}
    finally{activeAnalyses--;analyzingActors.delete(actor.id);}
    const qr=decodeIdentity(detail.qrPayload);
    const student=qr?await this.db.student.findUnique({where:{id:qr.studentId}}):null;
    const rosterMatched=!!(qr&&reconcileIdentity(detail.qrPayload,student,exam));
    const raw=scan.rawDetection as Record<string,unknown>|null;
    const originalRoll=typeof raw?.printedRollNumber==='string'?raw.printedRollNumber:null;
    const originalMatched=!!(rosterMatched&&student&&manualQrAgrees(raw,student,exam)&&
      (originalRoll===student.rollNumber||(scan.identityVerified&&scan.studentId===student.id)));
    const detailConflict=!!(detail.printedRollNumber&&((qr&&qr.rollNumber!==detail.printedRollNumber)||(originalRoll&&originalRoll!==detail.printedRollNumber)));
    const status=detail.rollStatus==='DETAIL_PROCESSING_FAILED'?'DETAIL_PROCESSING_FAILED':detailConflict?'CONFLICTING_DETAIL':detail.qrDecoded&&!qr?'UNSUPPORTED_QR':qr&&!rosterMatched?'ROSTER_MISMATCH':
      rosterMatched&&!originalMatched?'ORIGINAL_CONFIRMATION_REQUIRED':originalMatched?'MATCHED_ORIGINAL_UNVERIFIED':
      !detail.qrDecoded&&!detail.printedRollNumber?'DETAIL_UNREADABLE':'DETAIL_REVIEW_REQUIRED';
    const canPrefill=status==='MATCHED_ORIGINAL_UNVERIFIED';
    const rollCandidate=detailConflict?null:detail.printedRollNumber||(canPrefill?student!.rollNumber:null);
    const key=await storePrivate(bytes),hash=createHash('sha256').update(bytes).digest('hex');
    const audit=await serial(this.db,async tx=>{
      const locked=await lockScan(tx,id);await requireExam(tx as unknown as PrismaClient,actor,locked.examId,'review');
      if(locked.fileHash!==scan.fileHash||locked.studentId!==scan.studentId||locked.identityVerified!==scan.identityVerified||!['RECOGNIZED','REVIEW_REQUIRED'].includes(locked.status))throw omrError(409,'The original scan changed or closed during the upload');
      if(await tx.omrCorrectionAudit.count({where:{scanId:id,next:{path:['kind'],equals:'IDENTITY_DETAIL_CAPTURE'}}})>=5)throw omrError(429,'Close-up limit reached');
      return tx.omrCorrectionAudit.create({data:{scanId:id,actorId:actor.id,previous:jsonValue({originalSha256:scan.fileHash,pageIndex:scan.pageIndex}),next:jsonValue({kind:'IDENTITY_DETAIL_CAPTURE',originalSha256:scan.fileHash,pageIndex:scan.pageIndex,detailSha256:hash,objectKey:key,status,qrDecoded:detail.qrDecoded,rosterMatched,originalMatched,rollCandidate,width:detail.width,height:detail.height,identityVerified:false}),reason:'Supplemental identity evidence retained; original-sheet confirmation remains required'}});
    });
    return {id:audit.id,status,qrDecoded:detail.qrDecoded,rosterMatched,originalMatched,rollCandidate,canPrefill,identityVerified:false as const};
  }
}
