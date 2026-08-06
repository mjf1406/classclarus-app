#!/usr/bin/env bun
/**
 * Post-clone identity setup for the vctr template.
 *
 * Prompts for product identity, rewrites template brand fields, writes
 * .env.example, optionally runs `vp install`, and checks off matching items
 * in CLONE_CHECKLIST.md.
 *
 * Usage:
 *   bun run post-clone
 *   bun scripts/post-clone.mjs --dry-run
 *   bun scripts/post-clone.mjs --name MyApp --slug my-app --github https://github.com/org/repo --no-install
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const CHECKLIST_PATH = path.join(ROOT, "CLONE_CHECKLIST.md");
const APP_CONFIG_PATH = path.join(ROOT, "convex", "appConfig.ts");
const PACKAGE_JSON_PATH = path.join(ROOT, "package.json");
const INDEX_HTML_PATH = path.join(ROOT, "index.html");
const DOCKER_COMPOSE_PATH = path.join(ROOT, "docker-compose.yml");
const EXAMPLE_ENV_PATH = path.join(ROOT, "example.env");
const SELF_HOSTING_PATH = path.join(ROOT, "docs", "SELF_HOSTING.md");
const ENV_EXAMPLE_PATH = path.join(ROOT, ".env.example");
const ENV_LOCAL_PATH = path.join(ROOT, ".env.local");
const I18N_DIR = path.join(ROOT, "src", "i18n", "resources");

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const TEMPLATE_SLUGS = new Set(["vctr", "classclarus"]);

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
  /** @type {Record<string, string | boolean>} */
  const out = { dryRun: false, yes: false, install: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") out.dryRun = true;
    else if (arg === "--yes" || arg === "-y") out.yes = true;
    else if (arg === "--no-install") out.install = false;
    else if (arg === "--install") out.install = true;
    else if (arg === "--keep-classroom") out.keepClassroom = true;
    else if (arg.startsWith("--") && argv[i + 1] && !argv[i + 1].startsWith("--")) {
      out[arg.slice(2)] = argv[++i];
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const dryRun = Boolean(args.dryRun);
const nonInteractive = typeof args.name === "string" && typeof args.github === "string";

/** @type {Array<{ path: string, note: string }>} */
const plannedWrites = [];

/**
 * @param {string} question
 * @param {string} [defaultValue]
 */
async function prompt(question, defaultValue = "") {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const suffix = defaultValue ? ` [${defaultValue}]` : "";
  const answer = await new Promise((resolve) => {
    rl.question(`${question}${suffix}: `, resolve);
  });
  rl.close();
  const trimmed = answer.trim();
  return trimmed || defaultValue;
}

/**
 * @param {string} question
 * @param {boolean} defaultYes
 */
async function promptYesNo(question, defaultYes = true) {
  const hint = defaultYes ? "Y/n" : "y/N";
  const answer = (await prompt(`${question} (${hint})`, "")).toLowerCase();
  if (!answer) return defaultYes;
  return answer === "y" || answer === "yes";
}

/**
 * @param {string} name
 */
function slugify(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

/**
 * @param {string} filePath
 * @param {string} contents
 * @param {string} note
 */
async function writeText(filePath, contents, note) {
  plannedWrites.push({ path: path.relative(ROOT, filePath), note });
  if (dryRun) return;
  await writeFile(filePath, contents, "utf8");
}

/**
 * @param {string} filePath
 * @param {(src: string) => string} transform
 * @param {string} note
 */
async function transformFile(filePath, transform, note) {
  const before = await readFile(filePath, "utf8");
  const after = transform(before);
  if (after === before) {
    console.warn(`  (no change) ${path.relative(ROOT, filePath)}`);
    return false;
  }
  await writeText(filePath, after, note);
  return true;
}

/**
 * @param {string} src
 * @param {string} key
 * @param {string} value
 */
function replaceStringProp(src, key, value) {
  const re = new RegExp(`(${key}:\\s*)"[^"]*"`, "m");
  if (!re.test(src)) {
    throw new Error(`Could not find string property "${key}" in appConfig`);
  }
  return src.replace(re, `$1${JSON.stringify(value)}`);
}

/**
 * @param {object} identity
 * @param {string} identity.name
 * @param {string} identity.slug
 * @param {string} identity.authzTenantId
 * @param {string} identity.titleSuffix
 * @param {string} identity.appUrl
 * @param {string} identity.marketingUrl
 * @param {string} identity.privacyUrl
 * @param {string} identity.termsUrl
 * @param {string} identity.cookieUrl
 * @param {string} identity.changeLog
 * @param {string} identity.roadMap
 * @param {string} identity.github
 * @param {string} identity.downloadUrl
 * @param {string} identity.selfHostUrl
 * @param {string} identity.kofiUrl
 * @param {string} identity.patreonUrl
 */
async function rewriteAppConfig(identity) {
  await transformFile(
    APP_CONFIG_PATH,
    (src) => {
      let next = src;
      const stringFields = [
        ["name", identity.name],
        ["slug", identity.slug],
        ["titleSuffix", identity.titleSuffix],
        ["appUrl", identity.appUrl],
        ["marketingUrl", identity.marketingUrl],
        ["privacyUrl", identity.privacyUrl],
        ["termsUrl", identity.termsUrl],
        ["cookieUrl", identity.cookieUrl],
        ["changeLog", identity.changeLog],
        ["roadMap", identity.roadMap],
        ["github", identity.github],
        ["downloadUrl", identity.downloadUrl],
        ["selfHostUrl", identity.selfHostUrl],
        ["kofiUrl", identity.kofiUrl],
        ["patreonUrl", identity.patreonUrl],
        ["authzTenantId", identity.authzTenantId],
      ];
      for (const [key, value] of stringFields) {
        next = replaceStringProp(next, key, value);
      }
      return next;
    },
    "APP_CONFIG identity fields",
  );
}

/**
 * @param {object} identity
 * @param {string} identity.name
 * @param {string} identity.github
 * @param {string} identity.slug
 */
async function rewritePackageJson(identity) {
  const raw = await readFile(PACKAGE_JSON_PATH, "utf8");
  const pkg = JSON.parse(raw);
  pkg.name = identity.slug;
  pkg.description = `${identity.name} — Vite+ / React / Convex app`;
  pkg.author = identity.name;
  pkg.repository = {
    type: "git",
    url: identity.github.endsWith(".git") ? identity.github : `${identity.github}.git`,
  };
  const next = `${JSON.stringify(pkg, null, 2)}\n`;
  await writeText(PACKAGE_JSON_PATH, next, "package.json name/description/author/repository");
}

/**
 * @param {string} name
 */
async function rewriteIndexHtml(name) {
  await transformFile(
    INDEX_HTML_PATH,
    (src) => src.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(name)}</title>`),
    "index.html title",
  );
}

/**
 * @param {string} text
 */
function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/**
 * @param {string} slug
 */
async function rewriteDockerCompose(slug) {
  await transformFile(
    DOCKER_COMPOSE_PATH,
    (src) =>
      src
        .replace(/^name:\s*.+$/m, `name: ${slug}`)
        .replace(
          /INSTANCE_NAME:\s*"\$\{INSTANCE_NAME:-[^}]+\}"/,
          `INSTANCE_NAME: "\${INSTANCE_NAME:-${slug}}"`,
        ),
    "docker-compose.yml name / INSTANCE_NAME default",
  );
}

/**
 * @param {string} slug
 */
async function rewriteExampleEnv(slug) {
  await transformFile(
    EXAMPLE_ENV_PATH,
    (src) => src.replace(/^INSTANCE_NAME=.*$/m, `INSTANCE_NAME=${slug}`),
    "example.env INSTANCE_NAME",
  );
}

/**
 * @param {string} githubUrl
 * @param {string} slug
 */
async function rewriteSelfHostingDocs(githubUrl, slug) {
  const repoHttps = githubUrl.replace(/\.git$/, "");
  await transformFile(
    SELF_HOSTING_PATH,
    (src) =>
      src
        .replaceAll("https://github.com/mjf1406/vctr", repoHttps)
        .replaceAll("classclarus-backend-1", `${slug}-backend-1`)
        .replaceAll("-p classclarus", `-p ${slug}`)
        .replaceAll("`classclarus`", `\`${slug}\``),
    "docs/SELF_HOSTING.md repo + Portainer examples",
  );
}

/**
 * @param {string} tagline
 */
async function rewriteFooterTaglines(tagline) {
  const files = (await readdir(I18N_DIR)).filter((f) => f.endsWith(".ts"));
  for (const file of files) {
    const filePath = path.join(I18N_DIR, file);
    await transformFile(
      filePath,
      (src) => {
        if (!/footerTagline:\s*"/.test(src)) return src;
        return src.replace(
          /footerTagline:\s*"(?:\\.|[^"\\])*"/,
          `footerTagline: ${JSON.stringify(tagline)}`,
        );
      },
      `${file} footerTagline`,
    );
  }
}

async function writeEnvExample() {
  const contents = `# Vite / local client env (copied ideas only — do not commit real secrets)
# After \`bunx convex dev\`, real values live in \`.env.local\` (gitignored).

# Written by Convex CLI:
# CONVEX_DEPLOYMENT=dev:your-deployment
# VITE_CONVEX_URL=https://….convex.cloud
# VITE_CONVEX_SITE_URL=https://….convex.site

# Optional: show password sign-in UI in cloud/dev (self-host enables this automatically)
# VITE_AUTH_PASSWORD_ENABLED=true

# Self-host SPA builds only (set by Docker / Electron — not needed for cloud Convex)
# VITE_SELF_HOSTED=true

# ---------------------------------------------------------------------------
# Convex deployment secrets — set with \`bunx convex env set\`, NOT in Vite:
#   SITE_URL, JWT_PRIVATE_KEY, JWKS          → bunx @convex-dev/auth
#   AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET       → Google OAuth
#   POLAR_SERVER, POLAR_* token/secret/ids   → Polar billing
# See CLONE_CHECKLIST.md for the full setup order.
# ---------------------------------------------------------------------------
`;
  await writeText(ENV_EXAMPLE_PATH, contents, ".env.example");
}

/**
 * @param {string} src
 * @param {string[]} ids
 * @returns {{ src: string, marked: string[] }}
 */
function applyChecklistMarks(src, ids) {
  /** @type {string[]} */
  const marked = [];
  let next = src;
  for (const id of ids) {
    const unchecked = new RegExp(`(<!--\\s*clone:${id}\\s*-->\\r?\\n)(\\s*-\\s+)\\[ \\]`);
    const checked = new RegExp(`<!--\\s*clone:${id}\\s*-->\\r?\\n\\s*-\\s+\\[[xX]\\]`);
    if (unchecked.test(next)) {
      next = next.replace(unchecked, "$1$2[x]");
      marked.push(id);
    } else if (checked.test(next)) {
      marked.push(id);
    } else {
      console.warn(`  checklist id/task not found: ${id}`);
    }
  }
  return { src: next, marked };
}

/**
 * @param {string} src
 * @param {number} limit
 */
function listNextUncheckedFrom(src, limit = 5) {
  const lines = src.split(/\r?\n/);
  /** @type {Array<{ id: string | null, text: string }>} */
  const unchecked = [];
  let pendingId = null;
  for (const line of lines) {
    const idMatch = line.match(/<!--\s*clone:([a-z0-9-]+)\s*-->/);
    if (idMatch) {
      pendingId = idMatch[1];
      continue;
    }
    const task = line.match(/^\s*-\s+\[ \]\s+(.+)$/);
    if (task) {
      unchecked.push({ id: pendingId, text: task[1] });
      pendingId = null;
      if (unchecked.length >= limit) break;
    } else if (line.trim() !== "") {
      pendingId = null;
    }
  }
  return unchecked;
}

/**
 * @param {string[]} ids
 */
async function markCloneChecklistDone(ids) {
  if (!existsSync(CHECKLIST_PATH)) {
    console.warn("CLONE_CHECKLIST.md missing — skip auto-check.");
    return { marked: [], src: "" };
  }
  const before = await readFile(CHECKLIST_PATH, "utf8");
  const { src, marked } = applyChecklistMarks(before, ids);
  if (src !== before) {
    await writeText(CHECKLIST_PATH, src, `checklist: ${marked.join(", ") || "(none)"}`);
  }
  return { marked, src };
}

/**
 * @param {string} cmd
 * @param {string[]} args
 */
function runCommand(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: ROOT,
      stdio: "inherit",
      shell: process.platform === "win32",
      windowsHide: true,
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(" ")} exited with ${code}`));
    });
  });
}

/**
 * @param {string} githubUrl
 */
function deriveUrlsFromGithub(githubUrl) {
  const base = githubUrl.replace(/\.git$/, "");
  return {
    downloadUrl: `${base}/releases/latest`,
    selfHostUrl: `${base}/blob/master/docs/SELF_HOSTING.md`,
  };
}

async function warnIfExistingConvexDeploy() {
  if (!existsSync(ENV_LOCAL_PATH)) return;
  const envLocal = await readFile(ENV_LOCAL_PATH, "utf8");
  if (/^\s*CONVEX_DEPLOYMENT\s*=/m.test(envLocal)) {
    console.warn("");
    console.warn(
      "Warning: `.env.local` already has CONVEX_DEPLOYMENT.\n" +
        "Clones need a *new* Convex project — do not reuse the template deployment.\n" +
        "This script will not modify `.env` / `.env.local` secrets.",
    );
    console.warn("");
    if (args.yes || nonInteractive) {
      console.warn("Continuing (--yes / non-interactive flags).");
      return;
    }
    const ok = await promptYesNo("Continue with identity setup anyway?", true);
    if (!ok) {
      console.log("Aborted.");
      process.exit(0);
    }
  }
}

/**
 * @param {string} name
 * @param {string} slug
 * @param {string} github
 * @param {Partial<{ titleSuffix: string, appUrl: string, marketingUrl: string, privacyUrl: string, termsUrl: string, cookieUrl: string, changeLog: string, roadMap: string, kofiUrl: string, patreonUrl: string, footerTagline: string, authzTenantId: string, keepClassroom: boolean }>} [overrides]
 */
function buildIdentity(name, slug, github, overrides = {}) {
  const { downloadUrl, selfHostUrl } = deriveUrlsFromGithub(github);
  const marketingUrl = overrides.marketingUrl ?? `https://www.${slug}.com`;
  const changeLog = overrides.changeLog ?? `https://change-log.pages.dev/${slug}`;
  return {
    name,
    slug,
    authzTenantId: overrides.authzTenantId ?? slug,
    titleSuffix: overrides.titleSuffix ?? "App",
    appUrl: overrides.appUrl ?? `https://app.${slug}.com`,
    marketingUrl,
    privacyUrl: overrides.privacyUrl ?? `${marketingUrl}/privacy-policy`,
    termsUrl: overrides.termsUrl ?? `${marketingUrl}/terms-and-conditions`,
    cookieUrl: overrides.cookieUrl ?? `${marketingUrl}/cookie-policy`,
    changeLog,
    roadMap: overrides.roadMap ?? `${changeLog}/board`,
    github: github.replace(/\.git$/, ""),
    downloadUrl,
    selfHostUrl,
    kofiUrl: overrides.kofiUrl ?? "https://ko-fi.com/YOUR_PAGE",
    patreonUrl: overrides.patreonUrl ?? "https://www.patreon.com/YOUR_PAGE",
    footerTagline: overrides.footerTagline ?? `${name} — replace this tagline.`,
    keepClassroom: Boolean(overrides.keepClassroom),
  };
}

async function collectIdentity() {
  console.log("");
  console.log("Post-clone identity setup");
  console.log(dryRun ? "(dry run — no files will be written)\n" : "");

  if (nonInteractive) {
    const name = String(args.name);
    const slug = typeof args.slug === "string" ? args.slug : slugify(name);
    if (!SLUG_RE.test(slug)) {
      console.error(`Invalid slug "${slug}". Use lowercase letters, numbers, and hyphens.`);
      process.exit(1);
    }
    if (TEMPLATE_SLUGS.has(slug) && !args.keepClassroom) {
      console.error(
        `Slug "${slug}" matches the template. Pass --keep-classroom or choose a different slug.`,
      );
      process.exit(1);
    }
    return buildIdentity(name, slug, String(args.github), {
      titleSuffix: typeof args["title-suffix"] === "string" ? args["title-suffix"] : undefined,
      appUrl: typeof args["app-url"] === "string" ? args["app-url"] : undefined,
      marketingUrl: typeof args["marketing-url"] === "string" ? args["marketing-url"] : undefined,
      footerTagline: typeof args.tagline === "string" ? args.tagline : undefined,
      authzTenantId: typeof args["authz-tenant"] === "string" ? args["authz-tenant"] : undefined,
      keepClassroom: Boolean(args.keepClassroom),
    });
  }

  const name = await prompt("Display name (required)");
  if (!name) {
    console.error("Display name is required.");
    process.exit(1);
  }

  const slug = await prompt("Slug (kebab-case)", slugify(name));
  if (!SLUG_RE.test(slug)) {
    console.error(`Invalid slug "${slug}". Use lowercase letters, numbers, and hyphens.`);
    process.exit(1);
  }

  let keepClassroom = false;
  if (TEMPLATE_SLUGS.has(slug)) {
    keepClassroom = await promptYesNo(
      `Slug "${slug}" matches the template. Keep ClassClarus-style identity (retarget URLs only)?`,
      false,
    );
    if (!keepClassroom) {
      console.error("Choose a different slug for a fresh product.");
      process.exit(1);
    }
  }

  const github = await prompt(
    "GitHub repo URL (https://github.com/org/repo)",
    keepClassroom ? "https://github.com/mjf1406/vctr" : "",
  );
  if (!github) {
    console.error("GitHub repo URL is required (used for download/self-host links).");
    process.exit(1);
  }

  const titleSuffix = await prompt("Document title suffix", "App");
  const appUrl = await prompt("App URL (canonical SPA origin)", `https://app.${slug}.com`);
  const marketingUrl = await prompt("Marketing URL", `https://www.${slug}.com`);
  const privacyUrl = await prompt("Privacy policy URL", `${marketingUrl}/privacy-policy`);
  const termsUrl = await prompt("Terms URL", `${marketingUrl}/terms-and-conditions`);
  const cookieUrl = await prompt("Cookie policy URL", `${marketingUrl}/cookie-policy`);
  const changeLog = await prompt("Changelog URL", `https://change-log.pages.dev/${slug}`);
  const roadMap = await prompt("Roadmap URL", `${changeLog}/board`);
  const kofiUrl = await prompt("Ko-fi URL", "https://ko-fi.com/YOUR_PAGE");
  const patreonUrl = await prompt("Patreon URL", "https://www.patreon.com/YOUR_PAGE");
  const footerTagline = await prompt(
    "Footer tagline (all locales)",
    `${name} — replace this tagline.`,
  );
  const authzTenantId = await prompt("Authz tenant id (set before real authz data)", slug);

  return buildIdentity(name, slug, github, {
    titleSuffix,
    appUrl,
    marketingUrl,
    privacyUrl,
    termsUrl,
    cookieUrl,
    changeLog,
    roadMap,
    kofiUrl,
    patreonUrl,
    footerTagline,
    authzTenantId,
    keepClassroom,
  });
}

async function main() {
  await warnIfExistingConvexDeploy();
  const identity = await collectIdentity();

  console.log("\nApplying identity…");
  await rewriteAppConfig(identity);
  await rewritePackageJson(identity);
  await rewriteIndexHtml(identity.name);
  await rewriteDockerCompose(identity.slug);
  await rewriteExampleEnv(identity.slug);
  await rewriteSelfHostingDocs(identity.github, identity.slug);
  await rewriteFooterTaglines(identity.footerTagline);
  await writeEnvExample();

  /** @type {string[]} */
  const doneIds = [
    "identity-package",
    "identity-app-config",
    "identity-title",
    "identity-footer-tagline",
    "identity-self-host-docs",
    "identity-compose",
    "env-example",
  ];

  const runInstall =
    args.install === true
      ? true
      : args.install === false
        ? false
        : nonInteractive
          ? false
          : await promptYesNo("Run `vp install` now?", true);
  if (runInstall) {
    if (dryRun) {
      console.log("[dry-run] would run: vp install");
      doneIds.push("install-deps");
    } else {
      try {
        await runCommand("vp", ["install"]);
        doneIds.push("install-deps");
      } catch (err) {
        console.warn(`vp install failed (${err instanceof Error ? err.message : err}).`);
        console.warn(
          "You can run `vp install` or `bun install` manually, then check off install-deps.",
        );
      }
    }
  }

  const { marked, src: checklistSrc } = await markCloneChecklistDone(doneIds);

  if (dryRun) {
    console.log("\nDry run — planned writes:");
    for (const w of plannedWrites) {
      console.log(`  - ${w.path}: ${w.note}`);
    }
  }

  console.log("\n────────────────────────────────────────");
  console.log(`Checklist: ${path.relative(ROOT, CHECKLIST_PATH)}`);
  if (marked.length) {
    console.log(`Checked off: ${marked.join(", ")}`);
  }
  console.log("\nNext (manual) — see CLONE_CHECKLIST.md:");
  const nextSrc =
    checklistSrc || (existsSync(CHECKLIST_PATH) ? await readFile(CHECKLIST_PATH, "utf8") : "");
  const next = listNextUncheckedFrom(nextSrc, 6);
  for (const item of next) {
    const id = item.id ? ` [${item.id}]` : "";
    console.log(`  - [ ]${id} ${item.text}`);
  }
  console.log(`
Suggested order:
  1. bunx convex dev          # create a *new* Convex project
  2. bunx @convex-dev/auth    # SITE_URL=http://localhost:5173 + JWT keys
  3. Google OAuth → bunx convex env set AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET
     Redirect: {CONVEX_SITE_URL}/api/auth/callback/google
  4. Polar sandbox → env + grantAppAdmin + polar:syncProducts
  5. Replace public/brand/** + public/vctr/vctr-favicon.webp
  6. vp run ds

Do not copy template secrets. Tick boxes in CLONE_CHECKLIST.md as you go.
`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
