import fs from 'node:fs';
import path from 'node:path';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
export const workerRoot=()=>path.resolve(process.env.OMR_WORKER_ROOT||path.join(__dirname,'../../../../workers/omr'));
const digest=(bytes:Buffer|string)=>createHash('sha256').update(bytes).digest('hex');
export function recognitionHashes(root=workerRoot()) {
  return {profileSha256:digest(fs.readFileSync(path.join(root,'template-v2.json'))),engineSha256:digest(Buffer.concat(['engine.py','responses.py','pdf_input.py','worker_cli.py','printed_identity.py','registration.py'].map(name=>fs.readFileSync(path.join(root,name)))))};
}
/** Operator-signed release evidence, never HTTP-controlled. Absence or any mismatch fails closed. */
export function officialActivation() {
  try {
    const secret=process.env.OMR_VALIDATION_SIGNING_KEY;
    const manifestPath=process.env.OMR_VALIDATION_MANIFEST;
    const reportPath=process.env.OMR_PHYSICAL_REPORT;
    if(!secret || secret.length<32 || !manifestPath || !reportPath) return {approved:false,receipt:null};
    if(fs.statSync(manifestPath).size>32768 || fs.statSync(reportPath).size>4*1024*1024) return {approved:false,receipt:null};
    const envelope=z.object({payload:z.string().max(16384),signature:z.string().regex(/^[a-f0-9]{64}$/)}).strict().parse(JSON.parse(fs.readFileSync(manifestPath,'utf8')));
    const signature=createHmac('sha256',secret).update(envelope.payload).digest();
    if(!timingSafeEqual(signature,Buffer.from(envelope.signature,'hex'))) return {approved:false,receipt:null};
    const payload=z.object({status:z.literal('PHYSICAL_VALIDATED'),template:z.literal('AZM_OMR_V2_2026_V'),profileSha256:z.string().length(64),engineSha256:z.string().length(64),reportSha256:z.string().length(64),expiresAt:z.string().datetime(),approvedBy:z.string().min(1).max(128)}).strict().parse(JSON.parse(Buffer.from(envelope.payload,'base64url').toString('utf8')));
    const hashes=recognitionHashes();
    if(Date.parse(payload.expiresAt)<=Date.now() || payload.profileSha256!==hashes.profileSha256 || payload.engineSha256!==hashes.engineSha256 || payload.reportSha256!==digest(fs.readFileSync(reportPath))) return {approved:false,receipt:null};
    return {approved:true,receipt:digest(envelope.payload)};
  } catch { return {approved:false,receipt:null}; }
}
