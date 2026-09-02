import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { DashboardSectionCard } from "@/components/dashboard/DashboardSectionCard";
import { FontAwesomeIconFromId } from "@/components/icons/FontAwesomeIconFromId";
import { Badge } from "@/components/ui/badge";
import { useTimetableTerms, useTimetableWeekBundle } from "@/hooks/timetable/useTimetableQueries";
import { formatLocalizedTimeRange } from "@/i18n/formatDate";
import { toIntlLocale } from "@/lib/languages";
import { classNowDateKey } from "../../../convex/lib/calendar/monthGrid";
import { utcMsToZonedParts } from "../../../convex/lib/calendar/timeZone";
import {
  getIsoWeekYearAndNumberFromDateKey,
  weekdayNameFromDateKey,
} from "../../../convex/lib/timetable/timetableSchema";
import { findTermForDateKey, lessonPeriodStatus } from "@/lib/dashboard/dashboard";
import { sortSlotsByTime } from "@/lib/timetable/utils";
import type { Id } from "../../../convex/_generated/dataModel";

type DashboardTodayLessonsCardProps = {
  classId: Id<"classes">;
  timeZone: string;
  classPending: boolean;
};

export function DashboardTodayLessonsCard({
  classId,
  timeZone,
  classPending,
}: DashboardTodayLessonsCardProps) {
  const { t, i18n } = useTranslation("classes");
  const nowMs = useMemo(() => Date.now(), []);
  const todayKey = useMemo(() => classNowDateKey(nowMs, timeZone), [nowMs, timeZone]);
  const weekday = useMemo(() => weekdayNameFromDateKey(todayKey), [todayKey]);
  const week = useMemo(() => getIsoWeekYearAndNumberFromDateKey(todayKey), [todayKey]);
  const nowTimeHm = useMemo(() => utcMsToZonedParts(nowMs, timeZone).timeHm, [nowMs, timeZone]);

  const termsQuery = useTimetableTerms(classId);
  const term = useMemo(
    () => findTermForDateKey(termsQuery.data ?? [], todayKey),
    [termsQuery.data, todayKey],
  );
  const bundleQuery = useTimetableWeekBundle(classId, term?._id, week.year, week.weekNumber);

  const lessons = useMemo(() => {
    const bundle = bundleQuery.data;
    if (!bundle) return [];
    const disabled = new Set(bundle.disabledSlotIds);
    const daySlots = sortSlotsByTime(
      bundle.slots.filter(
        (slot) => slot.day === weekday && !slot.disabled && !disabled.has(slot._id),
      ),
    );
    return daySlots.flatMap((slot) => {
      const lesson = bundle.lessons.find((item) => item.slotId === slot._id);
      if (!lesson) return [];
      return [
        {
          slot,
          lesson,
          status: lessonPeriodStatus(slot.startTime, slot.endTime, nowTimeHm),
        },
      ];
    });
  }, [bundleQuery.data, nowTimeHm, weekday]);

  const isPending =
    classPending || termsQuery.isPending || (term !== undefined && bundleQuery.isPending);
  const isError = termsQuery.isError || bundleQuery.isError;
  const empty = !isPending && !isError && lessons.length === 0;

  return (
    <DashboardSectionCard
      title={t("dashboardTodayLessonsTitle")}
      viewAllLabel={t("dashboardViewAll")}
      viewAllTo="/class/$classId/timetable"
      viewAllParams={{ classId }}
      isPending={isPending}
      isError={isError}
      errorTitle={t("dashboardLoadFailed")}
      errorDescription={t("dashboardLoadFailedDescription")}
      onRetry={() => {
        void termsQuery.refetch();
        void bundleQuery.refetch();
      }}
      empty={empty}
      emptyTitle={t("dashboardTodayLessonsEmptyTitle")}
      emptyDescription={t("dashboardTodayLessonsEmptyDescription")}
    >
      {lessons.map(({ slot, lesson, status }) => (
        <div
          key={slot._id}
          className="flex items-center gap-2 rounded-xl px-3 py-2"
          style={{
            backgroundColor: lesson.subject.bgColor,
            color: lesson.subject.textColor,
          }}
        >
          {lesson.subject.iconName ? (
            <span
              className="inline-flex size-8 shrink-0 items-center justify-center"
              style={{ fontSize: 24 }}
            >
              <FontAwesomeIconFromId id={lesson.subject.iconName} />
            </span>
          ) : (
            <span
              className="size-8 shrink-0 rounded-full ring-2 ring-white/30"
              style={{ backgroundColor: lesson.subject.textColor }}
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{lesson.subject.name}</p>
            <p className="truncate text-xs font-medium tabular-nums opacity-90">
              {formatLocalizedTimeRange(
                slot.startTime,
                slot.endTime,
                "24",
                toIntlLocale(i18n.language),
              )}
            </p>
          </div>
          <Badge variant={status === "current" ? "default" : "secondary"}>
            {status === "past"
              ? t("dashboardLessonPast")
              : status === "current"
                ? t("dashboardLessonCurrent")
                : t("dashboardLessonUpcoming")}
          </Badge>
        </div>
      ))}
    </DashboardSectionCard>
  );
}
