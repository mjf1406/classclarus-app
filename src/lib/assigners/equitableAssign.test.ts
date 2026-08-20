import { describe, expect, it } from "vite-plus/test";

import {
  assignEquitable,
  assignEquitableSlots,
  buildExperienceCounts,
  buildEquitableAssignSlots,
} from "../../../convex/lib/assigners/equitableAssign";

const pickFirst = () => 0;

function recipient(
  id: string,
  genderBucket: "m" | "f" | "other" | "unknown",
  groupId?: string,
  rosterNumber?: number,
) {
  return {
    studentUserId: id,
    genderBucket,
    ...(groupId ? { groupId, groupName: groupId } : {}),
    rosterNumber,
  };
}

describe("assignEquitable", () => {
  it("prioritizes students with fewer total assignments", () => {
    const prior = [
      { studentUserId: "u1", item: "A" },
      { studentUserId: "u1", item: "B" },
      { studentUserId: "u2", item: "A" },
    ];

    const result = assignEquitable({
      items: ["A", "B"],
      recipients: [recipient("u1", "m"), recipient("u2", "m"), recipient("u3", "m")],
      scope: "class",
      balanceGender: false,
      priorAssignments: prior,
      random: pickFirst,
    });

    expect(result.map((row) => row.studentUserId)).toEqual(["u3", "u2"]);
  });

  it("assigns the item a student has done least often", () => {
    const prior = [
      { studentUserId: "u1", item: "A" },
      { studentUserId: "u1", item: "A" },
      { studentUserId: "u1", item: "B" },
    ];

    const result = assignEquitable({
      items: ["A", "B"],
      recipients: [recipient("u1", "m")],
      scope: "class",
      balanceGender: false,
      priorAssignments: prior,
      random: pickFirst,
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.item).toBe("B");
  });

  it("preserves locked manual assignments and fills remaining slots", () => {
    const slots = buildEquitableAssignSlots({
      items: ["A", "B", "C"],
      scope: "class",
      balanceGender: false,
      groups: [],
      recipients: [recipient("u1", "m"), recipient("u2", "f"), recipient("u3", "m")],
    });

    const lockedSlot = slots[0]!;
    const result = assignEquitableSlots({
      items: ["A", "B", "C"],
      slots,
      recipients: [recipient("u1", "m"), recipient("u2", "f"), recipient("u3", "m")],
      scope: "class",
      balanceGender: false,
      priorAssignments: [],
      lockedAssignments: [{ slotId: lockedSlot.id, studentUserId: "u1" }],
      random: pickFirst,
    });

    expect(result).toHaveLength(3);
    expect(result.find((row) => row.slotId === lockedSlot.id)?.studentUserId).toBe("u1");
    expect(new Set(result.map((row) => row.studentUserId))).toEqual(new Set(["u1", "u2", "u3"]));
  });

  it("scopes groups independently while using global history", () => {
    const prior = [
      { studentUserId: "a1", item: "A", groupId: "g1", groupName: "G1" },
      { studentUserId: "a1", item: "A", groupId: "g1", groupName: "G1" },
      { studentUserId: "b1", item: "A", groupId: "g2", groupName: "G2" },
    ];

    const result = assignEquitable({
      items: ["A"],
      recipients: [
        recipient("a1", "m", "g1"),
        recipient("a2", "f", "g1"),
        recipient("b1", "m", "g2"),
        recipient("b2", "f", "g2"),
      ],
      scope: "groups",
      balanceGender: false,
      priorAssignments: prior,
      random: pickFirst,
    });

    expect(result).toHaveLength(2);
    expect(result.find((row) => row.groupId === "g1")?.studentUserId).toBe("a2");
    expect(result.find((row) => row.groupId === "g2")?.studentUserId).toBe("b2");
  });

  it("creates gender-balanced slots only for buckets present in each pool", () => {
    const slots = buildEquitableAssignSlots({
      items: ["A"],
      scope: "class",
      balanceGender: true,
      genderBuckets: ["m", "f", "other"],
      groups: [],
      recipients: [recipient("boy", "m"), recipient("other", "other")],
    });

    expect(slots.map((slot) => slot.genderRequired)).toEqual(["m", "other"]);
  });

  it("eventually gives every student each item over repeated runs", () => {
    const items = ["A", "B"];
    const recipients = [
      recipient("u1", "m", undefined, 1),
      recipient("u2", "f", undefined, 2),
      recipient("u3", "m", undefined, 3),
    ];
    let prior: Array<{ studentUserId: string; item: string }> = [];

    for (let run = 0; run < 6; run += 1) {
      const batch = assignEquitable({
        items,
        recipients,
        scope: "class",
        balanceGender: false,
        priorAssignments: prior,
        random: pickFirst,
        runCount: run,
      });
      prior = [...prior, ...batch];
    }

    const experience = buildExperienceCounts(prior);
    for (const student of recipients) {
      for (const item of items) {
        expect(experience.itemByStudent.get(student.studentUserId)?.get(item) ?? 0).toBeGreaterThan(
          0,
        );
      }
    }
  });

  it("does not assign duplicate students in one run", () => {
    const result = assignEquitable({
      items: ["A", "B", "C", "D"],
      recipients: [recipient("u1", "m"), recipient("u2", "f"), recipient("u3", "m")],
      scope: "class",
      balanceGender: false,
      priorAssignments: [],
      random: pickFirst,
    });

    const ids = result.map((row) => row.studentUserId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(3);
  });

  it("remixes boy/girl partners across jobs instead of cycling as a locked pair", () => {
    const items = ["Board", "Door", "Line"];
    const recipients = [
      recipient("B1", "m", "g1", 1),
      recipient("G1", "f", "g1", 2),
      recipient("B2", "m", "g1", 3),
      recipient("G2", "f", "g1", 4),
    ];
    let prior: Array<{
      studentUserId: string;
      item: string;
      groupId?: string;
      groupName?: string;
      runKey?: string;
    }> = [];
    const sharedJobs: string[] = [];

    for (let run = 0; run < 3; run += 1) {
      const batch = assignEquitable({
        items,
        recipients,
        scope: "groups",
        balanceGender: true,
        genderBuckets: ["m", "f"],
        priorAssignments: prior,
        random: pickFirst,
        runCount: run,
      });
      const byStudent = new Map(batch.map((row) => [row.studentUserId, row.item]));
      const b1Job = byStudent.get("B1");
      const g1Job = byStudent.get("G1");
      if (b1Job && g1Job && b1Job === g1Job) sharedJobs.push(b1Job);
      prior = [...prior, ...batch.map((row) => ({ ...row, runKey: `run-${run}` }))];
    }

    expect(sharedJobs.length).toBeLessThan(3);
    expect(new Set(sharedJobs).size).toBeLessThan(items.length);
  });

  it("avoids a locked partner when another least-done job is open", () => {
    const slots = buildEquitableAssignSlots({
      items: ["Board", "Door"],
      scope: "class",
      balanceGender: true,
      genderBuckets: ["m", "f"],
      groups: [],
      recipients: [recipient("B1", "m"), recipient("G1", "f")],
    });
    const lockedGirlSlot = slots.find(
      (slot) => slot.item === "Board" && slot.genderRequired === "f",
    );
    expect(lockedGirlSlot).toBeDefined();

    const result = assignEquitableSlots({
      items: ["Board", "Door"],
      slots,
      recipients: [recipient("B1", "m", undefined, 1), recipient("G1", "f", undefined, 2)],
      scope: "class",
      balanceGender: true,
      genderBuckets: ["m", "f"],
      priorAssignments: [
        { studentUserId: "B1", item: "Board", runKey: "run-0" },
        { studentUserId: "G1", item: "Board", runKey: "run-0" },
        { studentUserId: "B1", item: "Door", runKey: "run-1" },
      ],
      lockedAssignments: [{ slotId: lockedGirlSlot!.id, studentUserId: "G1" }],
      random: pickFirst,
    });

    expect(result.find((row) => row.studentUserId === "B1")?.item).toBe("Door");
  });
});
