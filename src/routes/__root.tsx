import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";

import { QueryDevtools } from "@/components/dev/QueryDevtools";
import { RouterDevtools } from "@/components/dev/RouterDevtools";
import PendingComponent from "@/components/loading/PendingComponent";
import { RootErrorComponent } from "@/components/errors/RootErrorComponent";
import { PwaRoot } from "@/components/pwa/PwaReloadBanner";

export type RouterAuthContext = {
  isAuthenticated: boolean;
  isLoading: boolean;
};

export type RouterContext = {
  auth: RouterAuthContext;
  queryClient: QueryClient;
};

export const Route = createRootRouteWithContext<RouterContext>()({
  pendingComponent: PendingComponent,
  errorComponent: RootErrorComponent,
  component: () => (
    <>
      <PwaRoot />
      <Outlet />
      <RouterDevtools />
      <QueryDevtools />
    </>
  ),
});
