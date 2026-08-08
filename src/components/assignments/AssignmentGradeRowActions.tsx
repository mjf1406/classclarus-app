import { Check, Eraser, Pencil, XIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useAssignmentGradeEdit } from "@/components/assignments/assignmentGradeEditContext";
import { Button } from "@/components/ui/button";
import type { StudentRosterEntry } from "@/lib/roster/roster";

type AssignmentGradeRowActionsProps = {
  student: StudentRosterEntry;
};

export function AssignmentGradeRowActions({ student }: AssignmentGradeRowActionsProps) {
  const { t } = useTranslation("assignments");
  const { gradeAll, editingUserId, startRowGrade, saveRowGrade, cancelRowGrade, clearStudent } =
    useAssignmentGradeEdit();

  const isEditing = !gradeAll && editingUserId === student.userId;
  const editingLocked = !gradeAll && editingUserId !== null && editingUserId !== student.userId;
  // Keep row actions out of tab order while any grade inputs are active.
  const tabIndex = gradeAll || editingUserId !== null ? -1 : undefined;

  if (isEditing) {
    return (
      <div className="flex flex-wrap items-center gap-1">
        <Button
          type="button"
          size="icon-sm"
          tabIndex={tabIndex}
          aria-label={t("saveAction")}
          onClick={() => saveRowGrade(student.userId)}
        >
          <Check className="size-3.5" />
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="outline"
          tabIndex={tabIndex}
          aria-label={t("cancel")}
          onClick={() => cancelRowGrade(student.userId)}
        >
          <XIcon />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          tabIndex={tabIndex}
          onClick={() => clearStudent(student.userId)}
        >
          <Eraser className="size-4" />
          {t("clearScoreAction")}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={gradeAll || editingLocked}
        tabIndex={tabIndex}
        onClick={() => startRowGrade(student.userId)}
      >
        <Pencil className="size-4" />
        {t("gradeRowAction")}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={gradeAll || editingLocked}
        tabIndex={tabIndex}
        onClick={() => clearStudent(student.userId)}
      >
        <Eraser className="size-4" />
        {t("clearScoreAction")}
      </Button>
    </div>
  );
}
