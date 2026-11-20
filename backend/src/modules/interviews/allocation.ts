export type AllocationStrategy = 'BALANCED' | 'SEQUENTIAL';

export type AllocationCandidate = {
  studentId: string;
  rollNumber: string | null;
  className: string;
  groupName: string | null;
};

export type AllocationHall = {
  id: string;
  name: string;
  roomNumber: string;
  interviewDate: string | null;
  capacity: number;
  occupancy: number;
  lastQueueNumber: number;
  lockedCount: number;
  allowedClasses: string[];
  active: boolean;
};

export type PlannedAssignment = { studentId: string; hallId: string; queueNumber: number };

function compareText(a: string, b: string): number {
  const left = a.trim().toLowerCase();
  const right = b.trim().toLowerCase();
  return left < right ? -1 : left > right ? 1 : 0;
}
function compareCandidates(a: AllocationCandidate, b: AllocationCandidate): number {
  return compareText(a.rollNumber ?? '', b.rollNumber ?? '') || compareText(a.studentId, b.studentId);
}
function compareHalls(a: AllocationHall, b: AllocationHall): number {
  return compareText(a.interviewDate ?? '', b.interviewDate ?? '') ||
    compareText(a.name, b.name) || compareText(a.roomNumber, b.roomNumber) || compareText(a.id, b.id);
}
function classAllowed(candidate: AllocationCandidate, hall: AllocationHall): boolean {
  if (!hall.allowedClasses.length) return true;
  const values = new Set(hall.allowedClasses.map(value => value.trim().toLowerCase()));
  return [candidate.className, candidate.groupName].some(value => value !== null && values.has(value.trim().toLowerCase()));
}

export function buildAllocationPlan(
  candidates: AllocationCandidate[],
  halls: AllocationHall[],
  strategy: AllocationStrategy,
) {
  const uniqueCandidates = new Map<string, AllocationCandidate>();
  for (const candidate of candidates) if (!uniqueCandidates.has(candidate.studentId)) uniqueCandidates.set(candidate.studentId, candidate);
  const orderedCandidates = [...uniqueCandidates.values()].sort(compareCandidates);
  const orderedHalls = halls.filter(hall => hall.active).sort(compareHalls);
  const projected = new Map(orderedHalls.map(hall => [hall.id, Math.max(0, hall.occupancy)]));
  const nextQueue = new Map(orderedHalls.map(hall => [hall.id, Math.max(hall.occupancy, hall.lastQueueNumber)]));
  const assignments: PlannedAssignment[] = [];
  const unallocatedIds: string[] = [];

  for (const candidate of orderedCandidates) {
    const available = orderedHalls.filter(hall =>
      classAllowed(candidate, hall) && (projected.get(hall.id) ?? 0) < hall.capacity,
    );
    let selected: AllocationHall | undefined;
    if (strategy === 'SEQUENTIAL') {
      selected = available[0];
    } else {
      selected = available.reduce<AllocationHall | undefined>((best, hall) => {
        if (!best) return hall;
        const hallCount = projected.get(hall.id) ?? 0;
        const bestCount = projected.get(best.id) ?? 0;
        return hallCount * best.capacity < bestCount * hall.capacity ? hall : best;
      }, undefined);
    }
    if (!selected) {
      unallocatedIds.push(candidate.studentId);
      continue;
    }
    const queueNumber = (nextQueue.get(selected.id) ?? 0) + 1;
    assignments.push({ studentId: candidate.studentId, hallId: selected.id, queueNumber });
    nextQueue.set(selected.id, queueNumber);
    projected.set(selected.id, (projected.get(selected.id) ?? 0) + 1);
  }

  const hallProjection = orderedHalls.map(hall => {
    const assigned = projected.get(hall.id) ?? hall.occupancy;
    return {
      hallId: hall.id, name: hall.name, roomNumber: hall.roomNumber,
      capacity: hall.capacity, assigned: hall.occupancy, locked: hall.lockedCount,
      projected: assigned, remaining: Math.max(0, hall.capacity - assigned),
    };
  });
  return {
    strategy,
    eligibleCount: orderedCandidates.length,
    alreadyAssignedCount: halls.reduce((total, hall) => total + hall.occupancy, 0),
    lockedCount: halls.reduce((total, hall) => total + hall.lockedCount, 0),
    availableHallCapacity: orderedHalls.reduce((total, hall) => total + Math.max(0, hall.capacity - hall.occupancy), 0),
    assignments, unallocatedIds, hallProjection,
  };
}
