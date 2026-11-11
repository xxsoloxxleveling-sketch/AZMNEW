import React,{useEffect,useRef,useState} from 'react';
import {captureStill,resolutionGuidance,optimizeCapture,OptimizedCapture} from './capture-quality';
interface Props {onCapture:(file:File,details:OptimizedCapture)=>void;disabled?:boolean;mode?:'page'|'identity-detail'}
export function CameraCapture({onCapture,disabled,mode='page'}:Props) {
  const video=useRef<HTMLVideoElement>(null),stream=useRef<MediaStream|null>(null),generation=useRef(0);
  const [active,setActive]=useState(false),[error,setError]=useState(''),[warning,setWarning]=useState('');
  const [online,setOnline]=useState(navigator.onLine);
  const [capturing,setCapturing]=useState(false),[optimizing,setOptimizing]=useState(false),[resolution,setResolution]=useState('');
  const stop=()=>{generation.current++;stream.current?.getTracks().forEach(track=>track.stop());stream.current=null;if(video.current){video.current.pause();video.current.srcObject=null;}setActive(false);setCapturing(false);};
  useEffect(()=>{
    const change=()=>setOnline(navigator.onLine);window.addEventListener('online',change);window.addEventListener('offline',change);
    return()=>{generation.current++;stream.current?.getTracks().forEach(track=>track.stop());if(video.current)video.current.srcObject=null;window.removeEventListener('online',change);window.removeEventListener('offline',change);};
  },[]);
  useEffect(()=>{if(!online||disabled)stop();},[online,disabled]);
  useEffect(()=>{
    if(!active) return;
    const timer=setInterval(()=>{
      const element=video.current;if(!element?.videoWidth)return;
      const canvas=document.createElement('canvas');canvas.width=240;canvas.height=180;
      const context=canvas.getContext('2d',{willReadFrequently:true});if(!context)return;
      context.drawImage(element,0,0,240,180);const data=context.getImageData(0,0,240,180).data;
      const gray=new Float32Array(240*180);let sum=0,bright=0;
      for(let p=0;p<gray.length;p++){const value=.299*data[p*4]+.587*data[p*4+1]+.114*data[p*4+2];gray[p]=value;sum+=value;if(value>252)bright++;}
      let edges=0;for(let y=1;y<179;y++)for(let x=1;x<239;x++){const p=y*240+x;const value=gray[p-1]+gray[p+1]+gray[p-240]+gray[p+240]-4*gray[p];edges+=value*value;}
      const warnings:string[]=[];
      setResolution(resolutionGuidance(element.videoWidth,element.videoHeight));
      if(sum/gray.length<65)warnings.push('More light is needed');
      else if(edges/(238*178)<35)warnings.push('Hold still and check focus');
      else if(sum/gray.length<230&&bright/gray.length>.25)warnings.push('Check reflections and uneven lighting');
      setWarning(warnings.join(' · '));
    },750);return()=>clearInterval(timer);
  },[active]);
  async function start() {
    const ticket=++generation.current;setError('');try{
      if(!navigator.mediaDevices?.getUserMedia)throw new Error('Camera access requires a supported browser and a secure connection');
      const camera=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:3840},height:{ideal:2880}},audio:false});
      if(ticket!==generation.current){camera.getTracks().forEach(track=>track.stop());return;}
      stream.current=camera;setActive(true);
      if(video.current){video.current.srcObject=camera;await video.current.play();}
    }catch(reason){if(ticket===generation.current){stop();setError(reason instanceof Error?reason.message:'Camera permission was not granted');}}
  }
  async function capture() {
    const element=video.current,track=stream.current?.getVideoTracks()[0];if(!element?.videoWidth||!online||!track||capturing)return;
    setCapturing(true);setError('');setOptimizing(false);
    const ticket=generation.current;
    try {
      const blob=await captureStill(track,()=>new Promise(resolve=>{
        const canvas=document.createElement('canvas');canvas.width=element.videoWidth;canvas.height=element.videoHeight;
        const context=canvas.getContext('2d');if(!context){resolve(null);return;}
        context.drawImage(element,0,0);canvas.toBlob(value=>{canvas.width=0;canvas.height=0;resolve(value);},'image/jpeg',.98);
      }));
      if(ticket!==generation.current)return;
      if(!blob)throw new Error('No image was captured. Try again or choose the original camera photo.');
      setOptimizing(true);
      const result=mode==='page'?await optimizeCapture(blob):{blob,inputBytes:blob.size,outputBytes:blob.size,inputWidth:null,inputHeight:null,outputWidth:null,outputHeight:null,changed:false,quality:null};
      if(ticket!==generation.current)return;
      const uploaded=result.blob;
      // The disposable Android device observer tracks sensor-byte → upload-byte identity.
      // Never emit image bytes, identifiers, keys, or credentials in diagnostics.
      if((globalThis as typeof globalThis & {__azmDeviceAcceptance?:unknown}).__azmDeviceAcceptance&&crypto?.subtle){
        try{
          const sha=async(value:Blob)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await value.arrayBuffer()))).map(byte=>byte.toString(16).padStart(2,'0')).join('');
          const originalSha256=await sha(blob),uploadSha256=uploaded===blob?originalSha256:await sha(uploaded);
          if(ticket!==generation.current)return;
          window.dispatchEvent(new CustomEvent('azm-omr-capture-exported',{detail:{capturePurpose:mode,originalSha256,uploadSha256,originalBytes:blob.size,uploadBytes:uploaded.size,changed:result.changed}}));
        }catch{/* Diagnostic hashing must never prevent a legitimate camera capture. */}
      }
      onCapture(new File([uploaded],uploaded.type==='image/png'?'omr-capture.png':'omr-capture.jpg',{type:uploaded.type}),result);stop();
    }catch(reason){if(ticket===generation.current)setError(reason instanceof Error?reason.message:'Capture failed. Try again.');}
    finally{if(ticket===generation.current){setCapturing(false);setOptimizing(false);}}
  }
  return <section className="omr-camera" aria-label={mode==='identity-detail'?'Identity detail camera capture':'OMR camera capture'}>
    {!online&&<p role="status">Connect to the internet before capturing. Offline image storage is disabled.</p>}
    {error&&<p role="alert" className="text-red-700">{error}</p>}
    <div className={active?'relative overflow-hidden rounded-lg bg-slate-950':'hidden'}>
      <video ref={video} autoPlay muted playsInline className="w-full max-h-[65vh] object-contain" aria-label="Live camera preview" data-omr-capture-purpose={mode}/>
      <div aria-hidden="true" className={`pointer-events-none absolute border border-white/50 rounded-sm ${mode==='page'?'inset-y-[8%] left-[22%] right-[22%]':'inset-y-[25%] left-[8%] right-[8%]'}`}>{['top-0 left-0 border-t-4 border-l-4','top-0 right-0 border-t-4 border-r-4','bottom-0 left-0 border-b-4 border-l-4','bottom-0 right-0 border-b-4 border-r-4'].map(position=><span key={position} className={`absolute h-6 w-6 border-white ${position}`}/>)}</div>
    </div>
    {active?<><p className="text-sm my-2">{mode==='identity-detail'?'Frame the QR and complete printed roll together on the same sheet. Move closer without cutting off either region; keep the camera parallel and check focus.':'Fit the ENTIRE A4 page and all four black corner squares inside the guide. Leave visible background around EVERY page edge (ideally 5–10% of the photo width), especially on the right. Flatten the sheet, tap to focus and keep the camera parallel.'}</p><p className="text-sm my-2">{resolution}</p><p role="status" className="text-sm text-amber-700 min-h-5">{warning}</p><div className="flex gap-2"><button type="button" className="omr-primary" onClick={capture} disabled={disabled||!online||capturing}>{optimizing?'Optimizing photo…':capturing?'Capturing…':mode==='identity-detail'?'Capture identity detail':'Capture sheet'}</button><button type="button" className="omr-button" onClick={stop}>Close camera</button></div><p className="text-xs text-slate-500 mt-2">The camera prefers full-resolution sensor stills. Large page images are carefully JPEG-compressed before upload to save data while preserving small QR and bubble detail. If optimization fails, the original is retained. The server verifies every scan.</p></>:<button type="button" className="omr-button" onClick={start} disabled={disabled||!online||capturing}>Open camera</button>}
  </section>;
}
