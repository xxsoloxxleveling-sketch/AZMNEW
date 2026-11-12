/** Dedicated read-only APK preparation, only inside the isolated CI checkout.
 * Never bundles the ordinary scanner's upload/review/grading UI or credentials.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

export function trainingConfig(origin){
 const url=new URL(origin);
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.origin!=='https://azmaio.com'||url.pathname!=='/omr-training/')throw Error('The approved isolated HTTPS training endpoint is required');
 return {appId:'com.azmaio.omr.training',appName:'AZM Read-only Training',webDir:'readonly-dist',loggingBehavior:'none',
  server:{url:url.href,cleartext:false},android:{allowMixedContent:false,webContentsDebuggingEnabled:false}};
}

export const fallback='<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Read-only training unavailable</title><main style="font:18px system-ui;padding:24px"><h1>AZM Read-only Training</h1><p>The authenticated online training service is unavailable. Check your internet connection and reopen the app to retry. Contact the operator if it remains unavailable.</p><p>No scans or marks are saved by this app. No production upload or grading service is used.</p></main>';

export const runtimeFiles={
 'pyodide.js':'b4cb23a53aba19c221659b9fb40a2f18281d685691dc06647fb0afd0681baf98',
 'pyodide.asm.js':'6b4c90de5b7172873f04f21884d0e9d2274e305fe32116558fe3e4fbe3618d51',
 'pyodide.asm.wasm':'a50dd1843f805a0b7c45b61037ee0d7b26dfe85efe0e18ef95a34ad24e401f5f',
 'python_stdlib.zip':'16611534726e5d8ac2bd8f926410b2dcb8d6f49aa24913463533b457a2115c16',
 'pyodide-lock.json':'9c45b916001a750f4102fc287494f3eab215909c7535c626a20db80fd6333e2c',
 'numpy-2.0.2-cp312-cp312-pyodide_2024_0_wasm32.whl':'ebb61241d962b98b21597d7ce43b67668a6d5bab3acec4fbe958657320d7cd08',
 'opencv_python-4.10.0.84-cp312-cp312-pyodide_2024_0_wasm32.whl':'fae5731bfaa3590eefd92b70fb78a090882031f31905451230b2804e3d576800'
};
export const engineFiles=['engine.py','bubble_evidence.py','responses.py','qr_decode.py','registration.py','physical_layout.py','template-v2.json','template-framed-legacy-v1.json'];
export const pyodideTarballSha256='89d5d952675eb08e11286e52c7238f1248ce71726e896db9703e73bef23dc343';

export async function prepareRuntimeAssets(runtimeSource,engineSource,destination,workerSource){
 if(!runtimeSource||!engineSource||!destination||!workerSource)throw Error('Runtime, engine and worker sources are required');
 const lock=JSON.parse(await fs.readFile(path.join(runtimeSource,'pyodide-lock.json'),'utf8'));
 for(const [name,hash] of Object.entries(runtimeFiles)){
  const bytes=await fs.readFile(path.join(runtimeSource,name));
  if(createHash('sha256').update(bytes).digest('hex')!==hash)throw Error('Runtime checksum mismatch: '+name);
  if(name.endsWith('.whl')){
   const metadata=Object.values(lock.packages||{}).find(value=>value.file_name===name);
   if(!metadata||metadata.sha256!==hash)throw Error('Runtime package lock mismatch: '+name);
  }
 }
 const root=path.resolve(destination),runtimeRoot=path.resolve(runtimeSource);
 await fs.rm(root,{recursive:true,force:true});
 for(const [name] of Object.entries(runtimeFiles)){
  await fs.mkdir(root,{recursive:true});
  await fs.copyFile(path.join(runtimeRoot,name),path.join(root,name));
 }
 for(const name of engineFiles){
  const bytes=await fs.readFile(path.join(engineSource,name));
  if(/(?:answer[_-]?key|student[_-]?records|approved[_-]?keys|official[_-]?marks)/i.test(name))throw Error('Private data cannot be bundled');
  const target=path.join(root,'engine',name);await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,bytes);
 }
 const worker=await fs.readFile(workerSource,'utf8');
 if(!worker.includes("const BASE=new URL('device-runtime/',self.location.href).href")||worker.includes('approved_keys')||worker.includes('student_records'))throw Error('Unexpected or unsafe on-device worker source');
 await fs.writeFile(path.join(root,'device-worker.js'),worker);
 const bundled=['device-worker.js',...Object.keys(runtimeFiles),...engineFiles.map(name=>'engine/'+name)];
 return {runtimeFiles:bundled,engineFiles:[...engineFiles],bytes:(await Promise.all(bundled.map(name=>fs.stat(path.join(root,name))))).reduce((sum,file)=>sum+file.size,0)};
}

export const native=await fs.readFile(new URL('./MainActivity.java',import.meta.url),'utf8');

// These transformations only run against the disposable CI checkout. Keeping them
// pure lets tests verify isolation without overwriting the ordinary Android app.
export function prepareGradle(source){
 const ids=[...source.matchAll(/applicationId\s+["']([^"']+)["']/g)];
 if(ids.length!==1||!['com.azmaio.omr','com.azmaio.omr.training'].includes(ids[0][1]))throw Error('Unexpected Android application ID');
 if(!/minSdkVersion\s+rootProject\.ext\.minSdkVersion/.test(source))throw Error('Preserve the existing Android minimum SDK');
 let result=source.replace(ids[0][0],'applicationId "com.azmaio.omr.training"');
 for(const [pattern,value] of [[/versionCode\s+\d+/g,'versionCode 3'],[/versionName\s+["'][^"']+["']/g,'versionName "1.2-bundled-reader"']]){
  if([...result.matchAll(pattern)].length!==1)throw Error('Unexpected Android version configuration');
  result=result.replace(pattern,value);
 }
 if([...result.matchAll(/^dependencies\s*\{/gm)].length!==1)throw Error('Expected one Android dependency block');
 for(const dependency of ['com.google.android.gms:play-services-code-scanner:16.1.0','com.google.android.gms:play-services-base:18.11.1','androidx.webkit:webkit:$androidxWebkitVersion']){
  const name=dependency.slice(0,dependency.lastIndexOf(':'));
  if(result.includes(name+':')){
   const declared=[...result.matchAll(/implementation\s+["']([^"']+)["']/g)].filter(match=>match[1].startsWith(name+':'));
   if(declared.length!==1||declared[0][1]!==dependency)throw Error('Unexpected existing dependency: '+name);
  }else result=result.replace(/^dependencies\s*\{/m,'dependencies {\n    implementation "'+dependency+'"');
 }
 return result;
}

export function prepareManifest(source){
 const activity=/android:name="(?:\.MainActivity|com\.azmaio\.omr\.MainActivity)"/g;
 if([...source.matchAll(activity)].length!==1)throw Error('Unexpected Android main activity');
 let result=source.replace(activity,'android:name="com.azmaio.omr.MainActivity"');
 const metadata='<meta-data android:name="com.google.mlkit.vision.DEPENDENCIES" android:value="barcode_ui" />';
 if(result.includes('com.google.mlkit.vision.DEPENDENCIES')){
  if(result.split(metadata).length!==2)throw Error('Unexpected Google scanner module configuration');
 }else{
  if([...result.matchAll(/<application\b[^>]*>/g)].length!==1)throw Error('Unexpected Android application manifest');
  result=result.replace(/<application\b[^>]*>/,match=>match+'\n        '+metadata);
 }
 return result;
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
 if(process.env.GITHUB_ACTIONS!=='true'||process.env.OMR_READONLY_ISOLATED_BUILD!=='true')throw Error('This preparation runs only in the disposable CI checkout');
 const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
 const {origin}=JSON.parse(await fs.readFile(path.join(root,'tools/omr-readonly-android/endpoint.json'),'utf8'));
 const config=trainingConfig(origin),app=path.join(root,'apps/omr-mobile');
 const runtimeSource=process.env.OMR_DEVICE_RUNTIME_SOURCE,engineSource=path.join(root,'tools/omr-readonly-training/device-engine');
 if(!runtimeSource)throw Error('Verified bundled sheet-reader runtime source is required');
 const bundle=await prepareRuntimeAssets(runtimeSource,engineSource,path.join(app,'android/app/src/main/assets/device-runtime'),path.join(root,'tools/omr-readonly-training/device-worker.js'));
 await fs.writeFile(path.join(app,'capacitor.config.ts'),'const config='+JSON.stringify(config)+';export default config;\n');
 await fs.mkdir(path.join(app,'readonly-dist'),{recursive:true});
 await fs.writeFile(path.join(app,'readonly-dist/index.html'),fallback);
 const gradle=path.join(app,'android/app/build.gradle');
 await fs.writeFile(gradle,prepareGradle(await fs.readFile(gradle,'utf8')));
 const manifest=path.join(app,'android/app/src/main/AndroidManifest.xml');
 await fs.writeFile(manifest,prepareManifest(await fs.readFile(manifest,'utf8')));
 await fs.writeFile(path.join(app,'android/app/src/main/java/com/azmaio/omr/MainActivity.java'),native);
 await fs.writeFile(path.join(app,'android/app/src/main/res/xml/network_security_config.xml'),'<?xml version="1.0" encoding="utf-8"?><network-security-config><base-config cleartextTrafficPermitted="false" /></network-security-config>\n');
 console.log(`Prepared isolated read-only APK with the verified on-device sheet reader (${bundle.bytes} runtime bytes). HTTPS training page remains required for sign-in and live roster lookup; no keys, scans or marks are bundled.`);
}

