import express, { Request, Response, NextFunction, RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth.middleware';
import { OmrService, omrService } from './omr.service';
import { OmrQueue, omrQueue } from './queue';
import { OmrActor, omrError, requireExam } from './access';
import { LegacyReleaseService } from './legacy';
import { reasonInput } from './omr.schema';
import { readPrivate, fileType, MAX_UPLOAD } from './storage';
import {IdentityCaptureService} from './identity-capture';
import {createHash} from 'node:crypto';

function actor(req:Request):OmrActor { if(!req.user) throw omrError(401,'Staff authentication required'); return req.user; }
const id=(value:unknown)=>z.string().regex(/^[A-Za-z0-9_-]{1,128}$/).parse(value);
let activeUploads=0;
const uploading=new Set<string>();
export function createOmrRouter(service:OmrService=omrService,queue:OmrQueue=omrQueue,auth:RequestHandler=authenticate) {
  const router=express.Router(); router.use(auth);
  const legacy=new LegacyReleaseService(service);
  const identityCaptures=new IdentityCaptureService(service.db);
  const action=(handler:(req:Request,res:Response)=>Promise<unknown>):RequestHandler=>(req,res,next)=>{Promise.resolve(handler(req,res)).catch(next);};
  const json=(handler:(req:Request)=>Promise<unknown>,status=200)=>action(async(req,res)=>res.status(status).json({success:true,data:await handler(req)}));
  const uploadLimiter=rateLimit({windowMs:60000,limit:30,keyGenerator:req=>actor(req).id,standardHeaders:true,legacyHeaders:false,message:{success:false,error:{message:'Upload limit reached; retry shortly'}}});
  router.get('/legacy',json(req=>legacy.list(actor(req),req.query)));
  router.post('/legacy/review',json(req=>legacy.review(actor(req),req.body),201));
  router.get('/groups',json(req=>service.groups(actor(req))));
  router.get('/exams',json(req=>service.exams(actor(req))));
  router.post('/exams',json(req=>service.createExam(actor(req),req.body),201));
  router.put('/exams/:examId',json(req=>service.updateExam(actor(req),id(req.params.examId),req.body)));
  router.post('/exams/:examId/approve',json(req=>service.approveExam(actor(req),id(req.params.examId))));
  router.put('/exams/:examId/permissions',json(req=>service.permission(actor(req),id(req.params.examId),req.body)));
  router.get('/exams/:examId/keys',json(req=>service.keys(actor(req),id(req.params.examId))));
  router.post('/exams/:examId/keys',json(req=>service.createKey(actor(req),id(req.params.examId),req.body),201));
  router.post('/exams/:examId/keys/:keyId/approve',json(req=>service.approveKey(actor(req),id(req.params.examId),id(req.params.keyId))));
  router.get('/exams/:examId/stats',json(req=>service.stats(actor(req),id(req.params.examId))));
  router.get('/exams/:examId/scans',json(req=>service.scans(actor(req),id(req.params.examId),req.query)));
  router.get('/exams/:examId/results',json(req=>service.results(actor(req),id(req.params.examId),req.query)));
  router.get('/exams/:examId/batches',json(req=>queue.list(actor(req),id(req.params.examId),z.coerce.number().int().min(1).max(100000).default(1).parse(req.query.page))));
  router.post('/exams/:examId/results/approve',json(req=>{
    const body=z.object({resultIds:z.array(z.string().min(1).max(128)).min(1).max(200),reason:z.string().trim().min(8).max(500)}).strict().parse(req.body);
    return service.approveResults(actor(req),id(req.params.examId),[...new Set(body.resultIds)],body.reason);
  }));
  router.post('/exams/:examId/results/:resultId/withdraw',json(req=>service.withdraw(actor(req),id(req.params.examId),id(req.params.resultId),reasonInput.parse(req.body).reason)));
  router.post('/exams/:examId/results/:resultId/reevaluate',json(req=>{
    const body=z.object({sourceScanId:z.string().min(1).max(128).optional(),reason:z.string().trim().min(8).max(500)}).strict().parse(req.body);
    return service.reevaluate(actor(req),id(req.params.examId),id(req.params.resultId),body.sourceScanId,body.reason);
  }));
  const capacity:RequestHandler=(req,res,next)=>{
    const user=actor(req);
    if(activeUploads>=4 || uploading.has(user.id)) return void res.status(429).json({success:false,error:{message:'An upload is already active; retry shortly'}});
    activeUploads++; uploading.add(user.id); let released=false;
    const release=()=>{if(!released){released=true;activeUploads--;uploading.delete(user.id);}};
    res.once('finish',release); res.once('close',release); next();
  };
  const preflight:RequestHandler=(req,res,next)=>{(async()=>{
    await requireExam(service.db,actor(req),id(req.params.examId),'scan');
    const pending=await service.db.omrScanBatch.count({where:{uploadedBy:actor(req).id,status:{in:['QUEUED','PROCESSING','READY']}}});
    if(pending>=50) throw omrError(429,'Finish pending batches before uploading more scans');
  })().then(()=>next(),next);};
  router.post('/exams/:examId/batches',uploadLimiter,preflight,capacity,express.raw({type:['image/png','image/jpeg','application/pdf'],limit:MAX_UPLOAD}),json(req=>{
    if(!Buffer.isBuffer(req.body)) throw omrError(415,'Upload an image or PDF using its actual Content-Type');
    return queue.upload(actor(req),id(req.params.examId),req.body,req.get('Content-Type')||'',String(req.query.source||'web'));
  },202));
  router.get('/batches/:batchId',json(req=>queue.batch(actor(req),id(req.params.batchId))));
  router.get('/scans/:scanId',json(req=>service.scan(actor(req),id(req.params.scanId))));
  router.post('/scans/:scanId/identity-captures',uploadLimiter,
    (req,res,next)=>{identityCaptures.access(actor(req),id(req.params.scanId),req.query.originalSha256).then(()=>next(),next);},
    capacity,express.raw({type:['image/png','image/jpeg'],limit:MAX_UPLOAD}),json(req=>{
      if(!Buffer.isBuffer(req.body))throw omrError(415,'Upload an original JPEG or PNG close-up');
      return identityCaptures.capture(actor(req),id(req.params.scanId),req.query.originalSha256,req.body);
    },201));
  router.post('/scans/:scanId/retry',json(req=>queue.retry(actor(req),id(req.params.scanId))));
  router.patch('/scans/:scanId/review',json(req=>service.review(actor(req),id(req.params.scanId),req.body)));
  router.post('/scans/:scanId/approve',json(req=>service.decide(actor(req),id(req.params.scanId),true,reasonInput.parse(req.body).reason)));
  router.post('/scans/:scanId/reject',json(req=>service.decide(actor(req),id(req.params.scanId),false,reasonInput.parse(req.body).reason)));
  router.post('/exams/:examId/publish',json(req=>{
    const body=z.object({resultIds:z.array(z.string().min(1).max(128)).min(1).max(500),reason:z.string().trim().min(8).max(500)}).strict().parse(req.body);
    return service.publish(actor(req),id(req.params.examId),body.resultIds,body.reason);
  }));
  router.get('/scans/:scanId/image',action(async(req,res)=>{
    const scan=await service.db.omrScan.findUnique({where:{id:id(req.params.scanId)}});
    if(!scan) throw omrError(404,'Scan not found'); await requireExam(service.db,actor(req),scan.examId);
    const kind=z.enum(['original','annotation']).parse(req.query.kind||'original');
    const key=kind==='annotation'?scan.annotationObjectKey:scan.originalObjectKey;
    if(!key) throw omrError(404,'Scan evidence is not available yet');
    const bytes=await readPrivate(key),type=fileType(bytes);
    res.set({'Content-Type':type.mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; default-src 'none'",'Content-Disposition':`inline; filename="omr-scan.${type.extension}"`}).send(bytes);
  }));
  router.get('/scans/:scanId/identity-captures/:captureId/image',action(async(req,res)=>{
    const scan=await service.db.omrScan.findUnique({where:{id:id(req.params.scanId)}});
    if(!scan)throw omrError(404,'Scan not found');await requireExam(service.db,actor(req),scan.examId,'review');
    const receipt=await service.db.omrCorrectionAudit.findFirst({where:{id:id(req.params.captureId),scanId:scan.id}});
    const detail=receipt?.next as Record<string,unknown>|undefined;
    if(detail?.kind!=='IDENTITY_DETAIL_CAPTURE'||typeof detail.objectKey!=='string')throw omrError(404,'Identity detail not found for this scan');
    if(detail.originalSha256!==scan.fileHash||detail.pageIndex!==scan.pageIndex)throw omrError(409,'Identity detail source/page mismatch');
    const bytes=await readPrivate(detail.objectKey),type=fileType(bytes);
    if(type.extension==='pdf'||createHash('sha256').update(bytes).digest('hex')!==detail.detailSha256)throw omrError(409,'Identity detail integrity check failed');
    res.set({'Content-Type':type.mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; default-src 'none'",'Content-Disposition':`inline; filename="omr-identity-detail.${type.extension}"`}).send(bytes);
  }));
  router.use((error:unknown,_req:Request,res:Response,_next:NextFunction)=>{
    const expected=error as {statusCode?:number;code?:string;type?:string};
    const status=error instanceof z.ZodError?400:expected.type==='entity.too.large'?413:expected.code==='P2002'?409:expected.statusCode||500;
    res.status(status).json({success:false,error:{message:status>=500?'OMR operation failed; retry or contact an administrator':error instanceof z.ZodError?'Invalid OMR request':error instanceof Error?error.message:'OMR operation failed'}});
  });
  return router;
}
export default createOmrRouter();
