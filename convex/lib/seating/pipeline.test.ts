import { describe, expect, test } from "vite-plus/test";

import type { Id } from "../../_generated/dataModel.js";
import { deskItemsById } from "../seatChartGeometry.js";
import {
  TEST_CLASSROOM_GROUP_B_ID,
  TEST_CLASSROOM_GROUP_ID,
  TEST_CLASSROOM_LAYOUT_ID,
  classroomStudent,
  classroomStudents,
  grid4x5,
  rosterGenderForIndex,
} from "./classroomLayouts.js";
import {
  expectMergedLocksPreserved,
  expectValidSolverChart,
  neighborMapFromIds,
} from "./seatingTestHelpers.js";
import {
  buildSeatingDeskSlots,
  buildSeatingStudents,
  finishSeatingAlgorithm,
  prepareSeatingAlgorithmInput,
} from "./pipeline.js";
import { runSeatingAlgorithm } from "./runSeatingAlgorithm.js";
import { teamHistoryKey } from "./historyKeys.js";
import { genderBucketFromRoster } from "./gender.js";

const layoutId = TEST_CLASSROOM_LAYOUT_ID;

function membershipsFor(students: ReturnType<typeof classroomStudents>) {
  return students.map((student) => ({
    studentUserId: student.studentUserId,
    groupId: student.groupId,
  }));
}

describe("buildSeatingDeskSlots", () => {
  test("builds one slot per desk per group and matches independent neighbors", () => {
    const layout = grid4x5();
    const slots = buildSeatingDeskSlots({
      layoutItems: layout.items,
      groupIds: [TEST_CLASSROOM_GROUP_ID, TEST_CLASSROOM_GROUP_B_ID],
      resolveTeamKey: (groupId, desk) => teamHistoryKey(groupId, desk.teamAssignment),
    });
    expect(slots).toHaveLength(layout.deskIds.length * 2);
    const groupA = slots.filter((slot) => slot.groupId === TEST_CLASSROOM_GROUP_ID);
    const neighborMap = new Map(
      groupA.map((slot) => [slot.deskItemId, [...slot.neighborDeskIds].sort()]),
    );
    expect(neighborMapFromIds(neighborMap)).toEqual(layout.expectedNeighbors);
    expect(groupA.every((slot) => slot.zoneName === slot.zoneName?.trim())).toBe(true);
    expect(groupA.some((slot) => slot.teamKey === "name:Blue")).toBe(true);
  });
});

describe("buildSeatingStudents", () => {
  test("filters to movable ids and maps roster genders", () => {
    const students = classroomStudents(4);
    const movable = [students[0]!.studentUserId, students[2]!.studentUserId];
    const roster = new Map(
      students.map(
        (student, index) => [student.studentUserId, rosterGenderForIndex(index)] as const,
      ),
    );
    const built = buildSeatingStudents({
      memberships: membershipsFor(students),
      movableIds: movable,
      rosterGenderByStudent: roster,
    });
    expect(built.map((row) => row.studentUserId)).toEqual(movable);
    expect(built[0]?.genderBucket).toBe(genderBucketFromRoster(rosterGenderForIndex(0)));
  });
});

describe("prepareSeatingAlgorithmInput and finishSeatingAlgorithm", () => {
  test("wires history, scope, locks, and real geometry into a successful solve", () => {
    const layout = grid4x5();
    const students = classroomStudents(8);
    const lockedStudent = students[0]!;
    const locked = {
      studentUserId: lockedStudent.studentUserId,
      groupId: lockedStudent.groupId,
      deskItemId: layout.deskIds[0]!,
    };
    const input = prepareSeatingAlgorithmInput({
      layoutId,
      layoutItems: layout.items,
      lockedAssignments: [locked],
      scope: { kind: "class" },
      randomSeed: "pipeline-real",
      genderParityMode: "off",
      constraints: [],
      memberships: membershipsFor(students),
      rosterGenderByStudent: new Map(),
      layoutAggregateRows: [
        {
          studentUserId: students[1]!.studentUserId,
          dimension: "seat",
          key: `${layoutId}:${layout.deskIds[1]}`,
          count: 8,
        },
      ],
      resolveTeamKey: (groupId, desk) => teamHistoryKey(groupId, desk.teamAssignment),
    });
    expect(input.slots.length).toBe(layout.deskIds.length);
    expect(input.locked).toEqual([locked]);
    const finished = finishSeatingAlgorithm({
      input,
      lockedAssignments: [locked],
      memberships: membershipsFor(students),
      deskById: deskItemsById(layout.items),
    });
    expect(finished.status).toBe("ok");
    if (finished.status !== "ok") return;
    expectMergedLocksPreserved([locked], finished.assignments);
    expectValidSolverChart(
      input,
      finished.assignments.filter((row) => row.studentUserId !== locked.studentUserId),
    );
  });

  test("maps infeasible solver results to invalid", () => {
    const layout = grid4x5();
    const students = [classroomStudent(0), classroomStudent(1)];
    const input = prepareSeatingAlgorithmInput({
      layoutId,
      layoutItems: layout.items.slice(0, 2),
      lockedAssignments: [],
      randomSeed: "pipeline-infeasible",
      genderParityMode: "off",
      constraints: [
        {
          _id: "c1" as Id<"seatConstraints">,
          type: "neighbor",
          polarity: "must",
          studentUserId: students[0]!.studentUserId,
          otherStudentUserId: students[1]!.studentUserId,
        },
        {
          _id: "c2" as Id<"seatConstraints">,
          type: "neighbor",
          polarity: "mustNot",
          studentUserId: students[0]!.studentUserId,
          otherStudentUserId: students[1]!.studentUserId,
        },
      ],
      memberships: membershipsFor(students),
      rosterGenderByStudent: new Map(),
      layoutAggregateRows: [],
      resolveTeamKey: () => undefined,
    });
    const finished = finishSeatingAlgorithm({
      input,
      lockedAssignments: [],
      memberships: membershipsFor(students),
      deskById: deskItemsById(layout.items.slice(0, 2)),
    });
    expect(finished.status).toBe("invalid");
    if (finished.status === "invalid") {
      expect(finished.code).toBe("SEATING_INFEASIBLE");
    }
  });

  test("respects group scope when preparing input", () => {
    const layout = grid4x5();
    const students = classroomStudents(6, { dualGroup: true });
    const input = prepareSeatingAlgorithmInput({
      layoutId,
      layoutItems: layout.items,
      lockedAssignments: [],
      scope: { kind: "group", groupIds: [TEST_CLASSROOM_GROUP_ID] },
      randomSeed: "pipeline-scope",
      genderParityMode: "off",
      constraints: [],
      memberships: membershipsFor(students),
      rosterGenderByStudent: new Map(),
      layoutAggregateRows: [],
      resolveTeamKey: (groupId, desk) => teamHistoryKey(groupId, desk.teamAssignment),
    });
    expect(input.students.every((student) => student.groupId === TEST_CLASSROOM_GROUP_ID)).toBe(
      true,
    );
    expect(input.slots.every((slot) => slot.groupId === TEST_CLASSROOM_GROUP_ID)).toBe(true);
  });
});

describe("runSeatingAlgorithm", () => {
  test("fills a realistic 20-student grid with a fixed seed", () => {
    const layout = grid4x5();
    const students = classroomStudents(20);
    const result = runSeatingAlgorithm({
      classId: "class-test" as Id<"classes">,
      layoutId,
      layoutItems: layout.items,
      lockedAssignments: [],
      randomSeed: "run-20",
      genderParityMode: "off",
      constraints: [],
      memberships: membershipsFor(students),
      rosterGenderByStudent: new Map(),
      layoutAggregateRows: [],
      deskById: deskItemsById(layout.items),
    });
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.assignments).toHaveLength(20);
    expect(new Set(result.assignments.map((row) => row.deskItemId)).size).toBe(20);
  });
});
