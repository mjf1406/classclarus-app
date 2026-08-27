import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { TimetableSlotCell } from "@/components/timetable/TimetableSlotCell";
import {
  PIXELS_PER_MINUTE,
  type TimetableLesson,
  type TimetableSlot,
  type TimetableSubject,
  type TimetableWeekBundle,
} from "@/lib/timetable/timetable";
import { formatTimeString, sortSlotsByTime, timeToMinutes } from "@/lib/timetable/utils";
import type { Id } from "../../../convex/_generated/dataModel";

type TimetableWeekGridProps = {
  bundle: TimetableWeekBundle;
  days: Array<string>;
  canManage: boolean;
  timeFormat?: "12" | "24";
  onAddSubject: (slotId: Id<"timetableSlots">, subjectId: Id<"timetableSubjects">) => void;
  onLessonClick: (lesson: TimetableLesson) => void;
  onRemoveLesson: (lessonId: Id<"timetableLessons">) => void;
  onEditSlot: (slot: TimetableSlot) => void;
  onToggleWeekDisable: (slotId: Id<"timetableSlots">, disabled: boolean) => void;
};

type StackedSegment =
  | { kind: "gap"; heightPx: number }
  | { kind: "slot"; slot: TimetableSlot; heightPx: number };

function buildStackedSegments(
  slots: Array<TimetableSlot>,
  dayStartMinutes: number,
  dayEndMinutes: number,
): Array<StackedSegment> {
  const sorted = sortSlotsByTime(slots);
  const segments: Array<StackedSegment> = [];
  let cursor = dayStartMinutes;

  for (const slot of sorted) {
    const start = timeToMinutes(slot.startTime);
    const end = timeToMinutes(slot.endTime);
    if (end <= dayStartMinutes || start >= dayEndMinutes) continue;

    const gapMinutes = Math.max(0, start - cursor);
    if (gapMinutes > 0) {
      segments.push({ kind: "gap", heightPx: gapMinutes * PIXELS_PER_MINUTE });
    }

    const slotDuration = Math.max(end - start, 1);
    segments.push({
      kind: "slot",
      slot,
      heightPx: Math.max(slotDuration * PIXELS_PER_MINUTE, 44),
    });
    cursor = Math.max(cursor, end);
  }

  const tailGap = Math.max(0, dayEndMinutes - cursor);
  if (tailGap > 0) {
    segments.push({ kind: "gap", heightPx: tailGap * PIXELS_PER_MINUTE });
  }

  return segments;
}

export function TimetableWeekGrid({
  bundle,
  days,
  canManage,
  timeFormat = "24",
  onAddSubject,
  onLessonClick,
  onRemoveLesson,
  onEditSlot,
  onToggleWeekDisable,
}: TimetableWeekGridProps) {
  const { t } = useTranslation("timetable");
  const dayStartMinutes = timeToMinutes(bundle.term.startTime);
  const dayEndMinutes = timeToMinutes(bundle.term.endTime);
  const totalDuration = dayEndMinutes - dayStartMinutes;
  const gridHeight = totalDuration * PIXELS_PER_MINUTE;

  const slotsByDay = useMemo(() => {
    const grouped: Record<string, Array<TimetableSlot>> = {};
    for (const day of days) {
      grouped[day] = bundle.slots.filter((slot: TimetableSlot) => slot.day === day);
    }
    return grouped;
  }, [bundle.slots, days]);

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

  const timeLabels = useMemo(() => {
    const labels: Array<{ topPx: number; label: string }> = [];
    for (let m = dayStartMinutes; m <= dayEndMinutes; m += 30) {
      labels.push({
        topPx: (m - dayStartMinutes) * PIXELS_PER_MINUTE,
        label: formatTimeString(
          `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`,
          timeFormat,
        ),
      });
    }
    return labels;
  }, [dayEndMinutes, dayStartMinutes, timeFormat]);

  const availableSubjectsForSlot = (slotId: Id<"timetableSlots">): Array<TimetableSubject> => {
    const used = new Set((lessonsBySlot.get(slotId) ?? []).map((l) => l.subjectId));
    return bundle.subjects.filter((s: TimetableSubject) => !used.has(s._id));
  };

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-[720px]">
        <div
          className="grid border-b bg-muted/50"
          style={{ gridTemplateColumns: `80px repeat(${days.length}, 1fr)` }}
        >
          <div className="border-r p-2 text-sm font-medium">{t("timeColumn")}</div>
          {days.map((day) => (
            <div key={day} className="border-r p-2 text-center text-sm font-medium last:border-r-0">
              {day}
            </div>
          ))}
        </div>

        <div className="relative flex" style={{ height: `${gridHeight}px` }}>
          <div className="w-20 shrink-0 border-r bg-muted/30 relative">
            {timeLabels.map((item) => (
              <div
                key={item.topPx}
                className="absolute left-0 right-0 px-1 text-[10px] text-muted-foreground -translate-y-1/2"
                style={{ top: item.topPx }}
              >
                {item.label}
              </div>
            ))}
          </div>

          <div
            className="grid flex-1"
            style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}
          >
            {days.map((day) => {
              const segments = buildStackedSegments(
                slotsByDay[day] ?? [],
                dayStartMinutes,
                dayEndMinutes,
              );
              return (
                <div key={day} className="border-r last:border-r-0 relative px-1 py-0">
                  <div className="flex flex-col h-full">
                    {segments.map((segment, index) =>
                      segment.kind === "gap" ? (
                        <div
                          key={`gap-${index}`}
                          style={{ height: segment.heightPx }}
                          aria-hidden
                        />
                      ) : (
                        <div
                          key={segment.slot._id}
                          style={{ height: segment.heightPx }}
                          className="py-0.5"
                        >
                          <TimetableSlotCell
                            slot={segment.slot}
                            lessons={lessonsBySlot.get(segment.slot._id) ?? []}
                            availableSubjects={availableSubjectsForSlot(segment.slot._id)}
                            isDisabledForWeek={disabledSet.has(segment.slot._id)}
                            canManage={canManage}
                            timeFormat={timeFormat}
                            onAddSubject={(subjectId) => onAddSubject(segment.slot._id, subjectId)}
                            onLessonClick={onLessonClick}
                            onRemoveLesson={onRemoveLesson}
                            onEditSlot={canManage ? () => onEditSlot(segment.slot) : undefined}
                            onToggleWeekDisable={
                              canManage
                                ? () =>
                                    onToggleWeekDisable(
                                      segment.slot._id,
                                      !disabledSet.has(segment.slot._id),
                                    )
                                : undefined
                            }
                          />
                        </div>
                      ),
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
