import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { createRouter } from "@tanstack/react-router";
import { ConvexQueryClient } from "@convex-dev/react-query";
import { ConvexReactClient } from "convex/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toast";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import PendingComponent from "@/components/loading/PendingComponent";
import { InnerRouterProvider } from "@/components/routing/InnerRouterProvider";
import i18n, { ensureLocaleLoaded, getInitialLanguage } from "@/i18n";
import { LanguageProvider } from "@/i18n/LanguageProvider";
import { polyfillCryptoRandomUUID } from "@/lib/optimistic";
import { installVitePreloadRecovery } from "@/lib/pwa/recoverFromStaleAssets";
import { resolveConvexUrl } from "@/lib/runtimeEnv";
import { STORAGE_KEYS } from "@/lib/storageKeys";

import { routeTree } from "./routeTree.gen";
import { TooltipProvider } from "./components/ui/tooltip";
import { RootErrorComponent } from "./components/errors/RootErrorComponent";

// LAN HTTP (Electron / self-host) is not a secure context — presence needs this.
polyfillCryptoRandomUUID();
installVitePreloadRecovery();

const convex = new ConvexReactClient(resolveConvexUrl());
const convexQueryClient = new ConvexQueryClient(convex);
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryKeyHashFn: convexQueryClient.hashFn(),
      queryFn: convexQueryClient.queryFn(),
    },
  },
});
convexQueryClient.connect(queryClient);

const router = createRouter({
  routeTree,
  context: {
    auth: {
      isAuthenticated: false,
      isLoading: true,
    },
  },
  defaultPendingComponent: PendingComponent,
  defaultErrorComponent: RootErrorComponent,
  defaultPendingMs: 150,
  defaultPendingMinMs: 300,
  defaultPreload: "intent",
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

async function bootstrap() {
  const bootLanguage = getInitialLanguage();
  await ensureLocaleLoaded(bootLanguage);
  await i18n.changeLanguage(bootLanguage);

  const rootElement = document.getElementById("root");
  if (!rootElement) {
    throw new Error("Root element #root not found");
  }
  if (!rootElement.innerHTML) {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <ConvexAuthProvider client={convex}>
        <QueryClientProvider client={queryClient}>
          <StrictMode>
            <LanguageProvider>
              <ThemeProvider defaultTheme="system" storageKey={STORAGE_KEYS.theme}>
                <div vaul-drawer-wrapper="" className="bg-background">
                  <TooltipProvider>
                    <InnerRouterProvider router={router} />
                  </TooltipProvider>
                  <Toaster />
                </div>
              </ThemeProvider>
            </LanguageProvider>
          </StrictMode>
        </QueryClientProvider>
      </ConvexAuthProvider>,
    );
  }
}

void bootstrap();
