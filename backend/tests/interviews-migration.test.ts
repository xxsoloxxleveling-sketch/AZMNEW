import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const migrationUrl = new URL('../prisma/migrations/20261120120000_interview_hall_management/migration.sql', import.meta.url);

describe('interview schema migration', () => {
  it('applies additively, enforces core constraints, and retains immutable removal history', async () => {
    const db = new PGlite();
    try {
      await db.exec("CREATE TABLE \"User\" (\"id\" TEXT PRIMARY KEY); CREATE TABLE \"Student\" (\"id\" TEXT PRIMARY KEY);");
      await db.exec(await readFile(migrationUrl, 'utf8'));

      const tableNames = await db.query<{ table_name: string }>(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'Interview%' ORDER BY table_name",
      );
      assert.equal(tableNames.rows.length, 5);

      await db.exec("INSERT INTO \"User\" (\"id\") VALUES ('u1'); INSERT INTO \"Student\" (\"id\") VALUES ('s1'), ('s2'); INSERT INTO \"InterviewRound\" (\"id\", \"sessionRef\", \"title\", \"createdById\", \"updatedAt\") VALUES ('r1', 'exam-session-1', 'Test round', 'u1', CURRENT_TIMESTAMP); INSERT INTO \"InterviewHall\" (\"id\", \"roundId\", \"name\", \"roomNumber\", \"capacity\", \"updatedAt\") VALUES ('h1', 'r1', 'Hall A', '101', 1, CURRENT_TIMESTAMP);");

      await db.exec("INSERT INTO \"InterviewResultApproval\" (\"id\", \"roundId\", \"campaignReference\", \"snapshotHash\", \"candidateCount\", \"officialResultCount\", \"evidenceReference\", \"evidenceSha256\", \"reason\", \"approvedById\") VALUES ('approval-1', 'r1', '2026-V', repeat('a', 64), 1, 1, 'gazette-file-1', repeat('b', 64), 'Matched to final approved Gazette', 'u1')");
      await assert.rejects(
        db.exec("UPDATE \"InterviewResultApproval\" SET \"reason\" = 'changed' WHERE \"id\" = 'approval-1'"),
        /append-only/,
      );

      await assert.rejects(
        db.exec("INSERT INTO \"InterviewHall\" (\"id\", \"roundId\", \"name\", \"roomNumber\", \"capacity\", \"updatedAt\") VALUES ('bad-capacity', 'r1', 'Invalid', '102', 0, CURRENT_TIMESTAMP)"),
        /InterviewHall_capacity_check/,
      );
      await assert.rejects(
        db.exec("INSERT INTO \"InterviewHall\" (\"id\", \"roundId\", \"name\", \"roomNumber\", \"capacity\", \"scheduleStartAt\", \"updatedAt\") VALUES ('bad-schedule', 'r1', 'Invalid', '103', 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"),
        /InterviewHall_schedule_check/,
      );

      await db.exec("INSERT INTO \"InterviewAssignment\" (\"id\", \"roundId\", \"studentId\", \"hallId\", \"allocationType\", \"queueNumber\", \"isLocked\", \"lockedAt\", \"lockedById\", \"assignedById\", \"updatedAt\") VALUES ('a1', 'r1', 's1', 'h1', 'MANUAL', 1, TRUE, CURRENT_TIMESTAMP, 'u1', 'u1', CURRENT_TIMESTAMP)");
      await assert.rejects(
        db.exec("INSERT INTO \"InterviewAssignment\" (\"id\", \"roundId\", \"studentId\", \"hallId\", \"allocationType\", \"assignedById\", \"updatedAt\") VALUES ('a2', 'r1', 's1', 'h1', 'AUTO', 'u1', CURRENT_TIMESTAMP)"),
        /InterviewAssignment_roundId_studentId_key/,
      );

      await db.exec("INSERT INTO \"InterviewAllocationAudit\" (\"id\", \"roundId\", \"hallId\", \"assignmentId\", \"studentId\", \"actorId\", \"action\") VALUES ('audit-1', 'r1', 'h1', 'a1', 's1', 'u1', 'ASSIGNED_MANUAL')");
      await db.exec("DELETE FROM \"InterviewAssignment\" WHERE \"id\" = 'a1'");
      await db.exec("DELETE FROM \"Student\" WHERE \"id\" = 's1'");
      const history = await db.query<{ assignmentId: string; studentId: string }>(
        "SELECT \"assignmentId\", \"studentId\" FROM \"InterviewAllocationAudit\" WHERE \"id\" = 'audit-1'",
      );
      assert.deepEqual(history.rows, [{ assignmentId: 'a1', studentId: 's1' }]);

      await assert.rejects(
        db.exec("UPDATE \"InterviewAllocationAudit\" SET \"reason\" = 'changed' WHERE \"id\" = 'audit-1'"),
        /append-only/,
      );
    } finally {
      await db.close();
    }
  });
});
