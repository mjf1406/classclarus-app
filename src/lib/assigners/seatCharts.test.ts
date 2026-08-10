import { describe, expect, test } from "vite-plus/test";

import {
  assignStudentToSlot,
  assignmentsEqual,
  formatViolationReason,
  neighborDeskIdsForDesk,
  randomAssignSeatsByGroup,
  slotKey,
  swapDeskAssignments,
  unassignDeskSlot,
} from "@/lib/assigners/seatCharts";
import type { Id } from "../../../convex/_generated/dataModel";

const studentA = "studentA" as Id<"users">;
const studentB = "studentB" as Id<"users">;
const studentC = "studentC" as Id<"users">;
const studentD = "studentD" as Id<"users">;
const groupG1 = "groupG1" as Id<"groups">;
const groupG2 = "groupG2" as Id<"groups">;

/** Deterministic pseudo-random sequence for shuffle tests. */
function sequenceRandom(values: Array<number>): () => number {
  let i = 0;
  return () => {
    const value = values[i % values.length] ?? 0;
    i += 1;
    return value;
  };
}

describe("seatCharts assignments", () => {
  test("assignStudentToSlot replaces prior desk and slot", () => {
    const initial = [{ deskItemId: "d1", groupId: groupG1, studentUserId: studentA }];
    const next = assignStudentToSlot(initial, "d2", groupG1, studentA);
    expect(next).toEqual([{ deskItemId: "d2", groupId: groupG1, studentUserId: studentA }]);
  });

  test("assignStudentToSlot allows two groups on one desk", () => {
    const initial = [{ deskItemId: "d1", groupId: groupG1, studentUserId: studentA }];
    const next = assignStudentToSlot(initial, "d1", groupG2, studentB);
    expect(next).toEqual([
      { deskItemId: "d1", groupId: groupG1, studentUserId: studentA },
      { deskItemId: "d1", groupId: groupG2, studentUserId: studentB },
    ]);
  });

  test("swapDeskAssignments exchanges all slots on two desks", () => {
    const initial = [
      { deskItemId: "d1", groupId: groupG1, studentUserId: studentA },
      { deskItemId: "d2", groupId: groupG1, studentUserId: studentB },
    ];
    expect(swapDeskAssignments(initial, "d1", "d2")).toEqual([
      { deskItemId: "d2", groupId: groupG1, studentUserId: studentA },
      { deskItemId: "d1", groupId: groupG1, studentUserId: studentB },
    ]);
  });

  test("unassignDeskSlot removes one slot", () => {
    const initial = [
      { deskItemId: "d1", groupId: groupG1, studentUserId: studentA },
      { deskItemId: "d1", groupId: groupG2, studentUserId: studentB },
    ];
    expect(unassignDeskSlot(initial, "d1", groupG1)).toEqual([
      { deskItemId: "d1", groupId: groupG2, studentUserId: studentB },
    ]);
  });

  test("assignmentsEqual compares slot maps", () => {
    const a = [{ deskItemId: "d1", groupId: groupG1, studentUserId: studentA }];
    const b = [{ deskItemId: "d1", groupId: groupG1, studentUserId: studentA }];
    expect(assignmentsEqual(a, b)).toBe(true);
    expect(
      assignmentsEqual(a, [{ deskItemId: "d2", groupId: groupG1, studentUserId: studentA }]),
    ).toBe(false);
    expect(slotKey("d1", groupG1)).toBe("d1:groupG1");
  });

  test("randomAssignSeatsByGroup seats each group into its own desk slots", () => {
    const next = randomAssignSeatsByGroup({
      deskItemIds: ["d1", "d2"],
      studentsByGroup: [
        { groupId: groupG1, studentUserIds: [studentA, studentB] },
        { groupId: groupG2, studentUserIds: [studentC] },
      ],
      random: sequenceRandom([0, 0, 0, 0, 0, 0]),
    });
    expect(next).toHaveLength(3);
    expect(next.filter((a) => a.groupId === groupG1)).toHaveLength(2);
    expect(next.filter((a) => a.groupId === groupG2)).toHaveLength(1);
    for (const assignment of next) {
      expect(["d1", "d2"]).toContain(assignment.deskItemId);
    }
    const g1Desks = next.filter((a) => a.groupId === groupG1).map((a) => a.deskItemId);
    expect(new Set(g1Desks).size).toBe(2);
  });

  test("randomAssignSeatsByGroup leaves overflow students unseated", () => {
    const next = randomAssignSeatsByGroup({
      deskItemIds: ["d1"],
      studentsByGroup: [{ groupId: groupG1, studentUserIds: [studentA, studentB, studentD] }],
      random: sequenceRandom([0, 0, 0, 0]),
    });
    expect(next).toHaveLength(1);
    expect(next[0]?.deskItemId).toBe("d1");
    expect(next[0]?.groupId).toBe(groupG1);
  });

  test("randomAssignSeatsByGroup returns empty when there are no desks", () => {
    expect(
      randomAssignSeatsByGroup({
        deskItemIds: [],
        studentsByGroup: [{ groupId: groupG1, studentUserIds: [studentA] }],
      }),
    ).toEqual([]);
  });
});

describe("formatViolationReason", () => {
  const t = (key: string, options?: Record<string, string>) => {
    if (key === "chartViolationNoZone") return "none";
    if (key === "chartViolationNoSeat") return "none";
    if (key === "chartViolationNoTeam") return "none";
    if (key === "chartViolationReason_zone_must") {
      return `${options?.student} is in zone ${options?.currentZone}, but needs to be in zone ${options?.targetZone}.`;
    }
    if (key === "chartViolationReason_neighbor_must") {
      return `${options?.student} is at seat ${options?.studentSeat} and ${options?.other} is at seat ${options?.otherSeat}, but they need to sit next to each other.`;
    }
    if (key === "chartViolationReason_teammate_mustNot") {
      return `${options?.student} is on team ${options?.studentTeam} and ${options?.other} is on team ${options?.otherTeam}, but they must not be on the same team.`;
    }
    return key;
  };

  test("zone must includes current and target zones", () => {
    expect(
      formatViolationReason(
        {
          constraintId: "c1" as Id<"seatConstraints">,
          type: "zone",
          polarity: "must",
          summary: "Camila / Front",
          studentUserIds: [studentA],
          params: { student: "Camila Moore", currentZone: "Back", targetZone: "Front" },
        },
        t,
      ),
    ).toBe("Camila Moore is in zone Back, but needs to be in zone Front.");
  });

  test("falls back to none when current zone is missing", () => {
    expect(
      formatViolationReason(
        {
          constraintId: "c2" as Id<"seatConstraints">,
          type: "zone",
          polarity: "must",
          summary: "Camila / Front",
          studentUserIds: [studentA],
          params: { student: "Camila Moore", targetZone: "Front" },
        },
        t,
      ),
    ).toBe("Camila Moore is in zone none, but needs to be in zone Front.");
  });

  test("neighbor must includes both seats", () => {
    expect(
      formatViolationReason(
        {
          constraintId: "c3" as Id<"seatConstraints">,
          type: "neighbor",
          polarity: "must",
          summary: "A / B",
          studentUserIds: [studentA, studentB],
          params: {
            student: "Ada",
            other: "Ben",
            studentSeat: "1",
            otherSeat: "4",
          },
        },
        t,
      ),
    ).toBe("Ada is at seat 1 and Ben is at seat 4, but they need to sit next to each other.");
  });

  test("teammate mustNot includes both teams", () => {
    expect(
      formatViolationReason(
        {
          constraintId: "c4" as Id<"seatConstraints">,
          type: "teammate",
          polarity: "mustNot",
          summary: "A / B",
          studentUserIds: [studentA, studentB],
          params: {
            student: "Ada",
            other: "Ben",
            studentTeam: "Red",
            otherTeam: "Red",
          },
        },
        t,
      ),
    ).toBe("Ada is on team Red and Ben is on team Red, but they must not be on the same team.");
  });
});

describe("strict chart neighbors", () => {
  const items = [
    { id: "d1", kind: "desk" as const, label: "1", x: 0, y: 0, width: 80, height: 60 },
    { id: "d2", kind: "desk" as const, label: "2", x: 80, y: 0, width: 80, height: 60 },
    { id: "d3", kind: "desk" as const, label: "3", x: 0, y: 60, width: 80, height: 60 },
    { id: "corner", kind: "desk" as const, label: "4", x: 80, y: 60, width: 80, height: 60 },
  ];

  test("detects side neighbors but not diagonal-only contact", () => {
    expect(neighborDeskIdsForDesk(items, "d1").sort()).toEqual(["d2", "d3"]);
    expect(neighborDeskIdsForDesk(items, "corner").sort()).toEqual(["d2", "d3"]);
    const diagonalOnly = [
      { id: "a", kind: "desk" as const, label: "A", x: 0, y: 0, width: 80, height: 60 },
      { id: "b", kind: "desk" as const, label: "B", x: 80, y: 61, width: 80, height: 60 },
    ];
    expect(neighborDeskIdsForDesk(diagonalOnly, "a")).toEqual([]);
  });
});
