/**
 * Dev: Vite (LAN-reachable) + Electron (local Convex backend via Electron main).
 * Requires: bun scripts/download-convex-backend.mjs
 *
 * Vite binds 0.0.0.0:8088 so phones / projection browsers on the same Wi‑Fi
 * can open the classroom URL (join QR / join-display).
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const WEB_PORT = process.env.ELECTRON_WEB_PORT || "8088";
const CONVEX_PORT = process.env.ELECTRON_CONVEX_PORT || "3210";
const SITE_PORT = process.env.ELECTRON_SITE_PORT || "3211";

const platformDir =
  process.platform === "win32" ? "win" : process.platform === "darwin" ? "mac" : "linux";
const binaryName =
  process.platform === "win32" ? "convex-local-backend.exe" : "convex-local-backend";
const backendPath = path.join("resources", "convex-backend", platformDir, binaryName);
const tmpBackend = path.join("tmp-convex-backend", binaryName);

if (!existsSync(backendPath) && !existsSync(tmpBackend)) {
  console.error(`Missing ${backendPath}. Run: bun scripts/download-convex-backend.mjs`);
  process.exit(1);
}

await import("./build-electron.mjs");

// When this script is run via `bun`, execPath is the bun binary (needed under Electron).
const bunBin = process.execPath;

const viteEnv = {
  ...process.env,
  VITE_SELF_HOSTED: "true",
  VITE_AUTH_PASSWORD_ENABLED: "true",
  VITE_CLASS_PRESENCE_ENABLED: "true",
  CLASS_PRESENCE_ENABLED: "true",
  VITE_CONVEX_URL: `http://127.0.0.1:${CONVEX_PORT}`,
  VITE_CONVEX_SITE_URL: `http://127.0.0.1:${SITE_PORT}`,
};

// Bind all interfaces so LAN clients can reach the SPA (not just 127.0.0.1).
const vite = spawn(bunBin, ["x", "vp", "dev", "--host", "0.0.0.0", "--port", WEB_PORT], {
  env: viteEnv,
  stdio: "inherit",
});

async function waitForVite() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${WEB_PORT}`);
      if (res.ok || res.status === 404) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Vite did not start on port ${WEB_PORT}`);
}

await waitForVite();

const electron = spawn(bunBin, ["x", "electron", "."], {
  env: {
    ...process.env,
    ELECTRON_RENDERER_URL: `http://127.0.0.1:${WEB_PORT}`,
    ELECTRON_WEB_PORT: WEB_PORT,
    ELECTRON_CONVEX_PORT: CONVEX_PORT,
    ELECTRON_SITE_PORT: SITE_PORT,
    ELECTRON_BUN_BIN: bunBin,
  },
  stdio: "inherit",
});

const shutdown = () => {
  electron.kill();
  vite.kill();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

electron.on("exit", () => {
  vite.kill();
  process.exit(0);
});
