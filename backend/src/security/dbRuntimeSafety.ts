import { createHmac,randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

type RuntimeIdentity = {
  databaseRole: string;
  canLogin: boolean;
  superuser: boolean;
  createDb: boolean;
  createRole: boolean;
  bypassRls: boolean;
  replication: boolean;
  createSchema: boolean;
  createDatabase: boolean;
  schemaOwnerMemberships: bigint | number;
  sessionReplicationRole: string;
};
type DmlBoundary = {
  sessionRead: boolean; sessionInsert: boolean; sessionUpdate: boolean;
  markDelete: boolean; markTruncate: boolean; resetAuditInsert: boolean; cancelAuditInsert: boolean;
  cancelAuditUpdate: boolean; cancelAuditDelete: boolean;
  resetAuditUpdate: boolean; resetAuditDelete: boolean;
  resetAuditTruncate: boolean; cancelAuditTruncate: boolean;
  reopenAuditInsert: boolean; reopenAuditUpdate: boolean; reopenAuditDelete: boolean; reopenAuditTruncate: boolean;
  migrationWrite: boolean; migrationTruncate: boolean; triggerPrivilege: boolean;
};
type TriggerStatus = { tgname: string; tgenabled: string };
const expectedTriggers = [
  'ExamLifecycleEvent_immutable',
  'AttendanceSession_lifecycle_history',
  'Student_result_ownership',
  'ExamControlOperation_immutable',
  'ExamControlOperation_signed_insert',
  'ExamPlacementControl_signed_write',
  'Student_placement_freeze',
  'OfficeUseRecord_placement_freeze',
  'ExamHall_placement_freeze',
  'TestCenter_placement_freeze',
  'Student_sync_live_membership',
  'AttendanceSession_archive_protection',
  'AttendanceSession_closed_reset_coherence',
  'AttendanceSession_generation_protection',
  'Attendance_archived_evidence',
  'AttendanceSessionCandidate_archived_evidence',
  'AttendanceResetOperation_immutable',
  'AttendanceResetOperation_insert_validation',
  'AttendanceSessionCancellation_immutable',
  'AttendanceSessionCancellation_coherence',
  'Attendance_staged_no_delete',
  'AttendanceSessionReopening_immutable',
  'AttendanceSessionReopening_insert_validation',
  'AttendanceSessionReopening_coherence',
  'StudentStudyGroupCorrection_immutable',
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
    'r.rolbypassrls AS "bypassRls", r.rolreplication AS "replication",',
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
    "has_table_privilege(current_user,'public.\"Attendance\"','TRUNCATE') AS \"markTruncate\",",
    "has_table_privilege(current_user,'public.\"AttendanceResetOperation\"','INSERT') AS \"resetAuditInsert\",",
    "has_table_privilege(current_user,'public.\"AttendanceSessionCancellation\"','INSERT') AS \"cancelAuditInsert\",",
    "has_table_privilege(current_user,'public.\"AttendanceSessionCancellation\"','UPDATE') AS \"cancelAuditUpdate\",",
    "has_table_privilege(current_user,'public.\"AttendanceSessionCancellation\"','DELETE') AS \"cancelAuditDelete\",",
    "has_table_privilege(current_user,'public.\"AttendanceSessionCancellation\"','TRUNCATE') AS \"cancelAuditTruncate\",",
    "has_table_privilege(current_user,'public.\"AttendanceResetOperation\"','UPDATE') AS \"resetAuditUpdate\",",
    "has_table_privilege(current_user,'public.\"AttendanceResetOperation\"','DELETE') AS \"resetAuditDelete\",",
    "has_table_privilege(current_user,'public.\"AttendanceResetOperation\"','TRUNCATE') AS \"resetAuditTruncate\",",
    "has_table_privilege(current_user,'public.\"AttendanceSessionReopening\"','INSERT') AS \"reopenAuditInsert\",",
    "has_table_privilege(current_user,'public.\"AttendanceSessionReopening\"','UPDATE') AS \"reopenAuditUpdate\",",
    "has_table_privilege(current_user,'public.\"AttendanceSessionReopening\"','DELETE') AS \"reopenAuditDelete\",",
    "has_table_privilege(current_user,'public.\"AttendanceSessionReopening\"','TRUNCATE') AS \"reopenAuditTruncate\",",
    "has_table_privilege(current_user,'public.\"AttendanceSession\"','TRIGGER') AS \"triggerPrivilege\",",
    'EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace',
    "WHERE n.nspname='public' AND c.relname='_prisma_migrations'",
    "AND (has_table_privilege(current_user,c.oid,'INSERT')",
    "OR has_table_privilege(current_user,c.oid,'UPDATE')",
    "OR has_table_privilege(current_user,c.oid,'DELETE'))) AS \"migrationWrite\",",
    'EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace',
    "WHERE n.nspname='public' AND c.relname='_prisma_migrations'",
    "AND has_table_privilege(current_user,c.oid,'TRUNCATE')) AS \"migrationTruncate\"",
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
      r.superuser || r.createDb || r.createRole || r.bypassRls || r.replication ||
      r.createSchema || r.createDatabase ||
      Number(r.schemaOwnerMemberships) !== 0 ||
      r.sessionReplicationRole !== 'origin') {
    blocked('login has schema ownership, elevated privileges or unexpected identity');
  }
  const access = results.access;
  if (!access || !access.sessionRead || !access.sessionInsert ||
      !access.sessionUpdate || access.markDelete || access.markTruncate ||
      !access.resetAuditInsert || !access.cancelAuditInsert ||
      access.cancelAuditUpdate || access.cancelAuditDelete || access.cancelAuditTruncate ||
      access.resetAuditUpdate || access.resetAuditDelete || access.resetAuditTruncate ||
      !access.reopenAuditInsert || access.reopenAuditUpdate || access.reopenAuditDelete || access.reopenAuditTruncate ||
      access.migrationWrite || access.migrationTruncate || access.triggerPrivilege) {
    blocked('runtime DML or immutable-audit privilege requirements not met');
  }
  await assertStudyGroupAuditRuntime(db);
  const signingKey=process.env.EXAM_CONTROL_SIGNING_KEY;
  if(!signingKey||signingKey.length<64)blocked('Exam Session Control signing key is missing');
  const probe=randomUUID();
  const capability=await db.$queryRawUnsafe<any[]>('SELECT public.azm_exam_capability_probe($1,$2) AS valid',probe,createHmac('sha256',signingKey!).update(probe).digest('hex'));
  if(!capability[0]?.valid)blocked('Exam Session Control key does not match the provisioned DB capability');
  const controlGrants=await db.$queryRawUnsafe<any[]>(`SELECT
    has_table_privilege(current_user,'public."AttendanceSession"','DELETE,TRUNCATE') AS "sessionDelete",
    has_table_privilege(current_user,'public."AttendanceSessionCandidate"','DELETE,TRUNCATE') AS "rosterDelete",
    has_table_privilege(current_user,'public."ExamLifecycleEvent"','INSERT,UPDATE,DELETE,TRUNCATE') AS "lifecycleWrite",
    has_table_privilege(current_user,'public."ExamControlOperation"','INSERT,UPDATE,DELETE,TRUNCATE') AS "auditWrite",
    has_table_privilege(current_user,'public."ExamPlacementControl"','INSERT,UPDATE,DELETE,TRUNCATE') AS "freezeWrite",
    has_table_privilege(current_user,'public."ExamAttemptSequence"','INSERT,UPDATE,DELETE,TRUNCATE') AS "sequenceWrite",
    has_function_privilege(current_user,'public.azm_execute_exam_control(text,text)','EXECUTE') AS "execute"
  `);
  if(!controlGrants[0]?.execute||controlGrants[0].sessionDelete||controlGrants[0].rosterDelete||controlGrants[0].lifecycleWrite||controlGrants[0].auditWrite||controlGrants[0].freezeWrite||controlGrants[0].sequenceWrite)blocked('Exam control grants are unsafe');
  const statementGuards=await db.$queryRawUnsafe<any[]>(`SELECT count(*)::int AS count FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND t.tgname='ExamControl_statement_lock' AND t.tgenabled IN ('O','A') AND c.relname IN ('Student','OfficeUseRecord','ExamHall','TestCenter','AttendanceSession','AttendanceSessionCandidate','Attendance','ExamPlacementControl')`);
  if(statementGuards[0]?.count!==8)blocked('examination writer serialization guards missing');
  const signingBoundary=await db.$queryRawUnsafe<any[]>(`SELECT p.prosecdef, p.proconfig, pg_has_role(current_user,p.proowner,'MEMBER') AS owner_member,
    r.rolcanlogin OR r.rolsuper OR r.rolcreatedb OR r.rolcreaterole OR r.rolreplication OR r.rolbypassrls AS elevated,
    has_schema_privilege(r.oid,'public','CREATE') AS owner_create,
    EXISTS(SELECT 1 FROM pg_auth_members m WHERE m.roleid=r.oid OR m.member=r.oid) AS memberships,
    EXISTS(SELECT 1 FROM pg_class c WHERE c.relowner=r.oid AND c.relkind IN ('r','p')) AS owns_tables
    FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner WHERE p.oid='public.azm_execute_exam_control(text,text)'::regprocedure`);
  if(!signingBoundary[0]?.prosecdef||signingBoundary[0].owner_member||signingBoundary[0].elevated||signingBoundary[0].owner_create||signingBoundary[0].memberships||signingBoundary[0].owns_tables||!signingBoundary[0].proconfig?.includes('search_path=pg_catalog, public, azm_control_private, pg_temp'))blocked('signed deletion function owner/search path unsafe');
  const enabled = new Map(results.triggers.map(x => [x.tgname,x.tgenabled]));
  if (expectedTriggers.some(name => !['O','A'].includes(enabled.get(name) || '')))
    blocked('required attendance/audit triggers are missing or disabled');
}

/** Read-only release assertion, also exercised through the actual restricted login. */
export async function assertStudyGroupAuditRuntime(db: PrismaClient) {
  const rows = await db.$queryRawUnsafe<any[]>(`SELECT
    has_table_privilege(current_user,'public."StudentStudyGroupCorrection"','SELECT') AS readable,
    has_table_privilege(current_user,'public."StudentStudyGroupCorrection"','INSERT') AS insertable,
    has_table_privilege(current_user,'public."StudentStudyGroupCorrection"','UPDATE,DELETE,TRUNCATE,TRIGGER') AS mutable,
    c.relrowsecurity AS rls,
    EXISTS(SELECT 1 FROM pg_policy p WHERE p.polrelid=c.oid AND p.polcmd='*'
      AND pg_get_expr(p.polqual,p.polrelid)='true' AND pg_get_expr(p.polwithcheck,p.polrelid)='true'
      AND EXISTS(SELECT 1 FROM pg_roles r WHERE r.oid=ANY(p.polroles) AND pg_has_role(current_user,r.oid,'USAGE'))) AS policy,
    EXISTS(SELECT 1 FROM pg_trigger t WHERE t.tgrelid=c.oid AND t.tgname='StudentStudyGroupCorrection_immutable'
      AND t.tgenabled IN ('O','A') AND t.tgtype=58) AS immutable,
    EXISTS(SELECT 1 FROM pg_constraint f WHERE f.conrelid=c.oid AND f.contype='f'
      AND f.confrelid='public."Student"'::regclass AND f.confdeltype='r') AS restrictive
    FROM pg_class c WHERE c.oid='public."StudentStudyGroupCorrection"'::regclass`);
  const access = rows[0];
  if (!access?.readable || !access.insertable || access.mutable || !access.rls || !access.policy || !access.immutable || !access.restrictive)
    blocked('study group correction audit access/protection is missing or unsafe');
}
