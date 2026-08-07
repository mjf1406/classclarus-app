import { useDroppable } from "@dnd-kit/core";

import { StudentChip } from "@/components/groups/StudentChip";
import type { BoardStudent, DropTarget } from "@/lib/groups/groups";
import { cn } from "@/lib/utils";
import type { Id } from "../../../convex/_generated/dataModel";

type StudentDropZoneProps = {
  id: string;
  target: DropTarget;
  students: Array<BoardStudent>;
  canManage: boolean;
  emptyLabel: string;
  className?: string;
  disabled?: boolean;
  hiddenStudentId?: Id<"users"> | null;
  /** Signed-in user id — their chip is highlighted when present. */
  viewerUserId?: Id<"users"> | null;
};

export function StudentDropZone({
  id,
  target,
  students,
  canManage,
  emptyLabel,
  className,
  disabled = false,
  hiddenStudentId = null,
  viewerUserId = null,
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
        <p className="px-1 py-2 text-xs text-muted-foreground">{emptyLabel}</p>
      ) : (
        students.map((student) => (
          <StudentChip
            key={student.userId}
            student={student}
            canDrag={canManage}
            hidden={hiddenStudentId === student.userId}
            isSelf={viewerUserId != null && student.userId === viewerUserId}
          />
        ))
      )}
    </div>
  );
}
