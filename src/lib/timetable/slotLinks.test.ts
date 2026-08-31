import { describe, expect, test } from "vite-plus/test";

import type { Id } from "../../../convex/_generated/dataModel";
import {
  buildMirrorLessonOps,
  getLinkedSlotIds,
  planLinkSlots,
  planRemoveSlotsFromGroup,
  planRepairGroupAfterSlotDelete,
  planSyncSlotLinkMembership,
  planUnlinkSlot,
  type LessonLinkLike,
  type SlotLinkLike,
} from "../../../convex/lib/timetable/slotLinks";

const slotId = (id: string) => id as Id<"timetableSlots">;
const lessonId = (id: string) => id as Id<"timetableLessons">;
const subjectId = (id: string) => id as Id<"timetableSubjects">;

const slots: Array<SlotLinkLike> = [
  { _id: slotId("a"), linkGroupId: "group-1" },
  { _id: slotId("b"), linkGroupId: "group-1" },
  { _id: slotId("c") },
  { _id: slotId("d"), linkGroupId: "group-2" },
  { _id: slotId("e"), linkGroupId: "group-2" },
];

const lessons: Array<LessonLinkLike> = [
  {
    _id: lessonId("l-a-math"),
    slotId: slotId("a"),
    subjectId: subjectId("math"),
    year: 2026,
    weekNumber: 10,
    complete: false,
    materials: [],
    announcements: [],
    agenda: [],
  },
  {
    _id: lessonId("l-b-math"),
    slotId: slotId("b"),
    subjectId: subjectId("math"),
    year: 2026,
    weekNumber: 10,
    complete: true,
    materials: [{ key: "k1", text: "https://example.com", tags: [] }],
    announcements: [],
    agenda: [],
  },
];

describe("getLinkedSlotIds", () => {
  test("returns other slots in the same group", () => {
    expect(getLinkedSlotIds(slotId("a"), slots)).toEqual([slotId("b")]);
    expect(getLinkedSlotIds(slotId("b"), slots)).toEqual([slotId("a")]);
  });

  test("returns empty when slot has no group", () => {
    expect(getLinkedSlotIds(slotId("c"), slots)).toEqual([]);
  });
});

describe("buildMirrorLessonOps", () => {
  test("creates update ops for linked slots on add when lesson exists", () => {
    const ops = buildMirrorLessonOps(
      {
        type: "add",
        sourceSlotId: slotId("a"),
        subjectId: subjectId("math"),
        complete: false,
        materials: [],
        announcements: [],
        agenda: [],
      },
      slots,
      lessons,
      2026,
      10,
    );
    expect(ops).toEqual([
      {
        op: "updateLesson",
        lessonId: lessonId("l-b-math"),
        complete: false,
        materials: [],
        announcements: [],
        agenda: [],
        lessonUrl: undefined,
        lessonUrlShared: undefined,
      },
    ]);
  });

  test("mirrors an optional lesson URL onto linked slots", () => {
    const ops = buildMirrorLessonOps(
      {
        type: "update",
        sourceLesson: {
          ...lessons[0]!,
          lessonUrl: "https://docs.google.com/presentation/d/abc",
          lessonUrlShared: true,
        },
      },
      slots,
      lessons,
      2026,
      10,
    );
    expect(ops).toEqual([
      {
        op: "updateLesson",
        lessonId: lessonId("l-b-math"),
        complete: false,
        materials: [],
        announcements: [],
        agenda: [],
        lessonUrl: "https://docs.google.com/presentation/d/abc",
        lessonUrlShared: true,
      },
    ]);
  });

  test("creates delete ops for linked slots", () => {
    const ops = buildMirrorLessonOps(
      { type: "delete", sourceLesson: lessons[0]! },
      slots,
      lessons,
      2026,
      10,
    );
    expect(ops).toEqual([{ op: "deleteLesson", lessonId: lessonId("l-b-math") }]);
  });
});

describe("planLinkSlots", () => {
  test("merges groups and syncs source lessons for the week", () => {
    const result = planLinkSlots({
      sourceSlotId: slotId("a"),
      targetSlotIds: [slotId("d")],
      slots,
      lessons,
      year: 2026,
      weekNumber: 10,
    });

    expect(result.linkGroupId).toBe("group-1");
    expect(result.slotIdsToUpdate.sort()).toEqual(
      [slotId("a"), slotId("b"), slotId("d"), slotId("e")].sort(),
    );
    expect(result.syncOps.some((op) => op.op === "updateLesson")).toBe(true);
    expect(
      result.syncOps.some(
        (op) =>
          op.op === "createLesson" &&
          op.slotId === slotId("d") &&
          op.subjectId === subjectId("math"),
      ),
    ).toBe(true);
  });
});

describe("planUnlinkSlot", () => {
  test("clears only the slot when group has more than two members", () => {
    const trio: Array<SlotLinkLike> = [
      { _id: slotId("a"), linkGroupId: "group-1" },
      { _id: slotId("b"), linkGroupId: "group-1" },
      { _id: slotId("f"), linkGroupId: "group-1" },
    ];
    expect(planUnlinkSlot({ slotId: slotId("a"), slots: trio })).toEqual({
      slotIdsToClear: [slotId("a")],
    });
  });

  test("clears both slots when only two remain", () => {
    const pair: Array<SlotLinkLike> = [
      { _id: slotId("x"), linkGroupId: "g" },
      { _id: slotId("y"), linkGroupId: "g" },
    ];
    expect(planUnlinkSlot({ slotId: slotId("x"), slots: pair })).toEqual({
      slotIdsToClear: [slotId("x"), slotId("y")],
    });
  });
});

describe("planSyncSlotLinkMembership", () => {
  test("clears source when nothing selected", () => {
    const result = planSyncSlotLinkMembership({
      sourceSlotId: slotId("a"),
      selectedSlotIds: [],
      slots,
      lessons,
      year: 2026,
      weekNumber: 10,
    });
    expect(result.linkPlan).toBeNull();
    expect(result.slotIdsToClear).toContain(slotId("a"));
  });
});

describe("planRepairGroupAfterSlotDelete", () => {
  test("clears remaining singleton when pair loses one member", () => {
    const pair: Array<SlotLinkLike> = [
      { _id: slotId("x"), linkGroupId: "g" },
      { _id: slotId("y"), linkGroupId: "g" },
    ];
    expect(planRepairGroupAfterSlotDelete(slotId("x"), pair)).toEqual([slotId("y")]);
  });

  test("returns empty for larger groups", () => {
    const trio: Array<SlotLinkLike> = [
      { _id: slotId("a"), linkGroupId: "group-1" },
      { _id: slotId("b"), linkGroupId: "group-1" },
      { _id: slotId("f"), linkGroupId: "group-1" },
    ];
    expect(planRepairGroupAfterSlotDelete(slotId("a"), trio)).toEqual([]);
  });
});

describe("planRemoveSlotsFromGroup", () => {
  test("dissolves pair when removing one member", () => {
    const pair: Array<SlotLinkLike> = [
      { _id: slotId("x"), linkGroupId: "g" },
      { _id: slotId("y"), linkGroupId: "g" },
    ];
    expect(planRemoveSlotsFromGroup([slotId("x")], pair).sort()).toEqual(
      [slotId("x"), slotId("y")].sort(),
    );
  });
});
