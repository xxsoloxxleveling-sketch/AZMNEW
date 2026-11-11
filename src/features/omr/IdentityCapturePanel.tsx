import React,{useEffect,useRef,useState} from 'react';
import {OmrClient} from './contracts';
import {CameraCapture} from './CameraCapture';
interface Props {client:OmrClient;scanId:string;originalSha256:string;onCandidate:(roll:string)=>void}
export function IdentityCapturePanel({client,scanId,originalSha256,onCandidate}:Props){
  const generation=useRef(0);useEffect(()=>()=>{generation.current++;},[]);
  const [file,setFile]=useState<File|null>(null),[preview,setPreview]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[suggestion,setSuggestion]=useState<string|null>(null);
  useEffect(()=>{setSuggestion(null);if(!file){setPreview('');return;}const url=URL.createObjectURL(file);setPreview(url);return()=>URL.revokeObjectURL(url);},[file]);
  async function submit(){
    if(!file||busy)return;const ticket=generation.current;setBusy(true);setError('');setMessage('');setSuggestion(null);
    try{
      if(!['image/png','image/jpeg'].includes(file.type)||file.size>20*1024*1024)throw new Error('Choose an original JPEG or PNG of 20 MB or less');
      const result=await client.identityCapture(scanId,originalSha256,file);if(ticket!==generation.current)return;
      if(result.status==='DETAIL_REVIEW_REQUIRED'&&result.rollCandidate)setSuggestion(result.rollCandidate);
      if(result.canPrefill&&result.rollCandidate){onCandidate(result.rollCandidate);setMessage('The detail matches the original roll and examination roster. Check the original sheet before confirming identity.');}
      else if(result.status==='ROSTER_MISMATCH')setMessage('The QR was read, but its candidate does not match this examination roster. No identity was assigned.');
      else if(result.status==='UNSUPPORTED_QR')setMessage('The QR was read but its format or signature is not supported. Use the correct official sheet; no identity was assigned.');
      else if(result.status==='ORIGINAL_CONFIRMATION_REQUIRED')setMessage('The QR matches the examination roster but cannot be confirmed against this original sheet. Check the original printed identity manually; no identity was assigned.');
      else if(result.status.includes('CONFLICTING'))setMessage('The detail contains conflicting identity evidence. Use the correct original sheet; no identity was assigned.');
      else if(result.status==='DETAIL_UNREADABLE')setMessage('The detail is still unreadable. Move closer, check focus and use the original full-resolution image.');
      else if(result.status==='DETAIL_PROCESSING_FAILED')setMessage('The close-up was retained, but processing failed. No identity was assigned. Keep the original and contact an administrator or use a sharper capture.');
      else setMessage(`Detail retained for authorized review.${result.rollCandidate?' Unverified printed number: '+result.rollCandidate+'.':''} Compare it with the original sheet and roster before entering or confirming identity.`);
    }catch(problem){if(ticket===generation.current)setError(problem instanceof Error?problem.message:'Detail upload failed; keep this screen open and retry.');}
    finally{if(ticket===generation.current)setBusy(false);}
  }
  return <details className="omr-section"><summary className="font-semibold cursor-pointer">Add a clearer QR / printed-roll close-up</summary>
    <p className="text-sm my-3">Photograph the QR and printed roll together on this same sheet. Keep the text sharp and use an original full-resolution image. The close-up is linked to this scan and does not replace its full-page original or verify identity by itself.</p>
    <CameraCapture disabled={busy} mode="identity-detail" onCapture={setFile}/>
    <label className="omr-field my-3">Choose an original close-up<input type="file" accept="image/png,image/jpeg" disabled={busy} onChange={event=>{setFile(event.target.files?.[0]||null);setError('');setMessage('');}}/></label>
    {preview&&<img src={preview} alt="Supplemental identity close-up preview" className="max-h-64 max-w-full"/>}
    <button type="button" className="omr-button my-3" disabled={busy||!file} onClick={submit}>{busy?'Reading close-up…':'Read close-up for this scan'}</button>
    {error&&<p role="alert" className="omr-notice omr-error">{error}</p>}{message&&<p role="status" className="omr-notice">{message}</p>}
    {suggestion&&<button type="button" className="omr-button my-2" onClick={()=>{onCandidate(suggestion);setSuggestion(null);setMessage('Number entered for manual roster review. Identity remains unconfirmed; check the original sheet and examination before saving.');}}>Use this number for manual roster review</button>}
  </details>;
}
