import { PrismaClient, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { omrError } from '../omr/access';
import { MeritListQuery } from './results.schema';

const published = () => ({status:'PUBLISHED',publishedAt:{not:null},approvedAt:{not:null},
  exam:{status:'APPROVED',publicationStatus:'PUBLISHED',releaseAt:{lte:new Date()}},
  key:{isSynthetic:false,status:'APPROVED'},scan:{status:'VERIFIED',identityVerified:true},
  publications:{some:{action:'PUBLISHED'}}} satisfies Prisma.OmrExamResultWhereInput);
const mask = (value:string) => value.length>6 ? `${value.slice(0,3)}${'*'.repeat(value.length-5)}${value.slice(-2)}` : 'Withheld';

export class ResultsService {
  constructor(private db:PrismaClient=prisma) {}
  async searchCandidateResult(rawQuery:string) {
    const query=rawQuery.trim(),digits=query.replace(/\D/g,'');
    // Exact identifiers only: partial national IDs must never enumerate candidates.
    const students=await this.db.student.findMany({where:{OR:[
      {rollNumber:{equals:query,mode:'insensitive'}},{applicationNo:{equals:query,mode:'insensitive'}},
      ...(digits.length===13 ? [{cnicOrBForm:{in:[digits,`${digits.slice(0,5)}-${digits.slice(5,12)}-${digits.slice(12)}`]}}] : []),
    ]},take:2});
    if(students.length!==1) throw omrError(404,'No uniquely matching published result was found');
    const student=students[0];
    const result=await this.db.omrExamResult.findFirst({where:{studentId:student.id,...published()},include:{exam:true},orderBy:{publishedAt:'desc'}});
    let score:number,maximum:number,rank:number|null,status:string,subjects:unknown[]=[];
    if(result) {
      score=Number(result.score); maximum=Number(result.maximumScore); rank=result.rank; status='RESULT PUBLISHED';
      subjects=Array.isArray(result.subjectScores)?result.subjectScores:[];
    } else {
      const decision=await this.db.omrLegacyPublication.findFirst({where:{studentId:student.id},orderBy:[{createdAt:'desc'},{id:'desc'}]});
      if(!decision) throw omrError(student.testScore===null?404:409,student.testScore===null?'No published result is available':'Historical result requires an authorized release review');
      if(decision.state!=='PUBLISHED' || decision.isSynthetic) throw omrError(404,'No published result is available');
      const snapshot=decision.snapshot as Prisma.JsonObject;
      score=Number(snapshot.score); maximum=Number(snapshot.maximumScore);
      rank=typeof snapshot.rank==='number'?snapshot.rank:null; status='REVIEWED HISTORICAL RESULT';
    }
    if(!Number.isFinite(score)||!Number.isFinite(maximum)||maximum<=0) throw omrError(409,'Published result evidence is incomplete');
    return {rollNo:student.rollNumber||student.applicationNo,candidateName:student.fullName,fatherName:student.fatherName,
      classLevel:student.currentClass,cnicBForm:mask(student.cnicOrBForm),testCenter:null,
      obtainedScore:score,totalMarks:maximum,percentage:Math.round(score/maximum*10000)/100,
      overallRank:rank,percentileRank:null,category:student.scholarshipCategory||'Unassigned',status,isEvaluated:true,
      subjectScores:subjects};
  }
  async getPublicMeritList(filters?:MeritListQuery) {
    // Unranked records remain available through exact lookup. Displayed ranks require actual evidence.
    const rows=await this.db.omrExamResult.findMany({where:{...published(),rank:{not:null},student:{status:'ACTIVE',
      ...(filters?.district && filters.district!=='all'?{district:{equals:filters.district,mode:'insensitive' as const}}:{}),
      ...(filters?.search?{OR:[{fullName:{contains:filters.search,mode:'insensitive' as const}},{rollNumber:{equals:filters.search,mode:'insensitive' as const}}]}:{})}},
      include:{student:true},orderBy:[{publishedAt:'desc'},{rank:'asc'}],take:100});
    const historical=await this.db.$queryRaw<Array<{studentId:string;snapshot:Prisma.JsonObject;rollNumber:string|null;applicationNo:string;fullName:string;fatherName:string;cnicOrBForm:string;currentClass:string;district:string;scholarshipCategory:string}>>(Prisma.sql`
      WITH latest AS (SELECT DISTINCT ON ("studentId") * FROM "OmrLegacyPublication" ORDER BY "studentId","createdAt" DESC,id DESC)
      SELECT l."studentId",l.snapshot,s."rollNumber",s."applicationNo",s."fullName",s."fatherName",s."cnicOrBForm",s."currentClass",s.district,s."scholarshipCategory"
      FROM latest l JOIN "Student" s ON s.id=l."studentId"
      WHERE l.state='PUBLISHED' AND NOT l."isSynthetic" AND s.status='ACTIVE' AND jsonb_typeof(l.snapshot->'rank')='number'
      AND (${filters?.district||'all'}='all' OR lower(s.district)=lower(${filters?.district||'all'}))
      AND (${filters?.search||''}='' OR s."fullName" ILIKE ${'%'+(filters?.search||'')+'%'} OR s."rollNumber"=${filters?.search||''})
      ORDER BY (l.snapshot->>'rank')::numeric,s.id LIMIT 100`);
    const seen=new Set<string>();
    const current=rows.filter(row=>{if(seen.has(row.studentId))return false;seen.add(row.studentId);return true;}).map(row=>({rank:row.rank,
      rollNo:row.student.rollNumber||row.student.applicationNo,candidateName:row.student.fullName,
      fatherNameInitial:row.student.fatherName.slice(0,1),maskedCnic:mask(row.student.cnicOrBForm),classLevel:row.student.currentClass,
      district:row.student.district,testScore:Number(row.score),totalMarks:Number(row.maximumScore),category:row.student.scholarshipCategory,status:'Published result'}));
    const legacy=historical.filter(row=>!seen.has(row.studentId)&&Number.isFinite(Number(row.snapshot.score))&&Number(row.snapshot.maximumScore)>0).map(row=>({rank:Number(row.snapshot.rank),
      rollNo:row.rollNumber||row.applicationNo,candidateName:row.fullName,fatherNameInitial:row.fatherName.slice(0,1),maskedCnic:mask(row.cnicOrBForm),classLevel:row.currentClass,
      district:row.district,testScore:Number(row.snapshot.score),totalMarks:Number(row.snapshot.maximumScore),category:row.scholarshipCategory,status:'Reviewed historical result'}));
    return [...current,...legacy].sort((a,b)=>(a.rank||Infinity)-(b.rank||Infinity)).slice(0,100);
  }
}
export const resultsService=new ResultsService();
