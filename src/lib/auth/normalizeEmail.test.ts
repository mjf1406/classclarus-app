import { describe, expect, test } from "vite-plus/test";

import { normalizeEmail } from "../../../convex/lib/trial";

describe("normalizeEmail", () => {
  test("lowercases and trims", () => {
    expect(normalizeEmail("  Alice@Example.COM ")).toBe("alice@example.com");
  });

  test("strips plus tags and dots only for gmail", () => {
    expect(normalizeEmail("a.b+tag@gmail.com")).toBe("ab@gmail.com");
    expect(normalizeEmail("a.b+tag@googlemail.com")).toBe("ab@gmail.com");
    expect(normalizeEmail("a.b+tag@example.com")).toBe("a.b+tag@example.com");
  });

  test("rejects non-ascii local parts and malformed addresses", () => {
    expect(normalizeEmail("josé@example.com")).toBeNull();
    expect(normalizeEmail("user@")).toBeNull();
    expect(normalizeEmail("@example.com")).toBeNull();
    expect(normalizeEmail("not-an-email")).toBeNull();
    expect(normalizeEmail("")).toBeNull();
  });

  test("does not strip plus tags on non-gmail domains", () => {
    expect(normalizeEmail("teacher+class@school.edu")).toBe("teacher+class@school.edu");
  });
});
