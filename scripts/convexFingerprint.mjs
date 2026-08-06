/**
 * Content hash of Convex source (excludes `_generated`).
 * Shared by Docker / Electron self-host bootstrap so code edits redeploy.
 */
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

/**
 * @param {string} projectDir
 * @returns {Promise<string>}
 */
export async function fingerprintConvexSource(projectDir) {
  const root = path.join(projectDir, "convex");
  /** @type {string[]} */
  const files = [];

  /**
   * @param {string} dir
   */
  async function walk(dir) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name === "_generated" || entry.name === "node_modules") continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (/\.(ts|js|tsx|jsx)$/.test(entry.name)) {
        files.push(full);
      }
    }
  }

  await walk(root);
  files.sort();

  const hash = createHash("sha256");
  for (const file of files) {
    hash.update(path.relative(root, file).replaceAll("\\", "/"));
    hash.update("\0");
    hash.update(await readFile(file));
    hash.update("\0");
  }
  return hash.digest("hex").slice(0, 16);
}
