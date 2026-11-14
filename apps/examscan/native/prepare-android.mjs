/** Build-time Android scaffolding. Installs nothing globally; never touches a live backend. */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
const root=resolve(import.meta.dirname,'..');
if (!existsSync(resolve(root,'node_modules/@capacitor/android'))) throw new Error('Run npm install before building Android.');
if (!existsSync(resolve(root,'dist/native-bridge.js'))) throw new Error('Google scanner bundle missing. Run npm run native:bundle.');
const cfg=readFileSync(resolve(root,'config.js'),'utf8');
const url=cfg.match(/apiOrigin:\s*['"]([^'"]+)['"]/i)?.[1]||'';
if(!/^https:\/\/[^\s/?#:@]+(?:\.[^\s/?#:@]+)+(?:\:\d+)?$/.test(url))throw new Error('A real HTTPS AZM.AIO API origin must be configured before packaging Android.');
const isWindows=process.platform==='win32';
const npx=isWindows?'npx.cmd':'npx';
function cap(...args){execFileSync(npx,['--no-install','cap',...args],{cwd:root,stdio:'inherit'});}
if(!existsSync(resolve(root,'android/app')))cap('add','android');
cap('sync','android');
const manifest=resolve(root,'android/app/src/main/AndroidManifest.xml');
let xml=readFileSync(manifest,'utf8');
if(!xml.includes('com.google.mlkit.vision.DEPENDENCIES')){
  xml=xml.replace(/(<application\b[^>]*>)/, '$1\n        <meta-data android:name="com.google.mlkit.vision.DEPENDENCIES" android:value="barcode_ui" />');
  writeFileSync(manifest,xml);
}
// Google Play Services scanner is permissionless; don't request camera permission.
if(xml.includes('android.permission.CAMERA'))throw new Error('Google Code Scanner does not require CAMERA permission. Review Android manifest before release.');
console.log('Android app synced; Google Play Services scanner module prefetch enabled.');
