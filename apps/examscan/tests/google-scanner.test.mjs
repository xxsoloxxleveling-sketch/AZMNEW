import test from 'node:test';
import assert from 'node:assert/strict';
import { createGoogleScannerBridge } from '../native/google-scanner-core.js';
const code = 'qr_candidate_123.' + 'a'.repeat(64);
function fixture({ platform='android', installed=true, camera=true, scanResult, scanError }={}) {
  const calls=[];
  let available=installed;
  const bridge=createGoogleScannerBridge({
    Capacitor:{isNativePlatform:()=>platform!=='web', getPlatform:()=>platform},
    BarcodeFormat:{QrCode:'qr_code'},
    BarcodeScanner:{
      isSupported:async()=>({supported:camera}),
      isGoogleBarcodeScannerModuleAvailable:async()=>({available}),
      addListener:async(name,handler)=>{assert.equal(name,'googleBarcodeScannerModuleInstallProgress');handler({progress:35});return {remove:async()=>calls.push('remove-listener')}},
      installGoogleBarcodeScannerModule:async()=>calls.push('install'),
      scan:async(options)=>{calls.push(options);if(scanError)throw scanError;return scanResult||{barcodes:[{rawValue:code}]}}
    }
  });
  return {bridge,calls,markInstalled:()=>{available=true}};
}
test('Android Google Code Scanner uses QR-only mode, auto-zoom and returns untouched token',async()=>{
  const {bridge,calls}=fixture();
  assert.equal(await bridge.scanWithGoogle(),code);
  assert.deepEqual(calls,[{formats:['qr_code'],autoZoom:true}]);
});
test('first scan waits for Google module to install and never invents a QR result',async()=>{
  const f=fixture({installed:false});
  const progress=[];
  assert.deepEqual(await f.bridge.prepareGoogleScanner(x=>progress.push(x)),{ready:false,downloading:true});
  assert.deepEqual(progress,[35]);
  await assert.rejects(()=>f.bridge.scanWithGoogle(),/downloading through Play Services/);
  assert.equal(f.calls.filter(x=>typeof x==='object').length,0);
  f.markInstalled();
  assert.equal(await f.bridge.scanWithGoogle(),code);
});
test('scanner cancel does not produce a token or attendance action',async()=>{
  const f=fixture({scanError:{code:'canceled'}});
  assert.equal(await f.bridge.scanWithGoogle(),null);
});
test('Google scanner refuses unsupported platforms and devices',async()=>{
  await assert.rejects(()=>fixture({platform:'web'}).bridge.scanWithGoogle(),/installed Android app/);
  await assert.rejects(()=>fixture({camera:false}).bridge.scanWithGoogle(),/supported camera/);
});
test('Google scanner surfaces device failures rather than pretending attendance succeeded',async()=>{
  await assert.rejects(()=>fixture({scanError:new Error('Google Play Services not available')}).bridge.scanWithGoogle(),/Play Services/);
});
