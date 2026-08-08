import { describe, expect, test } from "vite-plus/test";

import type { Id } from "../../../convex/_generated/dataModel";
import { redeemPurchaseLimitBlock } from "./redeemPurchaseLimits";

const student = "student1" as Id<"users">;
const damla = "damla" as Id<"rewards">;
const other = "other" as Id<"rewards">;
const folder = "candy" as Id<"rewardFolders">;

describe("redeemPurchaseLimitBlock", () => {
  test("blocks when folder usedInWindow already at max", () => {
    const block = redeemPurchaseLimitBlock(
      damla,
      1,
      new Set(),
      [student],
      [
        {
          studentUserId: student,
          rewardId: damla,
          usedInWindow: 1,
          kind: "folder",
          maxPurchases: 1,
          period: "week",
          every: 1,
          folderId: folder,
        },
      ],
    );
    expect(block?.kind).toBe("folder");
  });

  test("blocks second folder item when another is selected", () => {
    const statuses = [
      {
        studentUserId: student,
        rewardId: damla,
        usedInWindow: 0,
        kind: "folder" as const,
        maxPurchases: 1,
        period: "week" as const,
        every: 1,
        folderId: folder,
      },
      {
        studentUserId: student,
        rewardId: other,
        usedInWindow: 0,
        kind: "folder" as const,
        maxPurchases: 1,
        period: "week" as const,
        every: 1,
        folderId: folder,
      },
    ];
    expect(redeemPurchaseLimitBlock(other, 1, new Set([damla]), [student], statuses)?.kind).toBe(
      "folder",
    );
    expect(redeemPurchaseLimitBlock(damla, 1, new Set([damla]), [student], statuses)).toBeNull();
  });
});
