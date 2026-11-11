import React,{useEffect,useMemo,useRef,useState} from 'react';
import {createMemorySession,Staff} from './session';
import {Exam,Batch,Scan,Stats} from '../../../src/features/omr/contracts';
import {UploadPanel} from '../../../src/features/omr/UploadPanel';
import {ScanReview} from '../../../src/components/admin/omr/ScanReview';
import {Icon} from './StitchIcon';
import '../../../src/features/omr/omr.css';
import './stitch.css';

type Page='home'|'exams'|'camera'|'pending'|'review'|'history'|'settings';
const errorGuidance:Record<string,string>={
 PAGE_CROPPED:'The paper boundary could not be verified. Retake the entire A4 page with all four black squares and visible background on every side. Do not upload a cropped copy.',
 PAGE_ALIGNMENT_FAILED:'The four corner markers could not be aligned. Flatten the sheet and photograph the complete page in even light.',
 GRID_ALIGNMENT_FAILED:'The 100 numbered rows could not be mapped safely. Retake a sharp original with the camera parallel to the paper.',
 PRINT_LAYOUT_MISMATCH:'This paper layout is not supported by the scanner profile. Retain the sheet for compatibility review.',
 IMAGE_TOO_BLURRY:'The answer circles are not sharp enough. Hold the camera steady, focus and retake.',
};
const countStatus=(stats:Stats|null,terms:string[])=>Array.isArray(stats?.scans)?stats.scans.filter(x=>terms.includes(x.status)).reduce((total,x)=>total+x._count,0):null;
const n=(value:number|null|undefined)=>value==null?'—':value.toLocaleString();
const dateString=(raw?:string)=>{if(!raw)return 'Date not supplied';const parsed=new Date(raw);return Number.isFinite(parsed.getTime())?parsed.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}):raw;};
const statusLabel=(value?:string|null)=>(value||'PENDING').replaceAll('_',' ');
const tone=(value?:string|null)=>!value?'neutral':/INVALID|FAILED|REJECTED|CANCELLED/.test(value)?'danger':/REVIEW|PENDING|QUEUED|DRAFT|PROCESSING/.test(value)?'warning':/APPROVED|VERIFIED|RECOGNIZED|COMPLETE|ACTIVE|PUBLISHED/.test(value)?'success':'neutral';
function Status({value,children}:{value?:string|null;children?:React.ReactNode}){
 return <span className={'azm-status azm-status-'+tone(value)}><span aria-hidden="true" className="azm-status-dot"/>{children||statusLabel(value)}</span>;
}
function Brand({small=false}:{small?:boolean}){return <div className={'azm-brand'+(small?' azm-brand-small':'')}><span className="azm-brand-mark"><Icon name="scan" size={small?18:26}/></span><span className="azm-brand-copy"><strong>AZM<span>Scan</span></strong><small>Powered by AZM.AIO</small></span></div>;}
function InfoTile({icon,label,value,toneName}:{icon:string;label:string;value:string;toneName?:string}){return <div className={'azm-metric azm-metric-'+(toneName||'blue')}><div className="azm-metric-top"><span className="azm-metric-icon"><Icon name={icon} size={17}/></span></div><strong>{value}</strong><span>{label}</span></div>;}
function SectionHead({title,action,onAction}:{title:string;action?:string;onAction?:()=>void}){return <div className="azm-section-head"><h3>{title}</h3>{action&&onAction&&<button className="azm-link" onClick={onAction}>{action}<Icon name="arrow" size={15}/></button>}</div>;}
function ScanRow({item,open}:{item:Scan;open:()=>void}){return <div className="azm-scan-row"><span className={'azm-row-icon azm-row-'+tone(item.status)}><Icon name={tone(item.status)==='danger'?'warning':tone(item.status)==='success'?'check':'review'} size={18}/></span><div className="azm-row-main"><strong>{item.student?.fullName||'Identity confirmation required'}</strong><small>{statusLabel(item.status)} · {dateString(item.createdAt)}</small></div><button className="azm-open" onClick={open}>Open</button></div>;}
export function StitchApp(){
 const [user,setUser]=useState<Staff|null>(null),[base,setBase]=useState((import.meta as any).env?.VITE_OMR_API_URL||'http://127.0.0.1:5055'),[email,setEmail]=useState(''),[password,setPassword]=useState('');
 const [page,setPage]=useState<Page>('home'),[exams,setExams]=useState<Exam[]>([]),[examId,setExamId]=useState(''),[search,setSearch]=useState(''),[listSearch,setListSearch]=useState(''),[listPage,setListPage]=useState(1);
 const [batch,setBatch]=useState<Batch|null>(null),[scanId,setScanId]=useState(''),[records,setRecords]=useState<Scan[]>([]),[total,setTotal]=useState(0),[recent,setRecent]=useState<Scan[]>([]),[metrics,setMetrics]=useState<Stats|null>(null);
 const [error,setError]=useState(''),[pollError,setPollError]=useState(''),[busy,setBusy]=useState(false),[online,setOnline]=useState(navigator.onLine),[reload,setReload]=useState(0);
 const terminalReported=useRef('');
 const errorRef=useRef<HTMLDivElement>(null);
 const session=useMemo(()=>createMemorySession(()=>{setUser(null);setExams([]);setExamId('');setBatch(null);setRecords([]);setScanId('');setPassword('');setError('Your secure session has expired. Sign in again.');}),[]);
 const exam=exams.find(item=>item.id===examId);
 const canScan=user?.role==='SUPER_ADMIN'||!!exam?.permissions?.[0]?.canScan;
 const canReview=user?.role==='SUPER_ADMIN'||!!exam?.permissions?.[0]?.canReview;
 const selectedStatus=exam?.status||'UNASSIGNED';
 const totalScans=Array.isArray(metrics?.scans)?metrics.scans.reduce((sum,row)=>sum+row._count,0):null;
 const reviewCount=countStatus(metrics,['REVIEW_REQUIRED']);
 const rejectedCount=countStatus(metrics,['INVALID','REJECTED','FAILED']);
 const relevantExams=exams.filter(item=>[item.title,item.code,item.candidateGroup,item.session].some(field=>field?.toLowerCase().includes(search.toLowerCase())));
 const headingName=user?.name?.trim().split(/\s+/)[0]||'Examiner';
 const nav=(target:Page)=>{setError('');setPollError('');setScanId('');setPage(target);if(['history','review'].includes(target)){setListPage(1);setListSearch('');}};
 useEffect(()=>{const update=()=>setOnline(navigator.onLine);window.addEventListener('online',update);window.addEventListener('offline',update);return()=>{window.removeEventListener('online',update);window.removeEventListener('offline',update);session.logout();};},[session]);
 useEffect(()=>{if(error||pollError)errorRef.current?.focus();},[error,pollError]);
 useEffect(()=>{
  if(!user)return;let stopped=false;
  session.client.exams().then(value=>{if(stopped)return;setExams(value);setExamId(current=>value.some(x=>x.id===current)?current:(value[0]?.id||''));},failure=>{if(!stopped)setError(failure instanceof Error?failure.message:'Could not load assigned examinations.');});
  return()=>{stopped=true;};
 },[session,user]);
 useEffect(()=>{
  if(!user||!examId)return;let stopped=false;
  Promise.allSettled([session.client.stats(examId),session.client.scans(examId,1),session.client.batches(examId,1)]).then(out=>{
   if(stopped)return;
   if(out[0].status==='fulfilled'&&Array.isArray(out[0].value?.scans))setMetrics(out[0].value);else setMetrics(null);
   if(out[1].status==='fulfilled')setRecent(out[1].value.items);else setRecent([]);
  });
  return()=>{stopped=true;};
 },[session,user,examId,reload]);
 useEffect(()=>{
  if(!user||!examId||!['history','review'].includes(page))return;let stopped=false;
  const status=page==='review'?'REVIEW_REQUIRED':'';
  session.client.scans(examId,listPage,status,listSearch).then(result=>{if(stopped)return;setRecords(result.items);setTotal(result.total);},failure=>{if(!stopped)setError(failure instanceof Error?failure.message:'Could not load scan history.');});
  return()=>{stopped=true;};
 },[session,user,examId,page,listPage,listSearch,reload]);
 useEffect(()=>{
  setPollError('');if(!user||!batch||page!=='pending')return;let stopped=false;
  const tick=()=>session.client.batch(batch.id).then(next=>{if(stopped)return;setBatch(next);setPollError('');const terminalKey=next.id+':'+next.status;if(['COMPLETE','FAILED','CANCELLED'].includes(next.status)&&terminalReported.current!==terminalKey){terminalReported.current=terminalKey;setReload(x=>x+1);}},failure=>{if(!stopped)setPollError(failure instanceof Error?failure.message:'Processing connection interrupted.');});
  void tick();const timer=setInterval(tick,3000);return()=>{stopped=true;clearInterval(timer);};
 },[session,user,batch?.id,page]);
 async function login(event:React.FormEvent){
  event.preventDefault();setError('');setBusy(true);
  try{const staff=await session.login(base,email,password);setUser(staff);setPassword('');setPage('home');}
  catch(failure){setError(failure instanceof Error?failure.message:'Sign-in failed. Check your connection.');}
  finally{setBusy(false);}
 }
 function logout(){session.logout();setUser(null);setExams([]);setExamId('');setBatch(null);setRecords([]);setMetrics(null);setScanId('');setPassword('');}
 const errorArea=(error||pollError)?<div tabIndex={-1} ref={errorRef} role="alert" className="azm-alert azm-alert-danger"><Icon name="warning" size={18}/><span>{error||pollError}</span><button aria-label="Dismiss error" onClick={()=>{setError('');setPollError('');}}><Icon name="close" size={16}/></button></div>:null;
 if(!user)return <main className="azm-app azm-login-screen">
  <div className="azm-login-wrap">
   <div className="azm-secure-strip"><Icon name="lock" size={14}/> Secure staff examination workspace</div>
   <div className="azm-login-identity"><div className="azm-large-mark"><Icon name="scan" size={37}/></div><h1>AZM Scan</h1><p>Smart OMR Examination Recognition</p><strong>Powered by AZM.AIO</strong></div>
   <div className="azm-role-selector" aria-label="Roles assigned by the examination authority"><span>Invigilator / Teacher</span><span>Exam Admin</span><span>Super Admin</span></div>
   {errorArea}
   <form onSubmit={login} className="azm-login-form">
    <div className="azm-form-title"><Icon name="shield" size={19}/> Institutional staff sign-in</div>
    <label className="azm-field"><span>Institutional email or staff ID</span><span className="azm-input-icon"><Icon name="user" size={17}/><input required type="email" autoComplete="username" autoCapitalize="none" value={email} onChange={event=>setEmail(event.target.value)} placeholder="staff@example.edu"/></span></label>
    <label className="azm-field"><span>Secure password</span><span className="azm-input-icon"><Icon name="lock" size={17}/><input required type="password" autoComplete="current-password" value={password} onChange={event=>setPassword(event.target.value)} placeholder="Enter your password"/></span></label>
    <label className="azm-field azm-server-field"><span>API server</span><span className="azm-input-icon"><Icon name="wifi" size={17}/><input required type="url" autoCapitalize="none" spellCheck={false} value={base} onChange={event=>setBase(event.target.value)} /></span></label>
    <p className="azm-field-note"><Icon name="info" size={14}/> Access permissions are checked by the server—not the visual role labels.</p>
    <button className="azm-primary azm-full" type="submit" disabled={!online||busy}>{busy?'Signing in…':'Sign in to examination portal'}<Icon name="arrow" size={18}/></button>
   </form>
   <div className="azm-login-help"><Icon name="scan" size={21}/><div><strong>High-resolution OMR capture</strong><small>Recognition and review require a live connection to your examination server.</small></div><span className={'azm-small-dot'+(online?' is-online':'')}/></div>
   <p className="azm-login-footer"><Icon name="shield" size={15}/> Confidential examination material. Sessions stay in memory; offline photo storage is disabled.</p>
  </div>
 </main>;
 return <main className={'azm-app azm-authenticated'+(page==='camera'?' azm-mode-camera':'')}>
  {page==='camera'?<div className="azm-camera-toolbar"><button onClick={()=>nav('home')} aria-label="Exit scanner"><Icon name="close" size={24}/></button><div className="azm-camera-toolbar-center"><span>{exam?.code||'No examination selected'}</span><small>Full-resolution capture</small></div><span className={'azm-camera-network'+(online?' is-online':'')}>{online?'Online':'Offline'}</span></div>:
  <header className="azm-app-header"><Brand small/><div className="azm-header-right"><span className={'azm-online'+(online?' is-online':'')}><i/>{online?'Online':'Offline'}</span><button aria-label="Open review queue" className="azm-header-icon" onClick={()=>nav('review')}><Icon name="bell" size={19}/>{reviewCount!=null&&reviewCount>0&&<b/>}</button><button className="azm-avatar" aria-label="Account settings" onClick={()=>nav('settings')} title={user.email}><Icon name="user" size={18}/></button></div></header>}
  {errorArea}
  <div className="azm-page-content">
  {page==='home'&&<>
   <div className="azm-greeting"><div><p>Good morning, {headingName}</p><span>{user.role.replaceAll('_',' ')} · Examination staff</span></div><button className="azm-mini-icon" aria-label="Choose examination" onClick={()=>nav('exams')}><Icon name="switch" size={19}/></button></div>
   <button className="azm-active-session" onClick={()=>nav('exams')}><div><span className="azm-eyebrow"><i/> Selected examination</span><strong>{exam?.title||'Select an examination to begin'}</strong><small>{exam?(exam.code+' · '+exam.candidateGroup):'Only assigned sessions are available'}</small></div><Icon name="chevron" size={20}/></button>
   <section className="azm-hero"><div className="azm-hero-top"><span><Icon name="spark" size={14}/> Precision scanning workflow</span><Icon name="scan" size={31}/></div><h2>Instant Single Sheet Scanner</h2><p>Capture a complete 100-question OMR page. Identity, paper version and answers are checked after upload.</p><button className="azm-hero-cta" disabled={!examId||!canScan||!online} onClick={()=>nav('camera')}><Icon name="camera" size={19}/>Scan OMR sheet<Icon name="arrow" size={18}/></button></section>
   <button className="azm-burst-card" onClick={()=>nav('camera')} disabled={!canScan||!examId||!online}><span className="azm-burst-symbol"><Icon name="layers" size={19}/></span><span><strong>Continuous staff workflow</strong><small>Scan the next sheet after reviewing the previous upload</small></span><Icon name="chevron" size={18}/></button>
   {batch&&<section className="azm-progress-card"><div><span className="azm-eyebrow">Current batch</span><Status value={batch.status}/></div><strong>{n(batch.progress?.processed)} / {n(batch.progress?.total)} pages</strong><div className="azm-progress-bar"><span style={{width:(batch.progress?.total?Math.min(100,Math.round((batch.progress.processed/batch.progress.total)*100)):0)+'%'}}/></div><button className="azm-link" onClick={()=>nav('pending')}>Open batch processing <Icon name="arrow" size={15}/></button></section>}
   <div className="azm-summary-grid">
    <InfoTile icon="file" label="Scans recorded" value={n(totalScans)}/>
    <InfoTile icon="review" label="Needs review" value={n(reviewCount)} toneName="amber"/>
    <InfoTile icon="warning" label="Retake / rejected" value={n(rejectedCount)} toneName="rose"/>
    <InfoTile icon="layers" label="Batches" value={n(metrics?.batches)} toneName="cyan"/>
   </div>
   <section className="azm-white-panel"><SectionHead title="Recent scanning activity" action="View history" onAction={()=>nav('history')}/>{recent.length?recent.slice(0,4).map(item=><ScanRow item={item} key={item.id} open={()=>setScanId(item.id)}/>):<p className="azm-empty-small">No scan records found for this examination. Start with a complete sheet photo.</p>}</section>
   <section className="azm-white-panel"><SectionHead title="Exam control tools"/><div className="azm-tools-grid"><button onClick={()=>nav('exams')}><Icon name="switch" size={20}/><span>Switch session</span></button><button onClick={()=>nav('review')}><Icon name="review" size={20}/><span>Review queue</span></button><button onClick={()=>nav('settings')}><Icon name="settings" size={20}/><span>Settings</span></button></div></section>
   <div className="azm-internal-note"><Icon name="shield" size={17}/> Unverified OCR/QR candidates are never treated as verified identities. Official scoring and publication need separate authorization.</div>
  </>}
  {page==='exams'&&<section className="azm-exam-page">
    <div className="azm-title-row"><button onClick={()=>nav('home')} aria-label="Back to dashboard"><Icon name="back" size={21}/></button><div><h1>Exam Batch Setup</h1><p>Select an authorized session</p></div></div>
    <div className="azm-assigned"><Icon name="id" size={18}/><span>Assigned examinations</span><Status value={online?'ACTIVE':'PENDING'}>{online?'Connected':'Offline'}</Status></div>
    <label className="azm-search"><Icon name="search" size={19}/><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search examination name or code" aria-label="Search examinations"/></label>
    <div className="azm-section-head"><h3>Authorized sessions ({relevantExams.length})</h3><Icon name="shield" size={18}/></div>
    {relevantExams.length?relevantExams.map(item=>{const allowed=user.role==='SUPER_ADMIN'||!!item.permissions?.[0]?.canScan;const selected=examId===item.id;return <article key={item.id} className={'azm-exam-card'+(selected?' is-selected':'')}>
      <div className="azm-exam-card-top"><span className="azm-code">{item.code||'EXAM'}</span><Status value={item.status}/></div>
      <h2>{item.title}</h2><p><Icon name="calendar" size={15}/> {dateString(item.examDate)} · {item.candidateGroup}</p>
      <div className="azm-exam-details"><div><span>Questions</span><strong>{item.questionCount} MCQs</strong></div><div><span>Versions</span><strong>{item.allowedVersions?.join(' · ')||'Not configured'}</strong></div><div><span>Session</span><strong>{item.session||'Not specified'}</strong></div></div>
      <div className="azm-exam-foot"><span className="azm-permission"><Icon name={allowed?'check':'lock'} size={15}/>{allowed?'Scanning permitted':'No scanning permission'}</span><button disabled={!allowed||!online} onClick={()=>{setExamId(item.id);nav('camera');}}>Select &amp; scan <Icon name="arrow" size={15}/></button></div>
    </article>;}):<div className="azm-empty-small">No matching assigned examinations. Try another search, or ask an administrator to grant access.</div>}
    <div className="azm-sticky-actions"><button className="azm-primary azm-full" onClick={()=>nav('camera')} disabled={!examId||!canScan||!online}><Icon name="scan" size={18}/> Confirm &amp; start scanning <Icon name="arrow" size={18}/></button></div>
   </section>}
  {page==='camera'&&<section className="azm-camera-page">
    <div className="azm-camera-instructions"><Icon name="crop" size={17}/><span>Place the entire paper inside the guide. All four corner squares must remain visible.</span></div>
    {!exam?<div className="azm-camera-unassigned"><Icon name="warning" size={28}/><h2>No examination selected</h2><button className="azm-primary" onClick={()=>nav('exams')}>Choose examination</button></div>:!canScan?<div className="azm-camera-unassigned">Your current staff role cannot scan this examination.<button className="azm-secondary" onClick={()=>nav('exams')}>Switch examination</button></div>:<UploadPanel key={exam.id} mobile client={session.client} examId={exam.id} onAccepted={value=>{setBatch(value);setPage('pending');setReload(x=>x+1);}}/>}
    <div className="azm-camera-footnote"><Icon name="info" size={16}/> Camera reticle is framing guidance, not a real-time sheet verification result. The server checks actual geometry and response evidence.</div>
   </section>}
  {page==='pending'&&<section className="azm-pending-page">
    <div className="azm-title-row"><button onClick={()=>nav('camera')} aria-label="Back to scanning"><Icon name="back" size={21}/></button><div><h1>Processing &amp; audit</h1><p>Upload and worker status</p></div></div>
    {batch?<><div className="azm-pending-card"><Status value={batch.status}/><h2>Batch processing</h2><p>{n(batch.progress?.processed)} of {n(batch.progress?.total)} pages processed</p><div className="azm-progress-bar"><span style={{width:(batch.progress?.total?Math.round((batch.progress.processed/batch.progress.total)*100):0)+'%'}}/></div><small>Upload completion is not answer verification, identity confirmation, or a published score.</small></div>
    {batch.items?.map(item=><article className="azm-batch-item" key={item.id}><div><span className="azm-code">Page {item.pageIndex}</span><Status value={item.scan?.status||item.status}/></div>{item.scan?.errorCode&&<p role="alert" className="azm-alert azm-alert-danger"><Icon name="warning" size={18}/>{errorGuidance[item.scan.errorCode]||'The sheet cannot be processed safely. Retake and inspect the original.'}</p>}
    <div className="azm-batch-actions">{item.scan&&<button className="azm-secondary" onClick={()=>setScanId(item.scan!.id)}><Icon name="eye" size={16}/>View evaluation evidence</button>}{item.scan?.status==='INVALID'&&<button className="azm-primary" onClick={()=>{setScanId('');setBatch(null);nav('camera');}}><Icon name="refresh" size={16}/>Retake sheet with camera</button>}</div></article>)}
    {batch.errorCode&&<p className="azm-alert azm-alert-danger"><Icon name="warning"/>Processing failed. Preserve the original and retry using a clean capture or contact an administrator.</p>}
    <button className="azm-primary azm-full" disabled={!online||!canScan} onClick={()=>nav('camera')}><Icon name="camera" size={18}/> Scan next sheet <Icon name="arrow" size={17}/></button></>:<div className="azm-empty-small">No active batch. Capture a sheet to begin.</div>}
   </section>}
  {['review','history'].includes(page)&&<section className="azm-list-page">
    <div className="azm-title-row"><span className="azm-title-icon"><Icon name={page==='review'?'review':'history'} size={24}/></span><div><h1>{page==='review'?'Review queue':'Scan history'}</h1><p>{page==='review'?'Unresolved examinations and uncertain marks':'Private history for the selected examination'}</p></div></div>
    {page==='review'&&!canReview&&<p role="status" className="azm-alert azm-alert-warning">Your account does not have permission to change reviewed answers. Open the history for permitted scan information.</p>}
    <label className="azm-search"><Icon name="search" size={18}/><input aria-label="Search scans" placeholder="Search authorized scan records" value={listSearch} onChange={event=>{setListPage(1);setListSearch(event.target.value);}}/></label>
    <div className="azm-white-panel">{records.length?records.map(item=><ScanRow key={item.id} item={item} open={()=>setScanId(item.id)}/>):<p className="azm-empty-small">{page==='review'?'No review-required scans on this page.':'No scans found on this page.'}</p>}</div>
    <div className="azm-pagination"><button disabled={listPage===1} onClick={()=>setListPage(x=>x-1)}><Icon name="back" size={16}/>Previous</button><span>Page {listPage} · {n(total)} scans</span><button disabled={listPage*25>=total} onClick={()=>setListPage(x=>x+1)}>Next<Icon name="chevron" size={16}/></button></div>
  </section>}
  {page==='settings'&&<section className="azm-settings-page"><div className="azm-title-row"><span className="azm-title-icon"><Icon name="settings" size={24}/></span><div><h1>Account &amp; settings</h1><p>Staff access and scanner configuration</p></div></div>
    <div className="azm-white-panel"><div className="azm-account-hero"><div className="azm-avatar azm-avatar-large"><Icon name="user" size={25}/></div><div><strong>{user.name}</strong><span>{user.email}</span></div><Status value="ACTIVE">{user.role.replaceAll('_',' ')}</Status></div></div>
    <div className="azm-white-panel azm-settings-list"><div><Icon name="wifi" size={20}/><span><strong>API server</strong><small className="azm-break">{session.origin()}</small></span></div><div><Icon name="camera" size={20}/><span><strong>Capture quality</strong><small>Use full-resolution photos and preserve QR/OMR detail. Local compression runs before upload.</small></span></div><div><Icon name="shield" size={20}/><span><strong>Private evaluation</strong><small>Human review, identity verification and publication are separate authorized operations.</small></span></div><div><Icon name="lock" size={20}/><span><strong>Offline storage</strong><small>Disabled. No photos or credentials are persisted locally.</small></span></div></div>
    <button className="azm-secondary azm-full" onClick={logout}><Icon name="logout" size={18}/> Sign out securely</button>
   </section>}
  </div>
  {page!=='camera'&&<nav className="azm-bottom-nav" aria-label="Scanner screens">
    {([{page:'home',label:'Home',icon:'home',target:'home'},{page:'camera',label:'Scan sheet',icon:'scan',target:'camera'},{page:'review',label:'Review',icon:'review',target:'review'},{page:'history',label:'History',icon:'history',target:'history'}] as const).map(item=><button key={item.page} aria-label={item.label} aria-current={page===item.target?'page':undefined} onClick={()=>nav(item.target)} disabled={item.target==='review'&&!examId}><span className="azm-bottom-nav-icon"><Icon name={item.icon} size={21}/></span><span>{item.label}</span>{item.target==='review'&&reviewCount!=null&&reviewCount>0&&<i className="azm-nav-count">{reviewCount>99?'99+':reviewCount}</i>}</button>)}
   </nav>}
  {scanId&&<div className="azm-review-cover"><div className="azm-review-surface"><ScanReview key={scanId} client={session.client} scanId={scanId} canReview={!!canReview} onClose={()=>setScanId('')} onChanged={()=>{setReload(x=>x+1);}}/></div></div>}
 </main>;
}
