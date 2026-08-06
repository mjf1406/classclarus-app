import { lazy, Suspense, type ComponentType } from "react";

/**
 * Dev-only router inspector.
 * Gated on `import.meta.env.DEV` so Vite/Rolldown tree-shakes the package from
 * production builds (cloud, Electron, and self-hosted all use `vp build`).
 */
const TanStackRouterDevtools: ComponentType | null = import.meta.env.DEV
  ? lazy(() =>
      import("@tanstack/react-router-devtools").then((m) => ({
        default: m.TanStackRouterDevtools,
      })),
    )
  : null;

export function RouterDevtools() {
  if (!TanStackRouterDevtools) {
    return null;
  }
  return (
    <Suspense fallback={null}>
      <TanStackRouterDevtools />
    </Suspense>
  );
}
