import { describe, expect, it } from "vite-plus/test";

import {
  assignEquitableSlots,
  buildEquitableAssignSlots,
  buildExperienceCounts,
  type EquitableAssignAssignment,
  type EquitableAssignRecipient,
  type EquitableAssignScope,
  type EquitableAssignSlot,
} from "./equitableAssign";
import type { EquitableGenderBucket } from "./equitableGenderBuckets";

const GENDERS: readonly EquitableGenderBucket[] = ["m", "f", "other"];

function sequenceRandom(values: readonly number[]): () => number {
  let index = 0;
  return () => values[index++ % values.length] ?? 0;
}

function recipient(
  index: number,
  groupCount: number,
  scope: EquitableAssignScope,
): EquitableAssignRecipient {
  return {
    studentUserId: `s${index}`,
    genderBucket: GENDERS[index % GENDERS.length],
    rosterNumber: index + 1,
    ...(scope === "groups"
      ? { groupId: `g${index % groupCount}`, groupName: `g${index % groupCount}` }
      : {}),
  };
}

function slotPoolKey(slot: EquitableAssignSlot): string {
  return `${slot.groupId ?? ""}::${slot.genderRequired ?? ""}`;
}

function studentEligible(
  student: EquitableAssignRecipient,
  slot: EquitableAssignSlot,
  scope: EquitableAssignScope,
): boolean {
  if (scope === "groups" && student.groupId !== slot.groupId) return false;
  if (slot.genderRequired && student.genderBucket !== slot.genderRequired) return false;
  return true;
}

function countItem(
  history: readonly EquitableAssignAssignment[],
  studentUserId: string,
  item: string,
): number {
  return history.filter((row) => row.studentUserId === studentUserId && row.item === item).length;
}

function combinations<T>(values: readonly T[], count: number): T[][] {
  if (count === 0) return [[]];
  if (values.length < count) return [];
  const result: T[][] = [];
  for (let index = 0; index <= values.length - count; index += 1) {
    const value = values[index]!;
    for (const rest of combinations(values.slice(index + 1), count - 1)) {
      result.push([value, ...rest]);
    }
  }
  return result;
}

function spread(values: readonly number[]): number {
  return Math.max(...values) - Math.min(...values);
}

function verifyPolicy(args: {
  scope: EquitableAssignScope;
  recipients: EquitableAssignRecipient[];
  slots: EquitableAssignSlot[];
  prior: EquitableAssignAssignment[];
  result: ReturnType<typeof assignEquitableSlots>;
}): void {
  const slotById = new Map(args.slots.map((slot) => [slot.id, slot]));
  const recipientById = new Map(args.recipients.map((student) => [student.studentUserId, student]));
  const resultStudentIds = args.result.map((row) => row.studentUserId);
  const resultSlotIds = args.result.map((row) => row.slotId);

  expect(new Set(resultStudentIds).size).toBe(resultStudentIds.length);
  expect(new Set(resultSlotIds).size).toBe(resultSlotIds.length);

  for (const row of args.result) {
    const slot = slotById.get(row.slotId);
    const student = recipientById.get(row.studentUserId);
    expect(slot).toBeDefined();
    expect(student).toBeDefined();
    expect(studentEligible(student!, slot!, args.scope)).toBe(true);
  }

  const slotsByPool = new Map<string, EquitableAssignSlot[]>();
  for (const slot of args.slots) {
    const key = slotPoolKey(slot);
    slotsByPool.set(key, [...(slotsByPool.get(key) ?? []), slot]);
  }

  const experience = buildExperienceCounts(args.prior);
  for (const [poolKey, poolSlots] of slotsByPool) {
    const sample = poolSlots[0]!;
    const eligible = args.recipients.filter((student) =>
      studentEligible(student, sample, args.scope),
    );
    const poolResults = args.result.filter(
      (row) => slotPoolKey(slotById.get(row.slotId)!) === poolKey,
    );
    expect(poolResults).toHaveLength(Math.min(poolSlots.length, eligible.length));

    const selected = new Set(poolResults.map((row) => row.studentUserId));
    const selectedTotals = eligible
      .filter((student) => selected.has(student.studentUserId))
      .map((student) => experience.totalByStudent.get(student.studentUserId) ?? 0);
    const unselectedTotals = eligible
      .filter((student) => !selected.has(student.studentUserId))
      .map((student) => experience.totalByStudent.get(student.studentUserId) ?? 0);
    if (selectedTotals.length > 0 && unselectedTotals.length > 0) {
      expect(Math.max(...selectedTotals)).toBeLessThanOrEqual(Math.min(...unselectedTotals));
    }

    const availableSlots = [...poolSlots];
    for (const row of poolResults) {
      const assignedSlotIndex = availableSlots.findIndex((slot) => slot.id === row.slotId);
      expect(assignedSlotIndex).toBeGreaterThanOrEqual(0);
      const minimumItemExperience = Math.min(
        ...availableSlots.map((slot) => countItem(args.prior, row.studentUserId, slot.item)),
      );
      expect(countItem(args.prior, row.studentUserId, row.item)).toBe(minimumItemExperience);
      availableSlots.splice(assignedSlotIndex, 1);
    }
  }
}

describe("equitable assignment policy properties", () => {
  it("satisfies structural and greedy fairness properties across small generated states", () => {
    for (const scope of ["class", "groups"] as const) {
      for (const balanceGender of [false, true]) {
        for (let studentCount = 1; studentCount <= 6; studentCount += 1) {
          for (let itemCount = 1; itemCount <= 4; itemCount += 1) {
            for (let groupCount = 1; groupCount <= 2; groupCount += 1) {
              const recipients = Array.from({ length: studentCount }, (_, index) =>
                recipient(index, groupCount, scope),
              );
              const items = Array.from({ length: itemCount }, (_, index) => `Item${index}`);
              const groups =
                scope === "groups"
                  ? Array.from({ length: groupCount }, (_, index) => ({
                      groupId: `g${index}`,
                      groupName: `g${index}`,
                    }))
                  : [];
              const slots = buildEquitableAssignSlots({
                items,
                scope,
                balanceGender,
                genderBuckets: GENDERS,
                groups,
                recipients,
              });
              const prior: EquitableAssignAssignment[] = recipients.flatMap((student, index) =>
                Array.from({ length: index % 3 }, (_, historyIndex) => ({
                  studentUserId: student.studentUserId,
                  item: items[historyIndex % items.length]!,
                  groupId: student.groupId,
                  groupName: student.groupName,
                })),
              );
              const result = assignEquitableSlots({
                items,
                recipients,
                scope,
                balanceGender,
                genderBuckets: GENDERS,
                priorAssignments: prior,
                slots,
                random: sequenceRandom([0.8, 0.1, 0.6, 0.3, 0.9, 0.2]),
                runCount: 3,
              });

              verifyPolicy({ scope, recipients, slots, prior, result });
            }
          }
        }
      }
    }
  });

  it("never assigns an ungrouped student in groups scope", () => {
    const recipients: EquitableAssignRecipient[] = [
      recipient(0, 2, "groups"),
      recipient(1, 2, "groups"),
      { studentUserId: "ungrouped", genderBucket: "m", rosterNumber: 3 },
    ];
    const slots = buildEquitableAssignSlots({
      items: ["A", "B"],
      scope: "groups",
      balanceGender: false,
      groups: [
        { groupId: "g0", groupName: "g0" },
        { groupId: "g1", groupName: "g1" },
      ],
      recipients,
    });
    const result = assignEquitableSlots({
      items: ["A", "B"],
      recipients,
      slots,
      scope: "groups",
      balanceGender: false,
      priorAssignments: [],
      random: () => 0,
    });

    expect(result.some((row) => row.studentUserId === "ungrouped")).toBe(false);
    verifyPolicy({ scope: "groups", recipients, slots, prior: [], result });
  });

  it("preserves valid locks without duplicating students or slots", () => {
    const recipients = [recipient(0, 1, "class"), recipient(1, 1, "class")];
    const slots = buildEquitableAssignSlots({
      items: ["A", "B", "C"],
      scope: "class",
      balanceGender: false,
      groups: [],
      recipients,
    });
    const result = assignEquitableSlots({
      items: ["A", "B", "C"],
      recipients,
      slots,
      scope: "class",
      balanceGender: false,
      priorAssignments: [],
      lockedAssignments: [{ slotId: slots[1]!.id, studentUserId: "s1" }],
      random: () => 0,
    });

    expect(result.find((row) => row.slotId === slots[1]!.id)?.studentUserId).toBe("s1");
    expect(new Set(result.map((row) => row.studentUserId)).size).toBe(result.length);
    expect(new Set(result.map((row) => row.slotId)).size).toBe(result.length);
  });

  it("uses the injected RNG only after fairness priorities tie", () => {
    const recipients = [recipient(0, 1, "class"), recipient(1, 1, "class")];
    const base = {
      items: ["A"],
      recipients,
      scope: "class" as const,
      balanceGender: false,
      priorAssignments: [],
    };

    const first = assignEquitableSlots({
      ...base,
      random: sequenceRandom([0.1, 0.9]),
    });
    const second = assignEquitableSlots({
      ...base,
      random: sequenceRandom([0.9, 0.1]),
    });

    expect(first[0]?.studentUserId).toBe("s0");
    expect(second[0]?.studentUserId).toBe("s1");
  });

  it("keeps global history when a student transfers groups", () => {
    const recipients: EquitableAssignRecipient[] = [
      { studentUserId: "mover", genderBucket: "m", groupId: "g1", groupName: "g1" },
      { studentUserId: "veteran", genderBucket: "f", groupId: "g1", groupName: "g1" },
      { studentUserId: "newer", genderBucket: "other", groupId: "g1", groupName: "g1" },
    ];
    const prior: EquitableAssignAssignment[] = [
      { studentUserId: "mover", item: "A", groupId: "g0" },
      { studentUserId: "mover", item: "B", groupId: "g0" },
      { studentUserId: "veteran", item: "A", groupId: "g1" },
    ];
    const result = assignEquitableSlots({
      items: ["A"],
      recipients,
      scope: "groups",
      balanceGender: false,
      priorAssignments: prior,
      random: () => 0,
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.studentUserId).toBe("newer");
  });

  it("stays within one assignment of the exhaustive optimum for every micro history", () => {
    for (let studentCount = 2; studentCount <= 5; studentCount += 1) {
      const recipients = Array.from({ length: studentCount }, (_, index) =>
        recipient(index, 1, "class"),
      );
      for (let itemCount = 1; itemCount <= 3; itemCount += 1) {
        const items = Array.from({ length: itemCount }, (_, index) => `Item${index}`);
        const assignmentCount = Math.min(studentCount, itemCount);
        const historyStateCount = 3 ** studentCount;

        for (let state = 0; state < historyStateCount; state += 1) {
          let encoded = state;
          const priorTotals: number[] = [];
          const prior: EquitableAssignAssignment[] = [];
          for (let studentIndex = 0; studentIndex < studentCount; studentIndex += 1) {
            const total = encoded % 3;
            encoded = Math.floor(encoded / 3);
            priorTotals.push(total);
            for (let historyIndex = 0; historyIndex < total; historyIndex += 1) {
              prior.push({
                studentUserId: `s${studentIndex}`,
                item: items[historyIndex % items.length]!,
              });
            }
          }

          const result = assignEquitableSlots({
            items,
            recipients,
            scope: "class",
            balanceGender: false,
            priorAssignments: prior,
            random: () => 0.5,
          });
          const selectedIds = new Set(result.map((row) => row.studentUserId));
          const actualTotals = priorTotals.map(
            (total, index) => total + (selectedIds.has(`s${index}`) ? 1 : 0),
          );
          const bestSpread = Math.min(
            ...combinations(
              Array.from({ length: studentCount }, (_, index) => index),
              assignmentCount,
            ).map((selectedIndexes) => {
              const selected = new Set(selectedIndexes);
              return spread(
                priorTotals.map((total, index) => total + (selected.has(index) ? 1 : 0)),
              );
            }),
          );

          expect(
            spread(actualTotals),
            `${studentCount} students, ${itemCount} items, history state ${state}`,
          ).toBeLessThanOrEqual(bestSpread + 1);
        }
      }
    }
  });
});
