import { APP_CONFIG } from "@/config/app";

/**
 * Artifact filenames must stay aligned with electron-builder.config.mjs
 * (`artifactName` for win / mac / linux).
 */
function latestDownloadUrl(artifact: string): string {
  return `${APP_CONFIG.github}/releases/latest/download/${artifact}`;
}

const productName = APP_CONFIG.name;

/** Direct GitHub “latest release” asset URLs for the billing Free download menu. */
export const DESKTOP_DOWNLOADS = {
  windows: latestDownloadUrl(`${productName}-Setup-Windows.exe`),
  mac: latestDownloadUrl(`${productName}-macOS.dmg`),
  /** UI label is Ubuntu; CI artifact is the Linux AppImage. */
  ubuntu: latestDownloadUrl(`${productName}-Linux.AppImage`),
} as const;
