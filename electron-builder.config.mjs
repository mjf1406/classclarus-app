/**
 * Electron Builder config — productName / appId / artifacts derived from APP_CONFIG.
 * Loaded via Node by electron-builder; bun evaluates convex/appConfig.ts.
 */
import { execFileSync } from "node:child_process";
import { cp, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

function loadAppConfig() {
  const out = execFileSync(
    process.execPath.includes("bun") ? process.execPath : "bun",
    [
      "-e",
      'import { APP_CONFIG } from "./convex/appConfig.ts"; process.stdout.write(JSON.stringify(APP_CONFIG))',
    ],
    { encoding: "utf8", cwd: root },
  );
  return JSON.parse(out);
}

const APP_CONFIG = loadAppConfig();
const productName = APP_CONFIG.name;
const slug = APP_CONFIG.slug;

function parseGithubRepo(url) {
  const match = String(url).match(/github\.com\/([^/]+)\/([^/#]+)/i);
  if (!match) {
    throw new Error(`APP_CONFIG.github is not a GitHub URL: ${url}`);
  }
  return { owner: match[1], repo: match[2].replace(/\.git$/i, "") };
}

const { owner: githubOwner, repo: githubRepo } = parseGithubRepo(APP_CONFIG.github);

/** @type {import('electron-builder').Configuration} */
const config = {
  appId: `com.${slug}.app`,
  productName,
  copyright: `Copyright © ${productName}`,
  directories: {
    output: "release",
    buildResources: "build",
  },
  files: ["dist-electron/**/*", "package.json"],
  extraResources: [
    {
      from: "resources/convex-backend-bundle",
      to: "convex-backend",
      filter: ["**/*"],
    },
    {
      from: "dist",
      to: "renderer",
      filter: ["**/*"],
    },
  ],
  /**
   * Copy deploy-project (including node_modules) after pack.
   * electron-builder's FileSet filters drop nested node_modules / honor ignore files,
   * which left the Convex CLI missing at runtime ("convex exit 1").
   */
  afterPack: async (context) => {
    const src = path.join(context.packager.projectDir, "resources", "deploy-project");
    const resourcesDir = context.packager.getResourcesDir(context.appOutDir);
    const dest = path.join(resourcesDir, "deploy-project");
    await rm(dest, { recursive: true, force: true });
    await cp(src, dest, { recursive: true });
    console.log(`afterPack: copied deploy-project → ${dest}`);
  },
  asar: true,
  asarUnpack: ["**/*.node"],
  win: {
    target: [
      {
        target: "nsis",
        arch: ["x64"],
      },
    ],
    // ${productName} / ${ext} are electron-builder macros (not JS interpolation).
    artifactName: "${productName}-Setup-Windows.${ext}",
  },
  mac: {
    // zip is required for electron-updater (latest-mac.yml / Squirrel.Mac).
    target: [
      {
        target: "dmg",
        arch: ["arm64"],
      },
      {
        target: "zip",
        arch: ["arm64"],
      },
    ],
    artifactName: "${productName}-macOS.${ext}",
    category: "public.app-category.education",
    // Unsigned by default; add CSC_* secrets in CI for Gatekeeper-friendly builds.
    // macOS auto-update requires code signing.
    identity: null,
  },
  linux: {
    target: ["AppImage"],
    artifactName: "${productName}-Linux.${ext}",
    category: "Education",
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    deleteAppDataOnUninstall: true,
  },
  publish: {
    provider: "github",
    owner: githubOwner,
    repo: githubRepo,
    releaseType: "release",
  },
};

export default config;
