import { describe, expect, test } from "vite-plus/test";

import { APP_CONFIG } from "@/config/app";

import { DESKTOP_DOWNLOADS } from "./desktopDownloads";

describe("DESKTOP_DOWNLOADS", () => {
  const base = `${APP_CONFIG.github}/releases/latest/download`;
  const name = APP_CONFIG.name;

  test("builds latest-release asset URLs from APP_CONFIG", () => {
    expect(DESKTOP_DOWNLOADS.windows).toBe(`${base}/${name}-Setup-Windows.exe`);
    expect(DESKTOP_DOWNLOADS.mac).toBe(`${base}/${name}-macOS.dmg`);
    expect(DESKTOP_DOWNLOADS.ubuntu).toBe(`${base}/${name}-Linux.AppImage`);
  });
});
