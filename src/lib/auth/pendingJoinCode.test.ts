import { describe, expect, test, beforeEach, afterEach } from "vite-plus/test";

import {
  clearPendingJoinCode,
  peekPendingJoinCode,
  relativeLocationHref,
  resolveJoinCodePrefill,
  stashPendingJoinCode,
  takePendingJoinCode,
} from "./pendingJoinCode";

describe("relativeLocationHref", () => {
  test("joins pathname, search, and hash", () => {
    expect(
      relativeLocationHref({
        pathname: "/join",
        searchStr: "?jc=ABC123",
        hash: "",
      }),
    ).toBe("/join?jc=ABC123");

    expect(
      relativeLocationHref({
        pathname: "/join",
        searchStr: "?jc=ABC123",
        hash: "top",
      }),
    ).toBe("/join?jc=ABC123#top");
  });
});

describe("resolveJoinCodePrefill", () => {
  beforeEach(() => {
    clearPendingJoinCode();
  });

  afterEach(() => {
    clearPendingJoinCode();
  });

  test("prefers typed search code over location and storage", () => {
    stashPendingJoinCode("STORED1");
    expect(
      resolveJoinCodePrefill({
        searchCode: "typed1",
        locationSearch: "?jc=LOCATI",
      }),
    ).toBe("TYPED1");
  });

  test("falls back to location search when typed search is empty", () => {
    stashPendingJoinCode("STORED1");
    expect(
      resolveJoinCodePrefill({
        searchCode: undefined,
        locationSearch: "?jc=loc123",
      }),
    ).toBe("LOC123");
  });

  test("falls back to session storage last", () => {
    stashPendingJoinCode("store9");
    expect(
      resolveJoinCodePrefill({
        searchCode: "",
        locationSearch: "",
      }),
    ).toBe("STORE9");
  });

  test("normalizes and truncates to six characters", () => {
    expect(
      resolveJoinCodePrefill({
        searchCode: " ab-12cdzz ",
        locationSearch: null,
      }),
    ).toBe("AB12CD");
  });

  test("stash, peek, take, and clear round-trip", () => {
    stashPendingJoinCode("abc123");
    expect(peekPendingJoinCode()).toBe("ABC123");
    expect(takePendingJoinCode()).toBe("ABC123");
    expect(peekPendingJoinCode()).toBeNull();

    stashPendingJoinCode("xyz789");
    clearPendingJoinCode();
    expect(peekPendingJoinCode()).toBeNull();
  });
});
