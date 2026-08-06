/**
 * Copy convex/ + install production deps into resources/deploy-project for packaged first-run deploy.
 * Root .gitignore already ignores resources/deploy-project — do not write a nested .gitignore that
 * excludes node_modules (electron-builder honors it and ships an empty deploy tree).
 */
import { $ } from "bun";
import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";

const out = path.join("resources", "deploy-project");
await rm(out, { recursive: true, force: true });
await mkdir(path.join(out, "scripts"), { recursive: true });

await cp("convex", path.join(out, "convex"), { recursive: true });
await cp("patches", path.join(out, "patches"), { recursive: true });
await cp("package.json", path.join(out, "package.json"));
await cp("bun.lock", path.join(out, "bun.lock"));
await cp("tsconfig.json", path.join(out, "tsconfig.json"));
await cp("tsconfig.app.json", path.join(out, "tsconfig.app.json"));
await cp("scripts/self-host-bootstrap.mjs", path.join(out, "scripts", "self-host-bootstrap.mjs"));
await cp("scripts/convexFingerprint.mjs", path.join(out, "scripts", "convexFingerprint.mjs"));

console.log("Installing deploy-project production dependencies...");
await $`bun install --frozen-lockfile --ignore-scripts --production`.cwd(out);
console.log(`Deploy project ready at ${out}`);
