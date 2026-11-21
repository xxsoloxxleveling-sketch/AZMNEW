import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assertInterviewAssessmentRuntime } from '../src/security/dbRuntimeSafety.ts';

const protectedRows = () => ['InterviewPanelRevision', 'InterviewAssessmentRevision'].map(tableName => ({
  tableName, readable: true, insertable: true, mutable: false, immutable: true,
}));

describe('interview assessment startup protection', () => {
  it('accepts only insertable, readable, immutable revision records', async () => {
    await assertInterviewAssessmentRuntime({ $queryRawUnsafe: async () => protectedRows() } as any);
  });

  for (const tableName of ['InterviewPanelRevision', 'InterviewAssessmentRevision']) {
    for (const [field, value] of [['readable', false], ['insertable', false], ['mutable', true], ['immutable', false]] as const) {
      it(`rejects ${tableName} when ${field} is ${value}`, async () => {
        const rows = protectedRows();
        const row = rows.find(item => item.tableName === tableName)!;
        row[field] = value;
        await assert.rejects(
          assertInterviewAssessmentRuntime({ $queryRawUnsafe: async () => rows } as any),
          /interview assessment revision access\/protection/,
        );
      });
    }
  }

  it('rejects a release before both assessment tables exist', async () => {
    await assert.rejects(
      assertInterviewAssessmentRuntime({ $queryRawUnsafe: async () => protectedRows().slice(0, 1) } as any),
      /interview assessment revision access\/protection/,
    );
  });
});
