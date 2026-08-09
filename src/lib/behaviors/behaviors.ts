import type { FunctionReturnType } from "convex/server";

import { api } from "../../../convex/_generated/api";
import { toIntlLocale } from "@/lib/languages";

export const MAX_BEHAVIOR_NAME_LENGTH = 100;
export const MAX_BEHAVIOR_DESCRIPTION_LENGTH = 500;
export const MAX_BEHAVIOR_POINTS = 1_000_000;

export type BehaviorListItem = FunctionReturnType<typeof api.behaviors.list>[number];
export type BehaviorList = FunctionReturnType<typeof api.behaviors.list>;
export type BehaviorFolderListItem = FunctionReturnType<typeof api.behaviorFolders.list>[number];
export type BehaviorFolderList = FunctionReturnType<typeof api.behaviorFolders.list>;

export type PointsApplyMode = "future" | "retroactive";

export type BehaviorFormValues = {
  name: string;
  description?: string;
  icon?: string;
  points: number;
  folderId?: BehaviorListItem["folderId"];
  pointsApplyMode?: PointsApplyMode;
};

export function formatBehaviorPoints(points: number, language: string): string {
  const formatted = new Intl.NumberFormat(toIntlLocale(language), {
    signDisplay: "exceptZero",
  }).format(points);
  return formatted;
}

export function filterBehaviorsByName(behaviors: BehaviorList, query: string): BehaviorList {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return behaviors;
  return behaviors.filter((behavior) => behavior.name.toLowerCase().includes(trimmed));
}

export function partitionBehaviorsByFolder(
  behaviors: BehaviorList,
  folderId: BehaviorFolderListItem["_id"] | null,
): BehaviorList {
  if (folderId === null) {
    return behaviors.filter((behavior) => behavior.folderId === undefined);
  }
  return behaviors.filter((behavior) => behavior.folderId === folderId);
}
