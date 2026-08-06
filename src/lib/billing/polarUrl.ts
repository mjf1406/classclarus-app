/**
 * Allowlist Polar checkout / portal URLs before `window.open` or embed.
 * Rejects non-https and non-Polar hosts.
 */
export function assertSafePolarCheckoutUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid Polar URL");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("Invalid Polar URL");
  }

  const host = parsed.hostname.toLowerCase();
  if (host !== "polar.sh" && !host.endsWith(".polar.sh")) {
    throw new Error("Invalid Polar URL");
  }

  return parsed.toString();
}
