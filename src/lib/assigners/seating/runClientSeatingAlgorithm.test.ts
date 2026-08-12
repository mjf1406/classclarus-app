import { describe, expect, test } from "vite-plus/test";

import type { Id } from "../../../../convex/_generated/dataModel";
import type { SeatLayoutItemSnapshot } from "../../../../convex/lib/seatChartGeometry";
import type { BoardGroup, GroupsBoard } from "@/lib/groups/groups";
import {
  filterConstraintsForBoard,
  runClientSeatingAlgorithm,
  type ClientSeatConstraint,
} from "@/lib/assigners/seating/runClientSeatingAlgorithm";

const groupId = "group" as Id<"groups">;
const layoutId = "layout" as Id<"seatLayouts">;
const seatedStudentId = "student-1" as Id<"users">;
const removedStudentId = "removed-student" as Id<"users">;

function group(partial: Pick<BoardGroup, "_id" | "name" | "students" | "teams">): BoardGroup {
  return {
    ...partial,
    description: undefined,
    icon: undefined,
    imageFileId: undefined,
    updatedAt: 1,
  };
}

function testBoard(): GroupsBoard {
  return {
    ungrouped: [],
    groups: [
      group({
        _id: groupId,
        name: "Group A",
        students: [
          {
            userId: seatedStudentId,
            firstName: "Alex",
            lastName: "Example",
            rosterNumber: 1,
          },
        ],
        teams: [],
      }),
    ],
  };
}

const layoutItems: Array<SeatLayoutItemSnapshot> = [
  {
    id: "desk-1",
    kind: "desk",
    label: "",
    deskNumber: 1,
    zoneName: "Front",
    x: 0,
    y: 0,
    width: 40,
    height: 40,
  },
];

function removedStudentConstraint(): ClientSeatConstraint {
  return {
    _id: "constraint-1" as Id<"seatConstraints">,
    type: "zone",
    polarity: "must",
    studentUserId: removedStudentId,
    zoneName: "Front",
  };
}

describe("filterConstraintsForBoard", () => {
  test("drops constraints whose students are no longer on the board", () => {
    const filtered = filterConstraintsForBoard([removedStudentConstraint()], testBoard());
    expect(filtered).toEqual([]);
  });

  test("keeps constraints for current board students", () => {
    const constraint: ClientSeatConstraint = {
      _id: "constraint-2" as Id<"seatConstraints">,
      type: "zone",
      polarity: "must",
      studentUserId: seatedStudentId,
      zoneName: "Front",
    };
    expect(filterConstraintsForBoard([constraint], testBoard())).toEqual([constraint]);
  });
});

describe("runClientSeatingAlgorithm", () => {
  test("does not fail when stale constraints reference removed students", () => {
    const result = runClientSeatingAlgorithm({
      layout: {
        _id: layoutId,
        items: layoutItems,
        genderParity: { mode: "off" },
      },
      board: testBoard(),
      constraints: [removedStudentConstraint()],
      lockedAssignments: [],
      layoutAggregateRows: [],
      randomSeed: "deterministic-seed",
    });

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.assignments).toHaveLength(1);
    expect(result.assignments[0]?.studentUserId).toBe(seatedStudentId);
  });

  test("uses a fresh empty constraint list instead of stale removed-student rules", () => {
    const freshConstraints: ClientSeatConstraint[] = [];
    const staleConstraints = [removedStudentConstraint()];

    expect(filterConstraintsForBoard(freshConstraints, testBoard())).toEqual([]);
    expect(filterConstraintsForBoard(staleConstraints, testBoard())).toEqual([]);

    const result = runClientSeatingAlgorithm({
      layout: {
        _id: layoutId,
        items: layoutItems,
        genderParity: { mode: "off" },
      },
      board: testBoard(),
      constraints: freshConstraints,
      lockedAssignments: [],
      layoutAggregateRows: [],
      randomSeed: "deterministic-seed",
    });

    expect(result.status).toBe("ok");
  });
});
