import { readViteEnv } from "@/lib/runtimeEnv";

/** True for Docker self-host or Electron classroom (runtime or build flag). */
export function isSelfHosted(): boolean {
  return readViteEnv("VITE_SELF_HOSTED") === "true";
}
