import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { randomUUID } from 'node:crypto';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { Client } from 'pg';

/** DBA-only setup; application queries use a separate restricted LOGIN. Loopback only. */
export async function hsscFixture(options: { groupBeforeMigration?: boolean; alternateGroup?: boolean } = {}) {
  assert.notEqual(process.env.NODE_ENV, 'production');
  const root = path.resolve(__dirname, '../..');
  const bin = process.env.STAFF_TEST_POSTGRES_BIN || 'C:/Program Files/PostgreSQL/18/bin';
  const executable = (name: string) => process.platform === 'win32' ? path.join(bin, name + '.exe') : name;
  let dir: string | undefined, log: number | undefined;
  let connection = process.env.ATTENDANCE_TEST_DATABASE_URL;
  if (!connection) {
    assert.equal(process.platform, 'win32', 'CI must supply its synthetic PostgreSQL service URL');
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'azm-hssc-'));
    execFileSync(executable('initdb'), ['-D', path.join(dir, 'data'), '-U', 'postgres', '-A', 'trust', '--encoding=UTF8', '--no-locale'], { windowsHide: true, stdio: 'pipe' });
    const port = await new Promise<number>(resolve => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = (s.address() as net.AddressInfo).port; s.close(() => resolve(p)); }); });
    log = fs.openSync(path.join(dir, 'postgres.log'), 'a');
    spawn(executable('postgres'), ['-D', path.join(dir, 'data'), '-h', '127.0.0.1', '-p', String(port)], { windowsHide: true, stdio: ['ignore', log, log] });
    connection = `postgresql://postgres@127.0.0.1:${port}/postgres`;
  }
  const ownerUrl = new URL(connection!);
  assert(['localhost', '127.0.0.1', '[::1]'].includes(ownerUrl.hostname), 'Synthetic loopback PostgreSQL only');
  ownerUrl.pathname = '/postgres'; ownerUrl.search = '';
  let owner = new Client({ connectionString: ownerUrl.toString() });
  for (let n = 0; ; n++) { try { await owner.connect(); break; } catch (error) { await owner.end().catch(() => {}); if (n > 80) throw error; await new Promise(r => setTimeout(r, 100)); owner = new Client({ connectionString: ownerUrl.toString() }); } }
  const tag = randomUUID().replaceAll('-', '');
  const database = 'hssc_' + tag, login = 'hssc_login_' + tag, capabilityOwner = 'hssc_cap_' + tag;
  const group = options.alternateGroup ? 'hssc_dml_' + tag : 'azm_app_dml';
  const password = randomUUID().replaceAll('-', '');
  const url = new URL(ownerUrl); url.pathname = '/' + database;
  const sql = new Client({ connectionString: url.toString() });
  const runtime = new URL(url); runtime.username = login; runtime.password = password;
  const provision = () => {
    const result = spawnSync(executable('psql'), ['-X', '-v', 'ON_ERROR_STOP=1', '-h', url.hostname, '-p', url.port || '5432', '-U', decodeURIComponent(url.username), '-d', database,
      '-v', 'target_db=' + database, '-v', 'login_role=' + login, '-v', 'grant_role=' + group,
      '-v', 'approved_ticket=SYNTHETIC-HSSC', '-v', 'accept_action=APPLY-AZM-RUNTIME-ROLE-GRANTS'],
    { input: fs.readFileSync(path.join(root, 'backend/ops/postgres/runtime-grants.sql'), 'utf8'), encoding: 'utf8', windowsHide: true,
      env: { ...process.env, PGPASSWORD: decodeURIComponent(url.password) }, timeout: 60000 });
    assert.equal(result.status, 0, 'Synthetic provisioning failed: ' + result.stderr + result.stdout);
  };
  const close = async () => {
    await sql.end();
    await owner.query(`DROP DATABASE "${database}" WITH (FORCE)`);
    for (const name of [login, group, capabilityOwner]) await owner.query(`DROP ROLE IF EXISTS "${name}"`);
    await owner.end();
    if (dir) { execFileSync(executable('pg_ctl'), ['-D', path.join(dir, 'data'), 'stop', '-m', 'fast', '-w'], { windowsHide: true, stdio: 'pipe' }); fs.closeSync(log!); }
  };
  try {
    await owner.query(`CREATE DATABASE "${database}"`); await sql.connect();
    if (process.env.REQUIRE_PG17 === 'true') assert.match((await sql.query('SHOW server_version_num')).rows[0].server_version_num, /^17\d{4}$/);
    if (options.groupBeforeMigration) await owner.query(`CREATE ROLE "${group}" NOLOGIN`);
    for (const name of fs.readdirSync(path.join(root, 'backend/prisma/migrations')).sort()) {
      const file = path.join(root, 'backend/prisma/migrations', name, 'migration.sql');
      if (fs.existsSync(file)) await sql.query(fs.readFileSync(file, 'utf8'));
    }
    await sql.query("SELECT set_config('azm.control_owner_role',$1,false)", [capabilityOwner]);
    await sql.query(fs.readFileSync(path.join(root, 'backend/ops/postgres/exam-control-capability.sql'), 'utf8'));
    const signingKey = 'synthetic-hssc-' + randomUUID() + randomUUID();
    await sql.query('INSERT INTO azm_control_private.signing_key(secret) VALUES($1)', [signingKey]);
    await owner.query(`CREATE ROLE "${login}" LOGIN INHERIT PASSWORD '${password}'`);
    provision();
    return { url: runtime.toString(), sql, provision, close, group, login, signingKey };
  } catch (error) { await close(); throw error; }
}
