import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const migration = fs.readFileSync(path.join(process.cwd(),
  'prisma/migrations/20261117110000_verified_manual_exam_mark_audit/migration.sql'), 'utf8');
const preflight = fs.readFileSync(path.join(process.cwd(),
  'ops/postgres/manual-verification-preflight-readonly.sql'), 'utf8');

/** Ignore prose comments so a safety explanation does not trigger a false positive. */
function stripComments(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\r\n]*/g, '');
}

test('manual verification schema migration is additive, never destructive', () => {
  const source = stripComments(migration);
  assert.match(source, /\bBEGIN\s*;/i);
  assert.match(source, /\bCOMMIT\s*;/i);
  assert.match(source, /CREATE TABLE public\."ManualExamMarkVerificationAudit"/);
  assert.match(source, /CREATE FUNCTION public\.azm_verify_manual_exam_mark/);
  assert.match(source, /ON DELETE RESTRICT/);
  assert.doesNotMatch(source, /\bDROP\s+(?:DATABASE|SCHEMA|TABLE|INDEX|COLUMN|FUNCTION|TRIGGER)\b/i);
  assert.doesNotMatch(source, /\bTRUNCATE\b/i);
  assert.doesNotMatch(source, /\bDELETE\s+FROM\b/i);
  assert.doesNotMatch(source, /\b(?:UPDATE|INSERT\s+INTO)\s+(?:public\.)?"(?:Student|User|Attendance|AttendanceSession|OmrProvisionalMark|ManualExamMark|ExaminationResult)"\b/i);
  assert.doesNotMatch(source, /\bALTER\s+TABLE\s+public\."(?:Student|User|Attendance|AttendanceSession|OmrProvisionalMark|ManualExamMark|ExaminationResult)"/i);
  assert.doesNotMatch(source, /\bmigrate\s+reset\b|\bdb\s+push\b/i);
});

test('production preflight is transaction-scoped READ ONLY and never prints personal rows', () => {
  const source = stripComments(preflight);
  assert.match(source, /BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;/i);
  assert.match(source, /SET LOCAL statement_timeout/i);
  assert.match(source, /current_database\(\)\s*<>\s*'student_app_db'/i);
  assert.match(source, /\bROLLBACK\s*;\s*$/i);
  assert.match(source, /content_fingerprint/);
  assert.match(source, /COUNT\(\*\)/i);
  // Permission names such as 'UPDATE' and 'INSERT' are read as literals,
  // not executed statements. Exclude quoted values before checking SQL verbs.
  const executable = source.replace(/'(?:''|[^'])*'/g, "''");
  assert.doesNotMatch(executable, /\b(?:DROP|TRUNCATE|DELETE|UPDATE|INSERT|ALTER|CREATE|GRANT|REVOKE|VACUUM)\b/i);
  assert.doesNotMatch(source, /SELECT\s+(?:\*|s\.\*|m\.\*)\s+FROM/i);
});
