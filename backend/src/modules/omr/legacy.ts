import { z } from 'zod';
import { OmrService, jsonValue, serial } from './omr.service';
import { OmrActor, requireSuper, omrError } from './access';
const decisionInput=z.object({studentId:z.string().min(1).max(128),state:z.enum(['PUBLISHED','WITHHELD']),
  maximumScore:z.number().positive().max(100000),isSynthetic:z.boolean().default(true),
  evidenceReference:z.string().trim().min(8).max(500),reason:z.string().trim().min(8).max(500)}).strict();
export class LegacyReleaseService {
  constructor(private service:OmrService) {}
  async list(actor:OmrActor,query:unknown) {
    requireSuper(actor);
    const input=z.object({page:z.coerce.number().int().min(1).max(100000).default(1),search:z.string().trim().max(128).default('')}).parse(query);
    const where={testScore:{not:null},...(input.search?{OR:[{rollNumber:input.search},{applicationNo:input.search}]}:{})};
    const [total,items]=await this.service.db.$transaction(async tx=>Promise.all([tx.student.count({where}),tx.student.findMany({where,
      select:{id:true,fullName:true,rollNumber:true,applicationNo:true,testScore:true,overallRank:true,resultSessionId:true,
        omrLegacyReviews:{orderBy:[{createdAt:'desc'},{id:'desc'}],take:1}},skip:(input.page-1)*25,take:25,orderBy:{id:'asc'}})]));
    return {total,items,page:input.page,pageSize:25};
  }
  async review(actor:OmrActor,body:unknown) {
    requireSuper(actor); const input=decisionInput.parse(body);
    if(input.state==='PUBLISHED'&&(input.isSynthetic||process.env.OMR_SYNTHETIC_ENVIRONMENT==='1')) throw omrError(409,'Synthetic historical records cannot be released');
    return serial(this.service.db,async tx=>{
      await tx.$queryRaw`SELECT id FROM "Student" WHERE id=${input.studentId} FOR UPDATE`;
      const student=await tx.student.findUnique({where:{id:input.studentId}});
      if(!student||student.testScore===null) throw omrError(409,'An existing historical score is required');
      if(student.testScore>input.maximumScore) throw omrError(400,'Maximum score is below the recorded historical score');
      return tx.omrLegacyPublication.create({data:{studentId:student.id,actorId:actor.id,state:input.state,isSynthetic:input.isSynthetic,
        evidenceReference:input.evidenceReference,reason:input.reason,snapshot:jsonValue({score:student.testScore,maximumScore:input.maximumScore,
          rank:student.overallRank,sessionId:student.resultSessionId})}});
    });
  }
}
