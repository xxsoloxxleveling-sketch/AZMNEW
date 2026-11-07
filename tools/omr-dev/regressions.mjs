import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const suites=['admin-registration','attendance-cancellation-ui','attendance-reset-ui','hssc-group-printing','staff-payments-teacher-accounts-ui','dashboard-theme-ui'];
const directory=path.resolve('tmp/omr-dev/regressions');fs.mkdirSync(directory,{recursive:true});
const summary=[];
for(const suite of suites){
 const result=spawnSync(process.execPath,['--import','./backend/node_modules/tsx/dist/loader.mjs',`backend/tests/${suite}.test.ts`],{encoding:'utf8',windowsHide:true,timeout:90000,env:{...process.env,DATABASE_URL:'postgresql://unused@127.0.0.1:1/unused',JWT_ACCESS_SECRET:'synthetic-test-access-secret-that-is-long',JWT_REFRESH_SECRET:'synthetic-test-refresh-secret-that-is-long'}});
 fs.writeFileSync(path.join(directory,suite+'.txt'),result.stdout+'\n'+result.stderr);
 summary.push({suite,passed:result.status===0,status:result.status,error:result.error?.message});console.log(suite,result.status===0?'PASS':result.error?'BLOCKED/TIMEOUT':'FAIL');
}
fs.writeFileSync(path.join(directory,'summary.json'),JSON.stringify(summary,null,2));
