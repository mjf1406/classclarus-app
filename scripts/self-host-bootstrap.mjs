/**
 * Shared self-host bootstrap for Docker deploy and Electron first-run.
 * Waits for Convex, deploys functions, sets SELF_HOSTED / SITE_URL / JWT keys.
 *
 * Usage (CLI):
 *   bun scripts/self-host-bootstrap.mjs \
 *     --convex-url http://127.0.0.1:3210 \
 *     --admin-key-file ./data/admin_key \
 *     --data-dir ./data \
 *     --site-url http://127.0.0.1:8088 \
 *     --project-dir .
 *
 * Or import { runSelfHostBootstrap } from this module.
 */
import { spawn } from "node:child_process";
import { generateKeyPairSync, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile, chmod } from "node:fs/promises";
import path from "node:path";

import { fingerprintConvexSource } from "./convexFingerprint.mjs";

/**
 * @typedef {object} BootstrapOptions
 * @property {string} convexUrl
 * @property {string} adminKeyFile
 * @property {string} dataDir
 * @property {string} siteUrl
 * @property {string} projectDir
 * @property {string} [deployMarkerFile]
 * @property {string} [authKeysFile]
 * @property {string} [appVersion] - release/label prefix; combined with convex source hash
 * @property {(cmd: string, args: string[], opts: import('node:child_process').SpawnOptions) => Promise<void>} [runCommand]
 * @property {(msg: string) => void} [log]
 */

function defaultLog(msg) {
  console.log(msg);
}

/**
 * @param {string} cmd
 * @param {string[]} args
 * @param {import('node:child_process').SpawnOptions & { input?: string }} opts
 */
function defaultRunCommand(cmd, args, opts) {
  return new Promise((resolve, reject) => {
    const stdio =
      opts.input !== undefined ? ["pipe", "inherit", "inherit"] : (opts.stdio ?? "inherit");
    // No shell:true — bunx.cmd PATH lookup fails under Electron on Windows.
    const child = spawn(cmd, args, {
      cwd: opts.cwd,
      env: opts.env,
      stdio,
      windowsHide: true,
    });
    if (opts.input !== undefined && child.stdin) {
      child.stdin.write(opts.input);
      child.stdin.end();
    }
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${cmd} ${args.join(" ")} exited with code ${code}`));
      }
    });
  });
}

export function generateAuthKeys() {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicExponent: 0x10001,
  });
  const pkcs8 = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const jwk = publicKey.export({ format: "jwk" });
  jwk.alg = "RS256";
  jwk.use = "sig";
  jwk.kid = randomUUID();
  return {
    jwtPrivateKey: pkcs8.replace(/\n/g, " "),
    jwks: JSON.stringify({ keys: [jwk] }),
  };
}

/**
 * @param {string} convexUrl
 * @param {(msg: string) => void} log
 */
async function waitForBackend(convexUrl, log) {
  log(`Waiting for Convex backend at ${convexUrl}...`);
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`${convexUrl}/version`);
      if (res.ok) {
        return;
      }
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`Backend did not become ready at ${convexUrl}`);
}

/**
 * @param {BootstrapOptions} options
 */
export async function runSelfHostBootstrap(options) {
  const log = options.log ?? defaultLog;
  const runCommand = options.runCommand ?? defaultRunCommand;
  const dataDir = options.dataDir;
  const authKeysFile = options.authKeysFile ?? path.join(dataDir, "auth_keys.json");
  const markerFile = options.deployMarkerFile ?? path.join(dataDir, ".deploy_complete");
  const appVersion = options.appVersion ?? "0";
  // Docker used to mark deploy complete with a sticky label ("docker" / "0.0.0"),
  // so rebuilt SPAs could call new functions the backend never received. Always
  // include a convex/ content hash (same idea as Electron).
  const sourceFp = await fingerprintConvexSource(options.projectDir);
  const deployKey = `${appVersion}:${sourceFp}`;

  await mkdir(dataDir, { recursive: true });

  if (!existsSync(options.adminKeyFile)) {
    throw new Error(`Missing admin key at ${options.adminKeyFile}`);
  }
  const adminKey = (await readFile(options.adminKeyFile, "utf8")).replace(/\r?\n/g, "");

  let needsDeploy = true;
  if (existsSync(markerFile)) {
    const prev = (await readFile(markerFile, "utf8")).trim();
    if (prev === deployKey) {
      needsDeploy = false;
      log(`Deploy marker matches ${deployKey}; skipping deploy.`);
    } else {
      log(`Deploy marker stale (was ${prev || "(empty)"}, want ${deployKey}); redeploying.`);
    }
  }

  await waitForBackend(options.convexUrl, log);

  // Convex CLI loads `.env.local` (cloud CONVEX_DEPLOYMENT) unless --env-file is used.
  // That flag overrides project dotenv and selects only self-hosted credentials.
  const cliEnvFile = path.join(dataDir, "convex-cli.env");
  await writeFile(
    cliEnvFile,
    [
      `CONVEX_SELF_HOSTED_URL=${options.convexUrl}`,
      `CONVEX_SELF_HOSTED_ADMIN_KEY=${adminKey}`,
      "",
    ].join("\n"),
    { mode: 0o600 },
  );

  /** @type {NodeJS.ProcessEnv} */
  const env = {
    ...process.env,
    CI: "true",
  };
  delete env.CONVEX_DEPLOYMENT;
  delete env.CONVEX_DEPLOY_KEY;
  delete env.CONVEX_DEPLOYMENT_TOKEN;
  delete env.CONVEX_URL;
  delete env.CONVEX_SELF_HOSTED_URL;
  delete env.CONVEX_SELF_HOSTED_ADMIN_KEY;

  // Prefer absolute bun from Electron (`ELECTRON_BUN_BIN`); else `bun` on PATH (Docker/dev).
  const bunBin = process.env.ELECTRON_BUN_BIN || process.env.BUN_BIN || "bun";
  const envFileArgs = ["--env-file", cliEnvFile];

  if (needsDeploy) {
    log("Deploying Convex functions...");
    await runCommand(bunBin, ["x", "convex", "deploy", "--typecheck", "try", ...envFileArgs], {
      cwd: options.projectDir,
      env,
    });
  }

  log("Setting self-host Convex env...");
  const setEnv = async (key, value) => {
    // stdin keeps long JWKS / secrets off the process command line
    await runCommand(bunBin, ["x", "convex", "env", "set", key, ...envFileArgs], {
      cwd: options.projectDir,
      env,
      input: value,
    });
  };

  await setEnv("SELF_HOSTED", "true");
  await setEnv("SITE_URL", options.siteUrl);

  if (!existsSync(authKeysFile)) {
    log("Generating auth JWT keys...");
    const keys = generateAuthKeys();
    await writeFile(authKeysFile, JSON.stringify(keys), { mode: 0o600 });
    try {
      await chmod(authKeysFile, 0o600);
    } catch {
      // Windows may ignore mode
    }
  }

  const keys = JSON.parse(await readFile(authKeysFile, "utf8"));
  await setEnv("JWT_PRIVATE_KEY", keys.jwtPrivateKey);
  await setEnv("JWKS", keys.jwks);

  await writeFile(markerFile, deployKey, "utf8");
  log(`Self-host bootstrap complete. App: ${options.siteUrl}`);
}
