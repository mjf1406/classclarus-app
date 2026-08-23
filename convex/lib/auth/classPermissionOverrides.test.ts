import { describe, expect, test } from "vite-plus/test";

import { classReadDeniedByOverrides } from "./classPermissionOverrides";

describe("classReadDeniedByOverrides", () => {
  test("skips classes with suspend wildcard or class:read deny", () => {
    expect(
      classReadDeniedByOverrides(
        [{ permission: "*", effect: "deny", scope: { type: "class", id: "c1" } }],
        "c1",
      ),
    ).toBe(true);
    expect(
      classReadDeniedByOverrides(
        [{ permission: "class:read", effect: "deny", scope: { type: "class", id: "c1" } }],
        "c1",
      ),
    ).toBe(true);
    expect(
      classReadDeniedByOverrides(
        [{ permission: "class:read", effect: "deny", scope: { type: "class", id: "c1" } }],
        "c2",
      ),
    ).toBe(false);
  });

  test("treats unscoped deny as global", () => {
    expect(classReadDeniedByOverrides([{ permission: "class:read", effect: "deny" }], "c1")).toBe(
      true,
    );
  });

  test("ignores allow overrides and unrelated denies", () => {
    expect(
      classReadDeniedByOverrides(
        [{ permission: "class:read", effect: "allow", scope: { type: "class", id: "c1" } }],
        "c1",
      ),
    ).toBe(false);
    expect(
      classReadDeniedByOverrides(
        [{ permission: "tasks:manage", effect: "deny", scope: { type: "class", id: "c1" } }],
        "c1",
      ),
    ).toBe(false);
  });
});
