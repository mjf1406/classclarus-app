import { CheckIcon, PencilIcon, PrinterIcon, UserMinusIcon, XIcon } from "lucide-react";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";

import { ClassRoleSelectLabel } from "@/components/badges/ClassRoleBadges";
import { Can } from "@/components/permissions/Can";
import { useClassPermissionsContext } from "@/components/permissions/classPermissionsContext";
import {
  RosterTable,
  type RosterRowActionsContext,
  type RosterSaveRowDraft,
} from "@/components/roster/RosterTable";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  assignableRolesFor,
  canChangeMemberRole,
  removePermissionForMember,
  type JoinCodeRole,
} from "@/lib/members/members";
import { isJoinCodeRole } from "@/lib/permissions/classPermissions";
import type { RosterColumnId, StudentRosterEntry } from "@/lib/roster/roster";
import type { Id } from "../../../convex/_generated/dataModel";

type StudentRosterTableProps = {
  data: StudentRosterEntry[];
  tableEditMode: boolean;
  canUpdateRoster: boolean;
  columnOrder: RosterColumnId[];
  columnVisibility: Record<RosterColumnId, boolean>;
  onColumnOrderChange: (order: RosterColumnId[]) => void;
  onColumnVisibilityChange: (visibility: Record<RosterColumnId, boolean>) => void;
  onReorderRows: (userIds: Id<"users">[]) => void;
  onSaveRow: (userId: Id<"users">, draft: RosterSaveRowDraft) => void;
  onRemove: (student: StudentRosterEntry) => void;
  onChangeRole: (student: StudentRosterEntry, role: JoinCodeRole) => void;
  onPrintInvite?: (students: StudentRosterEntry[]) => void;
  currentUserId?: Id<"users">;
};

export function StudentRosterTable({
  data,
  tableEditMode,
  canUpdateRoster,
  columnOrder,
  columnVisibility,
  onColumnOrderChange,
  onColumnVisibilityChange,
  onReorderRows,
  onSaveRow,
  onRemove,
  onChangeRole,
  onPrintInvite,
  currentUserId,
}: StudentRosterTableProps) {
  const { t } = useTranslation("classes");
  const { role: actorRole } = useClassPermissionsContext();

  const renderRowActions = useCallback(
    ({
      student,
      isEditing,
      editingLocked,
      canUpdateRoster: canEdit,
      startEdit,
      saveEdit,
      cancelEdit,
    }: RosterRowActionsContext) => {
      const isSelf = currentUserId === student.userId;
      const removePermission = removePermissionForMember("student");
      const showRemove = !isSelf && removePermission !== null;
      const showRoleSelect = !isSelf && canChangeMemberRole(actorRole, "student");
      const roleOptions = actorRole ? assignableRolesFor(actorRole) : [];

      if (isEditing) {
        return (
          <div className="flex flex-wrap items-center gap-1">
            <Button type="button" size="icon-sm" aria-label={t("rosterSaveRow")} onClick={saveEdit}>
              <CheckIcon />
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="outline"
              aria-label={t("rosterCancelRow")}
              onClick={cancelEdit}
            >
              <XIcon />
            </Button>
          </div>
        );
      }

      return (
        <div className="flex flex-wrap items-center gap-1">
          {canEdit ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={editingLocked}
              onClick={startEdit}
            >
              <PencilIcon data-icon="inline-start" />
              {t("rosterEditRow")}
            </Button>
          ) : null}
          {onPrintInvite ? (
            <Can permission="guardians:invite">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onPrintInvite([student])}
              >
                <PrinterIcon data-icon="inline-start" />
                {t("printGuardianInvite")}
              </Button>
            </Can>
          ) : null}
          {showRoleSelect ? (
            <Select
              value="student"
              onValueChange={(next) => {
                if (next == null || !isJoinCodeRole(next) || next === "student") return;
                onChangeRole(student, next);
              }}
            >
              <SelectTrigger size="sm" className="w-36" aria-label={t("changeRole")}>
                <SelectValue>
                  <ClassRoleSelectLabel role="student" colored />
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {roleOptions.map((role) => (
                    <SelectItem key={role} value={role}>
                      <ClassRoleSelectLabel role={role} />
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          ) : null}
          {showRemove && removePermission ? (
            <Can permission={removePermission}>
              <Button type="button" size="sm" variant="outline" onClick={() => onRemove(student)}>
                <UserMinusIcon data-icon="inline-start" />
                {t("removeMember")}
              </Button>
            </Can>
          ) : null}
        </div>
      );
    },
    [actorRole, currentUserId, onChangeRole, onPrintInvite, onRemove, t],
  );

  return (
    <RosterTable
      data={data}
      tableEditMode={tableEditMode}
      canUpdateRoster={canUpdateRoster}
      columnOrder={columnOrder}
      columnVisibility={columnVisibility}
      onColumnOrderChange={onColumnOrderChange}
      onColumnVisibilityChange={onColumnVisibilityChange}
      onReorderRows={onReorderRows}
      onSaveRow={onSaveRow}
      renderRowActions={renderRowActions}
    />
  );
}
