import type { ReactNode } from "react";
import { Trans, useTranslation } from "react-i18next";

import { useUsageStats } from "@/hooks/billing/useUsageStats";

function BoldCount({ children }: { children?: ReactNode }) {
  return <span className="font-semibold">{children}</span>;
}

type GiftStatsKey = "giftStatsDownloads" | "giftStatsSelfHost" | "giftStatsClones";

/**
 * Data-backed tip copy. Prefers month downloads, week self-host clicks, week clones.
 * Falls back to the static giftBody when nothing meaningful is available.
 *
 * Resolve plurals/locale via `t()`, then let `Trans` swap `<bold>` tags for components
 * (avoids Trans plural fallback quirks with dynamic keys).
 */
export function GiftTipStats() {
  const { t } = useTranslation("billing");
  const { data } = useUsageStats();

  if (!data?.enabled) {
    return <p className="text-sm text-muted-foreground">{t("giftBody")}</p>;
  }

  const lines: Array<{ key: GiftStatsKey; count: number }> = [];
  if (data.downloads.month > 0) {
    lines.push({ key: "giftStatsDownloads", count: data.downloads.month });
  }
  if (data.selfHostClicks.week > 0) {
    lines.push({ key: "giftStatsSelfHost", count: data.selfHostClicks.week });
  }
  if (data.clones.week > 0) {
    lines.push({ key: "giftStatsClones", count: data.clones.week });
  }

  if (lines.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("giftBody")}</p>;
  }

  return (
    <div className="flex flex-col gap-1 text-sm text-muted-foreground">
      {lines.map(({ key, count }) => (
        <p key={key}>
          <Trans defaults={t(key, { count })} components={{ bold: <BoldCount /> }} />
        </p>
      ))}
      <p>{t("giftStatsCloser")}</p>
    </div>
  );
}
