import { PrismaClient } from '@prisma/client';

type RuntimeIdentity = {
  databaseRole: string;
  canLogin: boolean;
  superuser: boolean;
  createDb: boolean;
  createRole: boolean;
  bypassRls: boolean;
  createSchema: boolean;
  createDatabase: boolean;
  schemaOwnerMemberships: bigint | number;
  sessionReplicationRole: string;
};
type DmlBoundary = {
  sessionRead: boolean; sessionInsert: boolean; sessionUpdate: boolean;
  markDelete: boolean; resetAuditInsert: boolean; cancelAuditInsert: boolean;
  cancelAuditUpdate: boolean; cancelAuditDelete: boolean;
  resetAuditUpdate: boolean; resetAuditDelete: boolean;
  migrationWrite: boolean; triggerPrivilege: boolean;
};
type TriggerStatus = { tgname: string; tgenabled: string };
const expectedTriggers = [
  'AttendanceSession_archive_protection',
  'AttendanceSession_closed_reset_coherence',
  'AttendanceSession_generation_protection',
  'Attendance_archived_evidence',
  'AttendanceSessionCandidate_archived_evidence',
  'AttendanceResetOperation_immutable',
  'AttendanceResetOperation_insert_validation',
  'AttendanceSessionCancellation_immutable',
  'AttendanceSessionCancellation_coherence',
] as const;

function loginFromUrl(value: string): string {
  try {
    const url = new URL(value);
    if (!['postgresql:', 'postgres:'].includes(url.protocol) || !url.username)
      throw new Error('Unexpected PostgreSQL URL format');
    return decodeURIComponent(url.username);
  } catch {
    throw new Error('Production PostgreSQL connection identity is not configured safely.');
  }
}
function blocked(message: string): never {
  // No credentials, connection URLs, or application-row data are logged.
  throw new Error('Blocked unsafe production DB runtime: ' + message);
}

/**
 * Read-only, pre-listen production authorization check. The DB owner
 * and SQL migration account must NEVER be used by the running Node API.
 * This does not by itself make app-level cancellation audits unforgeable.
 */
export async function assertRestrictedRuntimeDatabase(
  db: PrismaClient,
  options: { databaseUrl: string; directUrl: string },
): Promise<void> {
  if (!options.databaseUrl || !options.directUrl)
    blocked('both runtime connection identities are mandatory');
  const runtimeName = loginFromUrl(options.databaseUrl);
  if (loginFromUrl(options.directUrl) !== runtimeName)
    blocked('DIRECT_URL and DATABASE_URL must use the same restricted login');

  // SQL text is hardcoded with no interpolation or user-controlled identifiers.
  const identityQuery = [
    'SELECT current_user AS "databaseRole",',
    'r.rolcanlogin AS "canLogin", r.rolsuper AS "superuser",',
    'r.rolcreatedb AS "createDb", r.rolcreaterole AS "createRole",',
    'r.rolbypassrls AS "bypassRls",',
    "has_schema_privilege(current_user,'public','CREATE') AS \"createSchema\",",
    "has_database_privilege(current_user,current_database(),'CREATE') AS \"createDatabase\",",
    "current_setting('session_replication_role') AS \"sessionReplicationRole\",",
    '(SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace',
    " WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S','f')",
    " AND pg_has_role(r.oid,c.relowner,'MEMBER')) AS \"schemaOwnerMemberships\"",
    'FROM pg_roles r WHERE r.rolname=current_user',
  ].join(' ');
  const grantsQuery = [
    'SELECT',
    "has_table_privilege(current_user,'public.\"AttendanceSession\"','SELECT') AS \"sessionRead\",",
    "has_table_privilege(current_user,'public.\"AttendanceSession\"','INSERT') AS \"sessionInsert\",",
    "has_table_privilege(current_user,'public.\"AttendanceSession\"','UPDATE') AS \"sessionUpdate\",",
    "has_table_privilege(current_user,'public.\"Attendance\"','DELETE') AS \"markDelete\",",
    "has_table_privilege(current_user,'public.\"AttendanceResetOperation\"','INSERT') AS \"resetAuditInsert\",",
    "has_table_privilege(current_user,'public.\"AttendanceSessionCancellation\"','INSERT') AS \"cancelAuditInsert\",",
    "has_table_privilege(current_user,'public.\"AttendanceSessionCancellation\"','UPDATE') AS \"cancelAuditUpdate\",",
    "has_table_privilege(current_user,'public.\"AttendanceSessionCancellation\"','DELETE') AS \"cancelAuditDelete\",",
    "has_table_privilege(current_user,'public.\"AttendanceResetOperation\"','UPDATE') AS \"resetAuditUpdate\",",
    "has_table_privilege(current_user,'public.\"AttendanceResetOperation\"','DELETE') AS \"resetAuditDelete\",",
    "has_table_privilege(current_user,'public.\"AttendanceSession\"','TRIGGER') AS \"triggerPrivilege\",",
    'EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace',
    "WHERE n.nspname='public' AND c.relname='_prisma_migrations'",
    "AND (has_table_privilege(current_user,c.oid,'INSERT')",
    "OR has_table_privilege(current_user,c.oid,'UPDATE')",
    "OR has_table_privilege(current_user,c.oid,'DELETE'))) AS \"migrationWrite\"",
  ].join(' ');
  const triggerQuery = [
    'SELECT t.tgname, t.tgenabled FROM pg_trigger t',
    'JOIN pg_class c ON c.oid=t.tgrelid',
    'JOIN pg_namespace n ON n.oid=c.relnamespace',
    "WHERE n.nspname='public' AND t.tgname IN (",
    expectedTriggers.map(name => "'" + name + "'").join(','),
    ')',
  ].join(' ');
  const results = await db.$transaction(async tx => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    const identity = (await tx.$queryRawUnsafe<RuntimeIdentity[]>(identityQuery))[0];
    const access = (await tx.$queryRawUnsafe<DmlBoundary[]>(grantsQuery))[0];
    const triggers = await tx.$queryRawUnsafe<TriggerStatus[]>(triggerQuery);
    return { identity, access, triggers };
  });
  const r = results.identity;
  if (!r || r.databaseRole !== runtimeName || !r.canLogin ||
      r.superuser || r.createDb || r.createRole || r.bypassRls ||
      r.createSchema || r.createDatabase ||
      Number(r.schemaOwnerMemberships) !== 0 ||
      r.sessionReplicationRole !== 'origin') {
    blocked('login has schema ownership, elevated privileges or unexpected identity');
  }
  const access = results.access;
  if (!access || !access.sessionRead || !access.sessionInsert ||
      !access.sessionUpdate || !access.markDelete ||
      !access.resetAuditInsert || !access.cancelAuditInsert ||
      access.cancelAuditUpdate || access.cancelAuditDelete ||
      access.resetAuditUpdate || access.resetAuditDelete ||
      access.migrationWrite || access.triggerPrivilege) {
    blocked('runtime DML or immutable-audit privilege requirements not met');
  }
  const enabled = new Map(results.triggers.map(x => [x.tgname,x.tgenabled]));
  if (expectedTriggers.some(name => !['O','A'].includes(enabled.get(name) || '')))
    blocked('required attendance/audit triggers are missing or disabled');
}
