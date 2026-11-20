import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildAllocationPlan, type AllocationCandidate, type AllocationHall } from '../src/modules/interviews/allocation.ts';

function candidate(studentId: string, rollNumber: string, className = 'Class 10', groupName: string | null = null): AllocationCandidate {
  return { studentId, rollNumber, className, groupName };
}
function hall(overrides: Partial<AllocationHall> & Pick<AllocationHall, 'id' | 'name' | 'roomNumber'>): AllocationHall {
  return {
    id: overrides.id,
    name: overrides.name,
    roomNumber: overrides.roomNumber,
    interviewDate: '2026-11-25',
    capacity: 10,
    occupancy: 0,
    lastQueueNumber: 0,
    lockedCount: 0,
    allowedClasses: [],
    active: true,
    ...overrides,
  };
}

describe('interview allocation planning', () => {
  it('keeps locked assignments in place and only fills remaining capacity', () => {
    const lockedCandidateId = 'locked-student';
    const plan = buildAllocationPlan(
      [candidate('new-1', '001'), candidate('new-2', '002'), candidate('new-3', '003')],
      [hall({ id: 'hall-a', name: 'Hall A', roomNumber: '101', capacity: 3, occupancy: 2, lockedCount: 2, lastQueueNumber: 8 })],
      'SEQUENTIAL',
    );
    assert.equal(plan.assignments.length, 1);
    assert.equal(plan.assignments[0].queueNumber, 9);
    assert.equal(plan.hallProjection[0].locked, 2);
    assert.equal(plan.hallProjection[0].projected, 3);
    assert.equal(plan.unallocatedIds.length, 2);
    assert.equal(plan.assignments.some(item => item.studentId === lockedCandidateId), false);
  });

  it('never projects hall occupancy beyond capacity', () => {
    const plan = buildAllocationPlan(
      [candidate('s1', '001'), candidate('s2', '002'), candidate('s3', '003'), candidate('s4', '004')],
      [hall({ id: 'hall-a', name: 'Hall A', roomNumber: '101', capacity: 2 }), hall({ id: 'hall-b', name: 'Hall B', roomNumber: '102', capacity: 1, occupancy: 1 })],
      'BALANCED',
    );
    assert.equal(plan.assignments.length, 2);
    assert.deepEqual(plan.hallProjection.map(item => item.projected <= item.capacity), [true, true]);
    assert.equal(plan.unallocatedIds.length, 2);
  });

  it('respects academic-group restrictions', () => {
    const plan = buildAllocationPlan(
      [candidate('s1', '001', 'Class 10', 'Science'), candidate('s2', '002', 'Class 9', 'Arts')],
      [
        hall({ id: 'science', name: 'Science', roomNumber: '101', allowedClasses: ['Science'] }),
        hall({ id: 'class-10', name: 'Class 10', roomNumber: '102', allowedClasses: ['Class 10'] }),
      ],
      'SEQUENTIAL',
    );
    assert.deepEqual(plan.assignments.map(item => item.studentId), ['s1']);
    assert.deepEqual(plan.unallocatedIds, ['s2']);
  });

  it('uses stable candidate and hall ordering for repeatable previews', () => {
    const candidates = [candidate('s3', '003'), candidate('s1', '001'), candidate('s2', '002')];
    const halls = [hall({ id: 'b', name: 'Hall B', roomNumber: '102' }), hall({ id: 'a', name: 'Hall A', roomNumber: '101' })];
    const first = buildAllocationPlan(candidates, halls, 'BALANCED');
    const second = buildAllocationPlan([...candidates].reverse(), [...halls].reverse(), 'BALANCED');
    assert.deepEqual(first.assignments, second.assignments);
  });

  it('supports sequential filling by stable hall order', () => {
    const plan = buildAllocationPlan(
      [candidate('s1', '001'), candidate('s2', '002'), candidate('s3', '003')],
      [hall({ id: 'b', name: 'Hall B', roomNumber: '102', capacity: 2 }), hall({ id: 'a', name: 'Hall A', roomNumber: '101', capacity: 1 })],
      'SEQUENTIAL',
    );
    assert.deepEqual(plan.assignments.map(item => item.hallId), ['a', 'b', 'b']);
  });

  it('does not return duplicate student assignments for duplicate preview inputs', () => {
    const plan = buildAllocationPlan(
      [candidate('s1', '001'), candidate('s1', '001'), candidate('s2', '002')],
      [hall({ id: 'hall-a', name: 'Hall A', roomNumber: '101', capacity: 3 })],
      'BALANCED',
    );
    assert.equal(new Set(plan.assignments.map(item => item.studentId)).size, plan.assignments.length);
  });
});
