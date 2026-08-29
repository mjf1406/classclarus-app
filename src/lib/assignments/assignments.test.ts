import { describe, expect, test } from "vite-plus/test";

import {
  assignmentGradingStatusForStudent,
  isStudentAssignmentHandedIn,
} from "@/lib/assignments/assignments";

describe("isStudentAssignmentHandedIn", () => {
  test("uses handed-in student ids when present", () => {
    expect(
      isStudentAssignmentHandedIn(
        {
          handedInStudentIds: ["stu-1", "stu-2"],
          handedInStudentCount: 2,
          studentCount: 4,
        },
        "stu-2",
      ),
    ).toBe(true);
    expect(
      isStudentAssignmentHandedIn(
        {
          handedInStudentIds: ["stu-1"],
          handedInStudentCount: 1,
          studentCount: 4,
        },
        "stu-2",
      ),
    ).toBe(false);
  });

  test("falls back to a single-student count when ids are missing", () => {
    expect(isStudentAssignmentHandedIn({ handedInStudentCount: 1, studentCount: 1 }, "stu-1")).toBe(
      true,
    );
    expect(isStudentAssignmentHandedIn({ handedInStudentCount: 1, studentCount: 2 }, "stu-1")).toBe(
      false,
    );
  });
});

describe("assignmentGradingStatusForStudent", () => {
  test("returns undefined for staff (no viewerScoreStates)", () => {
    expect(assignmentGradingStatusForStudent({ scoresReleased: false }, "stu-1")).toBeUndefined();
    expect(assignmentGradingStatusForStudent({ scoresReleased: true }, "stu-1")).toBeUndefined();
  });

  test("returns released when scores are released", () => {
    expect(
      assignmentGradingStatusForStudent(
        {
          scoresReleased: true,
          viewerScoreStates: [{ studentUserId: "stu-1", graded: false, excused: false }],
        },
        "stu-1",
      ),
    ).toBe("released");
  });

  test("returns gradedNotReleased when that student is graded and scores are hidden", () => {
    expect(
      assignmentGradingStatusForStudent(
        {
          scoresReleased: false,
          viewerScoreStates: [
            { studentUserId: "stu-1", graded: true, excused: false },
            { studentUserId: "stu-2", graded: false, excused: false },
          ],
        },
        "stu-1",
      ),
    ).toBe("gradedNotReleased");
    expect(
      assignmentGradingStatusForStudent(
        {
          scoresReleased: false,
          viewerScoreStates: [{ studentUserId: "stu-1", graded: true, excused: false }],
        },
        "stu-2",
      ),
    ).toBe("notGraded");
  });

  test("returns notGraded when no score row exists for the student", () => {
    expect(
      assignmentGradingStatusForStudent({ scoresReleased: false, viewerScoreStates: [] }, "stu-1"),
    ).toBe("notGraded");
  });

  test("without a student id, uses any graded state", () => {
    expect(
      assignmentGradingStatusForStudent({
        scoresReleased: false,
        viewerScoreStates: [
          { studentUserId: "stu-1", graded: false, excused: false },
          { studentUserId: "stu-2", graded: true, excused: false },
        ],
      }),
    ).toBe("gradedNotReleased");
    expect(
      assignmentGradingStatusForStudent({
        scoresReleased: false,
        viewerScoreStates: [{ studentUserId: "stu-1", graded: false, excused: false }],
      }),
    ).toBe("notGraded");
  });
});
