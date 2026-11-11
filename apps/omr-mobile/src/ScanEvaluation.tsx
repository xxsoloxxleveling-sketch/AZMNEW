import React,{useEffect,useState} from 'react';
import type {Exam,OmrClient,ScanDetail,Batch,Answer} from '../../../src/features/omr/contracts';
import {parsePracticeKey,scorePracticeScan} from './practice-score';
const flags=new Set<Answer>(['MULTIPLE','UNCERTAIN']);
const choices=new Set<Answer>(['A','B','C','D']);
const textValue=(v:unknown)=>v===undefined||v===null?'—':String(v);
const explanations:Record<string,string>={
 PAGE_CROPPED:'The sheet edge or an OMR registration square is missing. Retake with all four black squares visible and inspect the native crop.',
 PAGE_ALIGNMENT_FAILED:'The four printed alignment squares did not align. Flatten the sheet and capture more of the page boundary.',
 GRID_ALIGNMENT_FAILED:'The answer grid could not be mapped. Retake a sharp original of the whole paper.',
 PRINT_LAYOUT_MISMATCH:'This paper does not match the supported OMR template. Use a compatible printed sheet.',
 WORKER_FAILED:'The isolated recognition worker failed before returning answers. Keep the original and check backend diagnostics.',
 WORKER_LEASE_EXHAUSTED:'The recognition worker exhausted its retry window. Keep the image for investigation.',
 ANSWER_KEY_REQUIRED:'The matching approved answer key is missing, so official marks cannot be calculated.',
 IDENTITY_REVIEW_REQUIRED:'Candidate identity requires verification before backend marks can be produced.'
};
const explain=(code:string|null|undefined)=>code?(explanations[code]||'Scanner returned '+code+'. Inspect the original before retrying.'):null;

export function ScanResultsPanel({scan,exam,role}:{scan:ScanDetail;exam:Exam;role:string}){
 const [flaggedOnly,setFlaggedOnly]=useState(false),[keyEntry,setKeyEntry]=useState(''),[showPractice,setShowPractice]=useState(false);
 const ordered=[...scan.responses].sort((a,b)=>a.question-b.question);
 const unresolved=ordered.filter(row=>flags.has(row.reviewedAnswer||row.detectedAnswer));
 const blanks=ordered.filter(row=>(row.reviewedAnswer||row.detectedAnswer)==='BLANK');
 const readable=ordered.filter(row=>choices.has(row.reviewedAnswer||row.detectedAnswer));
 const admin=role==='ADMIN'||role==='SUPER_ADMIN';
 const backendScore=admin&&scan.results?.find(item=>item.score!==undefined&&item.maximumScore!==undefined);
 const rawKey=parsePracticeKey(keyEntry),practice=admin&&rawKey?scorePracticeScan(scan,exam,rawKey):null;
 const complete=ordered.length===100&&ordered.every((row,i)=>row.question===i+1);
 return <section className="st-answers" aria-label="Detected MCQ answers and marks">
   <div className="st-heading"><div><h2>Detected MCQs &amp; marks</h2><p>Real question-by-question evidence returned by the isolated OMR worker</p></div><span className={'st-eval-status '+(['INVALID','FAILED'].includes(scan.status)?'st-bad':'')}>{scan.status.replaceAll('_',' ')}</span></div>
   <div className="st-facts">
     <div><small>MCQs returned</small><strong>{ordered.length} / 100</strong></div>
     <div><small>A–D readings</small><strong>{readable.length}</strong></div>
     <div><small>Blank</small><strong>{blanks.length}</strong></div>
     <div><small>Uncertain / multiple</small><strong>{unresolved.length}</strong></div>
   </div>
   <div className="st-identity"><span>Paper version: <strong>{scan.paperVersion||'Unresolved'}</strong></span><span>Candidate identity: <strong>{scan.identityVerified?'Verified':'Unverified'}</strong></span></div>
   {explain(scan.errorCode)&&<p className="st-error" role="alert">{explain(scan.errorCode)}</p>}
   {!complete&&<p role="status" className="st-error">The worker returned only {ordered.length} question records out of 100. Missing answers are not guessed. This sheet needs a successful retake or further investigation.</p>}
   {backendScore?<div className="st-backend-marks" role="status"><span>Backend {backendScore.status.toLowerCase()} marks</span><strong>{textValue(backendScore.score)} / {textValue(backendScore.maximumScore)}</strong><small>{backendScore.status==='DRAFT'?'Internal draft only; not approved or published.':'Backend result status: '+backendScore.status+'. This tester does not publish results.'}</small></div>:
   <div className="st-no-marks" role="status"><strong>Backend marks unavailable</strong><small>{role==='TEACHER'?'Internal scores are restricted to authorized administrators.':!scan.identityVerified?'Identity is not verified. An approved matching key is also required for backend grading.':'There is no eligible backend draft score for this scan and paper version.'}</small></div>}
   {!!ordered.length&&<><div className="st-answers-head"><strong>Question-by-question recognition</strong><label><input type="checkbox" checked={flaggedOnly} onChange={e=>setFlaggedOnly(e.target.checked)}/> Only flagged ({unresolved.length})</label></div>
    <div className="st-answers-grid" role="table" aria-label="100 OMR question readings">
     <div className="st-answers-row st-answers-header" role="row"><span>Question</span><span>Detected</span><span>Reading</span><span>Review state</span></div>
     {ordered.filter(row=>!flaggedOnly||flags.has(row.reviewedAnswer||row.detectedAnswer)).map(row=>{
       const effective=row.reviewedAnswer||row.detectedAnswer,flagged=flags.has(effective);
       return <div className={'st-answers-row'+(flagged?' is-flagged':'')} key={row.question} role="row">
         <span>Q{String(row.question).padStart(2,'0')}</span><span>{row.detectedAnswer}</span><strong>{effective}</strong>
         <span>{row.reviewedAnswer?'Human reviewed':flagged?'Needs review':effective==='BLANK'?'Unanswered':'Read'}</span>
       </div>;
     })}
    </div>
    <p className="st-small-note">These are detected bubbles, not an answer key. BLANK, MULTIPLE and UNCERTAIN are distinct evidence states. Corrections require the authorized review workflow.</p>
   </>}
   {admin&&<div className="st-practice">
     <button type="button" className="st-practice-toggle" aria-expanded={showPractice} onClick={()=>setShowPractice(v=>!v)}>Optional local practice marks <span>{showPractice?'Hide':'Show'}</span></button>
     {showPractice&&<><p className="st-small-note">Synthetic test only: paste 100 A–D practice key letters. The key stays in this screen and is not saved or uploaded. Confirm that it matches this paper version; official grading is still locked.</p>
       <label>100-answer practice key <textarea value={keyEntry} rows={3} placeholder="ABCDABCD… (100 letters)" onChange={e=>setKeyEntry(e.target.value)} aria-label="100-question practice key"/></label>
       {keyEntry&&!rawKey&&<p className="st-error" role="status">Enter exactly 100 A, B, C or D letters (spaces and commas are optional).</p>}
       {practice&&<div className="st-backend-marks st-practice-marks" role="status"><span>LOCAL PRACTICE ONLY — NOT OFFICIAL MARKS</span><strong>{practice.rawScore.toFixed(2)} / {practice.maximumScore.toFixed(2)}</strong><small>{practice.correct} correct · {practice.incorrect} incorrect · {practice.blank} blank · {practice.uncertain+practice.multiple+practice.missing} unresolved</small>{practice.provisional&&<small>This is a provisional subtotal. Flagged or missing responses need review before any final mark.</small>}</div>}
     </>}
   </div>}
 </section>;
}
export function ScanEvaluation({client,initialBatch,exam,role}:{client:OmrClient;initialBatch:Batch;exam:Exam;role:string}){
 const [batch,setBatch]=useState(initialBatch),[scan,setScan]=useState<ScanDetail|null>(null);
 const [failure,setFailure]=useState(''),[refresh,setRefresh]=useState(0);
 useEffect(()=>{
   let stopped=false,loading=false,done=false;
   const tick=async()=>{
     if(stopped||loading||done)return;loading=true;
     try{
       const next=await client.batch(initialBatch.id);
       if(stopped)return;setBatch(next);setFailure('');
       const item=next.items?.find(row=>row.scan?.id);
       const scanId=item?.scan?.id;
       if(scanId&&!['QUEUED','PROCESSING'].includes(item?.scan?.status||'')){
         const detail=await client.scan(scanId);
         if(!stopped){setScan(detail);done=true;}
       }else if(['FAILED','CANCELLED','COMPLETE'].includes(next.status)){
         done=true;
         if(!scanId)setFailure('Processing finished without an answer sheet. Check the worker error and retake if necessary.');
       }
     }catch(error){if(!stopped)setFailure(error instanceof Error?error.message:'Could not retrieve recognition results');}
     finally{loading=false;}
   };
   void tick();const timer=setInterval(tick,3000);
   return()=>{stopped=true;clearInterval(timer);};
 },[client,initialBatch.id,refresh]);
 return <section className="st-evaluation" aria-label="OMR recognition results">
   <div className="st-heading"><div><h2>OMR recognition results</h2><p>Batch ID: {initialBatch.id.slice(0,12)}…</p></div><span className={'st-eval-status'+(['FAILED','CANCELLED'].includes(batch.status)?' st-bad':'')}>{batch.status.replaceAll('_',' ')}</span></div>
   {batch.progress&&<p className="st-message">{batch.progress.processed} / {batch.progress.total} pages processed</p>}
   {batch.errorCode&&<p className="st-error" role="alert">{explain(batch.errorCode)}</p>}
   {failure&&<p className="st-error" role="alert">{failure}</p>}
   {!scan&&!failure&&<p role="status" className="st-message">Waiting for the recognition worker to return the 100 question readings. Your saved image is unaffected.</p>}
   {scan&&<ScanResultsPanel key={scan.id} scan={scan} exam={exam} role={role}/>}
   <button className="st-secondary st-refresh-eval" type="button" onClick={()=>{setFailure('');setScan(null);setRefresh(n=>n+1);}}>Refresh recognition results</button>
 </section>;
}
