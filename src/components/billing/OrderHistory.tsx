import { useTranslation } from "react-i18next";

import { AsyncButton } from "@/components/ui/async-button";
import { Badge } from "@/components/ui/badge";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useBillingHistory } from "@/hooks/billing/useBillingHistory";
import { formatBillingDate, formatBillingMoney } from "@/lib/billing/format";

function orderStatusLabel(status: string, paid: boolean, t: (key: string) => string): string {
  if (paid || status === "paid") {
    return t("orderStatusPaid");
  }
  if (status === "refunded" || status === "partially_refunded") {
    return t("orderStatusRefunded");
  }
  if (status === "pending") {
    return t("orderStatusPending");
  }
  return status;
}

export function OrderHistory() {
  const { t, i18n } = useTranslation("billing");
  const { items, isPending, isError, refetch, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useBillingHistory();

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-medium tracking-tight">{t("orderHistoryTitle")}</h2>

      {isPending ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      ) : null}

      {isError ? (
        <ErrorState
          card
          description={t("ordersLoadFailed")}
          onRetry={async () => {
            await refetch();
          }}
        />
      ) : null}

      {!isPending && !isError && items.length === 0 ? (
        <p className="rounded-2xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          {t("ordersEmpty")}
        </p>
      ) : null}

      {!isPending && !isError && items.length > 0 ? (
        <div className="rounded-2xl ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("orderDescription")}</TableHead>
                <TableHead>{t("orderStatus")}</TableHead>
                <TableHead>{t("orderDate")}</TableHead>
                <TableHead className="text-right">{t("orderAmount")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">{order.description}</TableCell>
                  <TableCell>
                    <Badge variant={order.paid ? "secondary" : "outline"}>
                      {orderStatusLabel(order.status, order.paid, t)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {formatBillingDate(order.createdAt, i18n.language) ?? t("dateUnknown")}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatBillingMoney(order.totalAmount, order.currency, i18n.language)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}

      {hasNextPage ? (
        <AsyncButton
          type="button"
          variant="outline"
          className="self-center"
          pending={isFetchingNextPage}
          onClick={async () => {
            await fetchNextPage();
          }}
        >
          {t("ordersLoadMore")}
        </AsyncButton>
      ) : null}
    </section>
  );
}
