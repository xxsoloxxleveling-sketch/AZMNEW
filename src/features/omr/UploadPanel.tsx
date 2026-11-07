import React,{useEffect,useRef,useState} from 'react';
import { CameraCapture } from './CameraCapture';
import { OmrClient,Batch } from './contracts';
export function UploadPanel({client,examId,bulk=false,mobile=false,onAccepted}:{client:OmrClient;examId:string;bulk?:boolean;mobile?:boolean;onAccepted:(batch:Batch)=>void}) {
  const [files,setFiles]=useState<File[]>([]),[preview,setPreview]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[progress,setProgress]=useState('');
  const [online,setOnline]=useState(navigator.onLine);const input=useRef<HTMLInputElement>(null);
  useEffect(()=>{let url='';const file=files[0];if(file?.type.startsWith('image/')){url=URL.createObjectURL(file);setPreview(url);}else setPreview('');return()=>{if(url)URL.revokeObjectURL(url);};},[files]);
  useEffect(()=>{const change=()=>setOnline(navigator.onLine);window.addEventListener('online',change);window.addEventListener('offline',change);return()=>{window.removeEventListener('online',change);window.removeEventListener('offline',change);};},[]);
  async function submit() {
    if(!online||!files.length)return;
    setBusy(true);setError('');const failed:File[]=[];
    try {
      for(let index=0;index<files.length;index++) {
        const file=files[index];setProgress(`Uploading ${index+1} of ${files.length}`);
        try {
          if(file.size>20*1024*1024)throw new Error('Each upload must be 20 MB or smaller');
          if(!['image/png','image/jpeg','application/pdf'].includes(file.type))throw new Error('Choose a JPEG, PNG or PDF file');
          const batch=await client.upload(examId,file,mobile?'mobile':'web');onAccepted(batch);
        }catch(problem){failed.push(file);setError(problem instanceof Error?problem.message:'Upload failed. The image remains in memory for retry.');}
      }
      setFiles(failed);if(input.current)input.current.value='';setProgress(failed.length?`${files.length-failed.length} queued; ${failed.length} need retry`:`${files.length} upload${files.length===1?'':'s'} queued for processing`);
    }finally{setBusy(false);}
  }
  return <section aria-label={bulk?'Bulk OMR upload':'Single OMR upload'} className="space-y-4">
    {!bulk&&<CameraCapture disabled={busy} onCapture={file=>{setFiles([file]);setError('');setProgress('');}}/>}
    <label className="omr-field">{bulk?'Select images or a multi-page PDF':'Choose a captured image or PDF'}<input ref={input} type="file" accept="image/jpeg,image/png,application/pdf" multiple={bulk} disabled={busy} onChange={event=>{setFiles(Array.from(event.target.files||[]));setError('');setProgress('');}}/></label>
    <p className="text-xs text-slate-500">JPEG, PNG or PDF. Up to 20 MB and 25 PDF pages per file. PDF processing requires the isolated renderer. Original files remain private.</p>
    {preview&&<div><img src={preview} alt="Captured OMR preview before upload" className="max-h-[55vh] max-w-full border border-slate-300 rounded-lg"/><button type="button" className="omr-button mt-2" disabled={busy} onClick={()=>setFiles([])}>Retake or choose again</button></div>}
    {files.length>0&&<p className="text-sm">{files.length} file{files.length===1?'':'s'} ready · {(files.reduce((total,file)=>total+file.size,0)/1024/1024).toFixed(1)} MB</p>}
    {error&&<p role="alert" className="omr-notice omr-error">{error} Retry while this screen remains open; offline images are not saved.</p>}
    <div className="flex items-center gap-3"><button type="button" className="omr-primary" disabled={busy||!online||!files.length} onClick={submit}>{busy?'Uploading…':'Upload for processing'}</button><span role="status" className="text-sm">{progress}</span></div>
    {!online&&<p role="status" className="omr-notice">Offline capture and storage are disabled. Connect before uploading.</p>}
  </section>;
}
