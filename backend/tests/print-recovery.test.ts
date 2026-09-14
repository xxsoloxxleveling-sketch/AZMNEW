import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

async function run() {
  // No real database or storage is contacted by this regression suite.
  process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:1/test';
  const { prisma } = await import('../src/lib/prisma');
  const { StudentsService, getCandidateNumber } = await import('../src/modules/students/students.service');
  process.env.NODE_ENV = 'production'; // Route every model call to the stubs below.
  const service = new StudentsService();
  const year = new Date().getFullYear();
  const prefix = `AZMVS-${year}-`;
  const records: any = { a: { id: 'a', rollNumber: null }, b: { id: 'b', rollNumber: null } };
  const reservations = new Map<string, string>();
  let locked = 0;
  const tx: any = {
    $queryRaw: async () => { locked++; },
    student: {
      findUniqueOrThrow: async ({ where }: any) => ({ ...records[where.id], officeUse: { testRollNo: reservations.get(where.id) } }),
      findMany: async () => [{ rollNumber: `${prefix}0007` }],
    },
    officeUseRecord: {
      findMany: async () => [...reservations.values()].map(testRollNo => ({ testRollNo })),
      upsert: async ({ create }: any) => reservations.set(create.studentId, create.testRollNo),
    },
  };
  let queue = Promise.resolve();
  (prisma as any).$transaction = (fn: any) => {
    const result = queue.then(() => fn(tx));
    queue = result.then(() => undefined);
    return result;
  };
  const [a, repeat, b] = await Promise.all([
    service.reserveCandidateNumber('a'), service.reserveCandidateNumber('a'), service.reserveCandidateNumber('b'),
  ]);
  assert.equal(a, `${prefix}0008`);
  assert.equal(repeat, a);
  assert.equal(b, `${prefix}0009`);
  assert.equal(records.a.rollNumber, null, 'Reservation must not publish/issue');
  assert.equal(getCandidateNumber({ officeUse: { testRollNo: a } }).value, a);
  records.a.rollNumber = a;
  assert.equal(await service.reserveCandidateNumber('a'), a, 'Issued number must never change');
  assert.equal(locked, 4);

  const { supabaseStorage } = await import('../src/lib/supabaseStorage');
  supabaseStorage.uploadFile = async () => ({ error: null } as any);
  (prisma.student as any).findMany = async () => [{ ...records.b, feeRecords: [{ status: 'PAID' }] }];
  (prisma.student as any).update = async ({ data }: any) => {
    assert.equal(data.rollNumber, b, 'Batch issuance must use the saved reservation');
    records.b.rollNumber = data.rollNumber;
    return { ...records.b, ...data };
  };
  assert.equal((await service.issueRollNumbers()).count, 1);
  assert.equal(records.b.rollNumber, b);

  const key = `test-photo-recovery-${process.pid}`;
  const dir = path.join(process.cwd(), 'uploads', key);
  fs.mkdirSync(dir, { recursive: true });
  try {
    const photo = await sharp({ create: { width: 160, height: 160, channels: 3, background: '#336699' } }).jpeg().toBuffer();
    fs.writeFileSync(path.join(dir, 'photoThumbnail.jpg'), photo);
    (prisma.student as any).findFirst = async () => ({ id: 'uuid-photo-test', cnicOrBForm: key });
    (prisma.studentDocument as any).findFirst = async () => { throw new Error('Metadata unavailable'); };
    const recovered = await service.getStudentDocument('uuid-photo-test', 'photoThumbnail');
    assert.deepEqual(recovered.buffer, photo, 'UUID lookup must recover CNIC disk thumbnail');
    assert.equal(recovered.contentType, 'image/jpeg');
  } finally {
    fs.unlinkSync(path.join(dir, 'photoThumbnail.jpg'));
    fs.rmdirSync(dir);
  }
  console.log('PASS: stable reservations, distinct candidates, no early issuance, CNIC thumbnail recovery');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
