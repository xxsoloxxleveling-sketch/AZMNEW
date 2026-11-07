import React,{useCallback,useEffect,useRef,useState} from 'react';
import { apiFetch,API_BASE_URL } from '../../../lib/apiClient';
import { getToken } from '../../../lib/auth';
import { useAuth } from '../../../lib/authContext';
import { DataTable } from '../shared/DataTable';
import { OmrClient,Exam,Stats,Scan,Page,KeyRevision,Result,Batch } from '../../../features/omr/contracts';
import { UploadPanel } from '../../../features/omr/UploadPanel';
import { ScanReview } from './ScanReview';
import { ExamManager } from './ExamManager';
import { LegacyReleaseReview } from './LegacyReleaseReview';
import { AnswerKeyManager } from './AnswerKeyManager';
import '../../../features/omr/omr.css';

const client=new OmrClient((url,options)=>apiFetch(url,options),async(id,kind)=>{
  const request=()=>fetch(`${API_BASE_URL}/api/omr/scans/${encodeURIComponent(id)}/image?kind=${kind}`,{headers:{Authorization:`Bearer ${getToken()||''}`},cache:'no-store'});
  let response=await request();if(response.status===401){await apiFetch('/api/auth/me');response=await request();}
  if(!response.ok)throw new Error(response.status===401?'Session expired; sign in again':'Private scan evidence is not available yet');
  return response.blob();
});
const empty=<T,>():Page<T>=>({items:[],total:0,page:1,pageSize:25});
const labels={dashboard:'Dashboard',exams:'Examinations',keys:'Answer keys',single:'Single scan',bulk:'Bulk upload',queue:'Processing queue',review:'Manual review',results:'Verified results',publication:'Publication',history:'Scan history'};
type Screen=keyof typeof labels;
function downloadReport(batch:Batch) {
  const lines=['Page,Scan,Status,Error',...(batch.items||[]).map(item=>[item.pageIndex,item.scan?.id||'',item.status==='DUPLICATE'?'DUPLICATE':item.scan?.status||item.status,item.scan?.errorCode||''].join(','))];
  const url=URL.createObjectURL(new Blob([lines.join('\r\n')],{type:'text/csv;charset=utf-8'}));
  const anchor=document.createElement('a');anchor.href=url;anchor.download=`omr-batch-${batch.id}.csv`;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function OmrEvaluationCenter() {
  const {role}=useAuth();const superAdmin=role==='SUPER_ADMIN';
  const [exams,setExams]=useState<Exam[]>([]),[examId,setExamId]=useState(''),[screen,setScreen]=useState<Screen>('dashboard');
  const [groups,setGroups]=useState<Array<{group:string;count:number}>>([]),[stats,setStats]=useState<Stats|null>(null),[keys,setKeys]=useState<KeyRevision[]>([]);
  const [scans,setScans]=useState(empty<Scan>),[results,setResults]=useState(empty<Result>),[batches,setBatches]=useState(empty<Batch>),[batch,setBatch]=useState<Batch|null>(null);
  const [page,setPage]=useState(1),[filter,setFilter]=useState(''),[search,setSearch]=useState(''),[scanId,setScanId]=useState(''),[reason,setReason]=useState(''),[selected,setSelected]=useState<string[]>([]),[releaseConfirmed,setReleaseConfirmed]=useState(false);
  const [replacement,setReplacement]=useState<Record<string,string>>({});
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const errorRef=useRef<HTMLDivElement>(null);
  const context=useRef(''); context.current=`${examId}:${screen}:${page}:${filter}:${search}`;
  const exam=exams.find(value=>value.id===examId)||null,permission=exam?.permissions?.[0];
  const canManage=superAdmin||(role==='ADMIN'&&!!permission?.canManage),canScan=superAdmin||!!permission?.canScan,canReview=superAdmin||!!permission?.canReview,canResults=role!=='TEACHER'&&canReview;
  const loadExams=useCallback(async()=>{
    const rows=await client.exams();setExams(rows);setExamId(previous=>rows.some(row=>row.id===previous)?previous:rows[0]?.id||'');
  },[]);
  useEffect(()=>{let cancelled=false;setLoading(true);loadExams().catch(problem=>{if(!cancelled)setError(problem.message);}).finally(()=>{if(!cancelled)setLoading(false);});if(superAdmin)client.groups().then(value=>{if(!cancelled)setGroups(value);},problem=>{if(!cancelled)setError(problem.message);});return()=>{cancelled=true;};},[loadExams,superAdmin]);
  useEffect(()=>{if(error)errorRef.current?.focus();},[error]);
  useEffect(()=>{setPage(1);setFilter('');setSearch('');setSelected([]);setBatch(null);setScanId('');setStats(null);},[examId,screen]);
  const reload=useCallback(async()=>{
    if(!examId)return;
    const ticket=context.current;
    const nextStats=await client.stats(examId);if(ticket!==context.current)return;setStats(nextStats);
    if(screen==='keys'){const next=await client.keys(examId);if(ticket===context.current)setKeys(next);}
    if(['review','history'].includes(screen)){const next=await client.scans(examId,page,screen==='review'?'REVIEW_REQUIRED':filter,search);if(ticket===context.current)setScans(next);}
    if(['results','publication'].includes(screen)){const next=await client.results(examId,page,screen==='publication'?'VERIFIED':filter);if(ticket===context.current)setResults(next);}
    if(screen==='queue'){const next=await client.batches(examId,page);if(ticket===context.current)setBatches(next);}
  },[examId,screen,page,filter,search]);
  useEffect(()=>{let cancelled=false;setLoading(true);reload().catch(problem=>{if(!cancelled)setError(problem.message);}).finally(()=>{if(!cancelled)setLoading(false);});const timer=['queue','dashboard','history'].includes(screen)?setInterval(()=>{void reload().catch(problem=>{if(!cancelled)setError(problem.message);});},5000):undefined;return()=>{cancelled=true;if(timer)clearInterval(timer);};},[reload,screen]);
  useEffect(()=>{if(!batch||screen!=='queue')return;let cancelled=false;const timer=setInterval(()=>{client.batch(batch.id).then(value=>{if(!cancelled)setBatch(value);},()=>{});},3000);return()=>{cancelled=true;clearInterval(timer);};},[batch?.id,screen]);
  async function run(operation:()=>Promise<unknown>,message:string) {
    if(busy)return;setBusy(true);setError('');setNotice('');
    try{await operation();setNotice(message);await loadExams();await reload();}catch(problem){setError(problem instanceof Error?problem.message:'OMR operation failed');await reload().catch(()=>{});}finally{setBusy(false);}
  }
  const allowed=(Object.keys(labels) as Screen[]).filter(key=>!['keys','exams'].includes(key)||canManage||superAdmin).filter(key=>!['single','bulk'].includes(key)||canScan).filter(key=>key!=='review'||canReview).filter(key=>!['results','publication'].includes(key)||canResults);
  const scanPagination={page,total:scans.total,totalPages:Math.max(1,Math.ceil(scans.total/25)),onPageChange:setPage};
  const total=stats?.scans.reduce((count,item)=>count+item._count,0)||0;
  return <main className="omr-workspace space-y-4 min-w-0" aria-label="OMR Evaluation Center">
    <div className="flex flex-wrap gap-3 items-end justify-between"><label className="omr-field flex-1 max-w-xl">Selected examination<select aria-label="Selected examination" value={examId} disabled={busy} onChange={event=>setExamId(event.target.value)}><option value="">{loading?'Loading examinations…':'Select examination'}</option>{exams.map(item=><option key={item.id} value={item.id}>{item.title} · {item.candidateGroup}</option>)}</select></label><button className="omr-button" disabled={busy} onClick={()=>run(async()=>{await loadExams();},'Examination list refreshed')}>Refresh</button></div>
    <nav className="omr-tabs" aria-label="OMR work areas">{allowed.map(key=><button key={key} aria-current={screen===key?'page':undefined} disabled={busy} onClick={()=>{setError('');setNotice('');setScreen(key);}}>{labels[key]}</button>)}</nav>
    {error&&<div ref={errorRef} tabIndex={-1} role="alert" className="omr-notice omr-error">{error}</div>}
    {notice&&<p role="status" className="omr-notice">{notice}</p>}
    {exam&&!stats?.officialRecognitionEnabled&&<p className="omr-notice">Official marking and publication remain locked pending physical scan validation. Synthetic examinations can be processed and reviewed internally.</p>}
    {loading&&<p role="status" className="text-sm">Loading {labels[screen].toLowerCase()}…</p>}
    {!exam&&screen!=='exams'&&!loading&&<p className="py-6 text-sm">{superAdmin?'Create an examination to configure keys and begin scanning.':'No examination is assigned to this account. Ask an administrator to grant access.'}</p>}
    {screen==='exams'&&(superAdmin||canManage)&&<ExamManager client={client} exam={exam} groups={groups} superAdmin={superAdmin} run={run}/>}
    {exam&&screen==='dashboard'&&stats&&<section><h2 className="omr-heading">Examination activity</h2><dl className="omr-metrics"><div><dt>Sheets uploaded</dt><dd>{total}</dd></div><div><dt>Review required</dt><dd>{stats.scans.find(row=>row.status==='REVIEW_REQUIRED')?._count||0}</dd></div><div><dt>Verified results</dt><dd>{stats.results.find(row=>row.status==='VERIFIED')?._count||0}</dd></div><div><dt>Published results</dt><dd>{stats.results.find(row=>row.status==='PUBLISHED')?._count||0}</dd></div><div><dt>Upload batches</dt><dd>{stats.batches}</dd></div></dl><div className="omr-table-scroll"><table className="omr-table"><thead><tr><th>Processing state</th><th>Sheets</th></tr></thead><tbody>{stats.scans.map(row=><tr key={row.status}><td>{row.status.replaceAll('_',' ')}</td><td>{row._count}</td></tr>)}</tbody></table></div>{!total&&<p className="py-4 text-sm">No sheets have been uploaded. Open Single scan or Bulk upload to begin.</p>}</section>}
    {exam&&screen==='keys'&&canManage&&<AnswerKeyManager key={exam.id} client={client} exam={exam} keys={keys} run={run}/>}
    {exam&&canScan&&['single','bulk'].includes(screen)&&<UploadPanel key={`${exam.id}:${screen}`} client={client} examId={exam.id} bulk={screen==='bulk'} onAccepted={value=>{setBatch(value);setNotice('File received. Open Processing queue to follow its pages.');void reload();}}/>}
    {exam&&screen==='queue'&&<section>
      <DataTable<Batch> data={batches.items} columns={[{header:'Batch',render:row=><button className="text-[#185b9d] underline break-all" onClick={()=>run(async()=>setBatch(await client.batch(row.id)),'Batch progress loaded')}>{row.id}</button>},{header:'Source',accessor:'source'},{header:'Status',accessor:'status'},{header:'Pages',render:row=>row._count?.items??'Pending inspection'},{header:'Received',render:row=>new Date(row.createdAt).toLocaleString()}]} keyExtractor={row=>row.id} isLoading={loading} emptyTitle="No upload batches" emptyMessage="Upload images or a PDF to create a processing batch." pagination={{page,total:batches.total,totalPages:Math.max(1,Math.ceil(batches.total/25)),onPageChange:setPage}}/>
      {batch&&<section className="omr-section"><div className="flex flex-wrap gap-3 justify-between items-center"><h3 className="omr-heading">Batch {batch.id}</h3><div className="flex gap-2"><button className="omr-button" onClick={()=>run(async()=>setBatch(await client.batch(batch.id)),'Batch progress refreshed')}>Refresh progress</button><button className="omr-button" disabled={!batch.items?.length} onClick={()=>downloadReport(batch)}>Download report</button></div></div><p className="text-sm">{batch.status} · {batch.progress?.processed??0} of {batch.progress?.total??0} pages processed · {batch.progress?.duplicates??0} duplicates</p><ul className="text-sm mt-3 space-y-2">{batch.items?.map(item=><li key={item.id}>Page {item.pageIndex}: {item.status==='DUPLICATE'?'Duplicate · ':''}{item.scan?.status||item.status} {item.scan?.errorCode&&`· ${item.scan.errorCode}`} {item.scan&&<button className="text-[#185b9d] underline ml-2" onClick={()=>setScanId(item.scan!.id)}>Open scan</button>}</li>)}</ul></section>}
    </section>}
    {exam&&['review','history'].includes(screen)&&<section><DataTable<Scan> data={scans.items} keyExtractor={row=>row.id} columns={[{header:'Candidate',render:row=>row.student?.fullName||'Identity review required'},{header:'Roll / application',render:row=>row.student?.rollNumber||row.student?.applicationNo||'Not attached'},{header:'Paper',render:row=>row.paperVersion||'Review'},{header:'State',render:row=><span className={row.status==='FAILED'||row.status==='INVALID'?'text-red-700':row.status==='REVIEW_REQUIRED'?'text-amber-700':''}>{row.status.replaceAll('_',' ')}</span>},{header:'Action',render:row=><button className="omr-button" onClick={()=>setScanId(row.id)}>Open evidence</button>}]} isLoading={loading} searchValue={search} onSearchChange={value=>{setPage(1);setSearch(value);}} searchPlaceholder="Search roll or application number" pagination={scanPagination} filters={screen==='history'?<label className="text-sm">State <select value={filter} onChange={event=>{setPage(1);setFilter(event.target.value);}}><option value="">All states</option>{['QUEUED','PROCESSING','REVIEW_REQUIRED','RECOGNIZED','VERIFIED','INVALID','FAILED','REJECTED'].map(value=><option key={value}>{value}</option>)}</select></label>:undefined} emptyTitle="No matching scans" emptyMessage="Scans appear here after upload and processing."/></section>}
    {exam&&['results','publication'].includes(screen)&&canResults&&<section className="space-y-3">
      <DataTable<Result> data={results.items} keyExtractor={row=>row.id} isLoading={loading} columns={[{header:'Select',render:row=><input type="checkbox" aria-label={`Select result for ${row.student.rollNumber||row.student.applicationNo}`} checked={selected.includes(row.id)} onChange={event=>setSelected(previous=>event.target.checked?[...previous,row.id]:previous.filter(id=>id!==row.id))}/>},{header:'Candidate',render:row=><>{row.student.fullName}<span className="block text-xs text-slate-500">{row.student.rollNumber||row.student.applicationNo}</span></>},{header:'Marks',render:row=>`${row.score} / ${row.maximumScore}`},{header:'Status',accessor:'status'},{header:'Evidence',render:row=><button className="omr-button" onClick={()=>setScanId(row.sourceScanId)}>Review</button>}]} emptyTitle="No matching internal results" emptyMessage="Results are saved after identity and an approved answer key are matched." pagination={{page,total:results.total,totalPages:Math.max(1,Math.ceil(results.total/25)),onPageChange:setPage}}/>
      <p className="text-sm">{selected.length} selected <button className="underline ml-2" onClick={()=>setSelected([])}>Clear selection</button></p><label className="omr-field">Approval / publication reason<textarea value={reason} minLength={8} maxLength={500} rows={2} onChange={event=>setReason(event.target.value)}/></label>
      <div className="flex flex-wrap gap-2"><button className="omr-button" disabled={busy||!selected.length||reason.trim().length<8} onClick={()=>run(async()=>{const result=await client.approveResults(exam.id,selected,reason);setSelected([]);if(result.failed.length)throw new Error(`${result.approved.length} verified; ${result.failed.length} require attention: ${result.failed.map(item=>item.reason).join('; ')}`);},'Selected draft results verified')}>Verify selected drafts</button>{superAdmin&&<><label className="flex gap-2 items-center text-sm"><input type="checkbox" checked={releaseConfirmed} onChange={event=>setReleaseConfirmed(event.target.checked)}/>Release approved marks to students</label><button className="omr-primary" disabled={busy||!stats?.officialRecognitionEnabled||!releaseConfirmed||!selected.length||reason.trim().length<8} onClick={()=>run(async()=>{await client.publish(exam.id,selected,reason);setSelected([]);setReleaseConfirmed(false);},'Authorized results published')}>Publish selected verified results</button></>}</div>
      {results.items.some(row=>row.publications.length>0)&&<details className="omr-section"><summary className="cursor-pointer text-sm font-semibold">Result history and corrections</summary>{results.items.map(row=><section key={row.id} className="py-3 border-b border-slate-200"><p className="font-medium text-sm">{row.student.fullName} · {row.status}</p><ul className="text-xs space-y-1 my-2">{row.publications.map(event=><li key={event.id}>{new Date(event.createdAt).toLocaleString()} · {event.action} · {event.reason}</li>)}</ul><div className="flex flex-wrap gap-2">{canManage&&<label className="omr-field">Replacement scan ID (optional)<input value={replacement[row.id]||''} onChange={event=>setReplacement(previous=>({...previous,[row.id]:event.target.value}))} maxLength={128}/></label>}{canManage&&<button className="omr-button" disabled={busy||row.status==='PUBLISHED'||reason.trim().length<8} onClick={()=>run(()=>client.reevaluate(exam.id,row.id,reason,replacement[row.id]?.trim()||undefined),'Reevaluation recorded as a new draft; review is required')}>Re-evaluate latest key</button>}{superAdmin&&row.status==='PUBLISHED'&&<button className="omr-danger" disabled={busy||reason.trim().length<8} onClick={()=>run(()=>client.withdraw(exam.id,row.id,reason),'Published result withdrawn with history retained')}>Withdraw result</button>}</div></section>)}</details>}
    </section>}
    {screen==='publication'&&superAdmin&&<LegacyReleaseReview client={client} run={run}/>}
    {scanId&&<ScanReview key={scanId} client={client} scanId={scanId} canReview={canReview} onClose={()=>setScanId('')} onChanged={()=>{void reload();}}/>}
  </main>;
}
