import { describe, expect, it } from "vite-plus/test";

import { assignEquitable } from "../../../convex/lib/assigners/equitableAssign";

describe("assignEquitable", () => {
  it("throws NOT_IMPLEMENTED until algorithm is added", () => {
    expect(() =>
      assignEquitable({
        items: ["A", "B"],
        recipients: [{ studentUserId: "user1", genderBucket: "m" }],
        scope: "class",
        balanceGender: false,
        priorAssignments: [],
      }),
    ).toThrow(/not implemented/i);
  });
});
