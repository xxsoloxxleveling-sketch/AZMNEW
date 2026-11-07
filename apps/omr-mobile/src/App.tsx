import React,{useEffect,useMemo,useRef,useState} from 'react';
import { createMemorySession,Staff } from './session';
import { Exam,Batch,Scan,ScanDetail } from '../../../src/features/omr/contracts';
import { UploadPanel } from '../../../src/features/omr/UploadPanel';
import { ScanReview } from '../../../src/components/admin/omr/ScanReview';
import '../../../src/features/omr/omr.css';
export function App() {
  const [user,setUser]=useState<Staff|null>(null),[base,setBase]=useState((import.meta as any).env?.VITE_OMR_API_URL||'http://127.0.0.1:5055'),[email,setEmail]=useState(''),[password,setPassword]=useState('');
  const session=useMemo(()=>createMemorySession(()=>{setUser(null);setExams([]);setExamId('');setBatch(null);setHistory([]);setScanId('');setPassword('');setError('Your session expired. Sign in again.');}),[]);
  const [error,setError]=useState(''),[busy,setBusy]=useState(false),[online,setOnline]=useState(navigator.onLine);
  const [exams,setExams]=useState<Exam[]>([]),[examId,setExamId]=useState(''),[view,setView]=useState<'dashboard'|'capture'|'pending'|'history'|'settings'>('dashboard');
  const [batch,setBatch]=useState<Batch|null>(null),[history,setHistory]=useState<Scan[]>([]),[page,setPage]=useState(1),[total,setTotal]=useState(0),[scanId,setScanId]=useState('');
  const errorRef=useRef<HTMLParagraphElement>(null),exam=exams.find(value=>value.id===examId);
  const canScan=user?.role==='SUPER_ADMIN'||!!exam?.permissions?.[0]?.canScan;
  const canReview=user?.role==='SUPER_ADMIN'||!!exam?.permissions?.[0]?.canReview;
  useEffect(()=>{const change=()=>setOnline(navigator.onLine);window.addEventListener('online',change);window.addEventListener('offline',change);return()=>{window.removeEventListener('online',change);window.removeEventListener('offline',change);session.logout();};},[session]);
  useEffect(()=>{if(error)errorRef.current?.focus();},[error]);
  useEffect(()=>{if(!user)return;let cancelled=false;session.client.exams().then(value=>{if(!cancelled){setExams(value);setExamId(value[0]?.id||'');}},problem=>{if(!cancelled)setError(problem.message);});return()=>{cancelled=true;};},[user,session]);
  useEffect(()=>{
    if(!user||!examId||view!=='history')return;let cancelled=false;
    session.client.scans(examId,page).then(value=>{if(!cancelled){setHistory(value.items);setTotal(value.total);}},problem=>{if(!cancelled)setError(problem.message);});
    return()=>{cancelled=true;};
  },[user,examId,view,page,session]);
  useEffect(()=>{
    if(!user||!batch||view!=='pending')return;let cancelled=false;
    const poll=()=>session.client.batch(batch.id).then(value=>{if(!cancelled)setBatch(value);},problem=>{if(!cancelled)setError(problem.message);});
    void poll();const timer=setInterval(poll,3000);return()=>{cancelled=true;clearInterval(timer);};
  },[user,batch?.id,view,session]);
  async function login(event:React.FormEvent) {
    event.preventDefault();setError('');setBusy(true);
    try {setUser(await session.login(base,email,password));setPassword('');setView('dashboard');}
    catch(problem){setError(problem instanceof Error?problem.message:'Connection failed. Check your network and API address.');}
    finally{setBusy(false);}
  }
  function logout(){session.logout();setUser(null);setExams([]);setExamId('');setBatch(null);setHistory([]);setScanId('');setPassword('');}
  return <main className="omr-workspace mx-auto max-w-3xl px-4 py-5 pb-20 min-h-screen">
    <header className="flex justify-between gap-3 items-center border-b border-slate-300 pb-4 mb-4"><div><h1 className="text-lg font-semibold text-[#185b9d]">AZM.AIO OMR</h1><p className="text-xs text-slate-500">Private examination scanning</p></div>{user&&<button className="omr-button" onClick={logout}>Sign out</button>}</header>
    {error&&<p ref={errorRef} tabIndex={-1} role="alert" className="omr-notice omr-error mb-4">{error}</p>}
    {!user?<form onSubmit={login} className="space-y-4 max-w-md mx-auto"><h2 className="omr-heading">Staff sign-in</h2><label className="omr-field">API server<input required type="url" value={base} onChange={event=>setBase(event.target.value)} autoCapitalize="none" spellCheck={false}/></label><label className="omr-field">Staff email<input required type="email" autoComplete="username" value={email} onChange={event=>setEmail(event.target.value)}/></label><label className="omr-field">Password<input required type="password" autoComplete="current-password" value={password} onChange={event=>setPassword(event.target.value)}/></label><button className="omr-primary w-full" disabled={busy||!online}>{busy?'Signing in…':'Sign in'}</button><p className="text-xs text-slate-500">Sessions stay in memory. Offline capture and image storage are disabled.</p></form>:<>
      <div className="flex flex-wrap justify-between gap-2 text-sm mb-3"><span>{user.name} · {user.role.replaceAll('_',' ')}</span><span role="status">{online?'Connected':'Offline · capture disabled'}</span></div>
      <nav className="omr-tabs mb-4" aria-label="Scanner screens">{(['dashboard','capture','history','settings'] as const).map(screen=><button key={screen} aria-current={view===screen?'page':undefined} onClick={()=>{setError('');setView(screen);setScanId('');}}>{screen==='dashboard'?'Home':screen==='capture'?'Scan sheet':screen==='history'?'History':'Settings'}</button>)}</nav>
      {view!=='settings'&&<label className="omr-field mb-4">Examination<select value={examId} onChange={event=>{setExamId(event.target.value);setPage(1);setBatch(null);setScanId('');setHistory([]);}}><option value="">Select assigned examination</option>{exams.map(item=><option key={item.id} value={item.id}>{item.title} · {item.candidateGroup}</option>)}</select></label>}
      {view==='dashboard'&&<section className="space-y-4"><h2 className="omr-heading">Ready to scan</h2><p className="text-sm">{exam?`${exam.title} · ${exam.candidateGroup}`:'Choose an assigned examination before capturing a sheet.'}</p><button className="omr-primary w-full" disabled={!examId||!online||!canScan} onClick={()=>setView('capture')}>Scan OMR sheet</button><p className="omr-notice">Marks are saved internally after identity and answer-key checks. Public release requires separate authorization.</p>{!exams.length&&<p className="text-sm">No examinations are assigned. Ask an administrator to grant scanning access.</p>}</section>}
      {view==='capture'&&exam&&canScan&&<UploadPanel key={exam.id} mobile client={session.client} examId={exam.id} onAccepted={value=>{setBatch(value);setView('pending');}}/>}
      {view==='pending'&&batch&&<section className="space-y-3"><h2 className="omr-heading">Processing status</h2><p role="status">{batch.status.replaceAll('_',' ')} · {batch.progress?.processed??0} / {batch.progress?.total??0} pages processed</p><p className="text-sm">Duplicate pages reuse the original scan and do not create another official result.</p>{batch.items?.map(item=><div key={item.id} className="border-b border-slate-300 py-3"><p className="text-sm">Page {item.pageIndex} · {item.scan?.status.replaceAll('_',' ')||item.status}</p>{item.scan?.errorCode&&<p className="text-sm text-amber-700">{item.scan.errorCode.replaceAll('_',' ')}</p>}{item.scan&&<button className="omr-button mt-2" onClick={()=>setScanId(item.scan!.id)}>View evaluation evidence</button>}</div>)}{batch.errorCode&&<p role="alert" className="omr-notice omr-error">The file could not be processed. Retain the original and upload a new capture or contact an administrator.</p>}</section>}
      {view==='history'&&<section><h2 className="omr-heading">Scan history</h2>{history.length?<ul>{history.map(item=><li key={item.id} className="border-b border-slate-300 py-3 flex items-center justify-between gap-3"><div><p className="text-sm font-medium">{item.student?.fullName||'Identity confirmation required'}</p><p className="text-xs text-slate-500">{item.status.replaceAll('_',' ')} · {new Date(item.createdAt).toLocaleString()}</p></div><button className="omr-button" onClick={()=>setScanId(item.id)}>Open</button></li>)}</ul>:<p className="text-sm py-4">No scans on this page.</p>}<div className="flex justify-between items-center mt-3 text-sm"><button className="omr-button" disabled={page===1} onClick={()=>setPage(value=>value-1)}>Previous</button><span>Page {page} · {total} scans</span><button className="omr-button" disabled={page*25>=total} onClick={()=>setPage(value=>value+1)}>Next</button></div></section>}
      {view==='settings'&&<section className="space-y-4"><h2 className="omr-heading">Account and capture settings</h2><dl className="text-sm space-y-2"><div><dt className="font-medium">Account</dt><dd>{user.email}</dd></div><div><dt className="font-medium">API server</dt><dd className="break-all">{session.origin()}</dd></div><div><dt className="font-medium">Capture quality</dt><dd>High-resolution JPEG, with server-side registration and quality checks.</dd></div><div><dt className="font-medium">Synchronization</dt><dd>Online uploads only. Failed captures remain in memory while their capture screen is open.</dd></div><div><dt className="font-medium">Offline storage</dt><dd>Disabled until protected storage is implemented and validated.</dd></div><div><dt className="font-medium">Camera permission</dt><dd>Granted by your browser or device when you open the camera. Change it in device settings.</dd></div><div><dt className="font-medium">Application version</dt><dd>0.1.0 development</dd></div></dl></section>}
      {scanId&&<ScanReview client={session.client} scanId={scanId} canReview={canReview} onClose={()=>setScanId('')} onChanged={()=>{}}/>}
    </>}
  </main>;
}
