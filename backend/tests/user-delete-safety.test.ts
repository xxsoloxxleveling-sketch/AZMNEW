import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://synthetic:synthetic@127.0.0.1:1/fixture';
process.env.DIRECT_URL = process.env.DATABASE_URL;

async function run() {
  const { prisma, Role } = await import('../src/lib/prisma');
  const { usersService } = await import('../src/modules/users/users.service');
  const originals = {
    transaction: prisma.$transaction,
    getUserById: usersService.getUserById,
  };
  const accounts = new Map<string, any>();
  const sources = [
    'attendanceSession', 'attendance', 'attendanceResetOperation',
    'attendanceSessionCancellation', 'attendanceSessionReopening', 'staff', 'studentDocument',
    'studentDocumentAudit', 'partnerStatusAudit', 'transaction',
  ] as const;
  let referencingSource: string | null = null;
  let passed = 0;
  const check = async (label: string, fn: () => Promise<void>) => {
    await fn();
    passed++;
    console.log('PASS: ' + label);
  };
  const tester = (id: string, role: string = Role.TEACHER) => ({
    id, role, status: 'ACTIVE', email: id + '@test.invalid', name: id,
  });
  const blocked = async (id: string, requester: string, status: number) => {
    await assert.rejects(
      usersService.deleteUser(id, requester),
      (error: any) => error.statusCode === status,
    );
    assert(accounts.has(id), 'Blocked deletion must retain the original account');
  };
  try {
    usersService.getUserById = async (id: string) => {
      const user = accounts.get(id);
      if (!user) throw Object.assign(new Error('Not found'), { statusCode: 404 });
      return user;
    };
    (prisma as any).$transaction = async (callback: (tx: any) => Promise<any>, options: any) => {
      assert.equal(options?.isolationLevel, 'Serializable');
      const tx: any = {
        user: {
          count: async ({ where }: any) =>
            [...accounts.values()].filter(u => u.role === where.role && u.status === where.status).length,
          delete: async ({ where }: any) => {
            const user = accounts.get(where.id);
            assert(user);
            accounts.delete(where.id);
            return user;
          },
        },
      };
      for (const source of sources) {
        tx[source] = { count: async () => Number(source === referencingSource) };
      }
      return callback(tx);
    };

    await check('Delete cleanly unused test login', async () => {
      accounts.set('unused', tester('unused'));
      await usersService.deleteUser('unused', 'admin');
      assert(!accounts.has('unused'));
    });
    for (const source of sources) {
      await check('Retain accounts referenced by ' + source, async () => {
        accounts.set('linked', tester('linked'));
        referencingSource = source;
        await blocked('linked', 'admin', 409);
        accounts.delete('linked');
        referencingSource = null;
      });
    }
    await check('Cannot delete your own login', async () => {
      accounts.set('self', tester('self', Role.SUPER_ADMIN));
      await blocked('self', 'self', 400);
      accounts.clear();
    });
    await check('Cannot delete last active Super Admin', async () => {
      accounts.set('only-admin', tester('only-admin', Role.SUPER_ADMIN));
      await blocked('only-admin', 'other-user', 409);
      accounts.clear();
    });
    await check('Can delete another Super Admin when another active admin remains', async () => {
      accounts.set('first-admin', tester('first-admin', Role.SUPER_ADMIN));
      accounts.set('second-admin', tester('second-admin', Role.SUPER_ADMIN));
      await usersService.deleteUser('second-admin', 'first-admin');
      assert(!accounts.has('second-admin') && accounts.has('first-admin'));
    });
    console.log('Account deletion safety: ' + passed + ' passed, 0 failed');
  } finally {
    (prisma as any).$transaction = originals.transaction;
    usersService.getUserById = originals.getUserById;
    await prisma.$disconnect();
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
