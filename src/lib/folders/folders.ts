/**
 * Shared folder UI types — domain tables stay feature-specific
 * (`behaviorFolders`, later `rewardFolders`).
 */

export const MAX_FOLDER_NAME_LENGTH = 100;
export const MAX_FOLDER_DESCRIPTION_LENGTH = 500;

export type FolderCardModel = {
  _id: string;
  name: string;
  description?: string;
  icon?: string;
  itemCount: number;
};

export type FolderFormValues = {
  name: string;
  description?: string;
  icon?: string;
};
