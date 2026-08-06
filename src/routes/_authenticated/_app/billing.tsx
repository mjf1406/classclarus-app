import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { APP_CONFIG } from "@/config/app";
import { FreeDownloadMenu } from "@/components/billing/FreeDownloadMenu";
import { GiftTipStats } from "@/components/billing/GiftTipStats";
import { OrderHistory } from "@/components/billing/OrderHistory";
import { PlanActionButton } from "@/components/billing/PlanActionButton";
import { SubscriptionManagement } from "@/components/billing/SubscriptionManagement";
import { DownloadUsageChip, SelfHostUsageChip } from "@/components/billing/UsageStatsChip";
import { useBillingProducts } from "@/hooks/billing/useBillingProducts";
import { useEntitlement } from "@/hooks/billing/useEntitlement";
import { useTrackSelfHostClick } from "@/hooks/billing/useTrackSelfHostClick";
import { useTheme } from "@/components/theme/theme-context";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { isSelfHosted } from "@/lib/selfHosted";
import { cn } from "@/lib/utils";

function checkoutTheme(theme: "dark" | "light" | "system"): "dark" | "light" {
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return theme;
}

export const Route = createFileRoute("/_authenticated/_app/billing")({
  component: function BillingPage() {
    const { t } = useTranslation("billing");
    const { theme } = useTheme();
    const selfHosted = isSelfHosted();
    const {
      data: products,
      isPending: productsPending,
      isError: productsError,
      refetch: refetchProducts,
    } = useBillingProducts();
    const {
      data: raw,
      entitlement,
      isPending: entitlementPending,
      isError: entitlementError,
      refetch: refetchEntitlement,
    } = useEntitlement();

    const isSubscribed = entitlement?.status === "active";
    const subscription = raw?.subscription ?? null;
    const monthly = products?.proMonthly;
    const yearly = products?.proYearly;
    const polarTheme = checkoutTheme(theme);
    const currentProductKey = raw?.productKey ?? null;
    const trackSelfHostClick = useTrackSelfHostClick();

    if (selfHosted) {
      return (
        <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-8">
          <div className="flex flex-col gap-2 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">{t("selfHostedTitle")}</h1>
            <p className="text-sm text-muted-foreground">{t("selfHostedSubtitle")}</p>
          </div>
          <Card className="mx-auto w-full max-w-lg">
            <CardHeader>
              <CardTitle>{t("freeTitle")}</CardTitle>
              <CardDescription>{t("selfHostedBody")}</CardDescription>
            </CardHeader>
          </Card>
        </div>
      );
    }

    return (
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-8">
        <div className="flex flex-col gap-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>

        {entitlementPending ? (
          <Skeleton className="mx-auto h-12 w-full max-w-lg" />
        ) : entitlementError ? (
          <ErrorState
            card
            description={t("entitlementLoadFailed")}
            onRetry={async () => {
              await refetchEntitlement();
            }}
          />
        ) : entitlement?.status === "expired" ? (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-center text-sm">
            <p className="font-medium text-destructive">{t("trialExpiredTitle")}</p>
            <p className="mt-1 text-muted-foreground">
              {t("trialExpiredBody", { appName: APP_CONFIG.name })}
            </p>
          </div>
        ) : entitlement?.status === "trialing" && entitlement.daysRemaining !== null ? (
          <p className="text-center text-sm text-muted-foreground">
            {t("trialActive", { count: entitlement.daysRemaining })}
          </p>
        ) : null}

        {isSubscribed && subscription ? (
          <>
            <SubscriptionManagement subscription={subscription} />
            <OrderHistory />
          </>
        ) : null}

        {productsPending ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <Skeleton className="h-56 rounded-2xl" />
            <Skeleton className="h-56 rounded-2xl" />
            <Skeleton className="h-56 rounded-2xl" />
          </div>
        ) : productsError ? (
          <ErrorState
            card
            description={t("productsLoadFailed")}
            onRetry={async () => {
              await refetchProducts();
            }}
          />
        ) : !monthly && !yearly ? (
          <p className="text-center text-sm text-muted-foreground">{t("productsUnavailable")}</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>{t("freeTitle")}</CardTitle>
                <CardDescription>
                  <span className="text-3xl font-semibold text-foreground">{t("freePrice")}</span>
                  <span className="text-muted-foreground">{t("freePeriod")}</span>
                </CardDescription>
              </CardHeader>
              <CardContent />
              <CardFooter className="flex min-w-0 flex-row items-start gap-2">
                <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
                  <FreeDownloadMenu />
                  <DownloadUsageChip />
                </div>
                <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
                  <a
                    href={APP_CONFIG.selfHostUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(
                      buttonVariants({ variant: "ghost", size: "sm" }),
                      "w-full justify-center",
                    )}
                    onClick={() => {
                      trackSelfHostClick.mutate({});
                    }}
                  >
                    {t("freeSelfHost")}
                  </a>
                  <SelfHostUsageChip />
                </div>
              </CardFooter>
            </Card>

            {monthly ? (
              <Card
                className={cn(isSubscribed && currentProductKey === "proMonthly" && "ring-primary")}
              >
                <CardHeader>
                  <CardTitle>{t("monthlyTitle")}</CardTitle>
                  <CardDescription>
                    <span className="text-3xl font-semibold text-foreground">
                      {t("monthlyPrice")}
                    </span>
                    <span className="text-muted-foreground">{t("monthlyPeriod")}</span>
                    <p className="mt-2 text-xs leading-snug text-muted-foreground">
                      {t("taxNote")}
                    </p>
                  </CardDescription>
                </CardHeader>
                <CardContent />
                <CardFooter>
                  {isSubscribed && currentProductKey === "proMonthly" ? (
                    <Badge>{t("currentPlan")}</Badge>
                  ) : (
                    <PlanActionButton
                      productId={monthly.id}
                      theme={polarTheme}
                      variant="secondary"
                      className="w-full justify-center"
                      changeExisting={isSubscribed}
                    >
                      {isSubscribed ? t("switchToMonthly") : t("startMonthly")}
                    </PlanActionButton>
                  )}
                </CardFooter>
              </Card>
            ) : null}

            {yearly ? (
              <Card
                className={cn(
                  isSubscribed && currentProductKey === "proYearly"
                    ? "ring-primary"
                    : !isSubscribed && "ring-primary/30",
                )}
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle>{t("yearlyTitle")}</CardTitle>
                    <Badge>{t("yearlySave")}</Badge>
                  </div>
                  <CardDescription>
                    <span className="text-3xl font-semibold text-foreground">
                      {t("yearlyPrice")}
                    </span>
                    <span className="text-muted-foreground">{t("yearlyPeriod")}</span>
                    <p className="mt-2 text-xs leading-snug text-muted-foreground">
                      {t("taxNote")}
                    </p>
                  </CardDescription>
                </CardHeader>
                <CardContent />
                <CardFooter>
                  {isSubscribed && currentProductKey === "proYearly" ? (
                    <Badge>{t("currentPlan")}</Badge>
                  ) : (
                    <PlanActionButton
                      productId={yearly.id}
                      theme={polarTheme}
                      variant="secondary"
                      className="w-full justify-center"
                      changeExisting={isSubscribed}
                    >
                      {isSubscribed ? t("switchToYearly") : t("startYearly")}
                    </PlanActionButton>
                  )}
                </CardFooter>
              </Card>
            ) : null}
          </div>
        )}

        <div className="mx-auto flex w-full max-w-lg mt-36 flex-col items-center gap-3 text-center">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold tracking-tight">{t("giftTitle")}</h2>
            <GiftTipStats />
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <a href={APP_CONFIG.kofiUrl} target="_blank" rel="noreferrer">
              <img
                src="/gift/support_me_on_kofi_blue.png"
                alt={t("giftKofiAlt")}
                className="h-10 w-auto"
              />
            </a>
            <a href={APP_CONFIG.patreonUrl} target="_blank" rel="noreferrer">
              <img
                src="/gift/become_a_patron_button.png"
                alt={t("giftPatreonAlt")}
                className="h-10 w-auto"
              />
            </a>
          </div>
          <p className="text-xs text-muted-foreground">{t("giftDisclaimer")}</p>
        </div>
      </div>
    );
  },
});
