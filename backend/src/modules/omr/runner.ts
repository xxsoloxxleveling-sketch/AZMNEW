import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { z } from 'zod';
import { workerRoot } from './activation';
import { workerOutput } from './omr.schema';
import { fileType } from './storage';
import { omrError } from './access';

/** Do not forward process.env: backend database and signing credentials stay out of CV/PDF processes. */
export function recognitionEnvironment() {
  const env:NodeJS.ProcessEnv={};
  for(const name of ['PATH','SYSTEMROOT','WINDIR','TEMP','TMP','LANG']) if(process.env[name]) env[name]=process.env[name];
  env.OPENCV_IO_MAX_IMAGE_PIXELS='20000000';
  env.OMP_NUM_THREADS='1';
  return env;
}
export async function runRecognition(bytes:Buffer,page?:number) {
  const type=fileType(bytes), temporary=path.resolve(os.tmpdir());
  const directory=await fs.mkdtemp(path.join(temporary,'azm-omr-'));
  try {
    await fs.chmod(directory,0o700);
    const source=path.join(directory,`input.${type.extension}`),annotation=path.join(directory,'annotation.png');
    await fs.writeFile(source,bytes,{flag:'wx',mode:0o600});
    const args=[path.join(workerRoot(),'worker_cli.py'),source,...(page===undefined?['--inspect']:['--page',String(page),'--annotation',annotation])];
    const output=await new Promise<string>((resolve,reject)=>execFile(process.env.OMR_PYTHON||'python3',args,{timeout:45000,maxBuffer:2*1024*1024,windowsHide:true,env:recognitionEnvironment()},(error,stdout)=>{
      if(error && (!stdout || !String(stdout).trim().startsWith('{'))) return reject(omrError(503,'Recognition worker failed or timed out'));
      resolve(String(stdout));
    }));
    let parsed:unknown;
    try { parsed=JSON.parse(output); } catch { throw omrError(503,'Invalid recognition-worker response'); }
    if(page===undefined) {
      const inspected=z.object({pages:z.number().int().min(1).max(25),type:z.enum(['image','pdf'])}).safeParse(parsed);
      if(!inspected.success) throw omrError(422,'File validation or the isolated PDF renderer is unavailable');
      return {inspection:inspected.data,observation:null,annotation:null};
    }
    const observation=workerOutput.parse(parsed);
    if(observation.status!=='INVALID' && (!observation.responses || new Set(observation.responses.map(r=>r.question)).size!==100 || !observation.paperVersion)) throw omrError(503,'Incomplete recognition evidence');
    const marked=await fs.readFile(annotation).catch(()=>null);
    return {inspection:null,observation,annotation:marked};
  } finally {
    // Only remove this newly-created private job directory, never a caller-supplied path.
    if(path.dirname(path.resolve(directory))===temporary && path.basename(directory).startsWith('azm-omr-')) await fs.rm(directory,{recursive:true,force:true});
  }
}
