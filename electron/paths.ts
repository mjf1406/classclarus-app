import { app } from "electron";
import path from "node:path";
import { existsSync } from "node:fs";

export function isDev(): boolean {
  return !app.isPackaged;
}

export function userDataRoot(): string {
  return path.join(app.getPath("userData"), "classroom");
}

export function convexDataDir(): string {
  return path.join(userDataRoot(), "convex-data");
}

export function instanceSecretPath(): string {
  return path.join(userDataRoot(), "instance_secret");
}

export function adminKeyPath(): string {
  return path.join(convexDataDir(), "admin_key");
}

export function authKeysPath(): string {
  return path.join(convexDataDir(), "auth_keys.json");
}

export function deployMarkerPath(): string {
  return path.join(convexDataDir(), ".deploy_complete");
}

/** Path to packaged or downloaded convex-local-backend binary. */
export function convexBackendBinary(): string {
  const binaryName =
    process.platform === "win32" ? "convex-local-backend.exe" : "convex-local-backend";

  if (app.isPackaged) {
    return path.join(process.resourcesPath, "convex-backend", binaryName);
  }

  const platformDir =
    process.platform === "win32" ? "win" : process.platform === "darwin" ? "mac" : "linux";
  const devPath = path.join(
    app.getAppPath(),
    "resources",
    "convex-backend",
    platformDir,
    binaryName,
  );
  if (existsSync(devPath)) {
    return devPath;
  }
  // Fallback: unzipped download at repo root (local hacking)
  const tmpPath = path.join(app.getAppPath(), "tmp-convex-backend", binaryName);
  return tmpPath;
}

/** Project root that contains convex/ for deploy (dev = repo; prod = resources). */
export function deployProjectDir(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "deploy-project");
  }
  return app.getAppPath();
}

export function rendererDistDir(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "renderer");
  }
  return path.join(app.getAppPath(), "dist");
}
