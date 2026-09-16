import assert from 'assert';
import {
  createAnnouncementSchema,
  updateAnnouncementSchema,
} from '../src/modules/announcements/announcements.schema';
import {
  announcementsService,
} from '../src/modules/announcements/announcements.service';
import { prisma } from '../src/lib/prisma';

async function runTests() {
  console.log('🚀 Starting AZM.AIO Public Announcement Tests...\n');

  // Set up in-memory fixture for prisma.systemSetting
  const settingStore = new Map<string, string>();
  (prisma.systemSetting.findUnique as any) = async ({ where }: any) => {
    const val = settingStore.get(where.key);
    if (!val) return null;
    return { id: 'test-id', key: where.key, value: val, updatedAt: new Date() };
  };
  (prisma.systemSetting.upsert as any) = async ({ where, update, create }: any) => {
    const val = update?.value || create?.value;
    settingStore.set(where.key, val);
    return { id: 'test-id', key: where.key, value: val, updatedAt: new Date() };
  };

  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => Promise<void> | void) {
    try {
      fn();
      console.log(`✅ PASS: ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`❌ FAIL: ${name}\n`, err);
      failed++;
    }
  }

  async function asyncTest(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      console.log(`✅ PASS: ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`❌ FAIL: ${name}\n`, err);
      failed++;
    }
  }

  console.log('--- 1. Testing Schema Validation ---');

  test('1. Schema rejects invalid type (e.g. "RESULT", "RANDOM")', () => {
    const result = createAnnouncementSchema.safeParse({
      title: 'Valid Title Here',
      message: 'Valid message body text',
      type: 'RESULT', // Invalid! Must be urgent, registration, exam, info
      badge: 'RESULT',
      isPinned: false,
      isPublished: true,
    });
    assert.strictEqual(result.success, false);
  });

  test('2.1 Schema rejects title < 3 characters', () => {
    const result = createAnnouncementSchema.safeParse({
      title: 'Hi',
      message: 'Valid message body text',
      type: 'info',
      badge: 'NOTICE',
    });
    assert.strictEqual(result.success, false);
  });

  test('2.2 Schema rejects title > 150 characters', () => {
    const result = createAnnouncementSchema.safeParse({
      title: 'A'.repeat(151),
      message: 'Valid message body text',
      type: 'info',
      badge: 'NOTICE',
    });
    assert.strictEqual(result.success, false);
  });

  test('2.3 Schema rejects message < 5 characters', () => {
    const result = createAnnouncementSchema.safeParse({
      title: 'Valid Title',
      message: 'Tiny',
      type: 'info',
      badge: 'NOTICE',
    });
    assert.strictEqual(result.success, false);
  });

  test('2.4 Schema rejects message > 2000 characters', () => {
    const result = createAnnouncementSchema.safeParse({
      title: 'Valid Title',
      message: 'A'.repeat(2001),
      type: 'info',
      badge: 'NOTICE',
    });
    assert.strictEqual(result.success, false);
  });

  test('3. Schema rejects publishStartAt > publishEndAt', () => {
    const result = createAnnouncementSchema.safeParse({
      title: 'Valid Title',
      message: 'Valid message text',
      type: 'urgent',
      badge: 'URGENT',
      publishStartAt: '2026-10-20T10:00:00Z',
      publishEndAt: '2026-10-10T10:00:00Z', // Earlier than start!
    });
    assert.strictEqual(result.success, false);
  });

  test('3.1 Schema accepts valid payload with publishStartAt <= publishEndAt', () => {
    const result = createAnnouncementSchema.safeParse({
      title: 'Valid Title',
      message: 'Valid message text',
      type: 'exam',
      badge: 'EXAM',
      publishStartAt: '2026-10-01T10:00:00Z',
      publishEndAt: '2026-10-20T10:00:00Z',
    });
    assert.strictEqual(result.success, true);
  });

  test('3.2 Schema rejects client-supplied id, createdAt, or updatedAt', () => {
    const result = createAnnouncementSchema.safeParse({
      id: 'hacked-id',
      title: 'Valid Title',
      message: 'Valid message text',
      type: 'info',
      badge: 'NOTICE',
    });
    assert.strictEqual(result.success, false);
  });

  console.log('\n--- 2. Testing Persistence & Fallback Semantics ---');

  await asyncTest('4. Missing SystemSetting key returns configured: false and empty data', async () => {
    settingStore.clear(); // Ensure clean store
    const res = await announcementsService.getPublicAnnouncements();
    assert.strictEqual(res.configured, false);
    assert.deepStrictEqual(res.data, []);
  });

  let createdId1: string;
  let createdId2: string;

  await asyncTest('5. Create first announcement: sets configured: true in storage', async () => {
    const item = await announcementsService.createAnnouncement({
      title: 'First Live Announcement',
      subtitle: 'Session V Notice',
      message: 'Registration is currently open for all regional centers.',
      type: 'registration',
      badge: 'REGISTRATION',
      isPinned: false,
      isPublished: true,
    });
    assert.ok(item.id);
    assert.strictEqual(item.title, 'First Live Announcement');
    assert.ok(item.createdAt);
    assert.ok(item.updatedAt);
    createdId1 = item.id;

    const publicRes = await announcementsService.getPublicAnnouncements();
    assert.strictEqual(publicRes.configured, true);
    assert.strictEqual(publicRes.data.length, 1);
    assert.strictEqual(publicRes.data[0].id, item.id);
  });

  console.log('\n--- 3. Testing Scheduling & Visibility Logic ---');

  let draftId: string;
  let scheduledId: string;
  let expiredId: string;

  await asyncTest('6. Draft announcement (isPublished: false) is excluded from public GET', async () => {
    const draft = await announcementsService.createAnnouncement({
      title: 'Draft Announcement',
      message: 'This announcement is not published yet.',
      type: 'info',
      badge: 'DRAFT',
      isPinned: false,
      isPublished: false,
    });
    draftId = draft.id;

    const publicRes = await announcementsService.getPublicAnnouncements();
    const found = publicRes.data.find((a) => a.id === draftId);
    assert.strictEqual(found, undefined);

    const adminRes = await announcementsService.getAdminAnnouncements();
    const adminFound = adminRes.items.find((a) => a.id === draftId);
    assert.ok(adminFound);
  });

  await asyncTest('7. Future scheduled announcement (publishStartAt > now) is excluded from public GET', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 5).toISOString(); // +5 days
    const scheduled = await announcementsService.createAnnouncement({
      title: 'Future Scheduled Announcement',
      message: 'This will only be visible in the future.',
      type: 'exam',
      badge: 'SCHEDULED',
      isPinned: false,
      isPublished: true,
      publishStartAt: futureDate,
    });
    scheduledId = scheduled.id;

    const publicRes = await announcementsService.getPublicAnnouncements();
    const found = publicRes.data.find((a) => a.id === scheduledId);
    assert.strictEqual(found, undefined);
  });

  await asyncTest('8. Currently live announcement (now between start and end) is included in public GET', async () => {
    const pastDate = new Date(Date.now() - 86400000 * 2).toISOString(); // -2 days
    const futureDate = new Date(Date.now() + 86400000 * 2).toISOString(); // +2 days
    const live = await announcementsService.createAnnouncement({
      title: 'Currently Active Scheduled Announcement',
      message: 'This notice is currently active within its window.',
      type: 'urgent',
      badge: 'ACTIVE',
      isPinned: false,
      isPublished: true,
      publishStartAt: pastDate,
      publishEndAt: futureDate,
    });
    createdId2 = live.id;

    const publicRes = await announcementsService.getPublicAnnouncements();
    const found = publicRes.data.find((a) => a.id === createdId2);
    assert.ok(found);
    assert.strictEqual(found?.title, 'Currently Active Scheduled Announcement');
  });

  await asyncTest('9. Expired announcement (publishEndAt < now) is excluded from public GET', async () => {
    const farPastStart = new Date(Date.now() - 86400000 * 10).toISOString(); // -10 days
    const pastEnd = new Date(Date.now() - 86400000 * 2).toISOString(); // -2 days
    const expired = await announcementsService.createAnnouncement({
      title: 'Expired Announcement',
      message: 'This announcement has already passed its end date.',
      type: 'info',
      badge: 'EXPIRED',
      isPinned: false,
      isPublished: true,
      publishStartAt: farPastStart,
      publishEndAt: pastEnd,
    });
    expiredId = expired.id;

    const publicRes = await announcementsService.getPublicAnnouncements();
    const found = publicRes.data.find((a) => a.id === expiredId);
    assert.strictEqual(found, undefined);
  });

  console.log('\n--- 4. Testing Sorting Rules ---');

  await asyncTest('10. Pinned announcements sort before unpinned announcements', async () => {
    // Pin createdId2
    await announcementsService.updateAnnouncement(createdId2, { isPinned: true });

    const publicRes = await announcementsService.getPublicAnnouncements();
    assert.strictEqual(publicRes.data[0].id, createdId2);
    assert.strictEqual(publicRes.data[0].isPinned, true);
  });

  await asyncTest('11. Newest announcements sort deterministically when pinned status is identical', async () => {
    // Both unpinned:
    await announcementsService.updateAnnouncement(createdId1, { isPinned: false });
    await announcementsService.updateAnnouncement(createdId2, { isPinned: false });

    const publicRes = await announcementsService.getPublicAnnouncements();
    // createdId2 was created after createdId1
    assert.strictEqual(publicRes.data[0].id, createdId2);
    assert.strictEqual(publicRes.data[1].id, createdId1);
  });

  console.log('\n--- 5. Testing Update & Delete CRUD Operations ---');

  await asyncTest('12. Update existing announcement works and updates fields', async () => {
    const updated = await announcementsService.updateAnnouncement(createdId1, {
      title: 'Updated Title',
      badge: 'UPDATED_BADGE',
    });
    assert.strictEqual(updated.title, 'Updated Title');
    assert.strictEqual(updated.badge, 'UPDATED_BADGE');

    const publicRes = await announcementsService.getPublicAnnouncements();
    const found = publicRes.data.find((a) => a.id === createdId1);
    assert.strictEqual(found?.title, 'Updated Title');
  });

  await asyncTest('13. Update unknown ID returns controlled 404', async () => {
    let errorCaught: any = null;
    try {
      await announcementsService.updateAnnouncement('non-existent-id-999', {
        title: 'New Title',
      });
    } catch (err: any) {
      errorCaught = err;
    }
    assert.ok(errorCaught);
    assert.strictEqual(errorCaught.statusCode, 404);
  });

  await asyncTest('14. Delete existing announcement works and removes it', async () => {
    const res = await announcementsService.deleteAnnouncement(createdId1);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.id, createdId1);

    const publicRes = await announcementsService.getPublicAnnouncements();
    const found = publicRes.data.find((a) => a.id === createdId1);
    assert.strictEqual(found, undefined);
  });

  await asyncTest('15. Delete unknown ID returns controlled 404', async () => {
    let errorCaught: any = null;
    try {
      await announcementsService.deleteAnnouncement('non-existent-id-999');
    } catch (err: any) {
      errorCaught = err;
    }
    assert.ok(errorCaught);
    assert.strictEqual(errorCaught.statusCode, 404);
  });

  console.log('\n--- 6. Testing Partial PATCH Date-Range Validation (Merged State) ---');

  let patchTestId: string;

  await asyncTest('A. Partial PATCH end date before existing start date is REJECTED (400)', async () => {
    const item = await announcementsService.createAnnouncement({
      title: 'Schedule Validation Item',
      message: 'Testing partial PATCH schedule validation.',
      type: 'exam',
      badge: 'SCHEDULE',
      isPinned: false,
      isPublished: true,
      publishStartAt: '2026-10-10T00:00:00.000Z',
      publishEndAt: '2026-10-20T00:00:00.000Z',
    });
    patchTestId = item.id;

    let err: any = null;
    try {
      await announcementsService.updateAnnouncement(patchTestId, {
        publishEndAt: '2026-10-05T00:00:00.000Z', // 5 days before existing start (Oct 10)
      });
    } catch (e: any) {
      err = e;
    }
    assert.ok(err, 'Expected error was not thrown');
    assert.strictEqual(err.statusCode, 400);
    assert.strictEqual(err.message, 'publishStartAt must be earlier than or equal to publishEndAt');
  });

  await asyncTest('B. Partial PATCH start date after existing end date is REJECTED (400)', async () => {
    let err: any = null;
    try {
      await announcementsService.updateAnnouncement(patchTestId, {
        publishStartAt: '2026-10-25T00:00:00.000Z', // 5 days after existing end (Oct 20)
      });
    } catch (e: any) {
      err = e;
    }
    assert.ok(err, 'Expected error was not thrown');
    assert.strictEqual(err.statusCode, 400);
    assert.strictEqual(err.message, 'publishStartAt must be earlier than or equal to publishEndAt');
  });

  await asyncTest('C. Existing schedule is NOT mutated or persisted after rejected PATCH', async () => {
    const adminRes = await announcementsService.getAdminAnnouncements();
    const current = adminRes.items.find((a) => a.id === patchTestId);
    assert.ok(current);
    // Preserves original boundaries: Oct 10 and Oct 20
    assert.strictEqual(current.publishStartAt, '2026-10-10T00:00:00.000Z');
    assert.strictEqual(current.publishEndAt, '2026-10-20T00:00:00.000Z');
  });

  await asyncTest('D. Partial PATCH clearing end date with null is ALLOWED', async () => {
    const updated = await announcementsService.updateAnnouncement(patchTestId, {
      publishEndAt: null,
    });
    assert.strictEqual(updated.publishStartAt, '2026-10-10T00:00:00.000Z');
    assert.strictEqual(updated.publishEndAt, null);
  });

  await asyncTest('E. Partial PATCH clearing start date with null is ALLOWED', async () => {
    // First reset end date back to Oct 20
    await announcementsService.updateAnnouncement(patchTestId, {
      publishEndAt: '2026-10-20T00:00:00.000Z',
    });

    const updated = await announcementsService.updateAnnouncement(patchTestId, {
      publishStartAt: null,
    });
    assert.strictEqual(updated.publishStartAt, null);
    assert.strictEqual(updated.publishEndAt, '2026-10-20T00:00:00.000Z');
  });

  await asyncTest('F. Simultaneous PATCH of both start and end date (Oct 1 to Oct 30) is ALLOWED', async () => {
    const updated = await announcementsService.updateAnnouncement(patchTestId, {
      publishStartAt: '2026-10-01T00:00:00.000Z',
      publishEndAt: '2026-10-30T00:00:00.000Z',
    });
    assert.strictEqual(updated.publishStartAt, '2026-10-01T00:00:00.000Z');
    assert.strictEqual(updated.publishEndAt, '2026-10-30T00:00:00.000Z');
  });

  await asyncTest('16. Intentionally empty managed list remains configured: true with data: []', async () => {
    // Delete all remaining announcements in store
    const adminRes = await announcementsService.getAdminAnnouncements();
    for (const item of adminRes.items) {
      await announcementsService.deleteAnnouncement(item.id);
    }

    const finalRes = await announcementsService.getPublicAnnouncements();
    assert.strictEqual(finalRes.configured, true);
    assert.deepStrictEqual(finalRes.data, []);
  });

  console.log('\n========================================');
  console.log(`Test Results: ${passed} Passed, ${failed} Failed`);
  console.log('========================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
