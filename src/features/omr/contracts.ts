export type Option='A'|'B'|'C'|'D';
export type Answer=Option|'BLANK'|'MULTIPLE'|'UNCERTAIN';
export interface Exam { id:string;code:string;title:string;session:string;candidateGroup:string;examDate:string;questionCount:number;correctMarks:number|string;incorrectPenalty:number|string;minimumScore:number|string|null;allowedVersions:Option[];status:string;publicationStatus:string;releaseAt:string|null;permissions?:Array<{canScan:boolean;canReview:boolean;canManage:boolean}> }
export interface KeyRevision {id:string;paperVersion:Option;revision:number;answers:Option[];status:string;isSynthetic:boolean}
export interface Candidate {id:string;fullName:string;applicationNo:string;rollNumber:string|null}
export interface Scan {id:string;status:string;paperVersion:Option|null;identityVerified:boolean;errorCode:string|null;createdAt:string;student:Candidate|null}
export interface ResponseRow {question:number;detectedAnswer:Answer;reviewedAnswer:Answer|null;evidence:{darkness?:number[];reviewRequired?:boolean}}
export interface Correction {id:string;question:number|null;reason:string;createdAt:string;previous:unknown;next:unknown}
export interface ScanDetail extends Scan {responses:ResponseRow[];corrections:Correction[];hasAnnotation:boolean;quality:{focus:number;registration:number}|null;results:Array<{id:string;status:string;score?:string;maximumScore?:string}>}
export interface Result {id:string;sourceScanId:string;status:string;score:string|number;maximumScore:string|number;student:{fullName:string;rollNumber:string|null;applicationNo:string};publications:Array<{id:string;action:string;reason:string;createdAt:string}>}
export interface Page<T> {items:T[];total:number;page:number;pageSize:number}
export interface Stats {scans:Array<{status:string;_count:number}>;results:Array<{status:string;_count:number}>;batches:number;officialRecognitionEnabled:boolean;offlineCaptureEnabled:boolean}
export interface Batch {id:string;status:string;source?:string;errorCode?:string|null;createdAt:string;progress?:{processed:number;total:number;duplicates:number};items?:Array<{id:string;pageIndex:number;status:string;scan:{id:string;status:string;errorCode:string|null}|null}>;_count?:{items:number}}
export interface Review {examConfirmed?:true;reason:string;answers?:Array<{question:number;answer:Answer}>;paperVersion?:Option;identityLookup?:string;printedRollNumber?:string;identityConfirmed?:true}
export type Transport=<T>(path:string,options?:RequestInit)=>Promise<T>;
export class OmrClient {
  constructor(readonly request:Transport,readonly image:(scanId:string,kind:'original'|'annotation')=>Promise<Blob>) {}
  exams=()=>this.request<Exam[]>('/api/omr/exams');
  groups=()=>this.request<Array<{group:string;count:number}>>('/api/omr/groups');
  createExam=(body:unknown)=>this.request<Exam>('/api/omr/exams',{method:'POST',body:JSON.stringify(body)});
  updateExam=(id:string,body:unknown)=>this.request<Exam>(`/api/omr/exams/${encodeURIComponent(id)}`,{method:'PUT',body:JSON.stringify(body)});
  approveExam=(id:string)=>this.request(`/api/omr/exams/${encodeURIComponent(id)}/approve`,{method:'POST'});
  permission=(id:string,body:unknown)=>this.request(`/api/omr/exams/${encodeURIComponent(id)}/permissions`,{method:'PUT',body:JSON.stringify(body)});
  stats=(id:string)=>this.request<Stats>(`/api/omr/exams/${encodeURIComponent(id)}/stats`);
  keys=(id:string)=>this.request<KeyRevision[]>(`/api/omr/exams/${encodeURIComponent(id)}/keys`);
  createKey=(id:string,body:unknown)=>this.request<KeyRevision>(`/api/omr/exams/${encodeURIComponent(id)}/keys`,{method:'POST',body:JSON.stringify(body)});
  approveKey=(id:string,key:string)=>this.request(`/api/omr/exams/${encodeURIComponent(id)}/keys/${encodeURIComponent(key)}/approve`,{method:'POST'});
  upload=(id:string,file:File,source='web')=>this.request<Batch>(`/api/omr/exams/${encodeURIComponent(id)}/batches?source=${source==='mobile'?'mobile':'web'}`,{method:'POST',headers:{'Content-Type':file.type},body:file});
  batches=(id:string,page=1)=>this.request<Page<Batch>>(`/api/omr/exams/${encodeURIComponent(id)}/batches?page=${page}`);
  batch=(id:string)=>this.request<Batch>(`/api/omr/batches/${encodeURIComponent(id)}`);
  scans=(id:string,page=1,status='',search='')=>this.request<Page<Scan>>(`/api/omr/exams/${encodeURIComponent(id)}/scans?${new URLSearchParams({page:String(page),...(status?{status}:{}),...(search?{search}:{})})}`);
  scan=(id:string)=>this.request<ScanDetail>(`/api/omr/scans/${encodeURIComponent(id)}`);
  review=(id:string,body:Review)=>this.request(`/api/omr/scans/${encodeURIComponent(id)}/review`,{method:'PATCH',body:JSON.stringify(body)});
  decide=(id:string,approve:boolean,reason:string)=>this.request(`/api/omr/scans/${encodeURIComponent(id)}/${approve?'approve':'reject'}`,{method:'POST',body:JSON.stringify({reason})});
  retry=(id:string)=>this.request(`/api/omr/scans/${encodeURIComponent(id)}/retry`,{method:'POST'});
  results=(id:string,page=1,status='')=>this.request<Page<Result>>(`/api/omr/exams/${encodeURIComponent(id)}/results?${new URLSearchParams({page:String(page),...(status?{status}:{})})}`);
  approveResults=(id:string,resultIds:string[],reason:string)=>this.request<{approved:string[];failed:Array<{id:string;reason:string}>}>(`/api/omr/exams/${encodeURIComponent(id)}/results/approve`,{method:'POST',body:JSON.stringify({resultIds,reason})});
  publish=(id:string,resultIds:string[],reason:string)=>this.request<{published:number}>(`/api/omr/exams/${encodeURIComponent(id)}/publish`,{method:'POST',body:JSON.stringify({resultIds,reason})});
  withdraw=(exam:string,id:string,reason:string)=>this.request(`/api/omr/exams/${encodeURIComponent(exam)}/results/${encodeURIComponent(id)}/withdraw`,{method:'POST',body:JSON.stringify({reason})});
  reevaluate=(exam:string,id:string,reason:string,sourceScanId?:string)=>this.request(`/api/omr/exams/${encodeURIComponent(exam)}/results/${encodeURIComponent(id)}/reevaluate`,{method:'POST',body:JSON.stringify({reason,sourceScanId})});
}

