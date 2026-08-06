import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useEntitlement } from "@/hooks/billing/useEntitlement";
import { buildPlanSummary } from "@/lib/billing/planSummary";
import { cn } from "@/lib/utils";

export function BillingSummaryCard() {
  const { t, i18n } = useTranslation("billing");
  const { t: tAccount } = useTranslation("account");
  const { data: raw, entitlement, isPending, isError, refetch } = useEntitlement();

  const summary = useMemo(
    () =>
      buildPlanSummary({
        entitlement,
        subscription: raw?.subscription ?? null,
        locale: i18n.language,
        t,
      }),
    [entitlement, raw?.subscription, i18n.language, t],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{tAccount("billingSummaryTitle")}</CardTitle>
        <CardDescription>{tAccount("billingSummaryDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {isPending ? (
          <Skeleton className="h-5 w-56" />
        ) : isError ? (
          <ErrorState
            description={t("entitlementLoadFailed")}
            onRetry={async () => {
              await refetch();
            }}
          />
        ) : (
          <p className="text-sm text-muted-foreground">{summary.line}</p>
        )}
        <Link
          to="/billing"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "justify-center")}
        >
          {tAccount("manageBilling")}
        </Link>
      </CardContent>
    </Card>
  );
}
