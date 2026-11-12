import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {trainingConfig,fallback,native,prepareGradle,prepareManifest,runtimeFiles,engineFiles,prepareRuntimeAssets} from './prepare.mjs';
const gradle=await fs.readFile(new URL('../../apps/omr-mobile/android/app/build.gradle',import.meta.url),'utf8');
const manifest=await fs.readFile(new URL('../../apps/omr-mobile/android/app/src/main/AndroidManifest.xml',import.meta.url),'utf8');
test('dedicated HTTPS-only package carries no write client or credentials',()=>{
 const config=trainingConfig('https://azmaio.com/omr-training/');
 assert.equal(config.appId,'com.azmaio.omr.training');
 assert.equal(config.server.cleartext,false);
 assert.equal(config.android.webContentsDebuggingEnabled,false);
 assert.equal(config.webDir,'readonly-dist');
 assert.ok(!/api\/omr|api\/upload|password\s*=|studentId|answerKeys/.test(fallback));
 assert.doesNotMatch(fallback,/test PC|tunnel/i);
});

test('isolated APK adds pinned Google scanner and WebView messaging dependencies idempotently',()=>{
 const result=prepareGradle(gradle);
 assert.equal(prepareGradle(result),result);
 assert.match(result,/applicationId "com\.azmaio\.omr\.training"/);
 assert.match(result,/versionCode 3\b/);
 assert.match(result,/versionName "1\.2-bundled-reader"/);
 for(const dependency of ['com.google.android.gms:play-services-code-scanner:16.1.0','com.google.android.gms:play-services-base:18.11.1','androidx.webkit:webkit:$androidxWebkitVersion'])assert.equal(result.split(dependency).length,2);
 assert.equal(result.match(/minSdkVersion[^\r\n]+/)[0],gradle.match(/minSdkVersion[^\r\n]+/)[0]);
 assert.match(gradle,/applicationId "com\.azmaio\.omr"/,'source Android app remains unchanged');
});

test('preparation refuses unknown package, dependency, version layout or SDK override',()=>{
 for(const source of [
  gradle.replace('applicationId "com.azmaio.omr"','applicationId "com.other.app"'),
  gradle.replace('dependencies {','dependencies {\nimplementation "com.google.android.gms:play-services-code-scanner:0.0.0"'),
  gradle.replace('versionCode 1',''),
  gradle.replace('minSdkVersion rootProject.ext.minSdkVersion','minSdkVersion 21'),
  gradle+'\ndependencies {}',
 ])assert.throws(()=>prepareGradle(source));
});

test('module metadata changes only isolated manifest and preserves original permission requirements',()=>{
 const result=prepareManifest(manifest);
 assert.equal(prepareManifest(result),result);
 assert.match(result,/android:name="com\.azmaio\.omr\.MainActivity"/);
 assert.match(result,/android:name="com\.google\.mlkit\.vision\.DEPENDENCIES" android:value="barcode_ui"/);
 assert.deepEqual(result.match(/<uses-permission\b[^>]+>/g),manifest.match(/<uses-permission\b[^>]+>/g));
 assert.match(result,/android:allowBackup="false"/);
 assert.throws(()=>prepareManifest(manifest.replace('.MainActivity','OtherActivity')));
 assert.throws(()=>prepareManifest(result.replace('barcode_ui','unrecognized_module')));
});

test('native source enforces origin, main-frame, text-only bridge and lifecycle boundary',()=>{
 assert.match(native,/WebViewCompat\.addWebMessageListener\(webView, "AZMNativeQr", Collections\.singleton\("https:\/\/azmaio\.com"\)/);
 assert.match(native,/@Override protected void load\(\)[\s\S]+if \(webView != null\) installQrBridge\(webView\);\s+super\.load\(\);/);
 assert.match(native,/!isMainFrame \|\| !allowedOrigin\(sourceOrigin\) \|\| !currentPageAllowed\(\)/);
 assert.match(native,/input\.length\(\) != 2/);
 assert.match(native,/Pattern\.compile\("\[A-Za-z0-9_-\]\{16,96\}"\)/);
 assert.match(native,/setBarcodeFormats\(Barcode\.FORMAT_QR_CODE\)\.enableAutoZoom\(\)/);
 assert.match(native,/value\.getBytes\(StandardCharsets\.UTF_8\)\.length > MAX_QR_BYTES/);
 assert.match(native,/MAX_QR_BYTES = 7000/);
 assert.match(native,/proxy\.postMessage\(response\.toString\(\)\)/);
 assert.match(native,/request\.epoch == documentEpoch/);
 assert.match(native,/nativeScannerVisible && scannerHandoffPauseExpected/);
 assert.match(native,/STATE_COMPLETED\) startScanner/);
 assert.match(native,/areModulesAlreadyInstalled\(\)\) startScanner/);
 assert.doesNotMatch(native,/\.addJavascriptInterface\(|@JavascriptInterface|addOn(?:Success|Failure|Canceled)Listener\(this,/);
 assert.doesNotMatch(native,/android\.util\.Log|System\.out|FileOutputStream|openFileOutput|HttpURLConnection|\.getRawBytes\(/);
 assert.equal((native.match(/evaluateJavascript\(/g)||[]).length,1);
 assert.match(native,/evaluateJavascript\("window\.dispatchEvent\(new Event\('pagehide'\)\)"/);
});

test('native sheet reader worker and Pyodide assets are served only from the APK allowlist',()=>{
 assert.match(native,/RUNTIME_PATH = "\/omr-training\/api\/device-runtime\/"/);
 assert.match(native,/"\/omr-training\/api\/device-worker\.js"\.equals\(uri\.getPath\(\)\)/);
 assert.match(native,/RUNTIME_ASSETS\.contains\(name\)/);
 assert.match(native,/getAssets\(\)\.open\("device-runtime\/" \+ name\)/);
 assert.match(native,/uri\.getQuery\(\) != null \|\| uri\.getFragment\(\) != null/);
 assert.doesNotMatch(native,/FileOutputStream|openFileOutput|HttpURLConnection|approved_keys|student_records/);
 assert.equal(Object.keys(runtimeFiles).length,7);
 assert.deepEqual(engineFiles,['engine.py','bubble_evidence.py','responses.py','qr_decode.py','registration.py','physical_layout.py','template-v2.json','template-framed-legacy-v1.json']);
});

test('verified runtime bundler includes only checksum-matched reader assets',async()=>{
 const runtime=process.env.OMR_DEVICE_RUNTIME_SOURCE;
 if(!runtime){assert.ok(process.env.CI,'CI must stage the verified Pyodide runtime before running tests');return;}
 const os=await import('node:os'),path=await import('node:path');
 const out=await fs.mkdtemp(path.join(os.tmpdir(),'azm-reader-apk-'));
 try{
  const result=await prepareRuntimeAssets(runtime,fileURLToPath(new URL('../omr-readonly-training/device-engine/',import.meta.url)),out,fileURLToPath(new URL('../omr-readonly-training/device-worker.js',import.meta.url)));
  assert.deepEqual(new Set(result.runtimeFiles),new Set(['device-worker.js',...Object.keys(runtimeFiles),...engineFiles.map(name=>'engine/'+name)]));
  assert.ok(result.bytes>27_000_000&&result.bytes<32_000_000);
  assert.equal(await fs.readdir(out).then(items=>items.includes('approved_keys.py')),false);
  assert.equal(await fs.readdir(path.join(out,'engine')).then(items=>items.some(name=>/answer.?key|student/i.test(name))),false);
  await assert.rejects(prepareRuntimeAssets(path.join(out,'missing-source'),fileURLToPath(new URL('../omr-readonly-training/device-engine/',import.meta.url)),out,fileURLToPath(new URL('../omr-readonly-training/device-worker.js',import.meta.url))));
 }finally{await fs.rm(out,{recursive:true,force:true});}
});
test('reject unapproved, credential-bearing and non-HTTPS URLs',()=>{
 for(const value of ['http://azmaio.com/omr-training/','https://production.example.com','https://user:secret@azmaio.com/omr-training/','https://azmaio.com/api','https://azmaio.com/omr-training/?key=secret','https://azmaio.com/omr-training/#secret','https://example.trycloudflare.com'])assert.throws(()=>trainingConfig(value));
});

