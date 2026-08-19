import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Gift, GripVertical, Pencil, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { FontAwesomeIconFromId } from "@/components/icons/FontAwesomeIconFromId";
import { ActionMenu, type ActionMenuItem } from "@/components/ui/action-menu";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { rewardDragId } from "@/lib/folders/folderDnd";
import { formatPurchaseLimitSummary } from "@/lib/rewards/purchaseLimit";
import { formatRewardPoints, type RewardListItem } from "@/lib/rewards/rewards";
import { cn } from "@/lib/utils";

type RewardCardProps = {
  reward: RewardListItem;
  compact?: boolean;
  canDrag?: boolean;
  /** Hide the source card while the drag overlay is active. */
  hidden?: boolean;
  onEdit: (reward: RewardListItem) => void;
  onDelete: (reward: RewardListItem) => void;
};

export function RewardCard({
  reward,
  compact = false,
  canDrag = false,
  hidden = false,
  onEdit,
  onDelete,
}: RewardCardProps) {
  const { t, i18n } = useTranslation("rewards");
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: rewardDragId(reward._id),
    data: {
      type: "reward" as const,
      rewardId: reward._id,
      folderId: reward.folderId,
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
        permission: "rewards:manage",
        group: "manage",
        onSelect: () => onEdit(reward),
      },
      {
        id: "delete",
        label: t("deleteAction"),
        icon: <Trash2 />,
        permission: "rewards:manage",
        variant: "destructive",
        group: "danger",
        onSelect: () => onDelete(reward),
      },
    ],
    [onDelete, onEdit, reward, t],
  );

  const description = reward.description?.trim() || t("emptyDescriptionPreview");
  const pointsLabel = formatRewardPoints(reward.points, i18n.language);
  const limitSummary = reward.purchaseLimit
    ? formatPurchaseLimitSummary(reward.purchaseLimit, {
        max: (count) => t("purchaseLimitSummaryMax", { count }),
        every: (count, period) => t("purchaseLimitSummaryEvery", { count, period }),
        period: (period) =>
          t(
            `purchaseLimitPeriod_${period}` as
              | "purchaseLimitPeriod_day"
              | "purchaseLimitPeriod_week"
              | "purchaseLimitPeriod_month",
          ),
      })
    : null;

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
            id={reward.icon}
            className="size-5"
            fallback={<Gift className="size-5" />}
          />
        </div>
        <div className="min-w-0 flex-1">
          <CardTitle className="text-base font-semibold">{reward.name}</CardTitle>
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
      <CardContent className="mt-auto flex flex-col gap-1">
        <span className="inline-flex w-fit items-center rounded-md bg-muted px-2 py-0.5 text-sm font-semibold tabular-nums text-muted-foreground">
          {t("pointsValue", { points: pointsLabel })}
        </span>
        <p
          className={cn(
            "text-xs text-muted-foreground tabular-nums",
            limitSummary ? undefined : "invisible",
          )}
        >
          {limitSummary ?? "\u00a0"}
        </p>
      </CardContent>
    </Card>
  );
}
