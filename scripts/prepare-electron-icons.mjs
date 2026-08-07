/**
 * Convert brand WebP → build/icon.png for electron-builder (Windows .ico / macOS .icns).
 *
 * Source is the high-res brand mark (same art as public/brand/logo/icon-86.webp).
 * Windows Control Panel / NSIS need a multi-size .ico; electron-builder generates that
 * from a ≥512px PNG under directories.buildResources (webp is not supported).
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const source = path.join(root, "public", "brand", "logo", "icon-688.webp");
const outDir = path.join(root, "build");
const outPng = path.join(outDir, "icon.png");

await mkdir(outDir, { recursive: true });

const { width, height } = await sharp(source).metadata();
if (!width || !height) {
  throw new Error(`prepare-electron-icons: could not read dimensions of ${source}`);
}
const side = Math.max(width, height);
const meta = await sharp(source)
  .extend({
    top: Math.floor((side - height) / 2),
    bottom: Math.ceil((side - height) / 2),
    left: Math.floor((side - width) / 2),
    right: Math.ceil((side - width) / 2),
    background: { r: 0, g: 0, b: 0, alpha: 1 },
  })
  .png()
  .toFile(outPng);

console.log(
  `prepare-electron-icons: ${path.relative(root, source)} → ${path.relative(root, outPng)} (${meta.width}×${meta.height})`,
);
