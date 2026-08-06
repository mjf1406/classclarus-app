import { lazy, Suspense } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";

import PendingComponent from "@/components/loading/PendingComponent";

const UiPlaygroundLazy = import.meta.env.DEV
  ? lazy(() => import("@/components/dev/UiPlayground").then((m) => ({ default: m.UiPlayground })))
  : null;

export const Route = createFileRoute("/_authenticated/_app/ui")({
  beforeLoad: () => {
    if (!import.meta.env.DEV) {
      throw redirect({ to: "/" });
    }
  },
  component: function UiRoute() {
    if (!UiPlaygroundLazy) {
      return null;
    }
    return (
      <Suspense fallback={<PendingComponent inset />}>
        <UiPlaygroundLazy />
      </Suspense>
    );
  },
});
