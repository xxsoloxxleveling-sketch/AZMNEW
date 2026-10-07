import { createUserSchema, updateUserSchema } from '../src/modules/users/users.schema';
import { usersService } from '../src/modules/users/users.service';
import { authService } from '../src/modules/auth/auth.service';
import { usersController } from '../src/modules/users/users.controller';
import { hashPassword, comparePassword } from '../src/lib/hash';
import { prisma, Role } from '../src/lib/prisma';
import { signRefreshToken } from '../src/lib/jwt';

async function runUserManagementTests() {
  console.log('🚀 Starting AZM.AIO User Credential Management Tests...\n');

  // Safety Gate: Ensure test is never run in a production environment
  if (process.env.NODE_ENV === 'production') {
    throw new Error('ABORT: Automated tests must never run in production environment.');
  }

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: any) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`, detail || '');
      failed++;
    }
  }

  // =========================================================================
  // 1. Schema Password Validation (Create & Update)
  // =========================================================================
  console.log('--- 1. Testing Schema Password Validation ---');

  // 1.1 Create User: reject password < 8
  const createShortPass = createUserSchema.safeParse({
    name: 'Test Examiner',
    email: 'examiner@azmaio.com',
    role: Role.TEACHER,
    password: 'Short7!',
  });
  assert(!createShortPass.success, 'createUserSchema rejects password with < 8 characters');

  // 1.2 Create User: accept password >= 8
  const createValidPass = createUserSchema.safeParse({
    name: 'Test Examiner',
    email: 'examiner@azmaio.com',
    role: Role.TEACHER,
    password: 'ValidPass123',
  });
  assert(createValidPass.success, 'createUserSchema accepts valid password >= 8 characters');

  // 1.3 Create User: enforce role whitelist (only 4 database roles)
  const createInvalidRole = createUserSchema.safeParse({
    name: 'Test Staff',
    email: 'staff@azmaio.com',
    role: 'EXAM_MANAGER' as any,
    password: 'ValidPass123',
  });
  assert(!createInvalidRole.success, 'createUserSchema rejects non-whitelisted roles (e.g. EXAM_MANAGER)');

  // 1.4 Update User: reject password < 8 (e.g. 6 or 7 chars)
  const updateShortPass = updateUserSchema.safeParse({
    password: 'Pass6!',
  });
  assert(!updateShortPass.success, 'updateUserSchema rejects password with < 8 characters');

  // 1.5 Update User: accept password >= 8
  const updateValidPass = updateUserSchema.safeParse({
    password: 'NewStrongPassword123',
  });
  assert(updateValidPass.success, 'updateUserSchema accepts valid password >= 8 characters');

  // =========================================================================
  // 2. Password Hashing Security Path
  // =========================================================================
  console.log('\n--- 2. Testing Password Hashing Security ---');

  const rawPassword = 'SuperSecretPassword2026!';
  const hashedPassword = await hashPassword(rawPassword);

  assert(
    typeof hashedPassword === 'string' &&
      hashedPassword.startsWith('$2') &&
      hashedPassword !== rawPassword,
    'hashPassword generates a valid bcrypt hash, never storing plaintext'
  );

  const isCorrectMatch = await comparePassword(rawPassword, hashedPassword);
  assert(isCorrectMatch === true, 'comparePassword validates the correct password');

  const isWrongMatch = await comparePassword('WrongPassword', hashedPassword);
  assert(isWrongMatch === false, 'comparePassword rejects incorrect passwords');

  // =========================================================================
  // 3. Controller Requester Identity Forwarding
  // =========================================================================
  console.log('\n--- 3. Testing Controller Requester ID Forwarding ---');

  let forwardedRequesterId: string | undefined = undefined;
  let forwardedTargetId: string | undefined = undefined;
  let forwardedBody: any = undefined;

  const origServiceUpdate = usersService.updateUser;
  (usersService as any).updateUser = async (id: string, body: any, reqUserId?: string) => {
    forwardedTargetId = id;
    forwardedBody = body;
    forwardedRequesterId = reqUserId;
    return { id, name: 'Mock', email: 'mock@test.com', role: Role.ADMIN, status: 'ACTIVE' };
  };

  const fakeReq: any = {
    params: { id: 'target-user-123' },
    body: { name: 'Updated Name' },
    user: { id: 'requester-admin-456' },
  };
  const fakeRes: any = {
    status: function (code: number) {
      this.statusCode = code;
      return this;
    },
    json: function (data: any) {
      this.data = data;
      return this;
    },
  };
  const fakeNext = (err: any) => {
    if (err) throw err;
  };

  await usersController.update(fakeReq, fakeRes, fakeNext);

  assert(
    forwardedTargetId === 'target-user-123' &&
      forwardedBody?.name === 'Updated Name' &&
      forwardedRequesterId === 'requester-admin-456',
    'UsersController.update forwards req.user?.id to usersService.updateUser'
  );

  // Restore
  (usersService as any).updateUser = origServiceUpdate;

  // =========================================================================
  // 4. Active Super Admin Protection Matrix (Section 7 Requirements)
  // =========================================================================
  console.log('\n--- 4. Testing Active Super Admin Protection Matrix ---');

  // Isolated In-Memory Test Fixture (Safe: zero DB broad deletes)
  const testUsersMap = new Map<string, any>();

  // Backup original service methods
  const origGetUserById = usersService.getUserById.bind(usersService);
  const origTransaction = prisma.$transaction;
  let matrixTransactions = 0;

  // Stub the pre-transaction lookup to use the isolated test fixture
  usersService.getUserById = async (id: string) => {
    const user = testUsersMap.get(id);
    if (!user) {
      const error: any = new Error(`User with ID '${id}' not found.`);
      error.statusCode = 404;
      throw error;
    }
    return { ...user };
  };

  // Exercise the actual transaction callback; fixture users never reach the app DB.
  (prisma as any).$transaction = async (callback: any, options: any) => {
    if (options?.isolationLevel !== 'Serializable') throw new Error('Super-admin guards require Serializable isolation.');
    matrixTransactions++;
    return callback({ user: {
      count: async ({ where }: any) => [...testUsersMap.values()].filter(user => user.role === where.role && user.status === where.status).length,
      update: async ({ where, data }: any) => {
        const user = testUsersMap.get(where.id);
        if (!user) throw new Error('Missing fixture user.');
        const updated = { ...user, ...data, tokenVersion: data.tokenVersion?.increment ? (user.tokenVersion || 0) + data.tokenVersion.increment : user.tokenVersion };
        testUsersMap.set(where.id, updated); return { ...updated };
      },
      delete: async ({ where }: any) => {
        const user = testUsersMap.get(where.id);
        if (!user) throw new Error('Missing fixture user.');
        testUsersMap.delete(where.id); return { ...user };
      },
    }});
  };

  try {
  // 4.1 Only ONE ACTIVE SUPER_ADMIN exists. Demote it to ADMIN -> REJECTED
  testUsersMap.clear();
  testUsersMap.set('sa-1', {
    id: 'sa-1',
    name: 'Super Admin 1',
    email: 'sa1@test.com',
    role: Role.SUPER_ADMIN,
    status: 'ACTIVE',
  });

  let demote1Caught = false;
  let demote1Error: any = null;
  try {
    await usersService.updateUser('sa-1', { role: Role.ADMIN });
  } catch (err: any) {
    demote1Caught = true;
    demote1Error = err;
  }
  assert(
    demote1Caught &&
      demote1Error?.statusCode === 409 &&
      demote1Error?.message === 'You cannot change the role of the last active Super Admin.',
    '1. Only one ACTIVE SUPER_ADMIN exists: Demote to ADMIN -> REJECTED (409)'
  );

  // 4.2 Only ONE ACTIVE SUPER_ADMIN exists. Change status to INACTIVE -> REJECTED
  let deact1Caught = false;
  let deact1Error: any = null;
  try {
    await usersService.updateUser('sa-1', { status: 'INACTIVE' }, 'different-requester');
  } catch (err: any) {
    deact1Caught = true;
    deact1Error = err;
  }
  assert(
    deact1Caught &&
      deact1Error?.statusCode === 409 &&
      deact1Error?.message === 'You cannot deactivate the last active Super Admin.',
    '2. Only one ACTIVE SUPER_ADMIN exists: Change status to INACTIVE -> REJECTED (409)'
  );

  // 4.3 TWO ACTIVE SUPER_ADMIN accounts exist. Demote one -> ALLOWED
  testUsersMap.clear();
  testUsersMap.set('sa-1', {
    id: 'sa-1',
    name: 'Super Admin 1',
    email: 'sa1@test.com',
    role: Role.SUPER_ADMIN,
    status: 'ACTIVE',
  });
  testUsersMap.set('sa-2', {
    id: 'sa-2',
    name: 'Super Admin 2',
    email: 'sa2@test.com',
    role: Role.SUPER_ADMIN,
    status: 'ACTIVE',
  });

  let demote2Blocked = false;
  try {
    await usersService.updateUser('sa-2', { role: Role.ADMIN });
  } catch (err: any) {
    demote2Blocked = true;
  }
  assert(
    !demote2Blocked && testUsersMap.get('sa-2')?.role === Role.ADMIN,
    '3. Two ACTIVE SUPER_ADMIN accounts exist: Demote one -> ALLOWED'
  );

  // 4.4 TWO ACTIVE SUPER_ADMIN accounts exist. Deactivate one (by other requester) -> ALLOWED
  testUsersMap.clear();
  testUsersMap.set('sa-1', {
    id: 'sa-1',
    name: 'Super Admin 1',
    email: 'sa1@test.com',
    role: Role.SUPER_ADMIN,
    status: 'ACTIVE',
  });
  testUsersMap.set('sa-2', {
    id: 'sa-2',
    name: 'Super Admin 2',
    email: 'sa2@test.com',
    role: Role.SUPER_ADMIN,
    status: 'ACTIVE',
  });

  let deact2Blocked = false;
  try {
    await usersService.updateUser('sa-2', { status: 'INACTIVE' }, 'sa-1');
  } catch (err: any) {
    deact2Blocked = true;
  }
  assert(
    !deact2Blocked && testUsersMap.get('sa-2')?.status === 'INACTIVE',
    '4. Two ACTIVE SUPER_ADMIN accounts exist: Deactivate one -> ALLOWED'
  );

  // 4.5 ONE ACTIVE SUPER_ADMIN + ONE INACTIVE SUPER_ADMIN. Demote the ACTIVE one -> REJECTED
  testUsersMap.clear();
  testUsersMap.set('sa-active', {
    id: 'sa-active',
    name: 'Active Super Admin',
    email: 'active@test.com',
    role: Role.SUPER_ADMIN,
    status: 'ACTIVE',
  });
  testUsersMap.set('sa-inactive', {
    id: 'sa-inactive',
    name: 'Inactive Super Admin',
    email: 'inactive@test.com',
    role: Role.SUPER_ADMIN,
    status: 'INACTIVE',
  });

  let demoteActiveBlocked = false;
  let demoteActiveError: any = null;
  try {
    await usersService.updateUser('sa-active', { role: Role.ADMIN });
  } catch (err: any) {
    demoteActiveBlocked = true;
    demoteActiveError = err;
  }
  assert(
    demoteActiveBlocked &&
      demoteActiveError?.statusCode === 409 &&
      demoteActiveError?.message === 'You cannot change the role of the last active Super Admin.',
    '5. One ACTIVE + one INACTIVE Super Admin: Demote ACTIVE one -> REJECTED (409)'
  );

  // 4.6 ONE ACTIVE SUPER_ADMIN + ONE INACTIVE SUPER_ADMIN. Deactivate the ACTIVE one -> REJECTED
  let deactActiveBlocked = false;
  let deactActiveError: any = null;
  try {
    await usersService.updateUser('sa-active', { status: 'INACTIVE' }, 'other-requester');
  } catch (err: any) {
    deactActiveBlocked = true;
    deactActiveError = err;
  }
  assert(
    deactActiveBlocked &&
      deactActiveError?.statusCode === 409 &&
      deactActiveError?.message === 'You cannot deactivate the last active Super Admin.',
    '6. One ACTIVE + one INACTIVE Super Admin: Deactivate ACTIVE one -> REJECTED (409)'
  );

  // 4.7 ONE ACTIVE SUPER_ADMIN + ONE INACTIVE SUPER_ADMIN. Delete the ACTIVE one -> REJECTED
  let deleteActiveBlocked = false;
  let deleteActiveError: any = null;
  try {
    await usersService.deleteUser('sa-active', 'other-requester');
  } catch (err: any) {
    deleteActiveBlocked = true;
    deleteActiveError = err;
  }
  assert(
    deleteActiveBlocked &&
      deleteActiveError?.statusCode === 409 &&
      deleteActiveError?.message === 'Cannot delete the last remaining Super Admin account.',
    '7. One ACTIVE + one INACTIVE Super Admin: Delete ACTIVE one -> REJECTED (409)'
  );

  // 4.8 TWO ACTIVE SUPER_ADMIN accounts. Delete one where self-delete does not apply -> ALLOWED
  testUsersMap.clear();
  testUsersMap.set('sa-1', {
    id: 'sa-1',
    name: 'Super Admin 1',
    email: 'sa1@test.com',
    role: Role.SUPER_ADMIN,
    status: 'ACTIVE',
  });
  testUsersMap.set('sa-2', {
    id: 'sa-2',
    name: 'Super Admin 2',
    email: 'sa2@test.com',
    role: Role.SUPER_ADMIN,
    status: 'ACTIVE',
  });

  let deleteAllowedBlocked = false;
  try {
    await usersService.deleteUser('sa-2', 'sa-1');
  } catch (err: any) {
    deleteAllowedBlocked = true;
  }
  assert(
    !deleteAllowedBlocked && !testUsersMap.has('sa-2'),
    '8. Two ACTIVE Super Admin accounts: Delete one (non-self) -> ALLOWED'
  );

  // 4.9 Existing self-deactivation protection still passes -> REJECTED
  let selfDeactCaught = false;
  let selfDeactError: any = null;
  try {
    await usersService.updateUser('sa-1', { status: 'INACTIVE' }, 'sa-1');
  } catch (err: any) {
    selfDeactCaught = true;
    selfDeactError = err;
  }
  assert(
    selfDeactCaught &&
      selfDeactError?.statusCode === 400 &&
      selfDeactError?.message === 'You cannot deactivate your own account.',
    '9. Existing self-deactivation protection still passes -> REJECTED (400)'
  );

  // 4.10 Existing self-delete protection still passes -> REJECTED
  let selfDeleteCaught = false;
  let selfDeleteError: any = null;
  try {
    await usersService.deleteUser('sa-1', 'sa-1');
  } catch (err: any) {
    selfDeleteCaught = true;
    selfDeleteError = err;
  }
  assert(
    selfDeleteCaught &&
      selfDeleteError?.statusCode === 400 &&
      selfDeleteError?.message === 'You cannot delete your own account while logged in.',
    '10. Existing self-delete protection still passes -> REJECTED (400)'
  );

  assert(matrixTransactions === 8, 'Super-admin protection matrix exercises all eight Serializable transactions');
  } finally {
    usersService.getUserById = origGetUserById;
    (prisma as any).$transaction = origTransaction;
  }

  // =========================================================================
  // 5. Inactive Account Authentication Enforcement (Login & Refresh)
  // =========================================================================
  console.log('\n--- 5. Testing Inactive Account Auth Enforcement ---');

  const testPassword = 'Password123!';
  const testPasswordHash = await hashPassword(testPassword);
  const testIsolatedUserId = `test-inactive-${Date.now()}`;
  const testIsolatedEmail = `inactive-${Date.now()}@azmaio.com`;

  // Create isolated inactive user fixture
  await prisma.user.create({
    data: {
      id: testIsolatedUserId,
      name: 'Inactive Staff',
      email: testIsolatedEmail,
      passwordHash: testPasswordHash,
      role: Role.TEACHER,
      status: 'INACTIVE',
    },
  });

  // 5.1 Inactive account login rejection
  let inactiveLoginCaught = false;
  let inactiveLoginError: any = null;

  try {
    await authService.login({
      email: testIsolatedEmail,
      password: testPassword,
    });
  } catch (err: any) {
    inactiveLoginCaught = true;
    inactiveLoginError = err;
  }

  assert(
    inactiveLoginCaught &&
      inactiveLoginError?.statusCode === 403 &&
      inactiveLoginError?.message === 'This account is inactive. Contact the system administrator.',
    '11.1 AuthService.login rejects INACTIVE user with 403 "This account is inactive. Contact the system administrator."'
  );

  // 5.2 Inactive account refresh rejection
  const inactiveRefreshToken = signRefreshToken({ userId: testIsolatedUserId });
  let inactiveRefreshCaught = false;
  let inactiveRefreshError: any = null;

  try {
    await authService.refresh(inactiveRefreshToken);
  } catch (err: any) {
    inactiveRefreshCaught = true;
    inactiveRefreshError = err;
  }

  assert(
    inactiveRefreshCaught &&
      inactiveRefreshError?.statusCode === 403 &&
      inactiveRefreshError?.message === 'This account is inactive. Contact the system administrator.',
    '11.2 AuthService.refresh rejects INACTIVE user with 403 "This account is inactive. Contact the system administrator."'
  );

  // Clean up only the specific isolated test record (zero broad deletes)
  try {
    await prisma.user.delete({ where: { id: testIsolatedUserId } });
  } catch {}

  // =========================================================================
  // Summary
  // =========================================================================
  console.log(`\n========================================`);
  console.log(`Test Results: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runUserManagementTests().catch((err) => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
