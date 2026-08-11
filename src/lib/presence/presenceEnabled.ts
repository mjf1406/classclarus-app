import { isSelfHosted } from "@/lib/selfHosted";
import { readViteEnv } from "@/lib/runtimeEnv";

/**
 * Class online presence is self-host only (Electron + Docker). Defaults on;
 * set `VITE_CLASS_PRESENCE_ENABLED=false` to disable. Hosted cloud stays off.
 */
export function isClassPresenceEnabled(): boolean {
  if (!isSelfHosted()) {
    return false;
  }
  const flag = readViteEnv("VITE_CLASS_PRESENCE_ENABLED");
  if (flag === "false") {
    return false;
  }
  return true;
}
