import React,{useEffect,useState} from 'react';
import {OmrClient,Page} from '../../../features/omr/contracts';
interface Historical {id:string;fullName:string;rollNumber:string|null;applicationNo:string;testScore:number;overallRank:number|null;resultSessionId:string|null;omrLegacyReviews:Array<{state:string;reason:string;evidenceReference:string}>}
export function LegacyReleaseReview({client,run}:{client:OmrClient;run:(operation:()=>Promise<unknown>,message:string)=>Promise<void>}) {
  const [rows,setRows]=useState<Page<Historical>|null>(null),[page,setPage]=useState(1),[search,setSearch]=useState(''),[error,setError]=useState('');
  const [selected,setSelected]=useState<Historical|null>(null),[maximum,setMaximum]=useState(''),[evidence,setEvidence]=useState(''),[reason,setReason]=useState(''),[state,setState]=useState('WITHHELD'),[synthetic,setSynthetic]=useState(true),[confirmed,setConfirmed]=useState(false);
  async function load(){setRows(await client.request<Page<Historical>>(`/api/omr/legacy?${new URLSearchParams({page:String(page),search})}`));}
  useEffect(()=>{let cancelled=false;client.request<Page<Historical>>(`/api/omr/legacy?${new URLSearchParams({page:String(page),search})}`).then(value=>{if(!cancelled)setRows(value);},problem=>{if(!cancelled)setError(problem.message);});return()=>{cancelled=true;};},[client,page,search]);
  return <details className="omr-section"><summary className="font-semibold cursor-pointer">Historical result release review</summary>
    <p className="text-sm my-3">Existing scores require evidence of their authorized release. Each decision retains a snapshot and leaves the student record unchanged. Unknown release status is never inferred from a score.</p>
    {error&&<p role="alert" className="omr-error omr-notice">{error}</p>}
    <label className="omr-field">Exact roll or application number<input value={search} onChange={event=>{setPage(1);setSearch(event.target.value);}}/></label>
    <div className="omr-table-scroll mt-3"><table className="omr-table"><thead><tr><th>Candidate</th><th>Stored score</th><th>Latest decision</th><th>Review</th></tr></thead><tbody>{rows?.items.map(row=><tr key={row.id}><td>{row.fullName}<span className="block text-xs">{row.rollNumber||row.applicationNo}</span></td><td>{row.testScore}</td><td>{row.omrLegacyReviews[0]?.state||'Unreviewed'}</td><td><button className="omr-button" onClick={()=>{setSelected(row);setMaximum('');setEvidence('');setReason('');setConfirmed(false);}}>Review release evidence</button></td></tr>)}</tbody></table></div>
    {rows&&!rows.total&&<p className="text-sm py-3">No historical scores match this search.</p>}
    <div className="flex gap-3 my-3"><button className="omr-button" disabled={page===1} onClick={()=>setPage(page-1)}>Previous</button><span>Page {page}</span><button className="omr-button" disabled={!rows||page*25>=rows.total} onClick={()=>setPage(page+1)}>Next</button></div>
    {selected&&<fieldset className="space-y-3 border-t pt-3"><legend className="font-semibold">{selected.fullName}</legend>
      <label className="omr-field">Maximum marks from the original examination record<input type="number" min="0.0001" step="any" value={maximum} onChange={event=>setMaximum(event.target.value)}/></label>
      <label className="omr-field">Release decision<select value={state} onChange={event=>setState(event.target.value)}><option>WITHHELD</option><option>PUBLISHED</option></select></label>
      <label className="omr-field">Evidence reference<input maxLength={500} value={evidence} onChange={event=>setEvidence(event.target.value)}/></label>
      <label className="omr-field">Reason<textarea maxLength={500} value={reason} onChange={event=>setReason(event.target.value)}/></label>
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={synthetic} onChange={event=>setSynthetic(event.target.checked)}/>Synthetic development record</label>
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={event=>setConfirmed(event.target.checked)}/>I verified the original score, maximum marks and release authority.</label>
      <button className="omr-primary" disabled={!confirmed||!Number.isFinite(Number(maximum))||Number(maximum)<=0||evidence.trim().length<8||reason.trim().length<8||(state==='PUBLISHED'&&synthetic)} onClick={()=>run(async()=>{await client.request('/api/omr/legacy/review',{method:'POST',body:JSON.stringify({studentId:selected.id,maximumScore:Number(maximum),state,isSynthetic:synthetic,evidenceReference:evidence,reason})});setSelected(null);await load();},'Historical release decision recorded')}>Record audited decision</button>
    </fieldset>}
  </details>;
}
