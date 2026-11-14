import {cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const files=['index.html','config.js','api.js','app.js','camera.js','ui.js','styles.css','service-worker.js','manifest.webmanifest','manifest.json','assets/mark.svg','assets/icon-192.png','assets/icon-512.png'];
for(const file of files)if(!existsSync(resolve(root,file)))throw new Error('Missing '+file);
const dist=resolve(root,'dist');rmSync(dist,{recursive:true,force:true});mkdirSync(dist,{recursive:true});
for(const file of files){const dest=resolve(dist,file);mkdirSync(dirname(dest),{recursive:true});cpSync(resolve(root,file),dest);}
if(existsSync(resolve(root,'native-bridge.js')))cpSync(resolve(root,'native-bridge.js'),resolve(dist,'native-bridge.js'));
const filesWritten=readdirSync(dist,{recursive:true}).length;
console.log(`Built static ExamScan PWA: ${filesWritten} files in dist. All source assets local; no API response is bundled.`);
