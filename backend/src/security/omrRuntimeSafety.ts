interface RuntimeQuery {
  $queryRawUnsafe<T = unknown>(query: string): Promise<T>;
}
interface Access {
  name: string; readable: boolean; insertable: boolean; updatable: boolean;
  unsafe: boolean; rls: boolean; policy: boolean;
}
/** Fail closed if OMR evidence is missing or the backend has broader access than required. */
export async function assertOmrRuntime(db: RuntimeQuery): Promise<void> {
  const rows = await db.$queryRawUnsafe<Access[]>(`SELECT c.relname AS name,
    has_table_privilege(current_user,c.oid,'SELECT') AS readable,
    has_table_privilege(current_user,c.oid,'INSERT') AS insertable,
    has_table_privilege(current_user,c.oid,'UPDATE') AS updatable,
    has_table_privilege(current_user,c.oid,'DELETE,TRUNCATE,TRIGGER') AS unsafe,
    c.relrowsecurity AS rls,
    EXISTS(SELECT 1 FROM pg_policy p WHERE p.polrelid=c.oid AND p.polcmd='*'
      AND pg_get_expr(p.polqual,p.polrelid)='true' AND pg_get_expr(p.polwithcheck,p.polrelid)='true'
      AND EXISTS(SELECT 1 FROM pg_roles r WHERE r.oid=ANY(p.polroles) AND pg_has_role(current_user,r.oid,'USAGE'))) AS policy
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
    AND c.relname IN ('OmrExam','OmrExamPermission','OmrAnswerKeyRevision','OmrScanBatch','OmrScanBatchItem','OmrScan','OmrDetectedResponse','OmrExamResult','OmrCorrectionAudit','OmrPublicationAudit','OmrLegacyPublication')`);
  if (rows.length !== 11 || rows.some(row => !row.readable || !row.insertable || row.unsafe || !row.rls || !row.policy ||
    row.updatable === ['OmrCorrectionAudit', 'OmrPublicationAudit', 'OmrLegacyPublication'].includes(row.name))) {
    throw new Error('Blocked unsafe production DB runtime: OMR tables, grants or RLS protections are missing or unsafe');
  }
}
