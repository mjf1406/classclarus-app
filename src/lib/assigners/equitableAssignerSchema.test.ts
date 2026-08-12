import { describe, expect, it } from "vite-plus/test";

import { equitableAssignerFormSchemaEn } from "../../../convex/lib/assigners/equitableAssignerSchema";

describe("equitableAssignerFormSchemaEn", () => {
  it("accepts valid form values", () => {
    const parsed = equitableAssignerFormSchemaEn.safeParse({
      name: "Jobs",
      items: ["Line leader", "Door holder"],
      defaultBalanceGender: true,
      defaultScope: "class",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects duplicate items", () => {
    const parsed = equitableAssignerFormSchemaEn.safeParse({
      name: "Jobs",
      items: ["A", "a"],
      defaultBalanceGender: false,
      defaultScope: "groups",
    });
    expect(parsed.success).toBe(false);
  });
});
