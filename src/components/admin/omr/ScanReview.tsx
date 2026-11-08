import React,{useEffect,useState} from 'react';
import { OmrClient,ScanDetail,Answer,Option,Review } from '../../../features/omr/contracts';
interface Props {client:OmrClient;scanId:string;onClose:()=>void;onChanged:()=>void;canReview:boolean}
const answers:Answer[]=['A','B','C','D','BLANK','MULTIPLE','UNCERTAIN'];
export function ScanReview({client,scanId,onClose,onChanged,canReview}:Props) {
  const [scan,setScan]=useState<ScanDetail|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const [image,setImage]=useState(''),[mime,setMime]=useState(''),[kind,setKind]=useState<'original'|'annotation'>('annotation'),[zoom,setZoom]=useState(100);
  const [edits,setEdits]=useState<Record<number,Answer>>({}),[version,setVersion]=useState(''),[reason,setReason]=useState(''),[lookup,setLookup]=useState(''),[printedRoll,setPrintedRoll]=useState(''),[confirmed,setConfirmed]=useState(false);
  const open=['RECOGNIZED','REVIEW_REQUIRED'].includes(scan?.status||'');
  const evidenceKind=kind==='annotation'&&scan&&!scan.hasAnnotation?'original':kind;
  const reload=async()=>{const next=await client.scan(scanId);setScan(next);setVersion(next.paperVersion||'');setEdits({});if(next.identityVerified){setLookup('');setPrintedRoll('');setConfirmed(false);}};
  useEffect(()=>{let cancelled=false;setScan(null);setReason('');setLookup('');setPrintedRoll('');setConfirmed(false);client.scan(scanId).then(value=>{if(!cancelled){setScan(value);setVersion(value.paperVersion||'');}},problem=>{if(!cancelled)setError(problem.message);});return()=>{cancelled=true;};},[client,scanId]);
  useEffect(()=>{
    let cancelled=false,url='';setImage('');if(!scan)return;
    client.image(scanId,evidenceKind).then(blob=>{url=URL.createObjectURL(blob);if(cancelled)URL.revokeObjectURL(url);else{setImage(url);setMime(blob.type);}},problem=>{if(!cancelled)setError(problem.message);});
    return()=>{cancelled=true;if(url)URL.revokeObjectURL(url);};
  },[client,scanId,evidenceKind,!!scan]);
  async function act(operation:()=>Promise<unknown>) {
    setBusy(true);setError('');try{await operation();await reload();onChanged();}catch(problem){setError(problem instanceof Error?problem.message:'Review failed');}finally{setBusy(false);}
  }
  function save() {
    const body:Review={reason,answers:Object.entries(edits).map(([question,answer])=>({question:Number(question),answer}))};
    if(version&&version!==scan?.paperVersion)body.paperVersion=version as Option;
    if(lookup){body.identityLookup=lookup;body.printedRollNumber=printedRoll;body.identityConfirmed=confirmed?true:undefined;if(confirmed)body.examConfirmed=true;}
    return act(()=>client.review(scanId,body));
  }
  return <section className="omr-section" aria-label="Scan review">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="omr-heading">Scan review</h2><button className="omr-button" onClick={onClose}>Close review</button></div>
    {error&&<p role="alert" className="omr-notice omr-error mb-3">{error}</p>}
    {!scan?<p role="status">Loading scan evidence…</p>:<>
      <p className="text-sm mb-3">{scan.student?.fullName||'Identity requires confirmation'} · {scan.student?.rollNumber||scan.student?.applicationNo||'No candidate attached'} · {scan.status.replaceAll('_',' ')}</p>
      {scan.status==='INVALID'&&<p role="status" className="omr-notice omr-error mb-3">{scan.errorCode==='PRINT_LAYOUT_MISMATCH'?'This printed layout does not match the scanner’s alignment marks. Keep this sheet for compatibility review; retaking the same layout may not resolve it.':scan.errorCode==='PAGE_ALIGNMENT_FAILED'?'The page could not be aligned. Capture all four corner marks with even lighting and a plain background.':'This capture could not be read safely. Inspect the original and upload a clearer supported sheet.'} No answers or marks were saved.</p>}
      <div className="grid min-w-0 lg:grid-cols-2 gap-5">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-3 items-end mb-3"><label className="omr-field">Evidence<select value={evidenceKind} onChange={event=>setKind(event.target.value as typeof kind)}><option value="annotation" disabled={!scan.hasAnnotation}>Recognition overlay</option><option value="original">Original file</option></select></label><label className="omr-field">Zoom {zoom}%<input type="range" min="100" max="250" step="10" value={zoom} onChange={event=>setZoom(Number(event.target.value))}/></label></div>
          <div className="max-h-[75vh] overflow-auto border border-slate-300 rounded-lg min-h-32">
            {image?(mime==='application/pdf'?<iframe src={image} title="Original OMR PDF" className="w-full h-[65vh]"/>:<img src={image} alt="OMR scan evidence with detected bubble regions" style={{width:`${zoom}%`,maxWidth:'none'}}/>):<p className="p-4 text-sm">Evidence is loading or not available yet. Try the original file if processing is pending.</p>}
          </div>
          <p className="text-xs text-slate-500 mt-2">The overlay preserves the original recognition. Corrections are recorded separately.</p>
        </div>
        <div className="min-w-0">
          <div className="omr-table-scroll max-h-[60vh]"><table className="omr-table"><thead><tr><th>Q.</th><th>Detected</th><th>Reviewed response</th></tr></thead><tbody>{scan.responses.map(row=><tr key={row.question} className={['UNCERTAIN','MULTIPLE'].includes(row.detectedAnswer)?'bg-amber-500/5':''}><th scope="row">{row.question}</th><td>{row.detectedAnswer}<span className="block text-xs text-slate-500" title="Measured ink darkness, not a probability">{row.evidence.darkness?.map(value=>value.toFixed(2)).join(' / ')}</span></td><td><select aria-label={`Question ${row.question} reviewed response`} disabled={!canReview||!open||busy} value={edits[row.question]||row.reviewedAnswer||row.detectedAnswer} onChange={event=>setEdits(previous=>({...previous,[row.question]:event.target.value as Answer}))}>{answers.map(answer=><option key={answer}>{answer}</option>)}</select></td></tr>)}</tbody></table></div>
          {canReview&&<div className="omr-section space-y-3">
            <label className="omr-field">Confirmed paper version<select disabled={!open||busy} value={version} onChange={event=>setVersion(event.target.value)}><option value="">Select version</option>{['A','B','C','D'].map(value=><option key={value}>{value}</option>)}</select></label>
            {!scan.identityVerified&&<fieldset className="space-y-3"><legend className="font-semibold text-sm">Candidate identity verification</legend><label className="omr-field">Official roll or application number<input value={lookup} onChange={event=>setLookup(event.target.value)} disabled={!open||busy}/></label><label className="omr-field">Roll number printed on this sheet<input value={printedRoll} onChange={event=>setPrintedRoll(event.target.value)} disabled={!open||busy}/></label><label className="flex gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={event=>setConfirmed(event.target.checked)} disabled={!open||busy}/>I checked the printed candidate identity and selected examination against this sheet.</label></fieldset>}
            <label className="omr-field">Review reason (at least 8 characters)<textarea rows={2} minLength={8} maxLength={500} value={reason} onChange={event=>setReason(event.target.value)} disabled={busy}/></label>
            <div className="flex flex-wrap gap-2"><button className="omr-primary" disabled={busy||!open||reason.trim().length<8||(!!lookup&&(!confirmed||!printedRoll))} onClick={save}>Save and recalculate draft</button><button className="omr-button" disabled={busy||!open||reason.trim().length<8||Object.keys(edits).length>0||version!==(scan.paperVersion||'')||!!lookup||!scan.identityVerified} onClick={()=>act(()=>client.decide(scanId,true,reason))}>Verify scan</button><button className="omr-danger" disabled={busy||!open||reason.trim().length<8} onClick={()=>act(()=>client.decide(scanId,false,reason))}>Reject scan</button>{scan.status==='FAILED'&&<button className="omr-button" disabled={busy} onClick={()=>act(()=>client.retry(scanId))}>Retry processing</button>}</div>
          </div>}
        </div>
      </div>
      <details className="omr-section"><summary className="cursor-pointer text-sm font-semibold">Correction history ({scan.corrections.length})</summary><ol className="space-y-2 mt-3 text-sm">{scan.corrections.map(item=><li key={item.id}><time>{new Date(item.createdAt).toLocaleString()}</time> · {item.question?`Q. ${item.question}`:'Identity / workflow'} · {item.reason}</li>)}</ol></details>
    </>}
  </section>;
}
