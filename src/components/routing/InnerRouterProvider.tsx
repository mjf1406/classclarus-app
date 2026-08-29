import { useEffect } from "react";
import { RouterProvider, type AnyRouter } from "@tanstack/react-router";
import { useConvexAuth } from "@convex-dev/auth/react";
import { useQueryClient } from "@tanstack/react-query";

import PendingComponent from "@/components/loading/PendingComponent";

/**
 * Wait for Convex auth to settle before mounting the router.
 * Avoids a cold-load race where `router.invalidate()` on isLoading→false
 * can briefly auth-gate public routes like `/a/$publicSlug`.
 */
export function InnerRouterProvider({ router }: { router: AnyRouter }) {
  const auth = useConvexAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (auth.isLoading) {
      return;
    }
    void router.invalidate();
  }, [auth.isAuthenticated, auth.isLoading, router]);

  if (auth.isLoading) {
    return <PendingComponent />;
  }

  return <RouterProvider router={router} context={{ auth, queryClient }} />;
}
