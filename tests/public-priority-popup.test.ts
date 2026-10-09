import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  choosePublicPriorityNotice,
  fetchPublicPriorityNotice,
  priorityNoticeDismissKey,
  priorityNoticeSeenKey,
  shouldAutoShowPriorityNotice,
  type PublicPriorityNotice,
} from '../src/services/publicPriorityNotices';
import { PriorityNoticeDisplay } from '../src/components/home/RegistrationAlertModal';

let passed = 0;
function check(name: string, fn: () => void | Promise<void>): Promise<void> {
  return Promise.resolve().then(fn).then(() => {
    passed++;
    console.log('PASS ' + name);
  });
}

const pinned = (overrides: Record<string, unknown> = {}) => ({
  id: 'featured-1', title: 'Roll Number Slips Allotment',
  subtitle: 'Official test-day instructions',
  message: 'Print a clear colour copy of your slip.',
  type: 'info', badge: 'OFFICIAL NOTICE', isPinned: true,
  createdAt: '2026-10-09T02:20:00.000Z',
  ...overrides,
});

async function run() {
  await check('Published pinned announcement is eligible', () => {
    assert.equal(choosePublicPriorityNotice([pinned()])?.title, 'Roll Number Slips Allotment');
  });
  await check('Empty configured public feed does not invent registration fallback', () => {
    assert.equal(choosePublicPriorityNotice([]), null);
  });
  await check('Non-priority info notices do not hijack the popup', () => {
    assert.equal(choosePublicPriorityNotice([pinned({ isPinned: false })]), null);
  });
  await check('Urgent notices are eligible without explicit pin', () => {
    assert.equal(choosePublicPriorityNotice([pinned({ id: 'urgent', type: 'urgent', isPinned: false })])?.id, 'urgent');
  });
  await check('Pinned info outranks unpinned urgent', () => {
    assert.equal(choosePublicPriorityNotice([
      pinned({ id: 'urgent', type: 'urgent', isPinned: false, createdAt: '2026-10-10T00:00:00.000Z' }),
      pinned({ id: 'pinned', isPinned: true }),
    ])?.id, 'pinned');
  });
  await check('Newest pinned item wins regardless of source order', () => {
    assert.equal(choosePublicPriorityNotice([
      pinned({ id: 'old', createdAt: '2026-10-01T00:00:00.000Z' }),
      pinned({ id: 'new', createdAt: '2026-10-09T00:00:00.000Z' }),
    ])?.id, 'new');
  });
  await check('Malformed data and missing title are ignored', () => {
    assert.equal(choosePublicPriorityNotice([{ id: 'bad', message: 'text', isPinned: true }]), null);
    assert.equal(choosePublicPriorityNotice({ bad: 'not-an-array' }), null);
  });
  await check('Empty badge safely defaults to official notice', () => {
    assert.equal(choosePublicPriorityNotice([pinned({ badge: '' })])?.badge, 'OFFICIAL NOTICE');
  });

  const day = 'Fri Oct 09 2026';
  const picked = choosePublicPriorityNotice([pinned()]) as PublicPriorityNotice;
  await check('Eligible notice auto-opens for a first public visit', () => {
    assert.equal(shouldAutoShowPriorityNotice(picked, day, null, false), true);
  });
  await check('Daily dismissal suppresses automatic reopening', () => {
    assert.equal(shouldAutoShowPriorityNotice(picked, day, day, false), false);
  });
  await check('Prior automatic display prevents repeated popup in same session', () => {
    assert.equal(shouldAutoShowPriorityNotice(picked, day, null, true), false);
  });
  await check('Previous-day dismissal allows updated daily display', () => {
    assert.equal(shouldAutoShowPriorityNotice(picked, day, 'Thu Oct 08 2026', false), true);
  });
  await check('No featured notice means no automatic modal', () => {
    assert.equal(shouldAutoShowPriorityNotice(null, day, null, false), false);
  });
  await check('Dismiss and session keys are scoped to individual announcement IDs', () => {
    assert.notEqual(priorityNoticeDismissKey('id-1'), priorityNoticeDismissKey('id-2'));
    assert.notEqual(priorityNoticeSeenKey('id-1'), priorityNoticeSeenKey('id-2'));
  });

  const malicious = pinned({
    title: '<script>alert(1)</script>',
    subtitle: '<img src=x onerror=alert(1)>',
    badge: '<b>evil</b>',
    message: '</p><script>alert(2)</script>',
  }) as PublicPriorityNotice;
  await check('React renders untrusted notice text as escaped HTML', () => {
    const html = renderToStaticMarkup(React.createElement(PriorityNoticeDisplay, { notice: malicious }));
    assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
    assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
    assert.ok(html.includes('&lt;b&gt;evil&lt;/b&gt;'));
    assert.ok(html.includes('&lt;/p&gt;&lt;script&gt;alert(2)&lt;/script&gt;'));
    assert.ok(!html.includes('<script>'));
    assert.ok(!html.includes('<img src=x'));
  });
  await check('Current modal no longer contains hard-coded stale registration notice', () => {
    const src = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/components/home/RegistrationAlertModal.tsx'), 'utf8');
    assert.ok(!src.includes('Session V registration has closed'));
    assert.ok(!src.includes('Khaqan Afridi'));
    assert.ok(!src.includes('must pay before 5:00 PM'));
    assert.ok(!src.includes('dangerouslySetInnerHTML'));
  });

  const originalFetch = globalThis.fetch;
  let requested = '';
  try {
    globalThis.fetch = (async (input: RequestInfo | URL, options?: RequestInit): Promise<Response> => {
      requested = String(input);
      assert.equal(options?.cache, 'no-store');
      assert.equal(options?.method, 'GET');
      return new Response(JSON.stringify({ success: true, configured: true, data: [pinned()] }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof globalThis.fetch;
    await check('Modal fetch reads current published notices from public API', async () => {
      const notice = await fetchPublicPriorityNotice();
      assert.ok(requested.endsWith('/api/announcements'));
      assert.equal(notice?.id, 'featured-1');
    });

    globalThis.fetch = (async () => new Response(JSON.stringify({ success: true, configured: true, data: [] }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    })) as typeof globalThis.fetch;
    await check('Configured feed with no pinned notices returns no modal payload', async () => {
      assert.equal(await fetchPublicPriorityNotice(), null);
    });

    globalThis.fetch = (async () => new Response(JSON.stringify({ success: true, configured: false, data: [] }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    })) as typeof globalThis.fetch;
    await check('Unconfigured feed never resurrects legacy registration text', async () => {
      assert.equal(await fetchPublicPriorityNotice(), null);
    });

    globalThis.fetch = (async () => new Response('Unavailable', { status: 503 })) as typeof globalThis.fetch;
    await check('HTTP service errors are reported rather than displayed as stale notices', async () => {
      await assert.rejects(fetchPublicPriorityNotice(), /Unable to load/);
    });

    globalThis.fetch = (async () => new Response(JSON.stringify({ success: true, data: 'bad' }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    })) as typeof globalThis.fetch;
    await check('Malformed response does not display an announcement', async () => {
      await assert.rejects(fetchPublicPriorityNotice(), /Invalid official notices response/);
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
  console.log(`PRIORITY_POPUP_TESTS_PASS=${passed} FAIL=0`);
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
