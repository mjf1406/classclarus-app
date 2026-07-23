/**
 * Returns a same-app relative path for post-login navigation,
 * or "/" if the value is missing or unsafe (open-redirect protection).
 */
export function getSafeAuthRedirect(redirect: unknown): string {
  if (typeof redirect !== "string" || redirect.length === 0) {
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
  return redirect;
}
