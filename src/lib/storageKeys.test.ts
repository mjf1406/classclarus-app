import { describe, expect, test } from "vite-plus/test";

import { APP_CONFIG } from "@/config/app";

import { STORAGE_KEYS, appStorageKey } from "./storageKeys";

describe("storageKeys", () => {
  test("appStorageKey prefixes with APP_CONFIG.slug", () => {
    expect(appStorageKey("example")).toBe(`${APP_CONFIG.slug}-example`);
  });

  test("STORAGE_KEYS are all scoped to the product slug", () => {
    const prefix = `${APP_CONFIG.slug}-`;
    for (const key of Object.values(STORAGE_KEYS)) {
      expect(key.startsWith(prefix)).toBe(true);
    }
  });

  test("known suffixes match the clone contract", () => {
    expect(STORAGE_KEYS.language).toBe(`${APP_CONFIG.slug}-language`);
    expect(STORAGE_KEYS.theme).toBe(`${APP_CONFIG.slug}-ui-theme`);
    expect(STORAGE_KEYS.pendingJoinCode).toBe(`${APP_CONFIG.slug}-pendingJoinCode`);
    expect(STORAGE_KEYS.trialBannerDismissed).toBe(`${APP_CONFIG.slug}-trial-banner-dismissed`);
    expect(STORAGE_KEYS.selfHostUpdateDismissed).toBe(
      `${APP_CONFIG.slug}-self-host-update-dismissed`,
    );
    expect(STORAGE_KEYS.selfHostUpdateRemindLater).toBe(
      `${APP_CONFIG.slug}-self-host-update-remind-later`,
    );
  });
});
