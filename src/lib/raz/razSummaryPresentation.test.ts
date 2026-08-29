import { describe, expect, it } from "vite-plus/test";

import { razStatusBadgeVariant } from "@/lib/raz/razSummaryPresentation";

describe("razSummaryPresentation", () => {
  it("maps display statuses to badge variants", () => {
    expect(razStatusBadgeVariant("rti")).toBe("destructive");
    expect(razStatusBadgeVariant("overdue")).toBe("destructive");
    expect(razStatusBadgeVariant("due_now")).toBe("default");
    expect(razStatusBadgeVariant("pending")).toBe("secondary");
    expect(razStatusBadgeVariant("coming_soon")).toBe("secondary");
    expect(razStatusBadgeVariant("up_to_date")).toBe("outline");
    expect(razStatusBadgeVariant("ineligible")).toBe("outline");
  });
});
