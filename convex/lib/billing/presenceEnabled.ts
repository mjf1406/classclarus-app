import { isSelfHosted } from "./selfHosted.js";

/**
 * Class online presence is self-host only. Cloud deployments stay off even if
 * `CLASS_PRESENCE_ENABLED` is set. Self-host defaults on; set to `"false"` to
 * disable all presence reads/writes.
 */
export function isClassPresenceEnabled(): boolean {
  if (!isSelfHosted()) {
    return false;
  }
  return process.env.CLASS_PRESENCE_ENABLED !== "false";
}
