import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {createMemorySession,Staff} from './session';
import {Exam,Batch} from '../../../src/features/omr/contracts';
import {scannerIsNative,captureTesterScans,listTesterScans,removeTesterScan,previewScanUrl,readTesterScan,SavedScan} from './native-scanner';
import {Icon} from './StitchIcon';
import {ScanEvaluation} from './ScanEvaluation';
import {nativeScanUploadProblem,nativeScanResolutionAdvisory} from './scanner-upload-quality';
import '../../../src/features/omr/omr.css';
import './scanner-tester.css';

type Page={id:string;name:string;size:number;uri:string;width:number;height:number;createdAt:number;native?:SavedScan;webFile?:File};
const mb=(bytes:number)=>(bytes/1048576).toFixed(2)+' MB';
const when=(time:number)=>new Date(time).toLocaleString();
const allowed=(staff:Staff,exam:Exam)=>staff.role==='SUPER_ADMIN'||exam.permissions?.some(item=>item.canScan)===true;
const fromNative=(item:SavedScan):Page=>({id:item.id,name:item.id,size:item.bytes,uri:previewScanUrl(item),width:item.width,height:item.height,createdAt:item.createdAt,native:item});

export function ScannerTesterApp(){
  const native=scannerIsNative();
  const [pages,setPages]=useState<Page[]>([]),[selected,setSelected]=useState<string|null>(null);
  const [scanning,setScanning]=useState(false),[message,setMessage]=useState('Ready to scan'),[error,setError]=useState('');
  const [serverPanel,setServerPanel]=useState(false),[api,setApi]=useState((import.meta as any).env?.VITE_OMR_API_URL||'http://127.0.0.1:5058');
  const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[staff,setStaff]=useState<Staff|null>(null),[exams,setExams]=useState<Exam[]>([]),[examId,setExamId]=useState('');
  const [authBusy,setAuthBusy]=useState(false),[transfer,setTransfer]=useState(false),[pageBatches,setPageBatches]=useState<Record<string,Batch>>({}),[batchError,setBatchError]=useState('');
  const session=useMemo(()=>createMemorySession(()=>{
    setStaff(null);setExams([]);setExamId('');
    setBatchError('Test-server session expired. Sign in again to upload. Saved images are unaffected.');
  }),[]);
  const reload=useCallback(async()=>{
    if(!native)return;
    const saved=await listTesterScans();
    setPages(saved.map(fromNative));
    setSelected(current=>current&&saved.some(p=>p.id===current)?current:(saved[0]?.id||null));
  },[native]);
  useEffect(()=>{
    void reload().catch(()=>setError('Saved images could not be listed. They were not deleted.'));
    const refresh=()=>{if(!document.hidden)void reload().catch(()=>{});};
    document.addEventListener('visibilitychange',refresh);
    return()=>document.removeEventListener('visibilitychange',refresh);
  },[reload]);
  const chosen=pages.find(p=>p.id===selected)||pages[0];
  const assigned=exams.filter(exam=>staff&&allowed(staff,exam));
  const exam=assigned.find(exam=>exam.id===examId);
  async function startScanner(){
    if(!native){setError('Automatic edge detection is available in the Android tablet APK.');return;}
    if(scanning)return;
    setScanning(true);setError('');setMessage('Opening Android document scanner…');
    try {
      const result=await captureTesterScans(10);
      await reload();
      if(result.cancelled)setMessage('Scanner closed. Your previous scans are still saved.');
      else if(result.pages.length){
        setMessage(result.pages.length+' page(s) saved privately. Close and reopen the app to verify they persist.');
        setSelected(result.pages[result.pages.length-1].id);
      } else setMessage('No pages were captured.');
    } catch (problem) {
      setError(problem instanceof Error?problem.message:'Native scanner could not start.');
      setMessage('Ready to retry; existing scans are preserved.');
      void reload().catch(()=>{});
    } finally {setScanning(false);}
  }
  async function importImage(event:React.ChangeEvent<HTMLInputElement>){
    const file=event.target.files?.[0];if(!file)return;event.target.value='';
    if(!['image/jpeg','image/png'].includes(file.type)||file.size>20*1048576){setError('Choose a JPEG/PNG below 20 MB.');return;}
    try {
      const bitmap=await createImageBitmap(file);
      const item:Page={id:'preview-'+Date.now(),name:file.name,size:file.size,uri:URL.createObjectURL(file),width:bitmap.width,height:bitmap.height,createdAt:Date.now(),webFile:file};
      bitmap.close();setPages(old=>[item,...old]);setSelected(item.id);setError('');
      setMessage('Browser preview only. Install the Android APK for automatic capture and private saving.');
    }catch{setError('Cannot decode this image.');}
  }
  async function deletePage(item:Page){
    if(!window.confirm('Delete this private test scan?'))return;
    try{
      if(item.native)await removeTesterScan(item.native);
      else URL.revokeObjectURL(item.uri);
      if(native)await reload();else setPages(old=>old.filter(p=>p.id!==item.id));
      setPageBatches(old=>{const remaining={...old};delete remaining[item.id];return remaining;});
      if(selected===item.id)setSelected(null);
      setMessage('Scan deleted');setError('');
    }catch{setError('The selected scan could not be deleted.');}
  }
  async function login(event:React.FormEvent){
    event.preventDefault();setAuthBusy(true);setBatchError('');
    try{
      const user=await session.login(api,email,password);
      setStaff(user);setPassword('');
      const exams=(await session.client.exams()).filter(item=>allowed(user,item));
      setExams(exams);setExamId(exams[0]?.id||'');
      if(!exams.length)setBatchError('No authorized test examinations for this account. Local scanning remains available.');
    }catch(problem){setBatchError(problem instanceof Error?problem.message:'Could not connect to the backend.');}
    finally{setAuthBusy(false);}
  }
  async function upload(){
    if(!chosen||!exam||!staff||transfer)return;
    setTransfer(true);setBatchError('');
    try{
      const imageProblem=nativeScanUploadProblem(chosen.width,chosen.height);
      if(imageProblem)throw Error(imageProblem);
      const file=chosen.native?await readTesterScan(chosen.native):chosen.webFile;
      if(!file)throw Error('Saved image unavailable.');
      const next=await session.client.upload(exam.id,file,'mobile');
      setPageBatches(old=>({...old,[chosen.id]:next}));
      setMessage('Recognition started. Tap the saved page to view detected answers and marks once available.');
    }catch(problem){setBatchError(problem instanceof Error?problem.message:'Upload failed; saved image remains intact.');}
    finally{setTransfer(false);}
  }
  useEffect(()=>()=>session.logout(),[session]);

  return <main className="st-app">
    <header className="st-header"><div className="st-logo"><span className="st-mark"><Icon name="scan" size={22}/></span><div><strong>AZM <em>SCAN</em></strong><small>SCANNER TESTER</small></div></div><span className="st-test-tag"><i/> Tester only</span></header>
    <div className="st-body">
      <section className="st-hero">
        <div className="st-overline"><Icon name="camera" size={15}/> Automatic document scanning</div>
        <h1>Scan a sheet.<br/><span>Let the camera find it.</span></h1>
        <p>Android finds the paper edges, captures a stable page and allows corner correction. Confirm the page in the native scanner to save it privately on your tablet.</p>
        <button className="st-cta" type="button" disabled={!native||scanning||pages.length>=40} onClick={()=>void startScanner()}><Icon name="scan" size={22}/>{scanning?'Scanner is open…':'Start automatic scanner'}<Icon name="arrow" size={19}/></button>
        {!native&&<label className="st-file-fallback">Preview an image in the browser<input type="file" accept="image/jpeg,image/png" onChange={importImage}/></label>}
        <div className="st-hero-foot"><span><Icon name="shield" size={15}/> Private on-device scans</span><span><Icon name="layers" size={15}/> Up to 10 pages per session</span></div>
      </section>
      <section className="st-instructions" aria-label="Scanner instructions">
        <div className="st-step"><span>01</span><div><strong>Place the OMR page</strong><small>Keep the sheet flat, fully visible and well-lit.</small></div></div>
        <div className="st-step"><span>02</span><div><strong>Automatic edge and corner detection</strong><small>Wait for the native scanner to capture, or adjust the corners manually.</small></div></div>
        <div className="st-step"><span>03</span><div><strong>Confirm to save privately</strong><small>Saved pages appear below, even after reopening AZM Scan.</small></div></div>
      </section>
      <section className="st-library" aria-label="Scanner test captures">
        <div className="st-heading"><div><h2>Captured pages</h2><p>Private app storage — no dashboard, no grading</p></div><span className="st-count">{pages.length} / 40</span></div>
        {error&&<div role="alert" className="st-error"><Icon name="warning" size={18}/>{error}</div>}
        <div role="status" className="st-message">{message}</div>
        {!pages.length?<div className="st-empty"><Icon name="file" size={34}/><strong>No scanned pages yet</strong><p>Tap Start automatic scanner to begin.</p></div>:
        <><div className="st-thumbnails">{pages.map((page,i)=><button type="button" key={page.id} className={'st-thumb'+(chosen?.id===page.id?' active':'')} onClick={()=>setSelected(page.id)} aria-label={'View captured page '+(i+1)}><img src={page.uri} alt="" loading="lazy"/><span>Page {pages.length-i}</span></button>)}</div>
        {chosen&&<div className="st-preview"><div className="st-preview-bar"><strong>Saved scanner image</strong><span>{chosen.width} × {chosen.height} px</span></div><img src={chosen.uri} alt="Selected OMR scan" className="st-preview-image"/><div className="st-meta"><span>{mb(chosen.size)}</span><span>{when(chosen.createdAt)}</span></div>{nativeScanResolutionAdvisory(chosen.width,chosen.height)&&<p role="status" className="st-message st-image-quality-note">{nativeScanResolutionAdvisory(chosen.width,chosen.height)}</p>}<div className="st-preview-actions"><button type="button" disabled={!native||scanning||pages.length>=40} onClick={()=>void startScanner()}><Icon name="scan" size={18}/> Scan another</button><button type="button" className="st-read-mcqs" onClick={()=>{setServerPanel(true);document.getElementById('omr-test-results')?.scrollIntoView({behavior:'smooth',block:'start'});}}><Icon name="review" size={17}/> View MCQs &amp; marks</button><button type="button" className="st-delete" onClick={()=>void deletePage(chosen)}><Icon name="close" size={17}/> Delete image</button></div></div>}
        </>}
      </section>
      <section className="st-api-zone" id="omr-test-results">
        <button type="button" className="st-api-toggle" aria-expanded={serverPanel} onClick={()=>setServerPanel(v=>!v)}><Icon name="wifi" size={18}/><span><strong>Read MCQs &amp; marks</strong><small>Recognize the selected saved photo using the isolated OMR backend</small></span><Icon name="chevron" size={17}/></button>
        {serverPanel&&<div className="st-api-panel">
          {!staff?<form onSubmit={login}><label>API origin<input type="url" required value={api} onChange={e=>setApi(e.target.value)}/></label><label>Staff email<input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Password<input type="password" required value={password} onChange={e=>setPassword(e.target.value)}/></label><button className="st-secondary" type="submit" disabled={authBusy}>{authBusy?'Connecting…':'Connect authorized tester'}</button></form>:
          <><div className="st-connected"><Icon name="check" size={18}/><strong>{staff.name}</strong><button type="button" onClick={()=>{session.logout();setStaff(null);setExams([]);setPageBatches({});}}>Sign out</button></div>
          <label>Examination<select value={examId} onChange={e=>setExamId(e.target.value)}>{assigned.map(x=><option key={x.id} value={x.id}>{x.code} — {x.title}</option>)}</select></label>
          <button className="st-secondary" type="button" disabled={!chosen||!exam||transfer} onClick={()=>void upload()}>{transfer?'Sending image…':'Recognize this page & view 100 MCQs'}</button>
          {chosen&&pageBatches[chosen.id]&&exam&&<ScanEvaluation key={chosen.id+':'+pageBatches[chosen.id].id} client={session.client} initialBatch={pageBatches[chosen.id]} exam={exam} role={staff.role}/>}</>}
          {batchError&&<div role="alert" className="st-error">{batchError}</div>}
          <p className="st-small-note">The scanner returns recognized A–D/blank/multiple/uncertain responses. Backend draft marks require a matching approved key and verified identity. Administrators may optionally enter a local test-only key. Nothing is published.</p>
        </div>}
      </section>
      <p className="st-foot"><Icon name="lock" size={16}/> Scanner-only development build. No production database changes or official score publication.</p>
    </div>
  </main>;
}
