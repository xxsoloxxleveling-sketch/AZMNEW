import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { authorizeRoles } from '../src/middleware/role.middleware.ts';

function runRoleCheck(role?: string) {
  let statusCode = 200;
  let body: unknown;
  let advanced = false;
  const req = { user: role ? { role } : undefined } as any;
  const res = {
    status(code: number) { statusCode = code; return this; },
    json(value: unknown) { body = value; return this; },
  } as any;
  authorizeRoles('SUPER_ADMIN', 'ADMIN')(req, res, () => { advanced = true; });
  return { statusCode, body, advanced };
}

describe('interview route role boundary', () => {
  it('allows Admin and Super Admin', () => {
    assert.equal(runRoleCheck('ADMIN').advanced, true);
    assert.equal(runRoleCheck('SUPER_ADMIN').advanced, true);
  });

  it('rejects Teacher, Accountant and unauthenticated requests', () => {
    assert.equal(runRoleCheck('TEACHER').statusCode, 403);
    assert.equal(runRoleCheck('ACCOUNTANT').statusCode, 403);
    assert.equal(runRoleCheck().statusCode, 401);
  });
});
