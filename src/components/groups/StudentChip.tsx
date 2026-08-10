import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useTranslation } from "react-i18next";

import { RosterStudentChip } from "@/components/students/RosterStudentChip";
import { Badge } from "@/components/ui/badge";
import type { BoardStudent } from "@/lib/groups/groups";
import {
  DEFAULT_ROSTER_NAME_FORMAT,
  getRosterDisplayName,
  type RosterNameFormat,
} from "@/lib/roster/roster";
import { cn } from "@/lib/utils";

type StudentChipProps = {
  student: BoardStudent;
  canDrag: boolean;
  /** Keep the chip invisible while the drag overlay is still settling after drop. */
  hidden?: boolean;
  /** Highlight this chip when it represents the signed-in viewer. */
  isSelf?: boolean;
  nameFormat?: RosterNameFormat;
};

export function StudentChip({
  student,
  canDrag,
  hidden = false,
  isSelf = false,
  nameFormat = DEFAULT_ROSTER_NAME_FORMAT,
}: StudentChipProps) {
  const { t } = useTranslation("classes");
  const displayName = getRosterDisplayName(student, t("unnamedMember"), nameFormat);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `student:${student.userId}`,
    data: { studentUserId: student.userId },
    disabled: !canDrag,
  });
  const invisiblyHeld = isDragging || hidden;

  return (
    <RosterStudentChip
      ref={setNodeRef}
      userId={student.userId}
      displayName={displayName}
      rosterNumber={student.rosterNumber}
      image={student.image}
      email={student.email}
      showGrip={canDrag}
      isSelf={isSelf}
      // DragOverlay owns the visual while dragging — keep the source in place and hidden.
      style={invisiblyHeld ? undefined : { transform: CSS.Translate.toString(transform) }}
      className={cn(canDrag && "cursor-grab active:cursor-grabbing", invisiblyHeld && "opacity-0")}
      trailing={
        isSelf ? (
          <Badge variant="default" className="ml-auto shrink-0">
            {t("groupsYouBadge")}
          </Badge>
        ) : null
      }
      {...(canDrag ? { ...listeners, ...attributes } : {})}
    />
  );
}
