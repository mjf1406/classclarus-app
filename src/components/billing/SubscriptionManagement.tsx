import { CircleQuestionMarkIcon, ExternalLinkIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { CancelSubscriptionCredenza } from "@/components/billing/CancelSubscriptionCredenza";
import { AsyncButton } from "@/components/ui/async-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useCustomerPortal } from "@/hooks/billing/useCustomerPortal";
import { formatBillingDate, formatBillingMoney } from "@/lib/billing/format";

export type SubscriptionSummary = {
  status: string;
  productKey: string | null;
  productName: string | null;
  amount: number | null;
  currency: string | null;
  recurringInterval: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  startedAt: string | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
  endsAt: string | null;
};

type SubscriptionManagementProps = {
  subscription: SubscriptionSummary;
};

export function SubscriptionManagement({ subscription }: SubscriptionManagementProps) {
  const { t, i18n } = useTranslation("billing");
  const portal = useCustomerPortal();
  const [cancelOpen, setCancelOpen] = useState(false);

  const planLabel =
    subscription.productKey === "proYearly"
      ? t("yearlyTitle")
      : subscription.productKey === "proMonthly"
        ? t("monthlyTitle")
        : (subscription.productName ?? t("currentPlan"));

  const priceLabel = formatBillingMoney(subscription.amount, subscription.currency, i18n.language);
  const periodLabel =
    subscription.recurringInterval === "year"
      ? t("yearlyPeriod")
      : subscription.recurringInterval === "month"
        ? t("monthlyPeriod")
        : "";

  const startDate = formatBillingDate(
    subscription.startedAt ?? subscription.currentPeriodStart,
    i18n.language,
  );
  const endDate = formatBillingDate(
    subscription.endsAt ?? subscription.currentPeriodEnd,
    i18n.language,
  );
  const statusLabel = subscription.cancelAtPeriodEnd ? t("statusToBeCancelled") : t("statusActive");

  return (
    <>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium tracking-tight">{t("subscriptionsTitle")}</h2>
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex flex-col gap-1">
                <CardTitle>{planLabel}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {priceLabel}
                  {periodLabel}
                </p>
              </div>
              <Badge variant={subscription.cancelAtPeriodEnd ? "outline" : "secondary"}>
                {statusLabel}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div className="flex flex-col gap-0.5">
                <dt className="text-muted-foreground">{t("statusLabel")}</dt>
                <dd>{statusLabel}</dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-muted-foreground">{t("startDateLabel")}</dt>
                <dd>{startDate ?? t("dateUnknown")}</dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-muted-foreground">
                  {subscription.cancelAtPeriodEnd ? t("expiryDateLabel") : t("renewalDateLabel")}
                </dt>
                <dd>{endDate ?? t("dateUnknown")}</dd>
              </div>
            </dl>
          </CardContent>
          <CardFooter className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              <AsyncButton
                type="button"
                variant="outline"
                pending={portal.isPending}
                onClick={async () => {
                  await portal.mutateAsync();
                }}
              >
                {t("manageOnPolar")}
                <ExternalLinkIcon data-icon="inline-end" />
              </AsyncButton>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("polarTooltipAria")}
                    />
                  }
                >
                  <CircleQuestionMarkIcon />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-left">
                  {t("polarTooltip")}
                </TooltipContent>
              </Tooltip>
            </div>
            {subscription.cancelAtPeriodEnd ? (
              <p className="text-sm text-muted-foreground">
                {t("cancellationScheduled", { date: endDate ?? t("dateUnknown") })}
              </p>
            ) : (
              <Button type="button" variant="destructive" onClick={() => setCancelOpen(true)}>
                {t("cancelSubscription")}
              </Button>
            )}
          </CardFooter>
        </Card>
      </section>

      <CancelSubscriptionCredenza
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        accessUntil={endDate}
      />
    </>
  );
}
