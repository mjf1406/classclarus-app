import { useEffect } from "react";
import { RouterProvider, type AnyRouter } from "@tanstack/react-router";
import { useConvexAuth } from "@convex-dev/auth/react";

export function InnerRouterProvider({ router }: { router: AnyRouter }) {
  const auth = useConvexAuth();

  useEffect(() => {
    void router.invalidate();
  }, [auth.isAuthenticated, auth.isLoading, router]);

  return <RouterProvider router={router} context={{ auth }} />;
}
