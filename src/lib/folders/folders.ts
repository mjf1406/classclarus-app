/**
 * Shared folder UI types — domain tables stay feature-specific
 * (`behaviorFolders`, `rewardFolders`).
 */

import type { PurchaseLimit } from "@/lib/rewards/purchaseLimit";

export const MAX_FOLDER_NAME_LENGTH = 100;
export const MAX_FOLDER_DESCRIPTION_LENGTH = 500;

export type FolderCardModel = {
  _id: string;
  name: string;
  description?: string;
  icon?: string;
  itemCount: number;
  purchaseLimit?: PurchaseLimit;
};

export type FolderFormValues = {
  name: string;
  description?: string;
  icon?: string;
  purchaseLimit?: PurchaseLimit;
};

export type FolderI18nNamespace = "behaviors" | "rewards";
