type VitePublicEnvKey =
  | "VITE_CONVEX_URL"
  | "VITE_CONVEX_SITE_URL"
  | "VITE_AUTH_PASSWORD_ENABLED"
  | "VITE_CLASS_PRESENCE_ENABLED"
  | "VITE_SELF_HOSTED"
  | "VITE_APP_VERSION";

type SelfHostRuntimeEnv = Partial<Record<VitePublicEnvKey, string>>;

declare global {
  interface Window {
    __SELF_HOST_ENV__?: SelfHostRuntimeEnv;
  }
}

/**
 * Prefer Docker/nginx-injected `window.__SELF_HOST_ENV__` (self-host),
 * then fall back to Vite build-time `import.meta.env`.
 */
export function readViteEnv(key: VitePublicEnvKey): string | undefined {
  const runtime = typeof window !== "undefined" ? window.__SELF_HOST_ENV__?.[key] : undefined;
  if (typeof runtime === "string" && runtime.length > 0) {
    return runtime;
  }
  const baked = import.meta.env[key];
  return typeof baked === "string" && baked.length > 0 ? baked : undefined;
}

/**
 * Convex WebSocket/HTTP origin for the SPA.
 * In self-host mode, always use the hostname from the address bar so a wrong
 * PUBLIC_HOST=localhost does not point the browser at the client machine.
 */
export function resolveConvexUrl(): string {
  const configured = readViteEnv("VITE_CONVEX_URL");
  const selfHosted = readViteEnv("VITE_SELF_HOSTED") === "true";

  if (selfHosted && typeof window !== "undefined") {
    const configuredUrl = configured ? safeUrl(configured) : null;
    const port = configuredUrl?.port || "3210";
    const protocol = window.location.protocol === "https:" ? "https:" : "http:";
    return `${protocol}//${window.location.hostname}:${port}`;
  }

  if (!configured) {
    throw new Error("VITE_CONVEX_URL is not set");
  }
  return configured;
}

/** HTTP Actions origin (`*.convex.site` equivalent) for self-host. */
export function resolveConvexSiteUrl(): string | undefined {
  const configured = readViteEnv("VITE_CONVEX_SITE_URL");
  const selfHosted = readViteEnv("VITE_SELF_HOSTED") === "true";

  if (selfHosted && typeof window !== "undefined") {
    const configuredUrl = configured ? safeUrl(configured) : null;
    const port = configuredUrl?.port || "3211";
    const protocol = window.location.protocol === "https:" ? "https:" : "http:";
    return `${protocol}//${window.location.hostname}:${port}`;
  }

  return configured;
}

function safeUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}
