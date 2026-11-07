/** CI-only bridge to official PostgreSQL 17 client tools in its disposable Docker service. */
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
const [tool,container,...args]=process.argv.slice(2);
if(!['psql','pg_dump','pg_restore'].includes(tool)||!/^[a-f0-9]{12,64}$/.test(container)||process.env.CI!=='true')throw new Error('Disposable CI PostgreSQL tools only');
let input='inherit',output='inherit';
const fds=[];
function fixtureFile(value){const file=path.resolve(value),parent=path.dirname(file);if(path.dirname(parent)!==path.resolve(os.tmpdir())||!path.basename(parent).startsWith('azm-reset-migration-')||path.basename(file)!=='synthetic-attendance.dump')throw new Error('Only the disposable rehearsal archive is supported');return file;}
try {
  if(tool==='pg_dump'&&args.includes('--file')){
    const index=args.indexOf('--file'),file=fixtureFile(args[index+1]);args.splice(index,2);output=fs.openSync(file,'wx',0o600);fds.push(output);
  } else if(tool==='pg_restore'&&args.at(-1)?.endsWith('.dump')){
    const file=fixtureFile(args.pop());input=fs.openSync(file,'r');fds.push(input);
  }
  const result=spawnSync('docker',['exec','-i','-e','PGPASSWORD',container,tool,...args],{stdio:[input,output,'inherit'],env:process.env});
  if(result.error)throw result.error;process.exitCode=result.status??1;
} finally {for(const fd of fds)fs.closeSync(fd);}
