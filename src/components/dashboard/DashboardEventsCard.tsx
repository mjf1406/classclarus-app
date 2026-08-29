import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { DashboardSectionCard } from "@/components/dashboard/DashboardSectionCard";
import { formatEventTimeLabel } from "@/lib/calendar/calendar";
import type { CalendarEvent } from "@/lib/calendar/calendar";
import type { Id } from "../../../convex/_generated/dataModel";

type DashboardEventsCardProps = {
  classId: Id<"classes">;
  events: CalendarEvent[];
  timeZone: string;
  locale: string;
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
};

export function DashboardEventsCard({
  classId,
  events,
  timeZone,
  locale,
  isPending,
  isError,
  onRetry,
}: DashboardEventsCardProps) {
  const { t } = useTranslation("classes");
  const empty = !isPending && !isError && events.length === 0;

  return (
    <DashboardSectionCard
      title={t("dashboardEventsTitle")}
      viewAllLabel={t("dashboardViewAll")}
      viewAllTo="/class/$classId/calendar"
      viewAllParams={{ classId }}
      isPending={isPending}
      isError={isError}
      errorTitle={t("dashboardLoadFailed")}
      errorDescription={t("dashboardLoadFailedDescription")}
      onRetry={onRetry}
      empty={empty}
      emptyTitle={t("dashboardNoEventsTitle")}
      emptyDescription={t("dashboardNoEventsDescription")}
    >
      {events.map((event) => (
        <Link
          key={event._id}
          to="/class/$classId/calendar/event/$eventId"
          params={{ classId, eventId: event._id }}
          className="flex flex-col gap-1 rounded-xl border px-3 py-2 transition-colors hover:bg-accent/40"
        >
          <span className="text-sm font-medium">{event.title}</span>
          <span className="text-xs text-muted-foreground">
            {formatEventTimeLabel(event, timeZone, locale)}
          </span>
        </Link>
      ))}
    </DashboardSectionCard>
  );
}
