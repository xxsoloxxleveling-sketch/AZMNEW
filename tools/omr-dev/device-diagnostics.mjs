/** Acceptance-only telemetry: no tokens, decoded identities, keys or image bodies. */
import {createHmac,timingSafeEqual} from 'node:crypto';
import path from 'node:path';

export function privateSessionDirectory(state,root){
  if(!/^[a-f0-9-]{36}$/.test(state.id||''))throw Error('Invalid acceptance session ID');
  const directory=path.resolve(root,state.id);
  if(path.resolve(state.folder||'')!==directory)throw Error('Acceptance evidence directory does not match its private session');
  return directory;
}
export async function waitForOmrWebView(getTargets,{timeoutMs=10000,intervalMs=250}={}){
  const deadline=Date.now()+timeoutMs;
  do{
    try{const targets=await getTargets();const page=targets.find(p=>p.url==='https://localhost/'&&p.title==='AZM.AIO OMR Scanner');if(page)return page;}catch{}
    if(Date.now()>=deadline)break;
    await new Promise(resolve=>setTimeout(resolve,intervalMs));
  }while(Date.now()<deadline);
  throw Error('The OMR WebView did not become ready; unlock the device and open the verified app');
}

export function localAcceptanceOrigin(value){
  const url=new URL(value);
  if(url.protocol!=='http:'||url.hostname!=='127.0.0.1'||url.pathname!=='/'||url.username||url.password||url.search||url.hash||!url.port)throw Error('Only the attested loopback acceptance API is allowed');
  return url.origin;
}
export async function attestSession(state){
  const origin=localAcceptanceOrigin(state.apiOrigin);
  if(state.scope!=='DISPOSABLE_SYNTHETIC_ONLY'||!/^[a-f0-9]{64}$/.test(state.nonce||''))throw Error('Invalid private acceptance manifest');
  const response=await fetch(origin+'/__omr-device-session',{headers:{'X-OMR-Device-Session':state.nonce},signal:AbortSignal.timeout(5000),cache:'no-store'});
  if(!response.ok)throw Error('Disposable session attestation failed');
  const proof=await response.json();
  if(proof.id!==state.id||proof.pid!==state.pid||proof.scope!==state.scope||proof.officialScoringAllowed!==false||proof.publicationAllowed!==false)throw Error('Test backend does not match the private session');
  return origin;
}
export function signDeviceEvent(event,nonce){const encoded=JSON.stringify(event);return {event,signature:createHmac('sha256',nonce).update(encoded).digest('hex')};}
export function validateRetakeNote(note,sourceSha256,baselineHashes={}){
  if(!/^D\d{3,}$/.test(note.sample||'')||!['S10','S11','S14','S16','S17','S18','S24'].includes(note.retakeOf)||note.sourceSha256!==sourceSha256||!/^[a-f0-9]{64}$/.test(sourceSha256))throw Error('Retake note must match an observed source and one of the seven rejected cases');
  const baseline=baselineHashes[note.retakeOf];
  if(baseline===sourceSha256)throw Error('The old rejected file cannot be presented as a fresh retake');
  return {sample:note.sample,retakeOf:note.retakeOf,sourceSha256,operatorDeclared:true,newSourceHashConfirmed:baseline?true:null,independentAnswerValidation:false};
}
export function verifiedDeviceEvents(lines,nonce,sessionId){
  return lines.filter(Boolean).map(line=>{
    const item=typeof line==='string'?JSON.parse(line):line;
    const expected=createHmac('sha256',nonce).update(JSON.stringify(item.event)).digest();
    if(!/^[a-f0-9]{64}$/.test(item.signature||'')||!timingSafeEqual(expected,Buffer.from(item.signature,'hex'))||item.event.sessionId!==sessionId)throw Error('Device evidence signature/session mismatch');
    return item.event;
  });
}
export function assertResumableDeviceContext(observed,origin,events){
  if(!observed||observed.apiOrigin!==localAcceptanceOrigin(origin)||!observed.contextId||!events.some(e=>e.contextId===observed.contextId))throw Error('Cannot resume an unverified or different app context; keep unsaved review open and reconnect its original session');
}
export function joinDeviceEvidence(samples,events){
  const hardware=events.find(e=>e.type==='DEVICE_ATTESTED'&&e.physicalAndroid===true);
  const accepted=hardware?events.filter(e=>e.type==='UPLOAD_ACCEPTED'&&e.sessionId===hardware.sessionId&&e.status===202):[];
  const matched=samples.filter(s=>accepted.some(e=>e.sha256===s.sourceSha256));
  const terminal=matched.filter(s=>!['QUEUED','PROCESSING'].includes(s.status));
  const mapped=terminal.filter(s=>s.mapped);
  const labels=mapped.map(s=>s.independentAccuracy).filter(Boolean);
  const judged=labels.reduce((n,l)=>n+l.judged,0),correct=labels.reduce((n,l)=>n+l.correct,0),acceptedJudged=labels.reduce((n,l)=>n+l.acceptedJudged,0),falseAccepted=labels.reduce((n,l)=>n+l.falseAccepted,0);
  return {deviceObserved:!!hardware,acceptedUploadEvents:accepted.length,uniqueMatchedScans:matched.length,terminalScans:terminal.length,mapped:mapped.length,scanSuccessRate:terminal.length?mapped.length/terminal.length:null,qrDecoded:mapped.filter(s=>s.qrDecoded).length,qrDenominator:mapped.length,independentlyLabeledSheets:labels.length,judgedQuestions:judged,questionAccuracy:judged?correct/judged:null,falseAcceptanceRate:acceptedJudged?falseAccepted/acceptedJudged:null,cameraCapturesObserved:hardware?events.filter(e=>e.type==='CAPTURE'&&['sensor-still','video-frame'].includes(e.captureSource)&&e.capturePurpose!=='identity-detail').length:0};
}

export function captureObserverSource(apiOrigin,sessionNonce=null){
  const origin=localAcceptanceOrigin(apiOrigin);
  if(sessionNonce!==null&&!/^[a-f0-9]{64}$/.test(sessionNonce))throw Error('Invalid acceptance transport token');
  // Function source is intentionally self-contained for an Android WebView debug context.
  return '('+function(allowed,transportToken){
    if(globalThis.__azmDeviceAcceptance)return;
  const state=globalThis.__azmDeviceAcceptance={events:[],installedAt:new Date().toISOString(),apiOrigin:allowed,contextId:crypto.randomUUID(),reviewId:null,droppedEvents:0};
    const emit=(type,data={})=>{state.events.push({type,...data,contextId:state.contextId,monotonicMs:Math.round(performance.now()),at:new Date().toISOString()});if(state.events.length>2000){state.events.shift();state.droppedEvents++;}};
    const meta=async blob=>{
      const sha256=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))].map(x=>x.toString(16).padStart(2,'0')).join('');
      let width=null,height=null;try{const image=await createImageBitmap(blob);width=image.width;height=image.height;image.close();}catch{}
      return {sha256,bytes:blob.size,mime:blob.type,width,height};
    };
    const gum=navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);
    if(gum)navigator.mediaDevices.getUserMedia=async constraints=>{
      try{const stream=await gum(constraints);const settings=stream.getVideoTracks()[0]?.getSettings();emit('CAMERA_OPENED',{permission:'granted',width:settings?.width||null,height:settings?.height||null,facingMode:settings?.facingMode||null});return stream;}
      catch(error){emit('CAMERA_PERMISSION_OR_OPEN_FAILED',{errorName:error?.name||'Error'});throw error;}
    };
    const purpose=()=>[...document.querySelectorAll('video')].find(v=>v.srcObject)?.dataset?.omrCapturePurpose||'page';
    const native=globalThis.ImageCapture?.prototype?.takePhoto;
    if(native)globalThis.ImageCapture.prototype.takePhoto=async function(...args){const capturePurpose=purpose(),blob=await native.apply(this,args);void meta(blob).then(data=>emit('CAPTURE',{captureSource:'sensor-still',capturePurpose,...data}),()=>emit('CAPTURE_DIAGNOSTICS_FAILED'));return blob;};
    const videoCanvases=new WeakMap(),draw=CanvasRenderingContext2D.prototype.drawImage,toBlob=HTMLCanvasElement.prototype.toBlob;
    CanvasRenderingContext2D.prototype.drawImage=function(image,...args){if(image instanceof HTMLVideoElement)videoCanvases.set(this.canvas,image.dataset?.omrCapturePurpose||'page');return draw.call(this,image,...args);};
    HTMLCanvasElement.prototype.toBlob=function(callback,...args){const fromVideo=videoCanvases.has(this);return toBlob.call(this,blob=>{if(blob&&fromVideo)void meta(blob).then(data=>emit('CAPTURE',{captureSource:'video-frame',capturePurpose:videoCanvases.get(this),...data}),()=>emit('CAPTURE_DIAGNOSTICS_FAILED'));callback(blob);},...args);};
    const fetchOriginal=globalThis.fetch.bind(globalThis);
    globalThis.fetch=async(input,init)=>{
      const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,location.href);
      if(![allowed,location.origin].includes(url.origin)){emit('EXTERNAL_API_BLOCKED');throw new Error('Device acceptance connects only to its disposable local API');}
      if(url.origin===allowed&&transportToken){const headers=new Headers(input instanceof Request?input.headers:undefined);new Headers(init?.headers).forEach((value,key)=>headers.set(key,value));headers.set('X-OMR-Device-Session',transportToken);init={...init,headers};}
      const upload=url.origin===allowed&&/\/api\/omr\/exams\/[^/]+\/batches$/.test(url.pathname)&&(init?.method||'GET').toUpperCase()==='POST';
      const detailUpload=url.origin===allowed&&/\/api\/omr\/scans\/[^/]+\/identity-captures$/.test(url.pathname)&&(init?.method||'GET').toUpperCase()==='POST';
      let evidence=null;if((upload||detailUpload)&&init?.body instanceof Blob)evidence=await meta(init.body);
      const started=performance.now();let response;
      try{response=await fetchOriginal(input,init);}catch(error){if(upload||detailUpload)emit(detailUpload?'IDENTITY_DETAIL_NETWORK_FAILED':'UPLOAD_NETWORK_FAILED',{...evidence,durationMs:Math.round(performance.now()-started)});throw error;}
      if(upload){const body=await response.clone().json().catch(()=>null);emit(response.status===202?'UPLOAD_ACCEPTED':'UPLOAD_REJECTED',{...evidence,status:response.status,batchId:body?.data?.id||null,durationMs:Math.round(performance.now()-started)});}
      if(detailUpload){const body=await response.clone().json().catch(()=>null);emit(response.status===201?'IDENTITY_DETAIL_ACCEPTED':'IDENTITY_DETAIL_REJECTED',{...evidence,status:response.status,scanId:url.pathname.split('/')[4],qrDecoded:body?.data?.qrDecoded===true,rosterMatched:body?.data?.rosterMatched===true,durationMs:Math.round(performance.now()-started)});}
      if(url.origin===allowed&&/\/api\/omr\/batches\/[^/]+$/.test(url.pathname)&&response.ok){const body=await response.clone().json().catch(()=>null);emit('PROCESSING_STATUS',{batchId:body?.data?.id,status:body?.data?.status,processed:body?.data?.progress?.processed,total:body?.data?.progress?.total,scanStates:body?.data?.items?.map(i=>({status:i.scan?.status||i.status,errorCode:i.scan?.errorCode||i.errorCode||null}))});}
      if(url.origin===allowed&&/\/api\/omr\/scans\/[^/]+$/.test(url.pathname)&&response.ok){const body=await response.clone().json().catch(()=>null);state.reviewId=body?.data?.id||null;emit('SCAN_REVIEW_LOADED',{scanId:state.reviewId,responseRows:body?.data?.responses?.length||0,identityVerified:body?.data?.identityVerified===true,paperVersion:body?.data?.paperVersion||null,draftCount:body?.data?.results?.filter(r=>r.status==='DRAFT').length||0});}
      return response;
    };
    emit('OBSERVER_INSTALLED');
  }.toString()+')('+JSON.stringify(origin)+','+JSON.stringify(sessionNonce)+');';
}
