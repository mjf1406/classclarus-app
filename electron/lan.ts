import os from "node:os";

/** Pick a primary IPv4 LAN address (skip internal/link-local). */
export function detectLanIpv4(): string | null {
  const nets = os.networkInterfaces();
  const candidates: string[] = [];

  for (const entries of Object.values(nets)) {
    if (!entries) continue;
    for (const entry of entries) {
      if (entry.family !== "IPv4" || entry.internal) continue;
      if (entry.address.startsWith("169.254.")) continue;
      candidates.push(entry.address);
    }
  }

  // Prefer common private ranges
  const preferred = candidates.find(
    (ip) =>
      ip.startsWith("192.168.") || ip.startsWith("10.") || /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip),
  );
  return preferred ?? candidates[0] ?? null;
}
