import type { ReactNode } from "react";

import { UnfiledItemsDropZone } from "@/components/folders/UnfiledItemsDropZone";
import type { FolderCardModel } from "@/lib/folders/folders";

type FolderedCardGridProps<TFolder extends FolderCardModel, TItem> = {
  folders: Array<TFolder>;
  unfiledItems: Array<TItem>;
  renderFolder: (folder: TFolder) => ReactNode;
  renderItem: (item: TItem) => ReactNode;
  getItemKey: (item: TItem) => string;
  /** When set, unfiled items render inside a droppable zone (shown even if empty). */
  unfiledDropZone?: {
    enabled: boolean;
    title: string;
    hint: string;
    emptyLabel: string;
  };
};

/**
 * Generic card grid: folders first (when any), then unfiled items.
 * Feature pages supply folder/item card renderers.
 */
export function FolderedCardGrid<TFolder extends FolderCardModel, TItem>({
  folders,
  unfiledItems,
  renderFolder,
  renderItem,
  getItemKey,
  unfiledDropZone,
}: FolderedCardGridProps<TFolder, TItem>) {
  const unfiledGrid = (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {unfiledItems.map((item) => (
        <div key={getItemKey(item)} className="h-full">
          {renderItem(item)}
        </div>
      ))}
    </div>
  );

  const showUnfiled =
    unfiledItems.length > 0 || (unfiledDropZone !== undefined && folders.length > 0);

  return (
    <div className="flex flex-col gap-6">
      {folders.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {folders.map((folder) => (
            <div key={folder._id} className="h-full">
              {renderFolder(folder)}
            </div>
          ))}
        </div>
      ) : null}
      {showUnfiled ? (
        unfiledDropZone ? (
          <UnfiledItemsDropZone
            enabled={unfiledDropZone.enabled}
            title={unfiledDropZone.title}
            hint={unfiledDropZone.hint}
            emptyLabel={unfiledDropZone.emptyLabel}
            isEmpty={unfiledItems.length === 0}
          >
            {unfiledGrid}
          </UnfiledItemsDropZone>
        ) : (
          unfiledGrid
        )
      ) : null}
    </div>
  );
}
