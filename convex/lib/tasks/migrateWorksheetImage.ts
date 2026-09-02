import type { Id } from "../../_generated/dataModel.js";

type TaskAttachmentFields = {
  worksheetImageFileId?: Id<"files">;
  attachmentFileIds?: Array<Id<"files">>;
};

/**
 * Copy a legacy worksheet image into `attachmentFileIds` and clear the old field.
 * Returns undefined when the document is already migrated.
 */
export function migrateTaskWorksheetImageFields(doc: TaskAttachmentFields):
  | {
      attachmentFileIds: Array<Id<"files">>;
      worksheetImageFileId: undefined;
    }
  | undefined {
  if (doc.worksheetImageFileId === undefined) {
    return undefined;
  }
  const unique = [...new Set([doc.worksheetImageFileId, ...(doc.attachmentFileIds ?? [])])];
  return {
    attachmentFileIds: unique,
    worksheetImageFileId: undefined,
  };
}
