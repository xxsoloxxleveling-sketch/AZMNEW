import React,{useEffect,useState} from 'react';
import { Exam,OmrClient } from '../../../features/omr/contracts';
type Run=(operation:()=>Promise<unknown>,message:string)=>Promise<void>;
const local=(value:string)=>{const date=new Date(value);return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);};
export function ExamManager({client,exam,groups,superAdmin,run}:{client:OmrClient;exam:Exam|null;groups:Array<{group:string;count:number}>;superAdmin:boolean;run:Run}) {
  const [editing,setEditing]=useState(false),[form,setForm]=useState({code:'',title:'',session:'2026-V',candidateGroup:'',examDate:'',correctMarks:'1',incorrectPenalty:'0',minimumScore:'',releaseAt:'',versions:'ABCD'});
  useEffect(()=>{if(!superAdmin&&exam)setEditing(true);},[superAdmin,exam?.id]);
  const [userId,setUserId]=useState(''),[scan,setScan]=useState(true),[review,setReview]=useState(false),[manage,setManage]=useState(false);
  useEffect(()=>{if(editing&&exam)setForm({code:exam.code,title:exam.title,session:exam.session,candidateGroup:exam.candidateGroup,examDate:local(exam.examDate).slice(0,10),correctMarks:String(exam.correctMarks),incorrectPenalty:String(exam.incorrectPenalty),minimumScore:exam.minimumScore===null?'':String(exam.minimumScore),releaseAt:exam.releaseAt?local(exam.releaseAt):'',versions:exam.allowedVersions.join('')});},[exam,editing]);
  function submit(event:React.FormEvent) {
    event.preventDefault();
    void run(()=>{
      const payload={code:form.code,title:form.title,session:form.session,candidateGroup:form.candidateGroup,examDate:new Date(form.examDate+'T00:00:00').toISOString(),questionCount:100,correctMarks:Number(form.correctMarks),incorrectPenalty:Number(form.incorrectPenalty),minimumScore:form.minimumScore===''?null:Number(form.minimumScore),allowedVersions:form.versions.toUpperCase().split(''),releaseAt:form.releaseAt?new Date(form.releaseAt).toISOString():null};
      return editing&&exam?client.updateExam(exam.id,payload):client.createExam(payload);
    },editing?'Examination draft updated':'Examination draft created');
  }
  return <div className="space-y-5">
    {superAdmin&&<label className="flex gap-2 text-sm"><input type="checkbox" checked={editing} onChange={event=>setEditing(event.target.checked)}/>Edit the selected draft instead of creating a new examination</label>}
    {(superAdmin||editing)&&<form onSubmit={submit} className="space-y-4"><div className="omr-grid">
      <label className="omr-field">Examination code<input required maxLength={64} value={form.code} onChange={event=>setForm({...form,code:event.target.value})}/></label>
      <label className="omr-field">Examination title<input required maxLength={160} value={form.title} onChange={event=>setForm({...form,title:event.target.value})}/></label>
      <label className="omr-field">Session<input required value={form.session} onChange={event=>setForm({...form,session:event.target.value})}/></label>
      <label className="omr-field">Candidate group<select required value={form.candidateGroup} onChange={event=>setForm({...form,candidateGroup:event.target.value})}><option value="">Select an existing group</option>{[...new Set([...groups.map(row=>row.group),...(exam?[exam.candidateGroup]:[])])].map(group=><option key={group}>{group}</option>)}</select></label>
      <label className="omr-field">Examination date<input required type="date" value={form.examDate} onChange={event=>setForm({...form,examDate:event.target.value})}/></label>
      <label className="omr-field">Earliest result release<input type="datetime-local" value={form.releaseAt} onChange={event=>setForm({...form,releaseAt:event.target.value})}/></label>
      <label className="omr-field">Marks per correct answer<input required type="number" min="0.0001" max="1000" step="0.0001" value={form.correctMarks} onChange={event=>setForm({...form,correctMarks:event.target.value})}/></label>
      <label className="omr-field">Penalty per incorrect answer<input required type="number" min="0" max="1000" step="0.0001" value={form.incorrectPenalty} onChange={event=>setForm({...form,incorrectPenalty:event.target.value})}/></label>
      <label className="omr-field">Minimum score, if prescribed<input type="number" step="0.0001" value={form.minimumScore} onChange={event=>setForm({...form,minimumScore:event.target.value})} placeholder="No floor unless configured"/></label>
      <label className="omr-field">Permitted paper versions<input required pattern="[ABCDabcd]{1,4}" value={form.versions} onChange={event=>setForm({...form,versions:event.target.value})}/></label>
    </div><p className="text-sm">Template 2.0 supports 100 questions. Leave the penalty at zero unless negative marking is approved.</p><button className="omr-primary" disabled={editing&&exam?.status!=='DRAFT'}>Save draft configuration</button></form>}
    {!superAdmin&&<button className="omr-button" onClick={()=>setEditing(true)}>Edit selected draft</button>}
    {exam&&<section className="omr-section"><h3 className="omr-heading">Saved configuration</h3><p className="text-sm mb-3">{exam.code} · {exam.candidateGroup} · {exam.questionCount} questions · {exam.allowedVersions.join(', ')} · {exam.status}</p><button className="omr-button" disabled={exam.status!=='DRAFT'} onClick={()=>run(()=>client.approveExam(exam.id),'Examination configuration approved and locked')}>Approve saved configuration</button></section>}
    {superAdmin&&exam&&<form className="omr-section space-y-3" onSubmit={event=>{event.preventDefault();void run(()=>client.permission(exam.id,{userId,canScan:scan,canReview:review,canManage:manage}),'Operator permissions saved');}}><h3 className="omr-heading">Examination operators</h3><label className="omr-field">Existing staff user ID<input required value={userId} onChange={event=>setUserId(event.target.value)}/></label><div className="flex flex-wrap gap-4 text-sm"><label><input type="checkbox" checked={scan} onChange={event=>setScan(event.target.checked)}/> Scan</label><label><input type="checkbox" checked={review} onChange={event=>setReview(event.target.checked)}/> Review</label><label><input type="checkbox" checked={manage} onChange={event=>setManage(event.target.checked)}/> Manage examination and keys (Admin only)</label></div><button className="omr-button">Save operator permissions</button></form>}
  </div>;
}
