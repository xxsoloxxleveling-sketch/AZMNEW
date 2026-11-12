import React,{useEffect,useRef,useState} from 'react';
import {captureStill,resolutionGuidance,optimizeCapture,OptimizedCapture,inspectOmrImage} from './capture-quality';
import {detectPage,nextStability,PageDetection,Stability,Quad} from './page-detection';

interface Props {onCapture:(file:File,details:OptimizedCapture,automatic?:boolean)=>void;disabled?:boolean;blocked?:boolean;continuous?:boolean;mode?:'page'|'identity-detail'}
const sampleWidth=180;
export function CameraCapture({onCapture,disabled,blocked=false,continuous=false,mode='page'}:Props) {
 const video=useRef<HTMLVideoElement>(null),stream=useRef<MediaStream|null>(null),generation=useRef(0),captureLock=useRef(false);
 const stability=useRef<Stability|null>(null),autoEnabledRef=useRef(true),armed=useRef(true),missingReadings=useRef(0);
 const [active,setActive]=useState(false),[error,setError]=useState(''),[warning,setWarning]=useState(''),[resolution,setResolution]=useState('');
 const [online,setOnline]=useState(navigator.onLine),[capturing,setCapturing]=useState(false),[optimizing,setOptimizing]=useState(false);
 const [autoEnabled,setAutoEnabled]=useState(mode==='page'),[sensed,setSensed]=useState<PageDetection|null>(null),[stabilization,setStabilization]=useState('Point at a flat page'),[videoDimensions,setVideoDimensions]=useState({width:0,height:0});
 const [torch,setTorch]=useState(false);
 const stop=()=>{
  generation.current++;captureLock.current=false;stability.current=null;armed.current=true;missingReadings.current=0;
  stream.current?.getTracks().forEach(track=>track.stop());stream.current=null;
  if(video.current){video.current.pause();video.current.srcObject=null;}
  setActive(false);setCapturing(false);setOptimizing(false);setSensed(null);setVideoDimensions({width:0,height:0});
 };
 useEffect(()=>{autoEnabledRef.current=autoEnabled;stability.current=null;},[autoEnabled]);
 useEffect(()=>{
  const update=()=>setOnline(navigator.onLine);
  window.addEventListener('online',update);window.addEventListener('offline',update);
  return()=>{generation.current++;stream.current?.getTracks().forEach(track=>track.stop());if(video.current)video.current.srcObject=null;window.removeEventListener('online',update);window.removeEventListener('offline',update);};
 },[]);
 useEffect(()=>{if(!online||disabled)stop();},[online,disabled]);
 useEffect(()=>{
  if(!active||mode!=='page')return;
  let cancelled=false;
  const canvas=document.createElement('canvas');
  const step=()=>{
   const element=video.current;
   if(cancelled||!element||!element.videoWidth||captureLock.current||!stream.current)return;
   const sourceWidth=element.videoWidth,sourceHeight=element.videoHeight;
   const width=sampleWidth,height=Math.max(100,Math.round(sourceHeight/sourceWidth*width));
   if(width*height>110000)return;
   canvas.width=width;canvas.height=height;
   const ctx=canvas.getContext('2d',{willReadFrequently:true,alpha:false});if(!ctx)return;
   try {
    ctx.drawImage(element,0,0,width,height);
    const data=ctx.getImageData(0,0,width,height);
    const detection=detectPage(data);
    if(!armed.current){
     if(!detection.corners)missingReadings.current++;else missingReadings.current=0;
     if(missingReadings.current>=3){armed.current=true;stability.current=null;missingReadings.current=0;}
     else {setSensed(detection);setStabilization('Remove the scanned sheet before presenting the next one');return;}
    }
    const next=nextStability(stability.current,detection,performance.now());
    stability.current=next;setSensed(detection);setStabilization(next.message);
    setVideoDimensions({width:sourceWidth,height:sourceHeight});
    setResolution(resolutionGuidance(sourceWidth,sourceHeight));
    if(detection.corners&&detection.focus<19){setWarning('Image edge contrast is weak. Improve lighting and tap to focus.');stability.current=null;return;}
    setWarning('');
    if(next.ready&&autoEnabledRef.current&&navigator.onLine&&!blocked&&armed.current){void capture(true);}
   }catch{stability.current=null;setStabilization('Cannot analyze preview. Use manual capture.');}
  };
  const timer=setInterval(step,350);step();
  return()=>{cancelled=true;clearInterval(timer);canvas.width=0;canvas.height=0;};
 },[active,mode,blocked]);
 async function start(){
  const ticket=++generation.current;setError('');setWarning('');stability.current=null;armed.current=true;missingReadings.current=0;
  try{
   if(!navigator.mediaDevices?.getUserMedia)throw new Error('Camera access requires a supported browser and a secure connection');
   const media=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:3840},height:{ideal:2880}},audio:false});
   if(ticket!==generation.current){media.getTracks().forEach(track=>track.stop());return;}
   stream.current=media;setActive(true);
   if(video.current){video.current.srcObject=media;await video.current.play();}
  }catch(reason){if(ticket===generation.current){stop();setError(reason instanceof Error?reason.message:'Camera permission denied.');}}
 }
 async function toggleTorch(){
  const track=stream.current?.getVideoTracks()[0];if(!track)return;
  try {
   const next=!torch;
   const capabilities=track.getCapabilities?.() as MediaTrackCapabilities & {torch?:boolean};
   if(!capabilities?.torch){setError('Flashlight control is not supported on this camera.');return;}
   await track.applyConstraints({advanced:[{torch:next} as MediaTrackConstraintSet]});
   setTorch(next);setError('');
  }catch{setError('This camera could not change its flashlight setting.');}
 }
 async function capture(automatic=false){
  const element=video.current,track=stream.current?.getVideoTracks()[0];
  if(!element?.videoWidth||!online||!track||captureLock.current||disabled||blocked)return;
  captureLock.current=true;setCapturing(true);setOptimizing(false);setError('');
  const ticket=generation.current;
  try{
   const blob=await captureStill(track,()=>new Promise(resolve=>{
    const canvas=document.createElement('canvas');canvas.width=element.videoWidth;canvas.height=element.videoHeight;
    const ctx=canvas.getContext('2d');if(!ctx){resolve(null);return;}
    ctx.drawImage(element,0,0);canvas.toBlob(value=>{canvas.width=0;canvas.height=0;resolve(value);},'image/jpeg',.96);
   }));
   if(ticket!==generation.current)return;
   if(!blob)throw Error('No image was captured. Hold the tablet steady and retry.');
   setOptimizing(true);
   const optimized=mode==='page'?await optimizeCapture(blob):{blob,inputBytes:blob.size,outputBytes:blob.size,inputWidth:null,inputHeight:null,outputWidth:null,outputHeight:null,changed:false,quality:null};
   if(ticket!==generation.current)return;
   const image=optimized.blob;
   if(mode==='page'){
    const checked=await inspectOmrImage(image);
    if(checked.problem)throw Error(checked.problem);
   }
   if((globalThis as typeof globalThis&{__azmDeviceAcceptance?:unknown}).__azmDeviceAcceptance&&crypto?.subtle){
    try{
     const sha=async(value:Blob)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await value.arrayBuffer()))).map(b=>b.toString(16).padStart(2,'0')).join('');
     const originalSha256=await sha(blob),uploadSha256=image===blob?originalSha256:await sha(image);
     if(ticket!==generation.current)return;
     window.dispatchEvent(new CustomEvent('azm-omr-capture-exported',{detail:{capturePurpose:mode,originalSha256,uploadSha256,originalBytes:blob.size,uploadBytes:image.size,changed:optimized.changed}}));
    }catch{/* Diagnostic failure must never alter image processing. */}
   }
   if(continuous&&automatic){armed.current=false;missingReadings.current=0;stability.current=null;setStabilization('Remove this sheet before scanning the next');}
   onCapture(new File([image],image.type==='image/png'?'omr-capture.png':'omr-capture.jpg',{type:image.type}),optimized,automatic);
   if(!continuous||!automatic)stop();
  }catch(problem){
   if(ticket===generation.current){
    setError(problem instanceof Error?problem.message:'Could not capture the sheet.');
    stability.current=null;setStabilization('Retake the sheet after checking its focus and page edges.');
    captureLock.current=false;
   }
  }finally{if(ticket===generation.current){setCapturing(false);setOptimizing(false);captureLock.current=false;}}
 }
 const points=sensed?.corners;
 const polygon=(corners:Quad)=>corners.map(p=>(p.x*videoDimensions.width)+','+(p.y*videoDimensions.height)).join(' ');
 return <section className="omr-camera" aria-label={mode==='identity-detail'?'Identity detail camera capture':'OMR camera capture'}>
  {!online&&<p role="status">Internet connection required. Offline image storage is disabled.</p>}
  {error&&<p role="alert" className="text-red-700">{error}</p>}
  <div className={active?'relative overflow-hidden rounded-lg bg-slate-950':'hidden'} style={{position:'relative'}}>
   <video ref={video} autoPlay muted playsInline className="w-full max-h-[65vh] object-contain" aria-label="Live camera preview" data-omr-capture-purpose={mode}/>
   {mode==='page'&&videoDimensions.width>0&&<svg aria-hidden="true" className="azm-auto-corners" viewBox={'0 0 '+videoDimensions.width+' '+videoDimensions.height} preserveAspectRatio="xMidYMid meet">
    {points&&<polygon data-testid="detected-page-corners" points={polygon(points)} stroke={stability.current?.ready?'#55f9b3':'#29e1ff'} strokeWidth={Math.max(7,videoDimensions.width*.003)} fill={stability.current?.ready?'#00b89422':'#11d8ff12'} strokeLinejoin="round"/>}
    {points&&points.map((p,i)=><circle key={i} cx={p.x*videoDimensions.width} cy={p.y*videoDimensions.height} r={Math.max(13,videoDimensions.width*.006)} fill="#29e1ff" stroke="white" strokeWidth={Math.max(3,videoDimensions.width*.0015)}/>)}
   </svg>}
   {!points&&<div aria-hidden="true" className="azm-manual-frame"><span/><span/><span/><span/></div>}
   {mode==='page'&&active&&<div className="azm-auto-status" role="status"><span className={points?'azm-auto-dot is-found':'azm-auto-dot'}/>{capturing?'Taking full-resolution photo…':blocked?'Uploading previous sheet — keep camera open':autoEnabled?stabilization:'Manual mode — automatic capture paused'}</div>}
  </div>
  {active?<div className="azm-camera-controls">
    {mode==='page'&&<label className="azm-autoscan-toggle"><input type="checkbox" checked={autoEnabled} disabled={capturing} onChange={event=>setAutoEnabled(event.target.checked)}/><span>Auto-detect &amp; capture</span><small>Holds for 1.25 seconds on a stable page</small></label>}
    <p className="text-sm my-2">{mode==='identity-detail'?'Frame the printed QR and complete roll together.':'Keep all four black registration squares and the full A4 sheet visible. For reliable automatic capture, use a darker contrasting background and even lighting.'}</p>
    <p className="text-sm my-2">{resolution}</p>
    {warning&&<p role="status" className="text-sm text-amber-700 min-h-5">{warning}</p>}
    <div className="azm-camera-buttons">
     <button type="button" className="omr-primary" onClick={()=>void capture(false)} disabled={disabled||blocked||!online||capturing}>{optimizing?'Optimizing…':capturing?'Capturing…':mode==='identity-detail'?'Capture QR detail':'Manual shutter'}</button>
     <button type="button" className="omr-button" onClick={()=>void toggleTorch()} disabled={!active||capturing}>{torch?'Flash off':'Flash'}</button>
     <button type="button" className="omr-button" onClick={stop}>Close camera</button>
    </div>
    <p className="text-xs text-slate-500 mt-2">Automatic capture is a preview-based framing aid, not verified recognition. High-resolution photos are optimized before upload, and the server independently checks every paper and mark.</p>
   </div>:<button type="button" className="omr-button" onClick={()=>void start()} disabled={disabled||!online||capturing}>Open camera</button>}
 </section>;
}
