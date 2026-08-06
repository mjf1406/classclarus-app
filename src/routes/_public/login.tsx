import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { LoginAuthFields, LoginTermsCheckbox } from "@/components/auth/LoginFormParts";
import { LogoBig } from "@/components/brand/Logo";
import PendingComponent from "@/components/loading/PendingComponent";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { APP_CONFIG } from "@/config/app";
import { isPasswordAuthEnabled } from "@/lib/auth/authPassword";
import { getSafeAuthRedirect } from "@/lib/auth/authRedirect";
import { stashPendingJoinCode } from "@/lib/auth/pendingJoinCode";
import { JOIN_CODE_PARAM } from "@/lib/invitations/joinCodes";

const MOBILE_BREAKPOINT = 768;

/** `null` until the viewport is measured — avoids a desktop-card flash on mobile. */
function useLoginViewport(): boolean | null {
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(mql.matches);
    };
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}

const loginSearchSchema = z.object({
  redirect: z.string().optional(),
});

function stashJoinCodeFromRedirect(redirectTo: string | undefined): void {
  if (!redirectTo) return;
  try {
    const url = new URL(redirectTo, "http://local.invalid");
    if (url.pathname !== "/join") return;
    const code = url.searchParams.get(JOIN_CODE_PARAM);
    if (code) {
      stashPendingJoinCode(code);
    }
  } catch {
    // ignore malformed redirect
  }
}

export const Route = createFileRoute("/_public/login")({
  validateSearch: loginSearchSchema,
  beforeLoad: ({ context, search }) => {
    stashJoinCodeFromRedirect(search.redirect);
    if (context.auth.isLoading) {
      return;
    }
    if (context.auth.isAuthenticated) {
      throw redirect({
        href: getSafeAuthRedirect(search.redirect),
      });
    }
  },
  component: function LoginPage() {
    const { auth } = Route.useRouteContext();
    const { redirect: redirectTo } = Route.useSearch();
    const [termsAccepted, setTermsAccepted] = useState(false);
    const { t } = useTranslation(["auth", "common"]);
    const passwordEnabled = isPasswordAuthEnabled();
    const isMobile = useLoginViewport();

    if (auth.isLoading || isMobile === null) {
      return <PendingComponent />;
    }

    if (auth.isAuthenticated) {
      return null;
    }

    const learnMoreLink = (
      <a
        href={APP_CONFIG.marketingUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline underline-offset-4"
      >
        {t("learnMore")}
      </a>
    );

    if (isMobile) {
      return (
        <div className="relative min-h-[calc(100svh-3.5rem)] bg-background">
          <div className="flex flex-col items-center px-6 pt-10">
            <LogoBig />
          </div>
          <Drawer
            open
            onOpenChange={() => {
              // Login drawer stays open; dismiss gestures are ignored.
            }}
            disablePointerDismissal
            modal={false}
          >
            <DrawerContent className="[--drawer-inset:0px] rounded-b-none border-x-0 border-b-0">
              <DrawerHeader className="text-left">
                <DrawerTitle className="text-2xl">{t("welcomeTitle")}</DrawerTitle>
                <DrawerDescription>
                  {t("signInToContinue")} {learnMoreLink}
                </DrawerDescription>
              </DrawerHeader>
              <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-6">
                <LoginTermsCheckbox
                  termsAccepted={termsAccepted}
                  onTermsAcceptedChange={setTermsAccepted}
                />
                <LoginAuthFields
                  termsAccepted={termsAccepted}
                  redirectTo={redirectTo}
                  passwordEnabled={passwordEnabled}
                />
              </div>
            </DrawerContent>
          </Drawer>
        </div>
      );
    }

    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md bg-input/30">
          <CardHeader className="space-y-3 text-center">
            <div className="flex justify-center">
              <LogoBig />
            </div>
            <div>
              <CardTitle className="text-2xl">{t("welcomeTitle")}</CardTitle>
              <CardDescription className="mt-2">
                {t("signInToContinue")} {learnMoreLink}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="mt-8 flex flex-col gap-4">
            <LoginTermsCheckbox
              termsAccepted={termsAccepted}
              onTermsAcceptedChange={setTermsAccepted}
            />
            <LoginAuthFields
              termsAccepted={termsAccepted}
              redirectTo={redirectTo}
              passwordEnabled={passwordEnabled}
            />
          </CardContent>
        </Card>
      </div>
    );
  },
});
