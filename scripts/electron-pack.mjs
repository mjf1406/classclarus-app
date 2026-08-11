/**
 * Full Electron package: deploy-project + self-host renderer + main + electron-builder.
 *
 * Flags:
 *   --dir       unpackaged dir output only
 *   --publish   publish to GitHub Releases (needs GH_TOKEN)
 *
 * Env (CI matrix):
 *   ELECTRON_PLATFORM=win|mac|linux
 *   ELECTRON_ARCH=x64|arm64
 */
import { $ } from "bun";
import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";

const dirOnly = process.argv.includes("--dir");
const publish = process.argv.includes("--publish");

const platform =
  process.env.ELECTRON_PLATFORM ??
  (process.platform === "win32" ? "win" : process.platform === "darwin" ? "mac" : "linux");
const arch = process.env.ELECTRON_ARCH ?? (process.arch === "arm64" ? "arm64" : "x64");

await $`bun scripts/download-convex-backend.mjs --platform ${platform} --arch ${arch}`;
await $`bun scripts/prepare-electron-deploy-project.mjs`;

const platformDir = platform === "darwin" ? "mac" : platform;
const bundleDir = path.join("resources", "convex-backend-bundle");
await rm(bundleDir, { recursive: true, force: true });
await mkdir(bundleDir, { recursive: true });
await cp(path.join("resources", "convex-backend", platformDir), bundleDir, {
  recursive: true,
});

process.env.VITE_SELF_HOSTED = "true";
process.env.VITE_AUTH_PASSWORD_ENABLED = "true";
process.env.VITE_CLASS_PRESENCE_ENABLED = "true";
process.env.CLASS_PRESENCE_ENABLED = "true";
process.env.VITE_CONVEX_URL = "http://127.0.0.1:3210";
process.env.VITE_CONVEX_SITE_URL = "http://127.0.0.1:3211";
process.env.DISABLE_REACT_COMPILER = "true";

// Match Docker web-build: skip `tsc -b` (Convex/app project refs fail typecheck in CI).
// Renderer bundle only — Electron main/preload built next.
await $`bunx vp build`;
await $`bun scripts/build-electron.mjs`;
await $`bun scripts/prepare-electron-icons.mjs`;

const builderPlatform =
  platform === "win" || platform === "win32"
    ? "win"
    : platform === "mac" || platform === "darwin"
      ? "mac"
      : "linux";
const builderArch = arch === "arm64" ? "arm64" : "x64";

const builderArgs = [
  "electron-builder",
  "--config",
  "electron-builder.config.mjs",
  `--${builderPlatform}`,
  `--${builderArch}`,
];
if (dirOnly) builderArgs.push("--dir");
if (publish) builderArgs.push("--publish", "always");
else builderArgs.push("--publish", "never");

await $`bunx ${builderArgs}`;
