import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AttendanceCancellationCenter } from '../../src/components/admin/attendance/AttendanceCancellationCenter';

const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(path.join(root, 'src/components/admin/attendance/AttendanceHubView.tsx'), 'utf8');
const api = fs.readFileSync(path.join(root, 'src/lib/attendanceCancellationApi.ts'), 'utf8');
const component = fs.readFileSync(path.join(root, 'src/components/admin/attendance/AttendanceCancellationCenter.tsx'), 'utf8');
const session = {
  id: 'synthetic-session-exact', examHallId: 'synthetic-hall',
  examDateSnapshot: '2026-10-10', hallNameSnapshot: 'Synthetic Hall',
  roomNumberSnapshot: '01', attemptNumber: 1, status: 'OPEN',
  isCurrent: true,
};

function render(status: string, isCurrent: boolean, disabled = false) {
  return renderToStaticMarkup(
    React.createElement(AttendanceCancellationCenter,{
      selectedSession: { ...session, status, isCurrent } as any,
      disabled, onCancelled: () => undefined,
    }),
  );
}
let checks = 0;
function check(name: string, work: () => void) {
  work();
  checks++;
  console.log('PASS: ' + name);
}
check('Super Admin cancellation center is role-gated in the Hall workspace',()=>{
  assert.match(source,/role === 'SUPER_ADMIN'\s*&&\s*<AttendanceCancellationCenter/);
});
check('current OPEN session offers session-specific management',()=>{
  const html = render('OPEN',true);
  assert.match(html,/Manage selected session/);
  assert.doesNotMatch(html,/disabled=""[^>]*>Manage selected session/);
  assert.match(html,/Cancel one exact Hall attendance attempt/);
});
check('current CLOSED session offers management',()=>{
  const html = render('CLOSED',true);
  assert.match(html,/Manage selected session/);
  assert.doesNotMatch(html,/disabled=""[^>]*>Manage selected session/);
});
check('cancelled, archived and disabled sessions cannot open the modal',()=>{
  for(const [status,current,disabled] of [
    ['CANCELLED',false,false],['OPEN',false,false],['CLOSED',false,false],['OPEN',true,true],
  ] as const) {
    const html = render(status,current,disabled);
    assert.match(html,/disabled=""[^>]*>Manage selected session/);
  }
});
check('client uses exact session preview and commit routes',()=>{
  assert.match(api,/\/sessions\/.*\/cancel\/preview/);
  assert.match(api,/\/sessions\/.*\/cancel\/confirm/);
  assert.match(api,/Idempotency-Key/);
  assert.match(api,/retryOnColdStart: false/);
});
check('Stage 1 UI visibly disables permanent attendance deletion',()=>{
  assert.match(component,/permanent attendance deletion is disabled/i);
  assert.match(component,/Cancel and preserve attendance/);
  assert.match(component,/All .*attendance marks will remain/);
  assert.match(component,/preview\.purgeAttendance === false/);
  assert.doesNotMatch(component,/CANCEL SESSION AND DELETE ATTENDANCE/);
  assert.doesNotMatch(component,/closedEvidenceApproved|retentionApproved|irreversibleDeletionAcknowledged/);
});
check('Stage 1 API always requests preserve-only confirmation',()=>{
  assert.match(api,/purgeAttendance: false/);
  assert.match(api,/value\.purgeAttendance === false/);
  assert.match(api,/value\.deletedCount === 0/);
  assert.match(api,/confirmationText: 'CANCEL SESSION'/);
  assert.doesNotMatch(api,/CANCEL SESSION AND DELETE ATTENDANCE/);
});
check('Hall history explicitly distinguishes CANCELLED attempts',()=>{
  assert.match(source,/option value="CANCELLED"/);
  assert.match(source,/session\.status === 'CANCELLED'/);
});
console.log('Cancellation UI static contract PASS: ' + checks + ' checks.');
