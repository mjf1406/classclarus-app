import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { app } from "electron";

import { APP_CONFIG } from "../convex/appConfig.ts";
import {
  adminKeyPath,
  authKeysPath,
  convexBackendBinary,
  convexDataDir,
  deployMarkerPath,
  deployProjectDir,
  instanceSecretPath,
  userDataRoot,
} from "./paths.ts";

const INSTANCE_NAME = `${APP_CONFIG.slug}-desktop`;
const MAX_RESTARTS = 5;

export type SupervisorPorts = {
  convexPort: number;
  sitePort: number;
  /** Hostname clients use (LAN IP or 127.0.0.1). */
  publicHost: string;
};

export type ConvexSupervisor = {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  ensureAdminKey: () => Promise<string>;
  runBootstrap: (siteUrl: string, appVersion: string) => Promise<void>;
  ports: SupervisorPorts;
};

async function ensureInstanceSecret(): Promise<string> {
  await mkdir(userDataRoot(), { recursive: true });
  const secretFile = instanceSecretPath();
  if (existsSync(secretFile)) {
    return (await readFile(secretFile, "utf8")).trim();
  }
  const secret = randomBytes(32).toString("hex");
  await writeFile(secretFile, secret, { mode: 0o600 });
  return secret;
}

async function waitForVersion(url: string, attempts = 60): Promise<void> {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(`${url}/version`);
      if (res.ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Convex backend not healthy at ${url}`);
}

function requireBinary(): string {
  const bin = convexBackendBinary();
  if (!existsSync(bin)) {
    throw new Error(
      `Missing Convex backend binary at ${bin}. Run: bun scripts/download-convex-backend.mjs`,
    );
  }
  return bin;
}

type RunCommand = (
  cmd: string,
  args: string[],
  opts: { cwd?: string; env?: NodeJS.ProcessEnv; input?: string },
) => Promise<void>;

function formatCommandFailure(label: string, code: number | null, stderr: string): Error {
  const detail = stderr.trim().slice(-2_000);
  return new Error(detail ? `${label} exit ${code}: ${detail}` : `${label} exit ${code}`);
}

function createRunCommand(projectDir: string): RunCommand {
  return (cmd, args, opts) => {
    if (app.isPackaged) {
      const convexCli = path.join(projectDir, "node_modules", "convex", "bin", "main.js");
      if (!existsSync(convexCli)) {
        return Promise.reject(
          new Error(
            `Missing Convex CLI at ${convexCli}. The packaged deploy-project is incomplete; rebuild with bun run electron:dist.`,
          ),
        );
      }
      // Dev bootstrap passes ["x", "convex", ...]; packaged skips bun and hits the CLI.
      const convexIdx = args.indexOf("convex");
      const cliArgs = convexIdx >= 0 ? args.slice(convexIdx + 1) : args;
      return new Promise<void>((resolve, reject) => {
        const childProc = spawn(process.execPath, [convexCli, ...cliArgs], {
          cwd: opts.cwd,
          env: { ...opts.env, ELECTRON_RUN_AS_NODE: "1" },
          stdio: ["pipe", "pipe", "pipe"],
          windowsHide: true,
        });
        let stderr = "";
        childProc.stderr?.on("data", (buf: Buffer) => {
          const text = buf.toString();
          stderr += text;
          console.error(`[convex-cli] ${text.trimEnd()}`);
        });
        childProc.stdout?.on("data", (buf: Buffer) => {
          console.log(`[convex-cli] ${buf.toString().trimEnd()}`);
        });
        if (opts.input !== undefined && childProc.stdin) {
          childProc.stdin.write(opts.input);
          childProc.stdin.end();
        }
        childProc.on("exit", (code) =>
          code === 0 ? resolve() : reject(formatCommandFailure("convex", code, stderr)),
        );
        childProc.on("error", reject);
      });
    }

    const bunBin = process.env.ELECTRON_BUN_BIN || cmd || "bun";
    return new Promise<void>((resolve, reject) => {
      const childProc =
        opts.input !== undefined
          ? spawn(bunBin, args, {
              cwd: opts.cwd,
              env: opts.env,
              stdio: ["pipe", "inherit", "inherit"],
              windowsHide: true,
            })
          : spawn(bunBin, args, {
              cwd: opts.cwd,
              env: opts.env,
              stdio: "inherit",
              windowsHide: true,
            });
      if (opts.input !== undefined && childProc.stdin) {
        childProc.stdin.write(opts.input);
        childProc.stdin.end();
      }
      childProc.on("exit", (code: number | null) =>
        code === 0 ? resolve() : reject(new Error(`${bunBin} ${args.join(" ")} exit ${code}`)),
      );
      childProc.on("error", reject);
    });
  };
}

export function createConvexSupervisor(ports: SupervisorPorts): ConvexSupervisor {
  let child: ChildProcess | null = null;
  let stopping = false;
  let restarts = 0;
  let instanceSecret = "";

  const spawnBackend = async () => {
    await mkdir(convexDataDir(), { recursive: true });
    instanceSecret = await ensureInstanceSecret();
    const bin = requireBinary();
    const dbPath = path.join(convexDataDir(), "convex_local_backend.sqlite3");
    const storagePath = path.join(convexDataDir(), "convex_local_storage");

    child = spawn(
      bin,
      [
        "--instance-name",
        INSTANCE_NAME,
        "--instance-secret",
        instanceSecret,
        "--port",
        String(ports.convexPort),
        "--site-proxy-port",
        String(ports.sitePort),
        "--interface",
        "0.0.0.0",
        "--convex-origin",
        `http://${ports.publicHost}:${ports.convexPort}`,
        "--convex-site",
        `http://${ports.publicHost}:${ports.sitePort}`,
        "--local-storage",
        storagePath,
        "--disable-beacon",
        dbPath,
      ],
      {
        cwd: convexDataDir(),
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      },
    );

    child.stdout?.on("data", (buf: Buffer) => {
      console.log(`[convex] ${buf.toString().trimEnd()}`);
    });
    child.stderr?.on("data", (buf: Buffer) => {
      console.error(`[convex] ${buf.toString().trimEnd()}`);
    });

    child.on("exit", (code, signal) => {
      console.error(`[convex] exited code=${code} signal=${signal}`);
      child = null;
      if (!stopping && restarts < MAX_RESTARTS) {
        restarts += 1;
        console.log(`[convex] restarting (${restarts}/${MAX_RESTARTS})...`);
        void spawnBackend().then(() => waitForVersion(`http://127.0.0.1:${ports.convexPort}`));
      }
    });

    await waitForVersion(`http://127.0.0.1:${ports.convexPort}`);
    restarts = 0;
  };

  const ensureAdminKey = async (): Promise<string> => {
    const keyFile = adminKeyPath();
    if (existsSync(keyFile)) {
      return (await readFile(keyFile, "utf8")).trim();
    }
    instanceSecret = await ensureInstanceSecret();
    const bin = requireBinary();
    const key = await new Promise<string>((resolve, reject) => {
      const gen = spawn(
        bin,
        [
          "keygen",
          "admin-key",
          "--instance-name",
          INSTANCE_NAME,
          "--instance-secret",
          instanceSecret,
        ],
        { stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
      );
      let out = "";
      let err = "";
      gen.stdout?.on("data", (b: Buffer) => {
        out += b.toString();
      });
      gen.stderr?.on("data", (b: Buffer) => {
        err += b.toString();
      });
      gen.on("exit", (code) => {
        const line = out
          .split(/\r?\n/)
          .map((s) => s.trim())
          .find((s) => s.includes("|"));
        if (code === 0 && line) resolve(line);
        else reject(new Error(`keygen failed: ${err || out || String(code)}`));
      });
    });
    await mkdir(convexDataDir(), { recursive: true });
    await writeFile(keyFile, key, { mode: 0o600 });
    return key;
  };

  return {
    ports,
    start: async () => {
      stopping = false;
      if (child) return;
      await spawnBackend();
    },
    stop: async () => {
      stopping = true;
      if (!child) return;
      const proc = child;
      child = null;
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          if (!proc.killed) proc.kill("SIGKILL");
          resolve();
        }, 5000);
        proc.once("exit", () => {
          clearTimeout(timer);
          resolve();
        });
        proc.kill("SIGTERM");
      });
    },
    ensureAdminKey,
    runBootstrap: async (siteUrl, appVersion) => {
      await mkdir(convexDataDir(), { recursive: true });
      await ensureAdminKey();
      const projectDir = deployProjectDir();
      const bootstrapFile = app.isPackaged
        ? path.join(projectDir, "scripts", "self-host-bootstrap.mjs")
        : path.join(app.getAppPath(), "scripts", "self-host-bootstrap.mjs");
      const { runSelfHostBootstrap } = await import(pathToFileURL(bootstrapFile).href);
      await runSelfHostBootstrap({
        convexUrl: `http://127.0.0.1:${ports.convexPort}`,
        adminKeyFile: adminKeyPath(),
        dataDir: convexDataDir(),
        siteUrl,
        projectDir,
        deployMarkerFile: deployMarkerPath(),
        authKeysFile: authKeysPath(),
        appVersion,
        runCommand: createRunCommand(projectDir),
        log: (msg: string) => console.log(`[bootstrap] ${msg}`),
      });
    },
  };
}
