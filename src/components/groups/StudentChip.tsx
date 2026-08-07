import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { BoardStudent } from "@/lib/groups/groups";
import { cn } from "@/lib/utils";
import { getDisplayName, getInitials } from "@/lib/user/userDisplay";

type StudentChipProps = {
  student: BoardStudent;
  canDrag: boolean;
  /** Keep the chip invisible while the drag overlay is still settling after drop. */
  hidden?: boolean;
};

export function StudentChip({ student, canDrag, hidden = false }: StudentChipProps) {
  const { t } = useTranslation("classes");
  const displayName = getDisplayName(
    { _id: student.userId, name: student.name, email: student.email },
    t("unnamedMember"),
  );
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `student:${student.userId}`,
    data: { studentUserId: student.userId },
    disabled: !canDrag,
  });
  const invisiblyHeld = isDragging || hidden;

  return (
    <div
      ref={setNodeRef}
      // DragOverlay owns the visual while dragging — keep the source in place and hidden.
      style={invisiblyHeld ? undefined : { transform: CSS.Translate.toString(transform) }}
      className={cn(
        "flex items-center gap-2 rounded-lg border bg-background px-2 py-1.5 text-sm shadow-sm",
        canDrag && "cursor-grab active:cursor-grabbing",
        invisiblyHeld && "opacity-0",
      )}
      {...(canDrag ? { ...listeners, ...attributes } : {})}
    >
      {canDrag ? (
        <GripVertical className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      ) : null}
      <Avatar className="size-6">
        {student.image ? (
          <AvatarImage src={student.image} alt={displayName} referrerPolicy="no-referrer" />
        ) : null}
        <AvatarFallback className="text-[10px]">
          {getInitials({
            _id: student.userId,
            name: student.name,
            email: student.email,
          })}
        </AvatarFallback>
      </Avatar>
      <span className="min-w-0 truncate font-medium">{displayName}</span>
    </div>
  );
}
