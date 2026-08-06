import { describe, expect, test } from "vite-plus/test";

import { emptyUsageStatsSummary } from "../../../convex/lib/usageTracking";
import { bumpDesktopDownload, bumpSelfHostClick } from "./usageStatsOptimistic";

describe("usageStatsOptimistic", () => {
  test("does not bump when tracking disabled", () => {
    const base = emptyUsageStatsSummary();
    expect(bumpDesktopDownload(base, "windows")).toBe(base);
    expect(bumpSelfHostClick(base)).toBe(base);
  });

  test("bumps download periods, OS, and download chip", () => {
    const base = emptyUsageStatsSummary();
    base.enabled = true;
    const next = bumpDesktopDownload(base, "mac");
    expect(next.downloads.today).toBe(1);
    expect(next.downloads.allTime).toBe(1);
    expect(next.downloadsByOs.today.mac).toBe(1);
    expect(next.downloadsByOs.today.windows).toBe(0);
    expect(next.downloadChip).toEqual({ count: 1, period: "today" });
  });

  test("bumps self-host clicks and self-host chip", () => {
    const base = emptyUsageStatsSummary();
    base.enabled = true;
    const next = bumpSelfHostClick(base);
    expect(next.selfHostClicks.week).toBe(1);
    expect(next.selfHostChip).toEqual({ count: 1, period: "today" });
  });
});
