import { useDroppable } from "@dnd-kit/core";
import { Folder as FolderIcon, Pencil, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { FontAwesomeIconFromId } from "@/components/icons/FontAwesomeIconFromId";
import { ActionMenu, type ActionMenuItem } from "@/components/ui/action-menu";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { folderDropId } from "@/lib/folders/folderDnd";
import type { FolderCardModel, FolderI18nNamespace } from "@/lib/folders/folders";
import type { ClassPermission } from "@/lib/permissions/classPermissions";
import { cn } from "@/lib/utils";

type FolderCardProps<TItem> = {
  folder: FolderCardModel;
  items: Array<TItem>;
  managePermission: ClassPermission;
  onEdit: () => void;
  onDelete: () => void;
  renderItem: (item: TItem) => ReactNode;
  emptyLabel: string;
  namespace?: FolderI18nNamespace;
  /** Optional short purchase-limit summary shown on the card. */
  limitSummary?: string;
  /** Accept drops of items into this folder. */
  canDrop?: boolean;
  /**
   * Keep the popover open (e.g. while dragging an item out). Prevents the
   * drag source from unmounting mid-drop, which snaps the overlay to origin.
   */
  keepOpen?: boolean;
};

export function FolderCard<TItem>({
  folder,
  items,
  managePermission,
  onEdit,
  onDelete,
  renderItem,
  emptyLabel,
  namespace = "behaviors",
  limitSummary,
  canDrop = false,
  keepOpen = false,
}: FolderCardProps<TItem>) {
  const { t } = useTranslation(namespace);
  const [open, setOpen] = useState(false);
  const wasKeepOpenRef = useRef(keepOpen);
  /** After drag-unpin, the next open can be closed by a stale focus-out/outside-press. */
  const suppressStaleDismissRef = useRef(false);
  const openedAtRef = useRef(0);
  const { setNodeRef, isOver } = useDroppable({
    id: folderDropId(folder._id),
    data: { type: "folder" as const, folderId: folder._id },
    disabled: !canDrop,
  });

  useEffect(() => {
    if (keepOpen) {
      setOpen(true);
      wasKeepOpenRef.current = true;
      return;
    }
    if (wasKeepOpenRef.current) {
      // Close after a pinned drag settles so the source unmounts cleanly.
      setOpen(false);
      suppressStaleDismissRef.current = true;
      wasKeepOpenRef.current = false;
      return;
    }
  }, [keepOpen]);

  const menuItems = useMemo<Array<ActionMenuItem>>(
    () => [
      {
        id: "edit",
        label: t("folderEditAction"),
        icon: <Pencil />,
        permission: managePermission,
        group: "manage",
        onSelect: onEdit,
      },
      {
        id: "delete",
        label: t("folderDeleteAction"),
        icon: <Trash2 />,
        permission: managePermission,
        variant: "destructive",
        group: "danger",
        onSelect: onDelete,
      },
    ],
    [managePermission, onDelete, onEdit, t],
  );

  const description = folder.description?.trim() || t("folderEmptyDescriptionPreview");
  const isOpen = keepOpen || open;

  return (
    <Popover
      open={isOpen}
      onOpenChange={(next, eventDetails) => {
        if (keepOpen && !next) {
          // Dragging out fires outside-press/focus-out; cancel so Base UI stays in sync.
          eventDetails.cancel();
          return;
        }
        if (next) {
          openedAtRef.current = performance.now();
          setOpen(true);
          return;
        }
        // Same gesture that re-opens after a drag-out often also delivers a stale dismiss.
        // Clicking elsewhere first consumes it; ignore that immediate close instead.
        if (suppressStaleDismissRef.current && performance.now() - openedAtRef.current < 100) {
          suppressStaleDismissRef.current = false;
          eventDetails.cancel();
          return;
        }
        suppressStaleDismissRef.current = false;
        setOpen(false);
      }}
    >
      <Card
        ref={setNodeRef}
        size="sm"
        className={cn(
          "transition-colors hover:bg-accent/40",
          canDrop && isOver && "bg-primary/5 ring-2 ring-primary",
        )}
      >
        <CardHeader className="flex flex-row items-start gap-3">
          <PopoverTrigger
            className="flex min-w-0 flex-1 items-start gap-3 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
            type="button"
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <FontAwesomeIconFromId
                id={folder.icon}
                className="size-5"
                fallback={<FolderIcon className="size-5" />}
              />
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-base font-semibold">{folder.name}</CardTitle>
              <CardDescription className="mt-1 line-clamp-2">{description}</CardDescription>
            </div>
          </PopoverTrigger>
          <div className="shrink-0">
            <ActionMenu items={menuItems} label={t("folderActions")} />
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          <PopoverTrigger
            type="button"
            className="text-left text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("folderItemCount", { count: folder.itemCount })}
          </PopoverTrigger>
          {limitSummary ? (
            <p className="text-xs text-muted-foreground tabular-nums">{limitSummary}</p>
          ) : null}
        </CardContent>
      </Card>

      <PopoverContent align="start" className="w-80 max-h-96 overflow-y-auto sm:w-96">
        <PopoverHeader>
          <PopoverTitle>{folder.name}</PopoverTitle>
          <PopoverDescription>
            {t("folderItemCount", { count: folder.itemCount })}
            {limitSummary ? ` · ${limitSummary}` : ""}
          </PopoverDescription>
        </PopoverHeader>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyLabel}</p>
        ) : (
          <div className="flex flex-col gap-2">{items.map((item) => renderItem(item))}</div>
        )}
      </PopoverContent>
    </Popover>
  );
}
