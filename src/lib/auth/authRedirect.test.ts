import { describe, expect, test } from "vite-plus/test";

import { getSafeAuthRedirect } from "./authRedirect";

const ORIGIN = "https://app.classclarus.com";

describe("getSafeAuthRedirect", () => {
  test("allows same-app relative paths", () => {
    expect(getSafeAuthRedirect("/classes", ORIGIN)).toBe("/classes");
    expect(getSafeAuthRedirect("/join?code=ABC123", ORIGIN)).toBe("/join?code=ABC123");
  });

  test("rejects empty and non-strings", () => {
    expect(getSafeAuthRedirect(undefined, ORIGIN)).toBe("/");
    expect(getSafeAuthRedirect("", ORIGIN)).toBe("/");
    expect(getSafeAuthRedirect(42, ORIGIN)).toBe("/");
  });

  test("rejects protocol-relative and absolute URLs", () => {
    expect(getSafeAuthRedirect("//evil.com", ORIGIN)).toBe("/");
    expect(getSafeAuthRedirect("https://evil.com", ORIGIN)).toBe("/");
    expect(getSafeAuthRedirect("https:evil.com", ORIGIN)).toBe("/");
  });

  test("rejects backslash and encoded separator bypasses", () => {
    expect(getSafeAuthRedirect("/\\evil.com", ORIGIN)).toBe("/");
    expect(getSafeAuthRedirect("/%5Cevil.com", ORIGIN)).toBe("/");
    expect(getSafeAuthRedirect("/%2f%2fevil.com", ORIGIN)).toBe("/");
    expect(getSafeAuthRedirect("/%00/evil", ORIGIN)).toBe("/");
  });

  test("rejects login bounce-backs", () => {
    expect(getSafeAuthRedirect("/login", ORIGIN)).toBe("/");
    expect(getSafeAuthRedirect("/login?x=1", ORIGIN)).toBe("/");
    expect(getSafeAuthRedirect("/login#hash", ORIGIN)).toBe("/");
  });
});
