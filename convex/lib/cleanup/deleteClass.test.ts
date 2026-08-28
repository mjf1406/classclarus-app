import { describe, expect, it } from "vitest";

import {
  CLASS_DELETION_STAGES,
  CLASS_DELETION_STAGE_COUNT,
  deletionProgressPercent,
  isValidDeletionStage,
  nextDeletionStage,
} from "./deleteClass";

describe("deleteClass stages", () => {
  it("defines finalize as the last stage", () => {
    expect(CLASS_DELETION_STAGES.at(-1)).toBe("finalize");
    expect(CLASS_DELETION_STAGE_COUNT).toBe(CLASS_DELETION_STAGES.length);
  });

  it("computes progress from completed stage count", () => {
    expect(deletionProgressPercent(0)).toBe(0);
    expect(deletionProgressPercent(CLASS_DELETION_STAGE_COUNT)).toBe(100);
  });

  it("advances stages in order", () => {
    expect(nextDeletionStage("joinCodes")).toBe("guardianLinks");
    expect(nextDeletionStage("finalize")).toBeNull();
  });

  it("validates known stage ids", () => {
    expect(isValidDeletionStage("tasks")).toBe(true);
    expect(isValidDeletionStage("not-a-stage")).toBe(false);
  });
});
