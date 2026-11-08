import React,{useEffect,useRef,useState} from 'react';
interface Props {onCapture:(file:File)=>void;disabled?:boolean}
export function CameraCapture({onCapture,disabled}:Props) {
  const video=useRef<HTMLVideoElement>(null),stream=useRef<MediaStream|null>(null),generation=useRef(0);
  const [active,setActive]=useState(false),[error,setError]=useState(''),[warning,setWarning]=useState('');
  const [online,setOnline]=useState(navigator.onLine);
  const stop=()=>{generation.current++;stream.current?.getTracks().forEach(track=>track.stop());stream.current=null;if(video.current){video.current.pause();video.current.srcObject=null;}setActive(false);};
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
      if(Math.min(element.videoWidth,element.videoHeight)<1200)warnings.push('Use the highest camera quality; low-resolution images may need review');
      if(sum/gray.length<65)warnings.push('More light is needed');
      else if(edges/(238*178)<35)warnings.push('Hold still and check focus');
      else if(sum/gray.length<230&&bright/gray.length>.25)warnings.push('Check reflections and uneven lighting');
      setWarning(warnings.join(' · '));
    },750);return()=>clearInterval(timer);
  },[active]);
  async function start() {
    const ticket=++generation.current;setError('');try{
      if(!navigator.mediaDevices?.getUserMedia)throw new Error('Camera access requires a supported browser and a secure connection');
      const camera=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:2560},height:{ideal:1920}},audio:false});
      if(ticket!==generation.current){camera.getTracks().forEach(track=>track.stop());return;}
      stream.current=camera;setActive(true);
      if(video.current){video.current.srcObject=camera;await video.current.play();}
    }catch(reason){if(ticket===generation.current){stop();setError(reason instanceof Error?reason.message:'Camera permission was not granted');}}
  }
  function capture() {
    const element=video.current;if(!element?.videoWidth||!online)return;
    const canvas=document.createElement('canvas');canvas.width=element.videoWidth;canvas.height=element.videoHeight;
    canvas.getContext('2d')?.drawImage(element,0,0);
    const ticket=generation.current;
    canvas.toBlob(blob=>{canvas.width=0;canvas.height=0;if(blob&&ticket===generation.current){onCapture(new File([blob],'omr-capture.jpg',{type:'image/jpeg'}));stop();}},'image/jpeg',.95);
  }
  return <section className="omr-camera" aria-label="OMR camera capture">
    {!online&&<p role="status">Connect to the internet before capturing. Offline image storage is disabled.</p>}
    {error&&<p role="alert" className="text-red-700">{error}</p>}
    <div className={active?'relative overflow-hidden rounded-lg bg-slate-950':'hidden'}>
      <video ref={video} autoPlay muted playsInline className="w-full max-h-[65vh] object-contain" aria-label="Live camera preview"/>
      <div aria-hidden="true" className="pointer-events-none absolute inset-y-[8%] left-[22%] right-[22%] border border-white/50 rounded-sm">{['top-0 left-0 border-t-4 border-l-4','top-0 right-0 border-t-4 border-r-4','bottom-0 left-0 border-b-4 border-l-4','bottom-0 right-0 border-b-4 border-r-4'].map(position=><span key={position} className={`absolute h-6 w-6 border-white ${position}`}/>)}</div>
    </div>
    {active?<><p className="text-sm my-2">Fit the whole page and all four black corner markers inside the guide, leaving a small margin. Flatten the sheet and keep the camera parallel to it. If opposite edges converge, adjust the camera angle.</p><p role="status" className="text-sm text-amber-700 min-h-5">{warning}</p><div className="flex gap-2"><button type="button" className="omr-primary" onClick={capture} disabled={disabled||!online}>Capture sheet</button><button type="button" className="omr-button" onClick={stop}>Close camera</button></div><p className="text-xs text-slate-500 mt-2">Use an original full-resolution photo. These framing and quality hints do not confirm recognition; the server validates each submitted sheet.</p></>:<button type="button" className="omr-button" onClick={start} disabled={disabled||!online}>Open camera</button>}
  </section>;
}
