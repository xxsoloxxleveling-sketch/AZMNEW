import assert from 'node:assert/strict';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { Client } from 'pg';

// Builds fixture tables in a disposable localhost database; never applies a migration.
async function run() {
  assert.notEqual(process.env.NODE_ENV, 'production');
  const source = new URL(process.env.ROLL_SLIP_TEST_DATABASE_URL || '');
  assert(['localhost', '127.0.0.1', '[::1]'].includes(source.hostname), 'localhost fixtures only');
  const backend = path.resolve(__dirname, '..');
  const name = 'roll_slip_13d3_' + randomUUID().replace(/-/g, '');
  const admin = new Client({ connectionString: source.toString() });
  const testUrl = new URL(source); testUrl.pathname = '/' + name; testUrl.search = '';
  const env = { ...process.env, DATABASE_URL: testUrl.toString(), DIRECT_URL: testUrl.toString(), NODE_ENV: 'test' };
  for (const key of Object.keys(env)) if (key.startsWith('R2_') || key.startsWith('SUPABASE_')) delete (env as any)[key];
  const tests = [
    'public-slip-cnic-search.test.ts', 'roll-number-decoupling.test.ts',
    'student-class-filtering.test.ts', 'students-controller-binding.test.ts',
    'print-routes.test.ts', 'print-recovery.test.ts', 'exam-schedule-paper-variant.test.ts',
    'admin-registration.test.ts',
  ];
  await admin.connect();
  let created = false;
  try {
    await admin.query('CREATE DATABASE "' + name + '"'); created = true;
    const ddl = execFileSync(process.execPath, [path.join(backend, 'node_modules/prisma/build/index.js'),
      'migrate', 'diff', '--from-empty', '--to-schema-datamodel', path.join(backend, 'prisma/schema.prisma'), '--script'],
      { cwd: backend, env, encoding: 'utf8' });
    const fixture = new Client({ connectionString: testUrl.toString() }); await fixture.connect();
    try { await fixture.query(ddl); } finally { await fixture.end(); }
    for (const test of tests) {
      await new Promise<void>((resolve, reject) => {
        const child = spawn(process.execPath, [path.join(backend, 'node_modules/tsx/dist/cli.mjs'), path.join(backend, 'tests', test)],
          { cwd: backend, env, stdio: 'inherit', windowsHide: true });
        child.on('error', reject); child.on('exit', code => code === 0 ? resolve() : reject(new Error(test + ' exited ' + code)));
      });
    }
    console.log('PASS: eight existing regression suites on disposable localhost fixture');
  } finally {
    if (created) {
      await admin.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()', [name]);
      await admin.query('DROP DATABASE "' + name + '"');
    }
    await admin.end();
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
