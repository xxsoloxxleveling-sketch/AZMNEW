#!/usr/bin/env node
'use strict';
// Read-only privilege inventory. Run with an explicit DATABASE_URL and --read-only.
// Never prints connection strings, passwords, row-level application data or tokens.
const { Client } = require('pg');
async function main() {
  if (!process.argv.includes('--read-only')) throw new Error('Specify --read-only.');
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL must be supplied.');
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    application_name: 'azm-db-role-readonly-preflight',
  });
  try {
    await client.connect();
    await client.query('BEGIN READ ONLY');
    const roleSql = [
      'SELECT current_user AS "loginRole", current_database() AS "databaseName",',
      "(SELECT setting FROM pg_settings WHERE name='server_version') AS \"postgresVersion\",",
      'r.rolsuper AS "superuser", r.rolcreatedb AS "canCreateDb",',
      'r.rolcreaterole AS "canCreateRole", r.rolbypassrls AS "canBypassRls",',
      'r.rolinherit AS "canInherit",',
      'has_schema_privilege(current_user,\'public\',\'CREATE\') AS "canCreateInPublic",',
      'has_database_privilege(current_user,current_database(),\'CREATE\') AS "canCreateInDatabase"',
      'FROM pg_roles r WHERE r.rolname=current_user'
    ].join(' ');
    const {rows:[role]}=await client.query(roleSql);
    const {rows:owners}=await client.query([
      'SELECT r.rolname AS "ownerRole", COUNT(*)::integer AS "objectCount",',
      'BOOL_OR(c.relname IN (\'AttendanceSession\',\'Attendance\',',
      '\'AttendanceSessionCandidate\',\'AttendanceResetOperation\',',
      '\'AttendanceSessionCancellation\')) AS "attendanceOwner"',
      'FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace',
      'JOIN pg_roles r ON r.oid=c.relowner',
      "WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S','f')",
      'GROUP BY r.rolname ORDER BY "objectCount" DESC'
    ].join(' '));
    const {rows:[integrity]}=await client.query([
      'SELECT COUNT(*) FILTER(WHERE NOT t.tgisinternal)::integer AS "customTriggers",',
      "COUNT(*) FILTER(WHERE NOT t.tgisinternal AND t.tgenabled='D')::integer AS \"disabledTriggers\"",
      'FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid',
      'JOIN pg_namespace n ON n.oid=c.relnamespace',
      "WHERE n.nspname='public' AND c.relname IN",
      "('AttendanceSession','Attendance','AttendanceSessionCandidate',",
      "'AttendanceResetOperation','AttendanceSessionCancellation')"
    ].join(' '));
    const {rows:[membership]}=await client.query([
      "SELECT COUNT(*) FILTER(WHERE pg_has_role(",
      "(SELECT oid FROM pg_roles WHERE rolname=current_user),c.relowner,'MEMBER'))::integer",
      'AS "ownedOrInheritedPublicObjects" FROM pg_class c',
      'JOIN pg_namespace n ON n.oid=c.relnamespace',
      "WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S','f')"
    ].join(' '));
    const tables=['AttendanceSession','Attendance','AttendanceSessionCandidate',
      'AttendanceResetOperation','AttendanceSessionCancellation','_prisma_migrations'];
    const {rows:acl}=await client.query([
      'SELECT c.relname AS "table",',
      "has_table_privilege(current_user,c.oid,'SELECT') AS \"read\",",
      "has_table_privilege(current_user,c.oid,'INSERT') AS \"insert\",",
      "has_table_privilege(current_user,c.oid,'UPDATE') AS \"update\",",
      "has_table_privilege(current_user,c.oid,'DELETE') AS \"delete\",",
      "has_table_privilege(current_user,c.oid,'TRIGGER') AS \"alterTriggerPrivilege\"",
      'FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace',
      "WHERE n.nspname='public' AND c.relkind IN ('r','p')",
      'AND c.relname=ANY($1) ORDER BY c.relname'
    ].join(' '),[tables]);
    await client.query('COMMIT');
    console.log(JSON.stringify({
      inventoryOnly:true, role, ownership:owners, integrity, membership, tables:acl,
      clearDDLBoundary:!role.superuser && !role.canCreateDb && !role.canCreateRole &&
        !role.canCreateInPublic && !role.canCreateInDatabase &&
        Number(membership.ownedOrInheritedPublicObjects)===0 &&
        acl.every(x=>!x.alterTriggerPrivilege)
    },null,2));
  } finally { await client.end(); }
}
main().catch(error=>{
  console.error('Read-only inventory failed:',String(error.message||error));
  process.exitCode=1;
});
