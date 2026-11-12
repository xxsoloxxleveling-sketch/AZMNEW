/** Dedicated read-only APK preparation, only inside the isolated CI checkout.
 * Never bundles the ordinary scanner's upload/review/grading UI or credentials.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export function trainingConfig(origin){
 const url=new URL(origin);
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.origin!=='https://azmaio.com'||url.pathname!=='/omr-training/')throw Error('The approved isolated HTTPS training endpoint is required');
 return {appId:'com.azmaio.omr.training',appName:'AZM Read-only Training',webDir:'readonly-dist',loggingBehavior:'none',
  server:{url:url.href,cleartext:false},android:{allowMixedContent:false,webContentsDebuggingEnabled:false}};
}

export const fallback='<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Read-only training unavailable</title><main style="font:18px system-ui;padding:24px"><h1>AZM Read-only Training</h1><p>The authenticated online training service is unavailable. Check your internet connection and reopen the app to retry. Contact the operator if it remains unavailable.</p><p>No scans or marks are saved by this app. No production upload or grading service is used.</p></main>';

export const native=await fs.readFile(new URL('./MainActivity.java',import.meta.url),'utf8');

// These transformations only run against the disposable CI checkout. Keeping them
// pure lets tests verify isolation without overwriting the ordinary Android app.
export function prepareGradle(source){
 const ids=[...source.matchAll(/applicationId\s+["']([^"']+)["']/g)];
 if(ids.length!==1||!['com.azmaio.omr','com.azmaio.omr.training'].includes(ids[0][1]))throw Error('Unexpected Android application ID');
 if(!/minSdkVersion\s+rootProject\.ext\.minSdkVersion/.test(source))throw Error('Preserve the existing Android minimum SDK');
 let result=source.replace(ids[0][0],'applicationId "com.azmaio.omr.training"');
 for(const [pattern,value] of [[/versionCode\s+\d+/g,'versionCode 2'],[/versionName\s+["'][^"']+["']/g,'versionName "1.1-google-qr"']]){
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
 await fs.writeFile(path.join(app,'capacitor.config.ts'),'const config='+JSON.stringify(config)+';export default config;\n');
 await fs.mkdir(path.join(app,'readonly-dist'),{recursive:true});
 await fs.writeFile(path.join(app,'readonly-dist/index.html'),fallback);
 const gradle=path.join(app,'android/app/build.gradle');
 await fs.writeFile(gradle,prepareGradle(await fs.readFile(gradle,'utf8')));
 const manifest=path.join(app,'android/app/src/main/AndroidManifest.xml');
 await fs.writeFile(manifest,prepareManifest(await fs.readFile(manifest,'utf8')));
 await fs.writeFile(path.join(app,'android/app/src/main/java/com/azmaio/omr/MainActivity.java'),native);
 await fs.writeFile(path.join(app,'android/app/src/main/res/xml/network_security_config.xml'),'<?xml version="1.0" encoding="utf-8"?><network-security-config><base-config cleartextTrafficPermitted="false" /></network-security-config>\n');
 console.log('Prepared separate read-only APK. HTTPS only; normal scanner UI and credentials are excluded.');
}
