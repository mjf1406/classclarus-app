import type { UniqueIdentifier } from "@dnd-kit/core";

/** Shared drag/drop id helpers for foldered grids (behaviors now, rewards later). */

export type FolderDropTarget = { kind: "folder"; folderId: string } | { kind: "unfiled" };

export function behaviorDragId(behaviorId: string): string {
  return `behavior:${behaviorId}`;
}

export function folderDropId(folderId: string): string {
  return `folder:${folderId}`;
}

export const UNFILED_DROP_ID = "unfiled";

export function parseFolderDropTarget(id: UniqueIdentifier): FolderDropTarget | null {
  const value = String(id);
  if (value === UNFILED_DROP_ID) return { kind: "unfiled" };
  if (value.startsWith("folder:")) {
    return { kind: "folder", folderId: value.slice("folder:".length) };
  }
  return null;
}

export function parseBehaviorDragId(id: UniqueIdentifier): string | null {
  const value = String(id);
  if (!value.startsWith("behavior:")) return null;
  return value.slice("behavior:".length);
}
