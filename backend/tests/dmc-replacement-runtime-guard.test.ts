import assert from 'node:assert/strict';
import test from 'node:test';
import type { PrismaClient } from '@prisma/client';
import { assertDmcReplacementRuntime } from '../src/security/dbRuntimeSafety';

const expected = {
  readable: true,
  insertable: true,
  mutable: false,
  rls: true,
  immutable: true,
  validated: true,
  read_policy: true,
  insert_policy: true,
};

function mockedDb(overrides: Partial<typeof expected> = {}) {
  return {
    $queryRawUnsafe: async (sql: string) => {
      assert.match(sql, /DmcReplacement_append_only/);
      assert.match(sql, /DmcReplacement_validate/);
      assert.match(sql, /pg_policy/);
      return [{ ...expected, ...overrides }];
    },
  } as unknown as PrismaClient;
}

test('DMC replacement runtime guard accepts a correctly restricted audit boundary', async () => {
  await assert.doesNotReject(() => assertDmcReplacementRuntime(mockedDb()));
});

test('DMC replacement runtime guard fails closed on changed grants, policies and triggers', async () => {
  for (const [field, value] of [
    ['readable', false], ['insertable', false], ['mutable', true],
    ['rls', false], ['immutable', false], ['validated', false],
    ['read_policy', false], ['insert_policy', false],
  ] as const) {
    await assert.rejects(
      () => assertDmcReplacementRuntime(mockedDb({ [field]: value })),
      /DMC replacement audit access\/protection is missing or unsafe/,
      field,
    );
  }
});

test('DMC replacement runtime guard blocks a missing migration table', async () => {
  const db = { $queryRawUnsafe: async () => { throw new Error('relation DmcReplacement does not exist'); } } as unknown as PrismaClient;
  await assert.rejects(() => assertDmcReplacementRuntime(db), /DmcReplacement does not exist/);
});
