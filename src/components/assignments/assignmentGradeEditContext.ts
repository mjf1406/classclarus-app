import { createContext, useContext } from "react";

import type { StudentScoreDraft } from "@/lib/assignments/assignmentScores";
import type { Id } from "../../../convex/_generated/dataModel";

export type AssignmentGradeEditContextValue = {
  gradeAll: boolean;
  editingUserId: Id<"users"> | null;
  isRowEditable: (studentUserId: Id<"users">) => boolean;
  getDraft: (studentUserId: Id<"users">) => StudentScoreDraft;
  /** Patch draft and persist immediately (blur / select / checkbox). */
  applyAndCommit: (
    studentUserId: Id<"users">,
    patch: (prev: StudentScoreDraft) => StudentScoreDraft,
  ) => void;
  startRowGrade: (studentUserId: Id<"users">) => void;
  /** Confirm row edits and exit edit mode (scores already persist on blur). */
  saveRowGrade: (studentUserId: Id<"users">) => void;
  /** Exit grade-all ("Done grading") or confirm the active row (checkmark). */
  finishGrading: (studentUserId: Id<"users">) => void;
  /** Revert to the score from when grading started, then exit edit mode. */
  cancelRowGrade: (studentUserId: Id<"users">) => void;
  clearStudent: (studentUserId: Id<"users">) => void;
};

export const AssignmentGradeEditContext = createContext<AssignmentGradeEditContextValue | null>(
  null,
);

export function useAssignmentGradeEdit(): AssignmentGradeEditContextValue {
  const ctx = useContext(AssignmentGradeEditContext);
  if (!ctx) {
    throw new Error("useAssignmentGradeEdit must be used within AssignmentGradeEditProvider");
  }
  return ctx;
}
