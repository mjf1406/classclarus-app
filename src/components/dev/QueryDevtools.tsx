import { lazy, Suspense, type ComponentType } from "react";

type ReactQueryDevtoolsProps = {
  initialIsOpen?: boolean;
  buttonPosition?: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "relative";
};

/**
 * Dev-only TanStack Query inspector.
 * Gated on `import.meta.env.DEV` so Vite/Rolldown tree-shakes the package from
 * production builds (cloud, Electron, and self-hosted all use `vp build`).
 */
const ReactQueryDevtools: ComponentType<ReactQueryDevtoolsProps> | null = import.meta.env.DEV
  ? lazy(() =>
      import("@tanstack/react-query-devtools").then((m) => ({
        default: m.ReactQueryDevtools as ComponentType<ReactQueryDevtoolsProps>,
      })),
    )
  : null;

export function QueryDevtools() {
  if (!ReactQueryDevtools) {
    return null;
  }
  return (
    <Suspense fallback={null}>
      <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
    </Suspense>
  );
}
