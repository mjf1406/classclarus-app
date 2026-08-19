import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, SmilePlus, Pencil, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { FontAwesomeIconFromId } from "@/components/icons/FontAwesomeIconFromId";
import { ActionMenu, type ActionMenuItem } from "@/components/ui/action-menu";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBehaviorPoints, type BehaviorListItem } from "@/lib/behaviors/behaviors";
import { behaviorDragId } from "@/lib/folders/folderDnd";
import { cn } from "@/lib/utils";

type BehaviorCardProps = {
  behavior: BehaviorListItem;
  compact?: boolean;
  canDrag?: boolean;
  /** Hide the source card while the drag overlay is active. */
  hidden?: boolean;
  onEdit: (behavior: BehaviorListItem) => void;
  onDelete: (behavior: BehaviorListItem) => void;
};

export function BehaviorCard({
  behavior,
  compact = false,
  canDrag = false,
  hidden = false,
  onEdit,
  onDelete,
}: BehaviorCardProps) {
  const { t, i18n } = useTranslation("behaviors");
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: behaviorDragId(behavior._id),
    data: {
      type: "behavior" as const,
      behaviorId: behavior._id,
      folderId: behavior.folderId,
    },
    disabled: !canDrag,
  });
  const invisiblyHeld = isDragging || hidden;

  const menuItems = useMemo<Array<ActionMenuItem>>(
    () => [
      {
        id: "edit",
        label: t("editAction"),
        icon: <Pencil />,
        permission: "behaviors:manage",
        group: "manage",
        onSelect: () => onEdit(behavior),
      },
      {
        id: "delete",
        label: t("deleteAction"),
        icon: <Trash2 />,
        permission: "behaviors:manage",
        variant: "destructive",
        group: "danger",
        onSelect: () => onDelete(behavior),
      },
    ],
    [behavior, onDelete, onEdit, t],
  );

  const description = behavior.description?.trim() || t("emptyDescriptionPreview");
  const pointsLabel = formatBehaviorPoints(behavior.points, i18n.language);
  const pointsPositive = behavior.points > 0;
  const pointsNegative = behavior.points < 0;

  return (
    <Card
      ref={setNodeRef}
      size="sm"
      style={invisiblyHeld ? undefined : { transform: CSS.Translate.toString(transform) }}
      className={cn(
        "h-full transition-colors hover:bg-accent/40",
        compact && "shadow-none",
        canDrag && "cursor-grab active:cursor-grabbing",
        invisiblyHeld && "opacity-0",
      )}
      {...(canDrag ? { ...listeners, ...attributes } : {})}
    >
      <CardHeader className="flex flex-row items-start gap-3">
        {canDrag ? (
          <GripVertical className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden />
        ) : null}
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <FontAwesomeIconFromId
            id={behavior.icon}
            className="size-5"
            fallback={<SmilePlus className="size-5" />}
          />
        </div>
        <div className="min-w-0 flex-1">
          <CardTitle className="text-base font-semibold">{behavior.name}</CardTitle>
          <CardDescription className="mt-1 line-clamp-2">{description}</CardDescription>
        </div>
        <div
          className="shrink-0"
          onPointerDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <ActionMenu items={menuItems} label={t("actions")} />
        </div>
      </CardHeader>
      <CardContent className="mt-auto flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center rounded-md px-2 py-0.5 text-sm font-semibold tabular-nums",
            pointsPositive && "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
            pointsNegative && "bg-rose-500/15 text-rose-700 dark:text-rose-300",
            !pointsPositive && !pointsNegative && "bg-muted text-muted-foreground",
          )}
        >
          {t("pointsValue", { points: pointsLabel })}
        </span>
      </CardContent>
    </Card>
  );
}
