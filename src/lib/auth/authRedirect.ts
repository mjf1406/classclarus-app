/**
 * Returns a same-app relative path for post-login navigation,
 * or "/" if the value is missing or unsafe (open-redirect protection).
 */
export function getSafeAuthRedirect(redirect: unknown, origin?: string): string {
  if (typeof redirect !== "string" || redirect.length === 0) {
    return "/";
  }

  // Reject backslashes, control chars, and encoded separators before other checks.
  if (redirect.includes("\\") || /%2f|%5c|%00/i.test(redirect) || hasControlChars(redirect)) {
    return "/";
  }

  if (!redirect.startsWith("/")) {
    return "/";
  }
  // Protocol-relative or absolute URLs
  if (redirect.startsWith("//") || redirect.includes("://")) {
    return "/";
  }
  // Avoid bouncing back to login
  if (redirect === "/login" || redirect.startsWith("/login?") || redirect.startsWith("/login#")) {
    return "/";
  }

  const base =
    origin ?? (typeof window !== "undefined" ? window.location.origin : "https://app.local");
  try {
    const parsed = new URL(redirect, base);
    if (parsed.origin !== new URL(base).origin) {
      return "/";
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/";
  }
}

function hasControlChars(value: string): boolean {
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code < 32 || code === 127) {
      return true;
    }
  }
  return false;
}
