/**
 * Sanitize avatar URLs for `<img src>`.
 * Allows HTTPS Google user-content hosts and Convex storage bearer URLs
 * (`/api/storage/…`, http or https for self-host / Electron LAN).
 */
export function sanitizeAvatarUrl(url: string | null | undefined): string | null {
  if (url === null || url === undefined) {
    return null;
  }
  const trimmed = url.trim();
  if (!trimmed) {
    return null;
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return null;
  }
  const host = parsed.hostname.toLowerCase();
  if (host === "googleusercontent.com" || host.endsWith(".googleusercontent.com")) {
    if (parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString();
  }
  // Convex file storage URLs (cloud `*.convex.cloud` or self-host site origin).
  if (parsed.pathname.startsWith("/api/storage/")) {
    return parsed.toString();
  }
  return null;
}
