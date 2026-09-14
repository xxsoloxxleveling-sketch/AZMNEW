import assert from 'node:assert/strict';

async function run() {
  process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:1/test';
  const { default: router } = await import('../src/modules/students/students.routes');
  const registered = router.stack.filter((layer: any) => layer.route).map((layer: any) => layer.route);
  for (const [path, method] of [
    ['/:id/document/:docType', 'get'], ['/:id/omr-sheet-pdf', 'get'],
    ['/:id/roll-slip-pdf', 'get'], ['/bulk-omr-pdf', 'post'],
    ['/bulk-roll-slips-pdf', 'post'], ['/:id/prepare-print', 'post'],
  ]) {
    assert(registered.some((route: any) => route.path === path && route.methods[method]), `Missing ${method} ${path}`);
  }
  console.log('PASS: all image, single PDF, bulk PDF, and reservation routes registered');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
