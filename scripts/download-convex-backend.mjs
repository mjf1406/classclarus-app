/**
 * Download platform convex-local-backend into resources/convex-backend/<platform>/.
 *
 * Usage:
 *   bun scripts/download-convex-backend.mjs [--platform win|mac|linux|darwin] [--arch x64|arm64]
 */
import { mkdir, writeFile, chmod } from "node:fs/promises";
import path from "node:path";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { spawn } from "node:child_process";

const RELEASE_API = "https://api.github.com/repos/get-convex/convex-backend/releases/latest";

function parseArgs(argv) {
  /** @type {Record<string, string>} */
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      out[arg.slice(2)] = argv[++i];
    }
  }
  return out;
}

function detectPlatform() {
  if (process.platform === "win32") return "win";
  if (process.platform === "darwin") return "mac";
  return "linux";
}

function detectArch() {
  if (process.arch === "arm64") return "arm64";
  return "x64";
}

/** @param {string} platform @param {string} arch */
function assetName(platform, arch) {
  if (platform === "win") {
    return "convex-local-backend-x86_64-pc-windows-msvc.zip";
  }
  if (platform === "mac" || platform === "darwin") {
    if (arch === "arm64") return "convex-local-backend-aarch64-apple-darwin.zip";
    // Precompiled Intel macOS builds are not published; use arm64 (Apple Silicon).
    throw new Error(
      "macOS x64 Convex backend is not available from GitHub releases; use --arch arm64",
    );
  }
  if (arch === "arm64") return "convex-local-backend-aarch64-unknown-linux-gnu.zip";
  return "convex-local-backend-x86_64-unknown-linux-gnu.zip";
}

/** @param {string} platform */
function outDirFor(platform) {
  const p = platform === "darwin" ? "mac" : platform;
  return path.join("resources", "convex-backend", p);
}

/**
 * @param {string} zipPath
 * @param {string} destDir
 */
async function unzip(zipPath, destDir) {
  await mkdir(destDir, { recursive: true });
  if (process.platform === "win32") {
    await new Promise((resolve, reject) => {
      const ps = spawn(
        "powershell",
        [
          "-NoProfile",
          "-Command",
          `Expand-Archive -Path '${zipPath.replace(/'/g, "''")}' -DestinationPath '${destDir.replace(/'/g, "''")}' -Force`,
        ],
        { stdio: "inherit" },
      );
      ps.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`unzip exit ${code}`))));
      ps.on("error", reject);
    });
    return;
  }
  await new Promise((resolve, reject) => {
    const child = spawn("unzip", ["-o", zipPath, "-d", destDir], { stdio: "inherit" });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`unzip exit ${code}`))));
    child.on("error", reject);
  });
}

const args = parseArgs(process.argv.slice(2));
const platform = args.platform ?? detectPlatform();
const arch = args.arch ?? detectArch();
const name = assetName(platform, arch);
const destDir = outDirFor(platform);

/** @type {Record<string, string>} */
const ghHeaders = { "User-Agent": "vctr-electron-download" };
if (process.env.GITHUB_TOKEN) {
  ghHeaders.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
}

console.log(`Fetching release metadata...`);
const releaseRes = await fetch(RELEASE_API, {
  headers: ghHeaders,
});
if (!releaseRes.ok) {
  throw new Error(`GitHub API ${releaseRes.status}`);
}
const release = await releaseRes.json();
const asset = (release.assets ?? []).find((a) => a.name === name);
if (!asset) {
  throw new Error(
    `Asset ${name} not found in ${release.tag_name}. Available: ${(release.assets ?? []).map((a) => a.name).join(", ")}`,
  );
}

await mkdir(destDir, { recursive: true });
const zipPath = path.join(destDir, name);
console.log(`Downloading ${asset.browser_download_url}...`);
const binRes = await fetch(asset.browser_download_url, {
  headers: ghHeaders,
  redirect: "follow",
});
if (!binRes.ok || !binRes.body) {
  throw new Error(`Download failed: ${binRes.status}`);
}
await pipeline(Readable.fromWeb(binRes.body), createWriteStream(zipPath));

console.log(`Extracting to ${destDir}...`);
await unzip(zipPath, destDir);

const binaryName = platform === "win" ? "convex-local-backend.exe" : "convex-local-backend";
const binaryPath = path.join(destDir, binaryName);
if (platform !== "win") {
  await chmod(binaryPath, 0o755);
}

await writeFile(path.join(destDir, "VERSION.txt"), `${release.tag_name}\n${name}\n`, "utf8");

console.log(`Ready: ${binaryPath}`);
