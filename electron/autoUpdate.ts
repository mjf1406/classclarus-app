import { createRequire } from "node:module";

import { app, BrowserWindow, ipcMain } from "electron";

import { APP_UPDATE_IPC, type AppUpdateStatus } from "../shared/appUpdate.ts";

// electron-updater is CJS and exposes autoUpdater via a getter; named ESM
// imports fail at runtime under Electron's ESM loader.
const { autoUpdater } = createRequire(import.meta.url)(
  "electron-updater",
) as typeof import("electron-updater");

export type AutoUpdateController = {
  /** True after an update was downloaded and quitAndInstall was requested. */
  isQuittingForUpdate: () => boolean;
  /** True when an update is downloaded and waiting to install. */
  isUpdateReady: () => boolean;
  /** Install the downloaded update (after resources are shut down). */
  quitAndInstall: () => void;
  /** Start listening + schedule the first check (packaged only). */
  start: () => void;
};

function broadcast(status: AppUpdateStatus): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(APP_UPDATE_IPC.onStatus, status);
  }
}

/**
 * Wire electron-updater for packaged builds. No-ops in electron:dev.
 */
export function createAutoUpdater(options: {
  shutdown: () => Promise<void>;
}): AutoUpdateController {
  let quittingForUpdate = false;
  let updateReady = false;
  let status: AppUpdateStatus = {
    phase: "idle",
    currentVersion: app.getVersion(),
    availableVersion: null,
    progress: null,
    errorMessage: null,
  };

  const setStatus = (patch: Partial<AppUpdateStatus>): void => {
    status = { ...status, currentVersion: app.getVersion(), ...patch };
    broadcast(status);
  };

  const quitAndInstall = (): void => {
    quittingForUpdate = true;
    autoUpdater.quitAndInstall(false, true);
  };

  const check = async (): Promise<void> => {
    if (!app.isPackaged) {
      setStatus({
        phase: "not-available",
        availableVersion: null,
        progress: null,
        errorMessage: null,
      });
      return;
    }
    try {
      await autoUpdater.checkForUpdates();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[autoUpdate] check failed", error);
      setStatus({
        phase: "error",
        progress: null,
        errorMessage: message,
      });
    }
  };

  ipcMain.handle(APP_UPDATE_IPC.getStatus, () => status);
  ipcMain.handle(APP_UPDATE_IPC.check, () => check());
  ipcMain.handle(APP_UPDATE_IPC.quitAndInstall, async () => {
    if (!updateReady) {
      return;
    }
    await options.shutdown();
    quitAndInstall();
  });

  const start = (): void => {
    if (!app.isPackaged) {
      console.log("[autoUpdate] skipped (not packaged)");
      return;
    }

    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on("checking-for-update", () => {
      setStatus({
        phase: "checking",
        errorMessage: null,
        progress: null,
      });
    });

    autoUpdater.on("update-available", (info) => {
      updateReady = false;
      setStatus({
        phase: "available",
        availableVersion: info.version,
        errorMessage: null,
        progress: 0,
      });
    });

    autoUpdater.on("update-not-available", () => {
      updateReady = false;
      setStatus({
        phase: "not-available",
        availableVersion: null,
        progress: null,
        errorMessage: null,
      });
    });

    autoUpdater.on("download-progress", (progress) => {
      setStatus({
        phase: "downloading",
        progress: Math.round(progress.percent),
        errorMessage: null,
      });
    });

    autoUpdater.on("update-downloaded", (info) => {
      updateReady = true;
      setStatus({
        phase: "ready",
        availableVersion: info.version,
        progress: 100,
        errorMessage: null,
      });
    });

    autoUpdater.on("error", (error) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[autoUpdate] error", error);
      setStatus({
        phase: "error",
        progress: null,
        errorMessage: message,
      });
    });

    // Let the UI settle after classroom reaches running.
    setTimeout(() => {
      void check();
    }, 5_000);
  };

  return {
    isQuittingForUpdate: () => quittingForUpdate,
    isUpdateReady: () => updateReady,
    quitAndInstall,
    start,
  };
}
