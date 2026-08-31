import { describe, expect, test } from "vite-plus/test";

import { MAX_LEDGER_LIMIT, normalizeLedgerLimit } from "./pointsLedger";

describe("normalizeLedgerLimit", () => {
  test("defaults to 40 and clamps to 1–100", () => {
    expect(normalizeLedgerLimit(undefined)).toBe(40);
    expect(normalizeLedgerLimit(0)).toBe(1);
    expect(normalizeLedgerLimit(-3)).toBe(1);
    expect(normalizeLedgerLimit(40.9)).toBe(40);
    expect(normalizeLedgerLimit(MAX_LEDGER_LIMIT + 20)).toBe(MAX_LEDGER_LIMIT);
  });
});
