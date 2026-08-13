import { describe, expect, it } from "vite-plus/test";

import type { Id } from "../../../../convex/_generated/dataModel";
import { deskItemsById } from "../../../../convex/lib/seatChartGeometry";
import {
  TEST_CLASSROOM_GROUP_ID,
  TEST_CLASSROOM_LAYOUT_ID,
  TEST_TEAM_BLUE,
  classroomStudents,
  grid4x5,
  rosterGenderForIndex,
} from "../../../../convex/lib/seating/classroomLayouts";
import { runSeatingAlgorithm } from "../../../../convex/lib/seating/runSeatingAlgorithm";
import type { GroupsBoard } from "@/lib/groups/groups";
import { filterConstraintsForBoard, runClientSeatingAlgorithm } from "./runClientSeatingAlgorithm";
import { runClientSeatingAlgorithmAsync } from "./runClientSeatingAlgorithmAsync";

const groupId = TEST_CLASSROOM_GROUP_ID;
const layoutId = TEST_CLASSROOM_LAYOUT_ID;

function boardStudent(index: number) {
  return {
    userId: `student-${index}` as Id<"users">,
    firstName: `Student ${index}`,
    rosterNumber: index + 1,
    gender: rosterGenderForIndex(index),
  };
}

function testBoard(args: {
  studentCount: number;
  ungrouped?: number[];
  teams?: Array<{ id: Id<"teams">; name: string; studentIndexes: number[] }>;
}): GroupsBoard {
  const teamStudentIds = new Set(args.teams?.flatMap((team) => team.studentIndexes) ?? []);
  const grouped = Array.from({ length: args.studentCount }, (_, index) => index).filter(
    (index) => !args.ungrouped?.includes(index) && !teamStudentIds.has(index),
  );
  return {
    groups: [
      {
        _id: groupId,
        name: "Homeroom",
        updatedAt: 1,
        students: grouped.map(boardStudent),
        teams: (args.teams ?? []).map((team) => ({
          _id: team.id,
          groupId,
          name: team.name,
          updatedAt: 1,
          students: team.studentIndexes.map(boardStudent),
        })),
      },
    ],
    ungrouped: (args.ungrouped ?? []).map(boardStudent),
  } as GroupsBoard;
}

describe("runClientSeatingAlgorithm", () => {
  it("matches runSeatingAlgorithm for an equivalent class-wide board", () => {
    const layout = grid4x5();
    const students = classroomStudents(20);
    const board = testBoard({ studentCount: 20 });
    const client = runClientSeatingAlgorithm({
      layout: { _id: layoutId, items: layout.items, genderParity: { mode: "off" } },
      board,
      constraints: [],
      lockedAssignments: [],
      layoutAggregateRows: [],
      randomSeed: "client-parity",
    });
    const server = runSeatingAlgorithm({
      classId: "class-test" as Id<"classes">,
      layoutId,
      layoutItems: layout.items,
      lockedAssignments: [],
      randomSeed: "client-parity",
      genderParityMode: "off",
      constraints: [],
      memberships: students.map((student) => ({
        studentUserId: student.studentUserId,
        groupId: student.groupId,
      })),
      rosterGenderByStudent: new Map(
        students.map((student, index) => [student.studentUserId, rosterGenderForIndex(index)]),
      ),
      layoutAggregateRows: [],
      deskById: deskItemsById(layout.items),
    });
    expect(client.status).toBe("ok");
    expect(server.status).toBe("ok");
    if (client.status !== "ok" || server.status !== "ok") return;
    expect(client.assignments).toEqual(server.assignments);
  });

  it("preserves locked seats in update mode", () => {
    const layout = grid4x5();
    const locked = {
      deskItemId: layout.deskIds[0]!,
      groupId,
      studentUserId: `student-0` as Id<"users">,
    };
    const result = runClientSeatingAlgorithm({
      layout: { _id: layoutId, items: layout.items, genderParity: { mode: "off" } },
      board: testBoard({ studentCount: 8 }),
      constraints: [],
      lockedAssignments: [locked],
      layoutAggregateRows: [],
      randomSeed: "client-lock",
    });
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.assignments.find((row) => row.studentUserId === locked.studentUserId)).toEqual(
      locked,
    );
  });

  it("treats missing layout genderParity as oddEven", () => {
    const layout = grid4x5();
    const result = runClientSeatingAlgorithm({
      layout: { _id: layoutId, items: layout.items },
      board: testBoard({ studentCount: 4 }),
      constraints: [],
      lockedAssignments: [],
      layoutAggregateRows: [],
      randomSeed: "client-default-parity",
    });
    expect(result.status).toBe("ok");
  });

  it("does not seat ungrouped students", () => {
    const layout = grid4x5();
    const result = runClientSeatingAlgorithm({
      layout: { _id: layoutId, items: layout.items, genderParity: { mode: "off" } },
      board: testBoard({ studentCount: 6, ungrouped: [5] }),
      constraints: [],
      lockedAssignments: [],
      layoutAggregateRows: [],
      randomSeed: "client-ungrouped",
    });
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(
      result.assignments.some((row) => row.studentUserId === (`student-5` as Id<"users">)),
    ).toBe(false);
  });

  it("drops team history for a stale single-team assignment", () => {
    const layout = grid4x5();
    const items = layout.items.map((item, index) =>
      index === 0
        ? {
            ...item,
            teamAssignment: {
              mode: "single" as const,
              groupId,
              teamId: "missing-team" as Id<"teams">,
            },
          }
        : item,
    );
    const client = runClientSeatingAlgorithm({
      layout: { _id: layoutId, items, genderParity: { mode: "off" } },
      board: testBoard({
        studentCount: 4,
        teams: [{ id: TEST_TEAM_BLUE, name: "Blue", studentIndexes: [0, 1] }],
      }),
      constraints: [],
      lockedAssignments: [],
      layoutAggregateRows: [],
      randomSeed: "client-stale-team",
    });
    const server = runSeatingAlgorithm({
      classId: "class-test" as Id<"classes">,
      layoutId,
      layoutItems: items,
      lockedAssignments: [],
      randomSeed: "client-stale-team",
      genderParityMode: "off",
      constraints: [],
      memberships: classroomStudents(4).map((student, index) => ({
        studentUserId: student.studentUserId,
        groupId: student.groupId,
        ...(index < 2 ? { teamId: TEST_TEAM_BLUE } : {}),
      })),
      rosterGenderByStudent: new Map(),
      layoutAggregateRows: [],
      deskById: deskItemsById(items),
    });
    expect(client.status).toBe("ok");
    expect(server.status).toBe("ok");
  });
});

describe("filterConstraintsForBoard", () => {
  it("drops constraints that reference students missing from the board", () => {
    const board = testBoard({ studentCount: 2 });
    const kept = filterConstraintsForBoard(
      [
        {
          _id: "c1" as Id<"seatConstraints">,
          type: "neighbor",
          polarity: "must",
          studentUserId: "student-0" as Id<"users">,
          otherStudentUserId: "student-1" as Id<"users">,
        },
        {
          _id: "c2" as Id<"seatConstraints">,
          type: "neighbor",
          polarity: "must",
          studentUserId: "student-0" as Id<"users">,
          otherStudentUserId: "student-99" as Id<"users">,
        },
      ],
      board,
    );
    expect(kept.map((row) => row._id)).toEqual(["c1"]);
  });
});

describe("runClientSeatingAlgorithmAsync", () => {
  it("falls back to the synchronous solver when Worker is unavailable", async () => {
    const layout = grid4x5();
    const args = {
      layout: { _id: layoutId, items: layout.items, genderParity: { mode: "off" as const } },
      board: testBoard({ studentCount: 8 }),
      constraints: [],
      lockedAssignments: [],
      layoutAggregateRows: [],
      randomSeed: "async-fallback",
    };
    const [asyncResult, syncResult] = await Promise.all([
      runClientSeatingAlgorithmAsync(args),
      Promise.resolve(runClientSeatingAlgorithm(args)),
    ]);
    expect(asyncResult).toEqual(syncResult);
    expect(asyncResult.status).toBe("ok");
  });
});
