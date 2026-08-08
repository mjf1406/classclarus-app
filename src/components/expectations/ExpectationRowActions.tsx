import { Check, Pencil, XIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useExpectationRowEdit } from "@/components/expectations/expectationRowEditContext";
import { Button } from "@/components/ui/button";
import type { StudentRosterEntry } from "@/lib/roster/roster";

type ExpectationRowActionsProps = {
  student: StudentRosterEntry;
};

export function ExpectationRowActions({ student }: ExpectationRowActionsProps) {
  const { t } = useTranslation("expectations");
  const { editingUserId, startEdit, cancelEdit, saveEdit } = useExpectationRowEdit();
  const isEditing = editingUserId === student.userId;
  const editingLocked = editingUserId !== null && editingUserId !== student.userId;

  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        <Button
          type="button"
          size="icon-sm"
          aria-label={t("saveAction")}
          onClick={() => saveEdit(student.userId)}
        >
          <Check className="size-3.5" />
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="outline"
          aria-label={t("cancel")}
          onClick={cancelEdit}
        >
          <XIcon />
        </Button>
      </div>
    );
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={editingLocked}
      onClick={() => startEdit(student.userId)}
    >
      <Pencil className="size-3.5" />
      {t("editRowAction")}
    </Button>
  );
}
