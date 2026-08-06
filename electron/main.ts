import {
  app,
  BrowserWindow,
  ipcMain,
  shell,
  type BrowserWindow as BrowserWindowType,
} from "electron";
import path from "node:path";

import { createAutoUpdater } from "./autoUpdate.ts";
import { fingerprintConvexSource } from "./convexFingerprint.ts";
import { createConvexSupervisor } from "./convexSupervisor.ts";
import { detectLanIpv4 } from "./lan.ts";
import { findFreePort } from "./ports.ts";
import { deployProjectDir, isDev, rendererDistDir } from "./paths.ts";
import { listenStaticServer, type StaticEnv } from "./staticServer.ts";
import { CLASSROOM_IPC, type ClassroomSession } from "./types.ts";

const DEFAULT_WEB_PORT = 8088;
const DEFAULT_CONVEX_PORT = 3210;
const DEFAULT_SITE_PORT = 3211;

let mainWindow: BrowserWindowType | null = null;
let session: ClassroomSession = {
  status: "starting",
  lanBaseUrl: null,
  loopbackBaseUrl: `http://127.0.0.1:${DEFAULT_WEB_PORT}`,
  convexUrl: `http://127.0.0.1:${DEFAULT_CONVEX_PORT}`,
  convexSiteUrl: `http://127.0.0.1:${DEFAULT_SITE_PORT}`,
  webPort: DEFAULT_WEB_PORT,
  convexPort: DEFAULT_CONVEX_PORT,
  sitePort: DEFAULT_SITE_PORT,
  lanIp: null,
  errorMessage: null,
  trustedLanWarning: true,
};

let staticClose: (() => Promise<void>) | null = null;
let supervisor: ReturnType<typeof createConvexSupervisor> | null = null;
let currentEnv: StaticEnv = {
  VITE_CONVEX_URL: session.convexUrl,
  VITE_CONVEX_SITE_URL: session.convexSiteUrl,
  VITE_AUTH_PASSWORD_ENABLED: "true",
  VITE_SELF_HOSTED: "true",
};

function broadcastSession(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(CLASSROOM_IPC.onSession, session);
  }
}

function setSession(patch: Partial<ClassroomSession>): void {
  session = { ...session, ...patch };
  broadcastSession();
}

function buildEnv(
  lanIp: string | null,
  ports: {
    webPort: number;
    convexPort: number;
    sitePort: number;
  },
): StaticEnv {
  // Prefer LAN host in injected env so teachers opening via LAN get correct SITE_URL clients;
  // resolveConvexUrl still rewrites to window.location.hostname for students.
  const host = lanIp ?? "127.0.0.1";
  return {
    VITE_CONVEX_URL: `http://${host}:${ports.convexPort}`,
    VITE_CONVEX_SITE_URL: `http://${host}:${ports.sitePort}`,
    VITE_AUTH_PASSWORD_ENABLED: "true",
    VITE_SELF_HOSTED: "true",
  };
}

function splashPath(): string {
  return path.join(import.meta.dirname, "splash.html");
}

async function createWindow(): Promise<void> {
  if (mainWindow && !mainWindow.isDestroyed()) {
    return;
  }

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 900,
    minHeight: 600,
    show: false,
    webPreferences: {
      preload: path.join(import.meta.dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  await mainWindow.loadFile(splashPath());
}

async function navigateMainWindow(loadUrl: string): Promise<void> {
  if (!mainWindow || mainWindow.isDestroyed()) {
    await createWindow();
  }
  if (!mainWindow || mainWindow.isDestroyed()) {
    throw new Error("Main window unavailable");
  }
  await mainWindow.loadURL(loadUrl);
}

async function startClassroom(): Promise<void> {
  try {
    setSession({ status: "starting", errorMessage: null });

    // Dev: Vite already owns ELECTRON_WEB_PORT on 0.0.0.0 (see electron-dev.mjs).
    // Packaged: we pick a free port and serve the built SPA ourselves.
    const webPort = isDev()
      ? Number(process.env.ELECTRON_WEB_PORT || DEFAULT_WEB_PORT)
      : await findFreePort(DEFAULT_WEB_PORT);
    const convexPort = isDev()
      ? Number(process.env.ELECTRON_CONVEX_PORT || DEFAULT_CONVEX_PORT)
      : await findFreePort(DEFAULT_CONVEX_PORT);
    const sitePort = isDev()
      ? Number(process.env.ELECTRON_SITE_PORT || DEFAULT_SITE_PORT)
      : await findFreePort(DEFAULT_SITE_PORT);
    const lanIp = detectLanIpv4();

    currentEnv = buildEnv(lanIp, { webPort, convexPort, sitePort });
    const loopbackBaseUrl = `http://127.0.0.1:${webPort}`;
    const lanBaseUrl = lanIp ? `http://${lanIp}:${webPort}` : null;

    setSession({
      webPort,
      convexPort,
      sitePort,
      lanIp,
      loopbackBaseUrl,
      lanBaseUrl,
      convexUrl: `http://127.0.0.1:${convexPort}`,
      convexSiteUrl: `http://127.0.0.1:${sitePort}`,
    });

    supervisor = createConvexSupervisor({
      convexPort,
      sitePort,
      publicHost: lanIp ?? "127.0.0.1",
    });
    await supervisor.start();
    await supervisor.ensureAdminKey();

    setSession({ status: "deploying" });
    const siteUrlForAuth = lanBaseUrl ?? loopbackBaseUrl;
    // Fingerprint convex/ so code edits redeploy (package version alone stays 0.0.0).
    const sourceFp = await fingerprintConvexSource(deployProjectDir());
    const deployVersion = `${app.getVersion()}-${sourceFp}`;
    console.log(`[classroom] bootstrap version ${deployVersion}`);
    await supervisor.runBootstrap(siteUrlForAuth, deployVersion);

    if (isDev()) {
      // Vite is LAN-bound by electron-dev.mjs; do not advertise a port with no listener.
      const viteUrl = process.env.ELECTRON_RENDERER_URL ?? `http://127.0.0.1:${webPort}`;
      await navigateMainWindow(viteUrl);
    } else {
      const staticServer = await listenStaticServer({
        rootDir: rendererDistDir(),
        port: webPort,
        getEnv: () => currentEnv,
      });
      staticClose = () => staticServer.close();
      await navigateMainWindow(loopbackBaseUrl);
    }

    // Refresh LAN IP periodically (DHCP churn)
    setInterval(() => {
      const nextIp = detectLanIpv4();
      if (nextIp !== session.lanIp) {
        currentEnv = buildEnv(nextIp, {
          webPort: session.webPort,
          convexPort: session.convexPort,
          sitePort: session.sitePort,
        });
        setSession({
          lanIp: nextIp,
          lanBaseUrl: nextIp ? `http://${nextIp}:${session.webPort}` : null,
        });
      }
    }, 15_000);

    setSession({ status: "running" });
    appAutoUpdate.start();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[classroom] failed to start", error);
    setSession({ status: "error", errorMessage: message });
    // Keep the splash window open so the error is visible.
    if (!mainWindow || mainWindow.isDestroyed()) {
      await createWindow().catch((createError) => {
        console.error("[classroom] failed to show error splash", createError);
      });
    }
  }
}

async function shutdown(): Promise<void> {
  setSession({ status: "stopped" });
  if (staticClose) {
    await staticClose().catch(() => undefined);
    staticClose = null;
  }
  if (supervisor) {
    await supervisor.stop().catch(() => undefined);
    supervisor = null;
  }
}

const appAutoUpdate = createAutoUpdater({ shutdown });

app.whenReady().then(() => {
  ipcMain.handle(CLASSROOM_IPC.getSession, () => session);

  void createWindow()
    .then(() => startClassroom())
    .catch((error) => {
      console.error("[classroom] startup failed before splash", error);
    });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow().then(async () => {
        if (session.status === "running") {
          await navigateMainWindow(session.loopbackBaseUrl);
        }
      });
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", (event) => {
  // quitAndInstall already shut down resources; do not app.exit() or the updater cannot relaunch.
  if (appAutoUpdate.isQuittingForUpdate()) {
    return;
  }
  if (supervisor || staticClose) {
    event.preventDefault();
    void shutdown().finally(() => {
      if (appAutoUpdate.isUpdateReady()) {
        appAutoUpdate.quitAndInstall();
        return;
      }
      app.exit(0);
    });
  }
});
