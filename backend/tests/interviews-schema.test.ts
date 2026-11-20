import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  candidateQuerySchema, createAssignmentsSchema, createHallSchema, createRoundSchema, lockAssignmentSchema, unlockAssignmentSchema,
} from '../src/modules/interviews/interviews.schema.ts';

describe('interview request validation', () => {
  it('accepts halls with a positive integer capacity and defaults allowed classes', () => {
    const hall = createHallSchema.parse({ name: 'Hall A', roomNumber: '101', capacity: '40' });
    assert.equal(hall.capacity, 40);
    assert.deepEqual(hall.allowedClasses, []);
  });

  it('rejects zero and fractional hall capacities on create and update', () => {
    assert.equal(createHallSchema.safeParse({ name: 'Hall A', roomNumber: '101', capacity: 0 }).success, false);
    assert.equal(createHallSchema.safeParse({ name: 'Hall A', roomNumber: '101', capacity: 1.5 }).success, false);
  });

  it('locks manual assignments by default but allows a deliberate unlocked choice', () => {
    assert.equal(createAssignmentsSchema.parse({ hallId: 'h1', studentIds: ['s1'] }).isLocked, true);
    assert.equal(createAssignmentsSchema.parse({ hallId: 'h1', studentIds: ['s1'], isLocked: false }).isLocked, false);
  });

  it('requires an explicit reason when unlocking an assignment', () => {
    assert.equal(unlockAssignmentSchema.safeParse({}).success, false);
    assert.equal(unlockAssignmentSchema.safeParse({ reason: 'ok' }).success, false);
    assert.equal(unlockAssignmentSchema.parse({ reason: 'Admin schedule correction' }).override, false);
  });

  it('fixes interview eligibility to a 100-mark scale', () => {
    assert.equal(createRoundSchema.parse({ sessionRef: 'session-1', title: 'Round 1' }).maximumMarks, 100);
    assert.equal(createRoundSchema.safeParse({ sessionRef: 'session-1', title: 'Round 1', maximumMarks: 120 }).success, false);
  });

  it('keeps override defaults explicit and false', () => {
    assert.equal(lockAssignmentSchema.parse({}).override, false);
  });
  it('rejects inverted final-mark filters', () => {
    assert.equal(candidateQuerySchema.safeParse({ minimumMarks: 80, maximumMarks: 60 }).success, false);
    assert.equal(candidateQuerySchema.parse({ minimumMarks: 60, maximumMarks: 100 }).minimumMarks, 60);
  });

});
