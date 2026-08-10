import { useDroppable } from "@dnd-kit/core";
import type { ReactNode } from "react";

import { StudentChip } from "@/components/groups/StudentChip";
import type { BoardStudent, DropTarget } from "@/lib/groups/groups";
import { DEFAULT_ROSTER_NAME_FORMAT, type RosterNameFormat } from "@/lib/roster/roster";
import { cn } from "@/lib/utils";
import type { Id } from "../../../convex/_generated/dataModel";

type StudentDropZoneProps = {
  id: string;
  target: DropTarget;
  students: Array<BoardStudent>;
  canManage: boolean;
  emptyLabel: string;
  /** Optional action shown under the empty label (e.g. add-all). */
  emptyAction?: ReactNode;
  className?: string;
  disabled?: boolean;
  hiddenStudentId?: Id<"users"> | null;
  /** Signed-in user id — their chip is highlighted when present. */
  viewerUserId?: Id<"users"> | null;
  nameFormat?: RosterNameFormat;
};

export function StudentDropZone({
  id,
  target,
  students,
  canManage,
  emptyLabel,
  emptyAction,
  className,
  disabled = false,
  hiddenStudentId = null,
  viewerUserId = null,
  nameFormat = DEFAULT_ROSTER_NAME_FORMAT,
}: StudentDropZoneProps) {
  const { setNodeRef, isOver } = useDroppable({
    id,
    data: { target },
    disabled: disabled || !canManage,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-16 flex-col gap-2 rounded-lg border border-dashed p-2 transition-colors",
        isOver && canManage && !disabled && "border-primary bg-primary/5",
        disabled && "opacity-60",
        className,
      )}
    >
      {students.length === 0 ? (
        <div className="flex flex-col items-start gap-2 px-1 py-2">
          <p className="text-xs text-muted-foreground">{emptyLabel}</p>
          {emptyAction}
        </div>
      ) : (
        students.map((student) => (
          <StudentChip
            key={student.userId}
            student={student}
            canDrag={canManage}
            hidden={hiddenStudentId === student.userId}
            isSelf={viewerUserId != null && student.userId === viewerUserId}
            nameFormat={nameFormat}
          />
        ))
      )}
    </div>
  );
}
