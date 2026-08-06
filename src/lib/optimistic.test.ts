import { describe, expect, test } from "vite-plus/test";

import {
  patchDoc,
  polyfillCryptoRandomUUID,
  randomClientId,
  removeById,
  upsertById,
} from "./optimistic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("randomClientId", () => {
  test("returns a uuid-shaped string", () => {
    expect(randomClientId()).toMatch(UUID_RE);
  });
});

describe("polyfillCryptoRandomUUID", () => {
  test("installs randomUUID when missing", () => {
    const original = crypto.randomUUID;
    // Simulate non-secure LAN origin (method absent).
    Object.defineProperty(crypto, "randomUUID", {
      value: undefined,
      configurable: true,
      writable: true,
    });

    polyfillCryptoRandomUUID();
    expect(typeof crypto.randomUUID).toBe("function");
    expect(crypto.randomUUID()).toMatch(UUID_RE);

    Object.defineProperty(crypto, "randomUUID", {
      value: original,
      configurable: true,
      writable: true,
    });
  });
});

describe("patchDoc", () => {
  test("returns null when doc is null", () => {
    expect(patchDoc(null, (doc: { name: string }) => ({ ...doc, name: "x" }))).toBeNull();
  });

  test("applies patch to existing doc", () => {
    expect(patchDoc({ name: "a", year: 1 }, (doc) => ({ ...doc, name: "b" }))).toEqual({
      name: "b",
      year: 1,
    });
  });
});

describe("upsertById", () => {
  test("appends when id is missing", () => {
    expect(upsertById([{ _id: "a", name: "A" }], { _id: "b", name: "B" })).toEqual([
      { _id: "a", name: "A" },
      { _id: "b", name: "B" },
    ]);
  });

  test("replaces existing id in place", () => {
    expect(
      upsertById(
        [
          { _id: "a", name: "A" },
          { _id: "b", name: "B" },
        ],
        { _id: "a", name: "A2" },
      ),
    ).toEqual([
      { _id: "a", name: "A2" },
      { _id: "b", name: "B" },
    ]);
  });

  test("treats null/undefined list as empty", () => {
    expect(upsertById(null, { _id: "a", name: "A" })).toEqual([{ _id: "a", name: "A" }]);
    expect(upsertById(undefined, { _id: "a", name: "A" })).toEqual([{ _id: "a", name: "A" }]);
  });
});

describe("removeById", () => {
  test("filters matching id", () => {
    expect(
      removeById(
        [
          { _id: "a", name: "A" },
          { _id: "b", name: "B" },
        ],
        "a",
      ),
    ).toEqual([{ _id: "b", name: "B" }]);
  });

  test("returns empty array for null/undefined list", () => {
    expect(removeById(null, "a")).toEqual([]);
    expect(removeById(undefined, "a")).toEqual([]);
  });
});
