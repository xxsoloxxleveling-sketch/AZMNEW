import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

/** Test infrastructure only. Never discovers or connects to a database server. */
export function postgresExecutable(name: string): string {
  const suffix = process.platform === 'win32' ? '.exe' : '';
  const configured = process.env.AZM_TEST_POSTGRES_BIN || process.env.STAFF_TEST_POSTGRES_BIN || process.env.ATTENDANCE_TEST_PG_BIN;
  const roots = configured ? [configured] : [
    ...(process.env.PATH || '').split(path.delimiter),
    ...[17, 18].flatMap(version => [
      path.join(process.env.ProgramFiles || 'C:/Program Files', 'PostgreSQL', String(version), 'bin'),
      `/usr/lib/postgresql/${version}/bin`, `/opt/homebrew/opt/postgresql@${version}/bin`,
    ]),
  ];
  const directory = roots.find(root => fs.existsSync(path.join(root, name + suffix)) && fs.existsSync(path.join(root, (name==='psql'||name==='pg_dump'||name==='pg_restore'?name:'postgres') + suffix)));
  if (!directory) throw new Error('Native PostgreSQL test binaries unavailable. Set AZM_TEST_POSTGRES_BIN to a PostgreSQL 17/18 bin directory, or configure the isolated loopback test service. Production URLs are prohibited.');
  const version = execFileSync(path.join(directory, (['psql','pg_dump','pg_restore'].includes(name)?name:'postgres') + suffix), ['--version'], { encoding: 'utf8', windowsHide: true });
  if (!/PostgreSQL\) (17|18)\./.test(version)) throw new Error('Native regression requires PostgreSQL 17 or 18; release compatibility must also be tested against 17.');
  return path.join(directory, name + suffix);
}
