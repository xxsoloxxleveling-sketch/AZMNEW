/** Capture optimization is upload-side only; recognition thresholds and raw scanner evidence are unchanged. */
export function resolutionGuidance(width:number,height:number) {
  return Math.min(width,height)<1600
    ? `${width} × ${height} capture: use the original camera photo at higher resolution. Small identity QR codes may be unreadable; do not use a messaging-app copy.`
    : `${width} × ${height} preview. Check the saved original: the QR squares and all four page corners must remain sharp.`;
}

const MIB=1024*1024;
export const CAMERA_UPLOAD_TARGET=3*MIB;
const MAX_CAPTURE_PIXELS=12_000_000;
const MAX_CAPTURE_SIDE=4600;
export interface OptimizedCapture {
  blob:Blob;
  inputBytes:number;
  outputBytes:number;
  inputWidth:number|null;
  inputHeight:number|null;
  outputWidth:number|null;
  outputHeight:number|null;
  changed:boolean;
  quality:number|null;
}
/**
 * Compress large camera JPEG/PNG images before upload. Preserve source pixel resolution
 * on <=12MP photographs, retain a high JPEG quality floor, never upscale, and leave
 * low-resolution evidence unchanged. No OCR, scoring, or ink threshold is involved.
 * Any unsupported encoder/decoder safely falls back to the original bytes.
 */
export async function optimizeCapture(blob:Blob):Promise<OptimizedCapture> {
  const fallback:OptimizedCapture={blob,inputBytes:blob.size,outputBytes:blob.size,inputWidth:null,inputHeight:null,outputWidth:null,outputHeight:null,changed:false,quality:null};
  if(blob.size<=CAMERA_UPLOAD_TARGET||!['image/jpeg','image/png'].includes(blob.type)||typeof createImageBitmap!=='function'||typeof document==='undefined')return fallback;
  let bitmap:ImageBitmap|undefined,canvas:HTMLCanvasElement|undefined;
  try {
    bitmap=await createImageBitmap(blob);
    const width=bitmap.width,height=bitmap.height;
    const original={...fallback,inputWidth:width,inputHeight:height,outputWidth:width,outputHeight:height};
    // Resampling an already small QR makes it less readable.
    if(Math.min(width,height)<1600||width*height>20_000_000)return original;
    const scale=Math.min(1,Math.sqrt(MAX_CAPTURE_PIXELS/(width*height)),MAX_CAPTURE_SIDE/Math.max(width,height));
    const outputWidth=Math.round(width*scale),outputHeight=Math.round(height*scale);
    if(Math.min(outputWidth,outputHeight)<1800)return original;
    canvas=document.createElement('canvas');
    canvas.width=outputWidth;canvas.height=outputHeight;
    const ctx=canvas.getContext('2d',{alpha:false});
    if(!ctx)return original;
    ctx.fillStyle='#fff';ctx.fillRect(0,0,outputWidth,outputHeight);
    ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
    ctx.drawImage(bitmap,0,0,outputWidth,outputHeight);
    let best:Blob|null=null,bestQuality:number|null=null;
    // Favor detail in small printed QR modules over shaving the last few bytes.
    for(const quality of [.90,.86,.82]) {
      const encoded=await new Promise<Blob|null>((resolve,reject)=>{
        const timer=setTimeout(()=>reject(Error('JPEG encoder timed out')),12000);
        try {canvas!.toBlob(value=>{clearTimeout(timer);resolve(value);},'image/jpeg',quality);}
        catch(error){clearTimeout(timer);reject(error);}
      });
      if(encoded?.type==='image/jpeg'&&encoded.size>0&&encoded.size<blob.size&&(!best||encoded.size<best.size)){
        best=encoded;bestQuality=quality;
      }
      if(best&&best.size<=CAMERA_UPLOAD_TARGET)break;
    }
    if(!best)return original;
    return {blob:best,inputBytes:blob.size,outputBytes:best.size,inputWidth:width,inputHeight:height,outputWidth,outputHeight,changed:true,quality:bestQuality};
  }catch{return fallback;}
  finally{if(bitmap)bitmap.close();if(canvas){canvas.width=0;canvas.height=0;}}
}

export const formatMegabytes=(bytes:number)=>(bytes/MIB).toFixed(1)+' MB';

/** Prefer the sensor's still image over a potentially low-resolution video frame. */
export async function captureStill(track:MediaStreamTrack,fallback:()=>Promise<Blob|null>,timeoutMs=12000):Promise<Blob|null> {
  const Constructor=(globalThis as unknown as {ImageCapture?:new(track:MediaStreamTrack)=>{takePhoto:()=>Promise<Blob>}}).ImageCapture;
  if(Constructor) {
    try {
      let timeout:ReturnType<typeof setTimeout>|undefined;
      const blob=await Promise.race([
        new Constructor(track).takePhoto(),
        new Promise<never>((_,reject)=>{timeout=setTimeout(()=>reject(new Error('Still capture timed out')),timeoutMs);}),
      ]).finally(()=>{if(timeout)clearTimeout(timeout);});
      if(['image/jpeg','image/png'].includes(blob.type)&&blob.size<=20*MIB) {
        const bitmap=await createImageBitmap(blob);
        const acceptable=bitmap.width*bitmap.height<=20_000_000&&Math.min(bitmap.width,bitmap.height)>=600;
        bitmap.close();if(acceptable)return blob;
      }
    } catch { /* Unsupported or failed still capture falls back to the live frame. */ }
  }
  return fallback();
}
