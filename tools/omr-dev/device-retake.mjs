/** Declare a retake case; this does not verify answers or approve a scan. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {attestSession,validateRetakeNote,privateSessionDirectory} from './device-diagnostics.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const sample=process.argv[2],retakeOf=process.argv[3];
const acceptanceRoot=path.join(root,'tmp/omr-reference/device-acceptance');
const state=JSON.parse(await fs.readFile(path.join(acceptanceRoot,'current-session.json'),'utf8'));privateSessionDirectory(state,acceptanceRoot);await attestSession(state);
const report=JSON.parse(await fs.readFile(path.join(state.folder,'private-report.json'),'utf8'));
const source=report.samples.find(s=>s.sample===sample);if(!source)throw Error('Choose a Dxxx sample already preserved in this acceptance session');
const frozen=JSON.parse(await fs.readFile(path.join(root,'tmp/omr-reference/physical-validation/frozen-validation.json'),'utf8'));
const baselineHashes=Object.fromEntries(['S10','S11','S14','S16','S17','S18','S24'].map(s=>[s,frozen.sourceHashes[Number(s.slice(1))-1]]));
const note=validateRetakeNote({sample,retakeOf,sourceSha256:source.sourceSha256},source.sourceSha256,baselineHashes);
const filename=path.join(state.folder,'retake-notes.json');const notes=await fs.readFile(filename,'utf8').then(JSON.parse,()=>[]);
if(notes.some(n=>n.sample===sample))throw Error('This sample already has a retained retake declaration; do not overwrite its history');
notes.push({...note,declaredAt:new Date().toISOString()});await fs.writeFile(filename,JSON.stringify(notes,null,2)+'\n',{mode:0o600});
console.log('Retake declaration recorded:',sample,'for',retakeOf,'— not an answer-validation or approval decision');
