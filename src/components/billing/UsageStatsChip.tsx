import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { useUsageStats, type UsageStatsSummary } from "@/hooks/billing/useUsageStats";
import type { StatsPeriod, UsageChip } from "../../../convex/lib/usageTracking";

const POPOVER_PERIODS: readonly StatsPeriod[] = ["week", "month", "year", "allTime"];

function PeriodChipLabel({ count, period }: UsageChip) {
  const { t } = useTranslation("billing");
  switch (period) {
    case "today":
      return t("usageChipToday", { count });
    case "week":
      return t("usageChipWeek", { count });
    case "twoWeeks":
      return t("usageChipTwoWeeks", { count });
    case "month":
      return t("usageChipMonth", { count });
    case "year":
      return t("usageChipYear", { count });
    case "allTime":
      return t("usageChipAllTime", { count });
  }
}

function periodHeading(t: (key: string) => string, period: StatsPeriod): string {
  switch (period) {
    case "week":
      return t("usagePeriodWeek");
    case "month":
      return t("usagePeriodMonth");
    case "year":
      return t("usagePeriodYear");
    case "allTime":
      return t("usagePeriodAllTime");
    default:
      return t("usagePeriodWeek");
  }
}

function ChipSkeleton() {
  return <Skeleton className="mx-auto h-5 w-28" />;
}

function UsageChipButton({
  chip,
  label,
}: {
  chip: UsageChip;
  label: (chip: UsageChip) => ReactNode;
}) {
  return (
    <PopoverTrigger
      render={
        <button
          type="button"
          className="inline-flex max-w-full cursor-pointer border-0 bg-transparent p-0"
        />
      }
    >
      <Badge variant="secondary" className="max-w-full whitespace-normal text-center font-normal">
        {label(chip)}
      </Badge>
    </PopoverTrigger>
  );
}

function DownloadPopoverBody({ data }: { data: UsageStatsSummary }) {
  const { t } = useTranslation("billing");
  return (
    <>
      <PopoverHeader>
        <PopoverTitle>{t("usageDownloadPopoverTitle")}</PopoverTitle>
        <PopoverDescription>{t("usageDownloadPopoverDescription")}</PopoverDescription>
      </PopoverHeader>
      <div className="flex flex-col gap-3">
        {POPOVER_PERIODS.map((period) => (
          <div key={period} className="flex flex-col gap-1">
            <p className="text-xs font-medium text-muted-foreground">{periodHeading(t, period)}</p>
            <p className="text-sm">
              {t("usageStatDownloads", { count: data.downloads[period] })}
              <span className="text-muted-foreground">
                {" "}
                (
                {t("usageStatDownloadsByOs", {
                  windows: data.downloadsByOs[period].windows,
                  mac: data.downloadsByOs[period].mac,
                  ubuntu: data.downloadsByOs[period].ubuntu,
                })}
                )
              </span>
            </p>
          </div>
        ))}
      </div>
    </>
  );
}

function SelfHostPopoverBody({ data }: { data: UsageStatsSummary }) {
  const { t } = useTranslation("billing");
  return (
    <>
      <PopoverHeader>
        <PopoverTitle>{t("usageSelfHostPopoverTitle")}</PopoverTitle>
        <PopoverDescription>{t("usageSelfHostPopoverDescription")}</PopoverDescription>
      </PopoverHeader>
      <div className="flex flex-col gap-3">
        {POPOVER_PERIODS.map((period) => (
          <div key={period} className="flex flex-col gap-1">
            <p className="text-xs font-medium text-muted-foreground">{periodHeading(t, period)}</p>
            <ul className="flex flex-col gap-0.5 text-sm">
              <li>{t("usageStatSelfHost", { count: data.selfHostClicks[period] })}</li>
              <li>{t("usageStatClones", { count: data.clones[period] })}</li>
            </ul>
          </div>
        ))}
      </div>
    </>
  );
}

export function DownloadUsageChip() {
  const { data, isPending } = useUsageStats();

  if (isPending) {
    return <ChipSkeleton />;
  }
  if (!data?.enabled || !data.downloadChip) {
    return null;
  }

  return (
    <Popover>
      <UsageChipButton chip={data.downloadChip} label={(chip) => <PeriodChipLabel {...chip} />} />
      <PopoverContent align="center" className="w-72 gap-3">
        <DownloadPopoverBody data={data} />
      </PopoverContent>
    </Popover>
  );
}

export function SelfHostUsageChip() {
  const { data, isPending } = useUsageStats();

  if (isPending) {
    return <ChipSkeleton />;
  }
  if (!data?.enabled || !data.selfHostChip) {
    return null;
  }

  return (
    <Popover>
      <UsageChipButton chip={data.selfHostChip} label={(chip) => <PeriodChipLabel {...chip} />} />
      <PopoverContent align="center" className="w-72 gap-3">
        <SelfHostPopoverBody data={data} />
      </PopoverContent>
    </Popover>
  );
}
