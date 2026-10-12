// Run relevant regression suites only against individually disposable local databases.
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { Client } = require('pg');

const backend = path.resolve(__dirname, '..');
const root = path.resolve(backend, '..');
const suites = process.argv.slice(2);
const source = new URL(process.env.ATTENDANCE_TEST_DATABASE_URL || '');
if (process.env.NODE_ENV === 'production' || !['localhost', '127.0.0.1', '[::1]'].includes(source.hostname)) {
  throw new Error('An explicitly configured localhost test database is required.');
}
source.pathname = '/postgres';
source.search = '';
const logDir = path.join(root, 'tmp', 'reset-verification');
fs.mkdirSync(logDir, { recursive: true });

async function run() {
  const admin = new Client({ connectionString: source.toString() });
  await admin.connect();
  const results = [];
  try {
    for (const suite of suites) {
      if (!/^[a-z0-9-]+$/.test(suite) || !fs.existsSync(path.join(__dirname, suite + '.test.ts'))) {
        throw new Error('Unknown regression suite: ' + suite);
      }
      const name = 'reset_regression_' + randomUUID().replace(/-/g, '');
      const fixtureUrl = new URL(source);
      fixtureUrl.pathname = '/' + name;
      await admin.query(`CREATE DATABASE "${name}"`);
      let fixture;
      try {
        fixture = new Client({ connectionString: fixtureUrl.toString() });
        await fixture.connect();
        const migrationDir = path.join(backend, 'prisma', 'migrations');
        for (const folder of fs.readdirSync(migrationDir).sort()) {
          const file = path.join(migrationDir, folder, 'migration.sql');
          if (fs.existsSync(file)) await fixture.query(fs.readFileSync(file, 'utf8'));
        }
        await fixture.end();
        fixture = undefined;
        const env = { ...process.env, NODE_ENV: 'test', DATABASE_URL: fixtureUrl.toString(), DIRECT_URL: fixtureUrl.toString() };
        for (const key of ['ATTENDANCE_TEST_DATABASE_URL', 'HALL_TEST_DATABASE_URL', 'VAULT_TEST_DATABASE_URL', 'ROLL_SLIP_TEST_DATABASE_URL', 'EXAM_LOCATION_TEST_DATABASE_URL']) env[key] = fixtureUrl.toString();
        env.ATTENDANCE_TEST_DATABASE_URL = source.toString();
        // Remote storage credentials are never passed to synthetic regression suites.
        for (const key of Object.keys(env)) if (key.startsWith('R2_') || key.startsWith('SUPABASE_')) delete env[key];
        const result = spawnSync(process.execPath, [path.join(backend, 'node_modules', 'tsx', 'dist', 'cli.mjs'), path.join(__dirname, suite + '.test.ts')], {
          cwd: backend, env, encoding: 'utf8', timeout: 240000, windowsHide: true, maxBuffer: 8 * 1024 * 1024,
        });
        const output = (result.stdout || '') + (result.stderr || '');
        fs.writeFileSync(path.join(logDir, suite + '.log'), output);
        const passLines = output.split(/\r?\n/).filter(line => /(?:\bPASS\b|✅)/.test(line));
        const summary = output.split(/\r?\n/).filter(line => /(?:passed|\bPASS\b.*\bFAIL\b|TESTS_PASS|checks passed|EXIT)/i.test(line)).slice(-2);
        const item = { suite, exitCode: result.status, assertionsReported: passLines.length, summary, timedOut: result.error?.code === 'ETIMEDOUT' };
        results.push(item);
        console.log(JSON.stringify(item));
        if (result.status !== 0) console.log(output.split(/\r?\n/).filter(Boolean).slice(-8).join('\n'));
      } finally {
        await fixture?.end();
        await admin.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1', [name]);
        await admin.query(`DROP DATABASE IF EXISTS "${name}"`);
      }
    }
  } finally {
    await admin.end();
    fs.writeFileSync(path.join(logDir, 'regression-results.json'), JSON.stringify(results, null, 2));
  }
  if (results.some(item => item.exitCode !== 0)) process.exitCode = 1;
}
run().catch(error => { console.error(error.message); process.exitCode = 1; });
