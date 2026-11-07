import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

/** Test infrastructure only. Never discovers or connects to a database server. */
export function postgresExecutable(name: string, discovery:{roots?:string[];exists?:(file:string)=>boolean;probe?:(file:string)=>string}={}): string {
  const suffix = process.platform === 'win32' ? '.exe' : '';
  const configured = process.env.AZM_TEST_POSTGRES_BIN || process.env.STAFF_TEST_POSTGRES_BIN || process.env.ATTENDANCE_TEST_PG_BIN;
  const roots = discovery.roots || (configured ? [configured] : [
    ...(process.env.PATH || '').split(path.delimiter),
    ...[17, 18].flatMap(version => [
      path.join(process.env.ProgramFiles || 'C:/Program Files', 'PostgreSQL', String(version), 'bin'),
      `/usr/lib/postgresql/${version}/bin`, `/opt/homebrew/opt/postgresql@${version}/bin`,
    ]),
  ]);
  for(const directory of roots) {
    const executable=path.join(directory,name+suffix);
    const probe=path.join(directory,(['psql','pg_dump','pg_restore'].includes(name)?name:'postgres')+suffix);
    const exists=discovery.exists||fs.existsSync;
    if(!exists(executable)||!exists(probe))continue;
    try {
      const version=discovery.probe?discovery.probe(probe):execFileSync(probe,['--version'],{encoding:'utf8',windowsHide:true,timeout:5000});
      if(/PostgreSQL\) (17|18)\./.test(version))return executable;
    } catch { /* Continue discovery; a stale PATH entry must not hide a valid installation. */ }
  }
  throw new Error('Native PostgreSQL 17/18 test tools unavailable. Set AZM_TEST_POSTGRES_BIN to compatible binaries or an isolated loopback service client. Production URLs are prohibited.');
}
