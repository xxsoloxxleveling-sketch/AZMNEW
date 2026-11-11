import React,{useEffect,useRef,useState} from 'react';
import { CameraCapture } from './CameraCapture';
import { optimizeCapture,formatMegabytes,OptimizedCapture,inspectOmrImage,OmrImageInspection } from './capture-quality';
import { OmrClient,Batch } from './contracts';
export function UploadPanel({client,examId,bulk=false,mobile=false,onAccepted}:{client:OmrClient;examId:string;bulk?:boolean;mobile?:boolean;onAccepted:(batch:Batch)=>void}) {
  const [files,setFiles]=useState<File[]>([]),[preview,setPreview]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[progress,setProgress]=useState('');
  const [online,setOnline]=useState(navigator.onLine);const input=useRef<HTMLInputElement>(null),selection=useRef(0);
  const [compression,setCompression]=useState<OptimizedCapture|null>(null),[preparing,setPreparing]=useState(false);
  const [inspection,setInspection]=useState<OmrImageInspection|null>(null),[inspecting,setInspecting]=useState(false);
  useEffect(()=>{let url='';const file=files[0];if(file?.type.startsWith('image/')){url=URL.createObjectURL(file);setPreview(url);}else setPreview('');return()=>{if(url)URL.revokeObjectURL(url);};},[files]);
  useEffect(()=>{const change=()=>setOnline(navigator.onLine);window.addEventListener('online',change);window.addEventListener('offline',change);return()=>{window.removeEventListener('online',change);window.removeEventListener('offline',change);};},[]);
  useEffect(()=>{
    const file=mobile&&!bulk&&files.length===1&&files[0].type.startsWith('image/')?files[0]:null;
    if(!file){setInspection(null);setInspecting(false);return;}
    let cancelled=false;setInspection(null);setInspecting(true);
    void inspectOmrImage(file).then(
      value=>{if(!cancelled)setInspection(value);},
      ()=>{if(!cancelled)setInspection({width:0,height:0,problem:'Cannot verify photo resolution. Use the camera to retake the sheet.'});}
    ).finally(()=>{if(!cancelled)setInspecting(false);});
    return()=>{cancelled=true;};
  },[files,mobile,bulk]);
  async function chooseFiles(chosen:File[]) {
    const ticket=++selection.current;setError('');setProgress('');setCompression(null);
    if(!mobile||bulk||chosen.length!==1||!chosen[0].type.startsWith('image/')){setFiles(chosen);return;}
    setPreparing(true);setProgress('Preparing camera image for upload…');
    try {
      const source=chosen[0],result=await optimizeCapture(source);
      if(ticket!==selection.current)return;
      const image=result.changed?new File([result.blob],source.name.replace(/\\.[^.]+$/, '')+'.jpg',{type:'image/jpeg',lastModified:source.lastModified}):source;
      setFiles([image]);setCompression(result);setProgress('');
    }catch(problem){if(ticket===selection.current){setFiles(chosen);setError('Could not optimize the image; the original is retained for upload.');setProgress('');}}
    finally{if(ticket===selection.current)setPreparing(false);}
  }
  async function submit() {
    if(!online||!files.length||preparing||busy)return;
    setBusy(true);setError('');const failed:File[]=[];
    try {
      for(let index=0;index<files.length;index++) {
        const file=files[index];setProgress(`Uploading ${index+1} of ${files.length}`);
        try {
          if(file.size>20*1024*1024)throw new Error('Each upload must be 20 MB or smaller');
          if(!['image/png','image/jpeg','application/pdf'].includes(file.type))throw new Error('Choose a JPEG, PNG or PDF file');
          if(mobile&&file.type.startsWith('image/')){
            const checked=await inspectOmrImage(file);
            if(checked.problem)throw new Error(checked.problem);
          }
          const batch=await client.upload(examId,file,mobile?'mobile':'web');onAccepted(batch);
        }catch(problem){failed.push(file);setError(problem instanceof Error?problem.message:'Upload failed. The image remains in memory for retry.');}
      }
      setFiles(failed);if(input.current)input.current.value='';setProgress(failed.length?`${files.length-failed.length} queued; ${failed.length} need retry`:`${files.length} upload${files.length===1?'':'s'} queued for processing`);
    }finally{setBusy(false);}
  }
  return <section aria-label={bulk?'Bulk OMR upload':'Single OMR upload'} className="space-y-4">
    {!bulk&&<CameraCapture disabled={busy||preparing} onCapture={(file,details)=>{selection.current++;setFiles([file]);setCompression(details);setError('');setProgress('');}}/>}
    <label className="omr-field">{bulk?'Select images or a multi-page PDF':'Choose a captured image or PDF'}<input ref={input} type="file" accept="image/jpeg,image/png,application/pdf" multiple={bulk} disabled={busy||preparing} onChange={event=>{void chooseFiles(Array.from(event.target.files||[]));}}/></label>
    <p className="text-xs text-slate-500">JPEG, PNG or PDF. Up to 20 MB and 25 PDF pages per file. Mobile photos must have at least 1600 pixels on the shorter side; use the original camera image. Large photos are compressed without reducing normal 12 MP resolution. PDF processing requires the isolated renderer.</p>
    {preview&&<div><img src={preview} alt="Captured OMR preview before upload" className="max-h-[55vh] max-w-full border border-slate-300 rounded-lg"/><button type="button" className="omr-button mt-2" disabled={busy} onClick={()=>{selection.current++;setFiles([]);setCompression(null);setPreparing(false);if(input.current)input.current.value='';}}>Retake or choose again</button></div>}
    {files.length>0&&<p className="text-sm">{files.length} file{files.length===1?'':'s'} ready · {formatMegabytes(files.reduce((total,file)=>total+file.size,0))}</p>}
    {mobile&&inspecting&&<p role="status" className="text-sm">Checking actual saved-image resolution…</p>}
    {mobile&&inspection?.problem&&<p role="alert" className="omr-notice omr-error">{inspection.problem} Upload is blocked until you select a sufficiently detailed photo.</p>}
    {mobile&&inspection&&!inspection.problem&&<p role="status" className="text-xs text-emerald-700">Image dimensions verified: {inspection.width} × {inspection.height} pixels. Keep all four black markers and a clear border around the page.</p>}
    {compression?.changed&&<p className="text-sm text-emerald-700" role="status">Image optimized: {formatMegabytes(compression.inputBytes)} → {formatMegabytes(compression.outputBytes)} ({Math.round(100*(1-compression.outputBytes/compression.inputBytes))}% smaller){compression.outputWidth&&compression.outputHeight?` · ${compression.outputWidth} × ${compression.outputHeight} pixels`:''}. Review the photo before uploading.</p>}
    {compression&&!compression.changed&&compression.inputBytes>3*1024*1024&&<p className="text-xs text-amber-700">Original retained: safe compression was unavailable or could reduce image readability.</p>}
    {error&&<p role="alert" className="omr-notice omr-error">{error} Retry while this screen remains open; offline images are not saved.</p>}
    <div className="flex items-center gap-3"><button type="button" className="omr-primary" disabled={busy||preparing||inspecting||!!inspection?.problem||!online||!files.length} onClick={submit}>{busy?'Uploading…':'Upload for processing'}</button><span role="status" className="text-sm">{progress}</span></div>
    {!online&&<p role="status" className="omr-notice">Offline capture and storage are disabled. Connect before uploading.</p>}
  </section>;
}
