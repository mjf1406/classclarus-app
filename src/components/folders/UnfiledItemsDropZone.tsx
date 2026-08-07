import { useDroppable } from "@dnd-kit/core";
import type { ReactNode } from "react";

import { UNFILED_DROP_ID } from "@/lib/folders/folderDnd";
import { cn } from "@/lib/utils";

type UnfiledItemsDropZoneProps = {
  enabled: boolean;
  title: string;
  hint: string;
  emptyLabel: string;
  isEmpty: boolean;
  children: ReactNode;
};

/** Droppable region for items not in a folder. */
export function UnfiledItemsDropZone({
  enabled,
  title,
  hint,
  emptyLabel,
  isEmpty,
  children,
}: UnfiledItemsDropZoneProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: UNFILED_DROP_ID,
    data: { type: "unfiled" as const },
    disabled: !enabled,
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-sm font-semibold">{title}</h2>
        {enabled ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "rounded-2xl transition-colors",
          enabled && "min-h-24 border border-dashed p-3",
          enabled && isOver && "border-primary bg-primary/5",
          enabled && !isOver && "border-border/80",
        )}
      >
        {isEmpty ? (
          <p className="px-1 py-6 text-center text-sm text-muted-foreground">{emptyLabel}</p>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
