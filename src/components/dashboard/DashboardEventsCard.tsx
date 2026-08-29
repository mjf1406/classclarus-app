import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { DashboardSectionCard } from "@/components/dashboard/DashboardSectionCard";
import { useCalendarEventsInRange } from "@/hooks/calendar/useCalendarEventsInRange";
import {
  eventStartDateKey,
  formatDateKeyMonthDay,
  formatEventTimeLabel,
} from "@/lib/calendar/calendar";
import { dashboardEventRange, upcomingDashboardEvents } from "@/lib/dashboard/dashboard";
import { toIntlLocale } from "@/lib/languages";
import type { Id } from "../../../convex/_generated/dataModel";

type DashboardEventsCardProps = {
  classId: Id<"classes">;
  timeZone: string;
  classPending: boolean;
};

export function DashboardEventsCard({ classId, timeZone, classPending }: DashboardEventsCardProps) {
  const { t, i18n } = useTranslation("classes");
  const [nowMs] = useState(() => Date.now());
  const eventRange = useMemo(() => dashboardEventRange(nowMs), [nowMs]);
  const query = useCalendarEventsInRange(classId, eventRange.rangeStartMs, eventRange.rangeEndMs);
  const isPending = classPending || query.isPending;
  const events = useMemo(
    () => upcomingDashboardEvents(query.data ?? [], nowMs, timeZone),
    [nowMs, query.data, timeZone],
  );
  const empty = !isPending && !query.isError && events.length === 0;
  const locale = toIntlLocale(i18n.language);

  return (
    <DashboardSectionCard
      title={t("dashboardEventsTitle")}
      viewAllLabel={t("dashboardViewAll")}
      viewAllTo="/class/$classId/calendar"
      viewAllParams={{ classId }}
      isPending={isPending}
      isError={query.isError}
      errorTitle={t("dashboardLoadFailed")}
      errorDescription={t("dashboardLoadFailedDescription")}
      onRetry={() => void query.refetch()}
      empty={empty}
      emptyTitle={t("dashboardNoEventsTitle")}
      emptyDescription={t("dashboardNoEventsDescription")}
    >
      {events.map((event) => {
        const dateParts = formatDateKeyMonthDay(eventStartDateKey(event, timeZone), locale);
        const whenLabel = formatEventTimeLabel(event, timeZone, locale, { includeDate: true });

        return (
          <Link
            key={event._id}
            to="/class/$classId/calendar/event/$eventId"
            params={{ classId, eventId: event._id }}
            className="flex items-start gap-3 rounded-xl border px-3 py-2 transition-colors hover:bg-accent/40"
          >
            {dateParts ? (
              <span
                aria-hidden="true"
                className="flex w-11 shrink-0 flex-col items-center rounded-lg bg-muted px-1 py-1.5"
              >
                <span className="text-[10px] font-semibold uppercase leading-none text-muted-foreground">
                  {dateParts.month}
                </span>
                <span className="mt-0.5 text-base font-semibold leading-none tabular-nums">
                  {dateParts.day}
                </span>
              </span>
            ) : null}
            <span className="flex min-w-0 flex-col gap-1">
              <span className="text-sm font-medium">{event.title}</span>
              <span className="text-xs text-muted-foreground">{whenLabel}</span>
            </span>
          </Link>
        );
      })}
    </DashboardSectionCard>
  );
}
