import { describe, expect, test } from "vite-plus/test";

import type { Id } from "../../../convex/_generated/dataModel";
import {
  assignmentFormValuesFromDetail,
  assignmentGradingStatusForStudent,
  assignmentMutationPayloadFromForm,
  emptyAssignmentFormValues,
  isStudentAssignmentHandedIn,
  type AssignmentListItem,
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

describe("assignment worksheet image payload", () => {
  test("includes worksheetImageFileId when the form has an image", () => {
    const values = emptyAssignmentFormValues();
    values.name = "Homework";
    values.worksheetImageFileId = "file123" as Id<"files">;
    expect(assignmentMutationPayloadFromForm(values).worksheetImageFileId).toBe("file123");
  });

  test("omits worksheetImageFileId when the form has no image", () => {
    const values = emptyAssignmentFormValues();
    values.name = "Homework";
    expect(assignmentMutationPayloadFromForm(values).worksheetImageFileId).toBeUndefined();
  });

  test("copies worksheetImageFileId from assignment detail", () => {
    const detail = {
      name: "Homework",
      subject: undefined,
      unit: undefined,
      dueDateKey: undefined,
      instructionsJson: undefined,
      scoringMode: "total" as const,
      totalPoints: 10,
      sections: undefined,
      procedureSteps: [],
      expectationIds: [],
      acceptLinkSubmissions: true,
      worksheetImageFileId: "file456" as Id<"files">,
    } as unknown as AssignmentListItem;
    expect(assignmentFormValuesFromDetail(detail).worksheetImageFileId).toBe("file456");
  });
});
