import { describe, expect, test } from "vite-plus/test";

import type { Id } from "../../_generated/dataModel";
import { migrateTaskWorksheetImageFields } from "./migrateWorksheetImage";

const imageId = "image1" as Id<"files">;
const extraId = "doc1" as Id<"files">;

describe("migrateTaskWorksheetImageFields", () => {
  test("copies a worksheet image into attachments and clears the old field", () => {
    expect(
      migrateTaskWorksheetImageFields({
        worksheetImageFileId: imageId,
      }),
    ).toEqual({
      attachmentFileIds: [imageId],
      worksheetImageFileId: undefined,
    });
  });

  test("deduplicates when the image is already in attachments", () => {
    expect(
      migrateTaskWorksheetImageFields({
        worksheetImageFileId: imageId,
        attachmentFileIds: [imageId, extraId],
      }),
    ).toEqual({
      attachmentFileIds: [imageId, extraId],
      worksheetImageFileId: undefined,
    });
  });

  test("returns undefined when there is no worksheet image", () => {
    expect(migrateTaskWorksheetImageFields({ attachmentFileIds: [extraId] })).toBeUndefined();
    expect(migrateTaskWorksheetImageFields({})).toBeUndefined();
  });
});
