export function resolutionGuidance(width:number,height:number) {
  return Math.min(width,height)<1600
    ? `${width} × ${height} capture: use the original camera photo at higher resolution. Small identity QR codes may be unreadable; do not use a messaging-app copy.`
    : `${width} × ${height} preview. Check the saved original: the QR squares and all four page corners must remain sharp.`;
}

/** Prefer the sensor's still image over a potentially low-resolution video frame. */
export async function captureStill(track:MediaStreamTrack, fallback:()=>Promise<Blob|null>,timeoutMs=12000):Promise<Blob|null> {
  const Constructor=(globalThis as unknown as {ImageCapture?:new(track:MediaStreamTrack)=>{takePhoto:()=>Promise<Blob>}}).ImageCapture;
  if(Constructor) {
    try {
      let timeout:ReturnType<typeof setTimeout>|undefined;
      const blob=await Promise.race([
        new Constructor(track).takePhoto(),
        new Promise<never>((_,reject)=>{timeout=setTimeout(()=>reject(new Error('Still capture timed out')),timeoutMs);}),
      ]).finally(()=>{if(timeout)clearTimeout(timeout);});
      if(['image/jpeg','image/png'].includes(blob.type)&&blob.size<=20*1024*1024) {
        const bitmap=await createImageBitmap(blob);
        const acceptable=bitmap.width*bitmap.height<=20_000_000&&Math.min(bitmap.width,bitmap.height)>=600;
        bitmap.close();if(acceptable)return blob;
      }
    } catch { /* Unsupported or failed still capture falls back to the live frame. */ }
  }
  return fallback();
}
