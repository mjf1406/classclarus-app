import { describe, expect, test } from "vite-plus/test";

import type { Id } from "../../../../convex/_generated/dataModel";
import { pruneSelectedRulesForConstraints } from "@/lib/assigners/seating/autoAssignRecovery";
import type { SeatingRelaxableRule } from "../../../../convex/lib/seating/types";

describe("pruneSelectedRulesForConstraints", () => {
  test("drops selected rules for deleted constraints", () => {
    const liveConstraintId = "live" as Id<"seatConstraints">;
    const deletedConstraintId = "deleted" as Id<"seatConstraints">;
    const rules: Array<SeatingRelaxableRule> = [
      { kind: "constraint", constraintId: liveConstraintId },
      { kind: "constraint", constraintId: deletedConstraintId },
      { kind: "genderParity" },
    ];

    const pruned = pruneSelectedRulesForConstraints(rules, [{ _id: liveConstraintId }]);
    expect(pruned).toEqual([
      { kind: "constraint", constraintId: liveConstraintId },
      { kind: "genderParity" },
    ]);
  });
});
