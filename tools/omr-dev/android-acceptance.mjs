/** USB-only Android acceptance connection and bounded, private debug telemetry. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {attestSession,captureObserverSource,signDeviceEvent,privateSessionDirectory,waitForOmrWebView,verifiedDeviceEvents,assertResumableDeviceContext} from './device-diagnostics.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const expected='0c92215362bd2966589036459f100e0679c5a66616b3ef2fbede948dbdae3095';
const apk=path.join(root,'tmp/omr-dev/release/azm-omr-reliability-965c4ff.apk');
const adb=process.env.OMR_ADB||path.join(root,'tmp/omr-dev/android-tools/platform-tools',process.platform==='win32'?'adb.exe':'adb');
const output=path.join(root,'tmp/omr-reference/device-acceptance');await fs.mkdir(output,{recursive:true,mode:0o700});
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
if(sha(await fs.readFile(apk))!==expected)throw Error('Current APK checksum does not match the verified build');
const run=async(...args)=>(await promisify(execFile)(adb,args,{windowsHide:true,timeout:20000,maxBuffer:2*1024*1024})).stdout.trim();
const devices=(await run('devices','-l')).split(/\r?\n/).slice(1).map(s=>s.trim().split(/\s+/)).filter(x=>x[1]==='device'&&/^[A-Za-z0-9._-]+$/.test(x[0]));
let backendAttested=false;try{const current=JSON.parse(await fs.readFile(path.join(output,'current-session.json'),'utf8'));privateSessionDirectory(current,output);await attestSession(current);backendAttested=true;}catch{}
const readiness={at:new Date().toISOString(),apkVerified:true,apkSha256:expected,backendAttested,connectedUsbDevices:devices.length,physicalDeviceTests:'NOT_RUN'};
await fs.writeFile(path.join(output,'device-readiness.json'),JSON.stringify(readiness,null,2)+'\n',{mode:0o600});
if(!process.argv.includes('--connect')){console.log(JSON.stringify(readiness));process.exit(0);}
if(devices.length!==1)throw Error('Connect exactly one unlocked USB device and authorize USB debugging; no physical device test was performed');
const serial=devices[0][0],device=async(...args)=>run('-s',serial,...args);
const state=JSON.parse(await fs.readFile(path.join(output,'current-session.json'),'utf8'));
privateSessionDirectory(state,output);
const origin=await attestSession(state),port=new URL(origin).port;
const resume=process.argv.includes('--resume');
if(resume&&process.argv.includes('--install'))throw Error('Resume cannot reinstall or restart an app containing unsaved review');
if(process.argv.includes('--install'))await device('install','-r',apk);
const packagePath=(await device('shell','pm','path','--user','0','com.azmaio.omr')).split(/\r?\n/).find(x=>x.startsWith('package:'))?.slice(8);
if(!packagePath||!/^\/data\/app\/[A-Za-z0-9_./=+~-]+\/base\.apk$/.test(packagePath))throw Error('OMR APK is not installed under Android user 0; use --connect --install');
if(!(await device('shell','sha256sum',packagePath)).startsWith(expected+' '))throw Error('Installed OMR APK is not the verified build; use --connect --install');
await device('reverse','tcp:'+port,'tcp:'+port);
// The app stores credentials/API settings only in memory. Start a clean test
// process so an earlier in-memory server choice cannot precede interception.
if(!resume){
 await device('shell','am','force-stop','com.azmaio.omr');
 await device('shell','am','start','--user','0','-n','com.azmaio.omr/.MainActivity');
}
const model=await device('shell','getprop','ro.product.model'),android=await device('shell','getprop','ro.build.version.release');
const pid=await device('shell','pidof','com.azmaio.omr');if(!/^\d+$/.test(pid))throw Error('Could not identify the OMR app process');
await device('forward','tcp:9223','localabstract:webview_devtools_remote_'+pid);
const page=await waitForOmrWebView(async()=>await (await fetch('http://127.0.0.1:9223/json/list',{signal:AbortSignal.timeout(1500)})).json());
const ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
let nextId=0,closed=false;const pending=new Map();
const call=(method,params={})=>new Promise((resolve,reject)=>{
 const id=++nextId,timer=setTimeout(()=>{pending.delete(id);reject(Error('Android debug command timed out'));},8000);
 pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));
});
ws.onmessage=event=>{
 const message=JSON.parse(event.data);
 if(message.id){const job=pending.get(message.id);if(job){clearTimeout(job.timer);pending.delete(message.id);message.error?job.reject(Error('Android debug command failed')):job.resolve(message.result);}return;}
 if(message.method==='Fetch.requestPaused'){
  const url=new URL(message.params.request.url);
  const allowed=[origin,'https://localhost'].includes(url.origin)||['data:','blob:'].includes(url.protocol);
  void call(allowed?'Fetch.continueRequest':'Fetch.failRequest',{requestId:message.params.requestId,...(!allowed?{errorReason:'BlockedByClient'}:{})}).catch(()=>{});
 }
};
const evaluate=async expression=>{
 const result=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
 if(result.exceptionDetails)throw Error('OMR WebView diagnostics could not initialize');return result.result?.value;
};
const append=async event=>fs.appendFile(path.join(state.folder,'device-events.jsonl'),JSON.stringify(signDeviceEvent({...event,sessionId:state.id},state.nonce))+'\n',{mode:0o600});
const source=captureObserverSource(origin,state.nonce);
try{
 await call('Page.enable');await call('Runtime.enable');
 if(resume){
  const events=verifiedDeviceEvents((await fs.readFile(path.join(state.folder,'device-events.jsonl'),'utf8')).split(/\r?\n/),state.nonce,state.id);
  const context=await evaluate('globalThis.__azmDeviceAcceptance ? ({apiOrigin:globalThis.__azmDeviceAcceptance.apiOrigin,contextId:globalThis.__azmDeviceAcceptance.contextId}) : null');
  assertResumableDeviceContext(context,origin,events);
 }
 // Browser-level interception also covers XHR/navigation, not just app fetch.
 await call('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});
 await call('Page.addScriptToEvaluateOnNewDocument',{source});await evaluate(source);
 // App session clients capture fetch at initialization. Reload after registering
 // the preload so the private transport wrapper exists before those clients.
 if(!resume){
 await call('Page.reload',{ignoreCache:false});
 const readyDeadline=Date.now()+10000;let appReady=false;
 while(Date.now()<readyDeadline){try{appReady=await evaluate('!!globalThis.__azmDeviceAcceptance && !!document.querySelector("input[type=email]")');if(appReady)break;}catch{}await new Promise(resolve=>setTimeout(resolve,250));}
 if(!appReady)throw Error('The OMR sign-in screen did not initialize with acceptance transport enabled');
 }
 await append({type:'DEVICE_ATTESTED',at:new Date().toISOString(),physicalAndroid:true,serialSha256:sha(serial),model,android,apkSha256:expected,backendAttested:true,networkRestrictedTo:origin});
 console.log('Verified Android app connected to disposable session. Model:',model,'Android:',android);console.log('App API server:',origin);console.log('Use the disposable synthetic credentials supplied by the operator; keep USB connected. Diagnostic observer is active; Ctrl+C stops it.');
 let polling=false,lastReview='';const timer=setInterval(()=>{
  if(polling||closed)return;polling=true;
  void (async()=>{
   const batch=await evaluate(`(()=>{const s=globalThis.__azmDeviceAcceptance;return {events:s?.events.splice(0)||[],reviewId:s?.reviewId||null,droppedEvents:s?.droppedEvents||0,reviewRows:document.querySelectorAll('[aria-label="Scan review"] tbody tr').length,video:[...document.querySelectorAll('video')].map(v=>({width:v.videoWidth,height:v.videoHeight,active:!!v.srcObject})),online:navigator.onLine}})()`);
   for(const event of batch.events)await append(event);
   if(batch.reviewRows===100&&batch.reviewId&&lastReview!==batch.reviewId){await append({type:'REVIEW_DISPLAYED',scanId:batch.reviewId,responseRows:100,at:new Date().toISOString()});lastReview=batch.reviewId;}
   if(!batch.reviewRows)lastReview='';
   await fs.writeFile(path.join(state.folder,'device-ui.json'),JSON.stringify({at:new Date().toISOString(),reviewRows:batch.reviewRows,video:batch.video,online:batch.online},null,2),{mode:0o600});
  })().catch(()=>{console.error('Device diagnostics disconnected; physical tests remain incomplete');void stop();}).finally(()=>{polling=false;});
 },1000);
 async function stop(){if(closed)return;closed=true;clearInterval(timer);await append({type:'DEVICE_OBSERVER_STOPPED',at:new Date().toISOString()});await call('Fetch.disable').catch(()=>{});ws.close();await device('forward','--remove','tcp:9223').catch(()=>{});await device('reverse','--remove','tcp:'+port).catch(()=>{});process.exit();}
 process.on('SIGINT',()=>void stop());process.on('SIGTERM',()=>void stop());
}catch(error){await call('Fetch.disable').catch(()=>{});ws.close();await device('forward','--remove','tcp:9223').catch(()=>{});await device('reverse','--remove','tcp:'+port).catch(()=>{});throw error;}
