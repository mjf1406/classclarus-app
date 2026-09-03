import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { MoreHorizontal, SquareCheck, SquareX } from "lucide-react";
import { useTranslation } from "react-i18next";

import { TimetableSlotCell } from "@/components/timetable/TimetableSlotCell";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  type TimetableLesson,
  type TimetableSlot,
  type TimetableSubject,
  type TimetableWeekBundle,
} from "@/lib/timetable/timetable";
import {
  buildTimeLabels,
  getSlotLayout,
  layoutOverlappingSlots,
  minutesToHm,
  pixelsPerMinuteForAvailableHeight,
} from "@/lib/timetable/timelineLayout";
import {
  formatDayDate,
  formatTimeString,
  formatWeekdayHeader,
  formatWeekdayName,
  timeToMinutes,
  weekdayFromDate,
} from "@/lib/timetable/utils";
import { isSlotElapsed } from "../../../convex/lib/timetable/slotTiming";
import { isWeekdayName } from "../../../convex/lib/timetable/slotDisableScope";
import { cn } from "@/lib/utils";
import type { Id } from "../../../convex/_generated/dataModel";

type TimetableTimelineGridProps = {
  bundle: TimetableWeekBundle;
  days: Array<string>;
  weekStart: Date;
  locale: string;
  view: "week" | "day";
  currentDate?: Date;
  canManage: boolean;
  timeFormat?: "12" | "24";
  onAddSubject: (slotId: Id<"timetableSlots">, subjectId: Id<"timetableSubjects">) => void;
  onLessonClick: (lesson: TimetableLesson) => void;
  onRemoveLesson: (lessonId: Id<"timetableLessons">) => void;
  onEditSlot: (slot: TimetableSlot) => void;
  onDeleteSlot: (slot: TimetableSlot) => void;
  onLinkSlot: (slot: TimetableSlot) => void;
  onUnlinkSlot: (slot: TimetableSlot) => void;
  onDisableSlot: (slot: TimetableSlot) => void;
  onEnableSlot: (slot: TimetableSlot) => void;
  onDisableDay: (day: string) => void;
  onEnableDay: (day: string) => void;
  onMoveLesson: (lesson: TimetableLesson) => void;
  onAddParallelSlot: (slot: TimetableSlot) => void;
  year: number;
  weekNumber: number;
  nowMs: number;
  timeZone: string;
};

export function TimetableTimelineGrid({
  bundle,
  days,
  weekStart,
  locale,
  view,
  currentDate,
  canManage,
  timeFormat = "24",
  onAddSubject,
  onLessonClick,
  onRemoveLesson,
  onEditSlot,
  onDeleteSlot,
  onLinkSlot,
  onUnlinkSlot,
  onDisableSlot,
  onEnableSlot,
  onDisableDay,
  onEnableDay,
  onMoveLesson,
  onAddParallelSlot,
  year,
  weekNumber,
  nowMs,
  timeZone,
}: TimetableTimelineGridProps) {
  const { t } = useTranslation("timetable");
  const scrollRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const [availableBodyHeight, setAvailableBodyHeight] = useState(0);

  const dayStartMinutes = timeToMinutes(bundle.term.startTime);
  const dayEndMinutes = timeToMinutes(bundle.term.endTime);
  const totalDuration = Math.max(dayEndMinutes - dayStartMinutes, 1);
  const pixelsPerMinute = pixelsPerMinuteForAvailableHeight(totalDuration, availableBodyHeight);
  const gridHeight = Math.floor(totalDuration * pixelsPerMinute);
  const needsVerticalScroll = availableBodyHeight > 0 && gridHeight > availableBodyHeight;

  const displayDays = useMemo(() => {
    if (view === "day" && currentDate) {
      const dayName = weekdayFromDate(currentDate);
      return days.includes(dayName) ? [dayName] : [];
    }
    return days;
  }, [currentDate, days, view]);

  const slotsByDay = useMemo(() => {
    const grouped: Record<string, Array<TimetableSlot>> = {};
    for (const day of displayDays) {
      grouped[day] = bundle.slots.filter((slot: TimetableSlot) => slot.day === day);
    }
    return grouped;
  }, [bundle.slots, displayDays]);

  const overlapByDay = useMemo(() => {
    const map = new Map<string, ReturnType<typeof layoutOverlappingSlots>>();
    for (const day of displayDays) {
      const daySlots = slotsByDay[day] ?? [];
      map.set(
        day,
        layoutOverlappingSlots(
          daySlots.map((slot) => ({
            id: slot._id,
            startTime: slot.startTime,
            endTime: slot.endTime,
          })),
        ),
      );
    }
    return map;
  }, [displayDays, slotsByDay]);

  const lessonsBySlot = useMemo(() => {
    const map = new Map<Id<"timetableSlots">, Array<TimetableLesson>>();
    for (const lesson of bundle.lessons) {
      const list = map.get(lesson.slotId) ?? [];
      list.push(lesson);
      map.set(lesson.slotId, list);
    }
    return map;
  }, [bundle.lessons]);

  const disabledSet = useMemo(() => new Set(bundle.disabledSlotIds), [bundle.disabledSlotIds]);

  const timeLabels = useMemo(
    () =>
      buildTimeLabels(
        dayStartMinutes,
        dayEndMinutes,
        (minutes) => formatTimeString(minutesToHm(minutes), timeFormat),
        30,
        pixelsPerMinute,
      ),
    [dayEndMinutes, dayStartMinutes, pixelsPerMinute, timeFormat],
  );

  useLayoutEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;

    const update = () => {
      const headerHeight = headerRef.current?.offsetHeight ?? 0;
      setAvailableBodyHeight(Math.max(0, scrollEl.clientHeight - headerHeight));
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(scrollEl);
    if (headerRef.current) observer.observe(headerRef.current);
    return () => observer.disconnect();
  }, []);

  const availableSubjectsForSlot = (slotId: Id<"timetableSlots">): Array<TimetableSubject> => {
    const used = new Set((lessonsBySlot.get(slotId) ?? []).map((l) => l.subjectId));
    return bundle.subjects.filter((s: TimetableSubject) => !used.has(s._id));
  };

  const timeColumnWidth = timeFormat === "12" ? "96px" : "80px";

  if (view === "day" && currentDate && displayDays.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-lg border p-8 text-sm text-muted-foreground">
        {formatDayDate(currentDate, locale)}
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className={cn(
        "h-full min-h-0 overflow-x-auto",
        needsVerticalScroll ? "overflow-y-auto" : "overflow-y-hidden",
      )}
    >
      <div
        className={
          view === "week"
            ? "flex min-h-full min-w-[720px] flex-col"
            : "flex min-h-full min-w-full flex-col"
        }
      >
        <div
          ref={headerRef}
          className="sticky top-0 z-20 grid border-b bg-muted/50"
          style={{ gridTemplateColumns: `${timeColumnWidth} repeat(${displayDays.length}, 1fr)` }}
        >
          <div className="border-r px-3 py-2.5 text-sm font-medium">{t("timeColumn")}</div>
          {displayDays.map((day) => (
            <div
              key={day}
              className="relative border-r px-3 py-2.5 pr-8 text-center text-sm font-medium last:border-r-0"
            >
              {view === "week"
                ? formatWeekdayHeader(day, weekStart, locale)
                : currentDate
                  ? formatDayDate(currentDate, locale)
                  : formatWeekdayName(day, locale)}
              {canManage ? (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute top-1 right-1 h-6 w-6"
                        aria-label={t("dayActions")}
                      />
                    }
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onDisableDay(day)}>
                      <SquareX className="h-4 w-4" />
                      {t("disableDayAction")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onEnableDay(day)}>
                      <SquareCheck className="h-4 w-4" />
                      {t("enableDayAction")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </div>
          ))}
        </div>

        <div className="relative overflow-hidden" style={{ height: `${gridHeight}px` }}>
          <div className="pointer-events-none absolute inset-0">
            {timeLabels.map((item) => (
              <div
                key={`line-${item.topPx}`}
                className="absolute right-0 left-0 border-t border-border/70"
                style={{ top: Math.min(item.topPx, Math.max(gridHeight - 1, 0)) }}
              />
            ))}
          </div>

          <div
            className="absolute top-0 bottom-0 left-0 z-10 border-r bg-muted/30"
            style={{ width: timeColumnWidth }}
          >
            {timeLabels.map((item, index) => (
              <div
                key={item.topPx}
                className={cn(
                  "absolute right-0 left-0 pr-2 text-right text-[10px] leading-none whitespace-nowrap text-muted-foreground",
                  index === 0
                    ? null
                    : index === timeLabels.length - 1
                      ? "-translate-y-full"
                      : "-translate-y-1/2",
                )}
                style={{ top: item.topPx }}
              >
                {item.label}
              </div>
            ))}
          </div>

          <div
            className="absolute top-0 right-0 bottom-0 grid"
            style={{
              left: timeColumnWidth,
              gridTemplateColumns: `repeat(${displayDays.length}, 1fr)`,
            }}
          >
            {displayDays.map((day) => (
              <div key={day} className="relative border-r px-1 last:border-r-0">
                {(slotsByDay[day] ?? []).map((slot) => {
                  const layout = getSlotLayout(
                    slot.startTime,
                    slot.endTime,
                    dayStartMinutes,
                    dayEndMinutes,
                    pixelsPerMinute,
                  );
                  if (!layout) return null;
                  const overlap = overlapByDay.get(day)?.get(slot._id);
                  const columnCount = overlap?.columnCount ?? 1;
                  const leftPct = overlap?.leftPct ?? 0;
                  const widthPct = overlap?.widthPct ?? 100;
                  const insetPx = 4;

                  return (
                    <div
                      key={slot._id}
                      className="absolute"
                      style={{
                        top: layout.topPx + 1,
                        height: Math.max(layout.heightPx - 2, 1),
                        left: `calc(${leftPct}% + ${insetPx}px)`,
                        width: `calc(${widthPct}% - ${insetPx * 2}px)`,
                      }}
                    >
                      <TimetableSlotCell
                        slot={slot}
                        lessons={lessonsBySlot.get(slot._id) ?? []}
                        availableSubjects={availableSubjectsForSlot(slot._id)}
                        isDisabledForWeek={disabledSet.has(slot._id)}
                        canManage={canManage}
                        timeFormat={timeFormat}
                        narrow={columnCount > 1}
                        onAddSubject={(subjectId) => onAddSubject(slot._id, subjectId)}
                        onLessonClick={onLessonClick}
                        onRemoveLesson={onRemoveLesson}
                        onMoveLesson={canManage ? onMoveLesson : undefined}
                        onAddParallelSlot={canManage ? () => onAddParallelSlot(slot) : undefined}
                        onEditSlot={canManage ? () => onEditSlot(slot) : undefined}
                        onDeleteSlot={canManage ? () => onDeleteSlot(slot) : undefined}
                        onLinkSlot={canManage ? () => onLinkSlot(slot) : undefined}
                        onUnlinkSlot={
                          canManage && slot.linkGroupId ? () => onUnlinkSlot(slot) : undefined
                        }
                        onDisableSlot={canManage ? () => onDisableSlot(slot) : undefined}
                        onEnableSlot={canManage ? () => onEnableSlot(slot) : undefined}
                        isElapsed={
                          isWeekdayName(slot.day) &&
                          isSlotElapsed({
                            day: slot.day,
                            endTime: slot.endTime,
                            year,
                            weekNumber,
                            nowMs,
                            timeZone,
                          })
                        }
                      />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** @deprecated Use TimetableTimelineGrid */
export const TimetableWeekGrid = TimetableTimelineGrid;
