import { useLayoutEffect, useRef, useState } from "react";
import {
  Check,
  Link2,
  MoreHorizontal,
  Pencil,
  Plus,
  SquareCheck,
  SquareX,
  Trash2,
  Unlink,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FontAwesomeIconFromId } from "@/components/icons/FontAwesomeIconFromId";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  COMPACT_SLOT_MAX_MINUTES,
  type TimetableLesson,
  type TimetableSlot,
  type TimetableSubject,
} from "@/lib/timetable/timetable";
import { formatTimeString, slotDurationMinutes } from "@/lib/timetable/utils";
import { cn } from "@/lib/utils";

type TimetableSlotCellProps = {
  slot: TimetableSlot;
  lessons: Array<TimetableLesson>;
  availableSubjects: Array<TimetableSubject>;
  isDisabledForWeek: boolean;
  canManage: boolean;
  timeFormat?: "12" | "24";
  onAddSubject: (subjectId: TimetableSubject["_id"]) => void;
  onLessonClick: (lesson: TimetableLesson) => void;
  onRemoveLesson: (lessonId: TimetableLesson["_id"]) => void;
  onEditSlot?: () => void;
  onDeleteSlot?: () => void;
  onLinkSlot?: () => void;
  onUnlinkSlot?: () => void;
  onDisableSlot?: () => void;
  onEnableSlot?: () => void;
  isElapsed?: boolean;
};

export function TimetableSlotCell({
  slot,
  lessons,
  availableSubjects,
  isDisabledForWeek,
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
  isElapsed = false,
}: TimetableSlotCellProps) {
  const { t } = useTranslation("timetable");
  const duration = slotDurationMinutes(slot.startTime, slot.endTime);
  const compact = duration < COMPACT_SLOT_MAX_MINUTES;
  const isDisabled = slot.disabled || isDisabledForWeek;
  const isLinked = Boolean(slot.linkGroupId);
  const showActions =
    canManage &&
    (onEditSlot || onDeleteSlot || onLinkSlot || onUnlinkSlot || onDisableSlot || onEnableSlot);

  return (
    <div
      className={cn(
        "group/slot relative flex h-full min-h-0 flex-col gap-1 overflow-hidden rounded-md border px-1.5 py-1 shadow-sm transition-colors",
        isDisabled
          ? "border-destructive/40 bg-card text-card-foreground opacity-50"
          : isLinked
            ? "border-primary/50 bg-card text-card-foreground ring-1 ring-primary/20 hover:bg-accent"
            : "border-primary/30 bg-card text-card-foreground hover:bg-accent",
        isElapsed && !isDisabled ? "opacity-50" : null,
      )}
    >
      {isElapsed ? <span className="sr-only">{t("pastSlot")}</span> : null}
      {!compact ? (
        <SlotTimeLabel
          startTime={slot.startTime}
          endTime={slot.endTime}
          timeFormat={timeFormat}
          isLinked={isLinked}
        />
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {lessons.map((lesson) => (
          <LessonChip
            key={lesson._id}
            lesson={lesson}
            compact={compact}
            canManage={canManage}
            onClick={() => onLessonClick(lesson)}
            onRemove={() => onRemoveLesson(lesson._id)}
          />
        ))}

        {canManage && !isDisabled && availableSubjects.length > 0 ? (
          compact ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0 self-start opacity-100 md:opacity-0 md:group-hover/slot:opacity-100"
                    aria-label={t("addSubject")}
                  />
                }
              >
                <Plus className="h-3.5 w-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {availableSubjects.map((subject) => (
                  <DropdownMenuItem key={subject._id} onClick={() => onAddSubject(subject._id)}>
                    <SubjectLabel subject={subject} />
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    className="w-full rounded border border-dashed border-muted-foreground/30 px-1 py-0.5 text-left text-xs text-muted-foreground opacity-100 hover:border-muted-foreground/50 hover:text-foreground md:opacity-0 md:group-hover/slot:opacity-100"
                  />
                }
              >
                {t("addSubject")}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {availableSubjects.map((subject) => (
                  <DropdownMenuItem key={subject._id} onClick={() => onAddSubject(subject._id)}>
                    <SubjectLabel subject={subject} />
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        ) : null}
      </div>

      {showActions ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute top-0.5 right-0.5 h-6 w-6 opacity-0 group-hover/slot:opacity-100"
                aria-label={t("slotActions")}
              />
            }
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onEditSlot ? (
              <DropdownMenuItem onClick={onEditSlot}>
                <Pencil className="h-4 w-4" />
                {t("editSlot")}
              </DropdownMenuItem>
            ) : null}
            {onLinkSlot ? (
              <DropdownMenuItem onClick={onLinkSlot}>
                <Link2 className="h-4 w-4" />
                {t("linkSlotsAction")}
              </DropdownMenuItem>
            ) : null}
            {onUnlinkSlot && slot.linkGroupId ? (
              <DropdownMenuItem onClick={onUnlinkSlot}>
                <Unlink className="h-4 w-4" />
                {t("unlinkSlotAction")}
              </DropdownMenuItem>
            ) : null}
            {onDisableSlot ? (
              <DropdownMenuItem onClick={onDisableSlot}>
                <SquareX className="h-4 w-4" />
                {t("disableSlotAction")}
              </DropdownMenuItem>
            ) : null}
            {onEnableSlot ? (
              <DropdownMenuItem onClick={onEnableSlot}>
                <SquareCheck className="h-4 w-4" />
                {t("enableSlotAction")}
              </DropdownMenuItem>
            ) : null}
            {onDeleteSlot ? (
              <DropdownMenuItem variant="destructive" onClick={onDeleteSlot}>
                <Trash2 className="h-4 w-4" />
                {t("deleteSlotAction")}
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}

function SubjectLabel({ subject }: { subject: TimetableSubject }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      {subject.iconName ? (
        <FontAwesomeIconFromId id={subject.iconName} className="h-4 w-4 shrink-0 text-foreground" />
      ) : (
        <span
          className="size-2 shrink-0 rounded-full"
          style={{ backgroundColor: subject.bgColor }}
        />
      )}
      <span className="truncate">{subject.name}</span>
    </span>
  );
}

function LessonChip({
  lesson,
  compact,
  canManage,
  onClick,
  onRemove,
}: {
  lesson: TimetableLesson;
  compact: boolean;
  canManage: boolean;
  onClick: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation("timetable");
  const subject = lesson.subject;
  const hasContent =
    lesson.materials.length > 0 ||
    lesson.announcements.length > 0 ||
    lesson.agenda.length > 0 ||
    lesson.upcomingEvents.length > 0 ||
    (Boolean(lesson.lessonUrl) && (canManage || lesson.lessonUrlShared === true)) ||
    (lesson.resources.length > 0 && (canManage || lesson.resourcesShared === true));

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-1.5 rounded-md border border-white/20 text-left shadow-sm transition-opacity hover:opacity-90",
        compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1.5 text-xs",
      )}
      style={{ backgroundColor: subject.bgColor, color: subject.textColor }}
    >
      {subject.iconName ? (
        <FontAwesomeIconFromId
          id={subject.iconName}
          className={cn("shrink-0", compact ? "h-3 w-3" : "h-4 w-4")}
        />
      ) : null}
      {lesson.complete ? (
        <Check className={cn("shrink-0", compact ? "h-3 w-3" : "h-4 w-4")} />
      ) : null}
      <span className="min-w-0 flex-1 truncate font-medium">{subject.name}</span>
      {hasContent ? (
        <Link2 className={cn("shrink-0 opacity-80", compact ? "h-3 w-3" : "h-3.5 w-3.5")} />
      ) : null}
      {canManage ? (
        <span
          role="button"
          tabIndex={0}
          className="shrink-0 p-0.5 opacity-0 hover:opacity-100 group-hover/slot:opacity-100"
          aria-label={t("deleteAction")}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.stopPropagation();
              onRemove();
            }
          }}
        >
          <Trash2 className="h-3 w-3" />
        </span>
      ) : null}
    </button>
  );
}

function SlotTimeLabel({
  startTime,
  endTime,
  timeFormat,
  isLinked,
}: {
  startTime: string;
  endTime: string;
  timeFormat: "12" | "24";
  isLinked: boolean;
}) {
  const { t } = useTranslation("timetable");
  const rowRef = useRef<HTMLDivElement>(null);
  const timesRef = useRef<HTMLSpanElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [showDuration, setShowDuration] = useState(false);
  const durationMinutes = slotDurationMinutes(startTime, endTime);
  const durationLabel = t("slotDurationMins", { count: durationMinutes });

  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row) return;

    const update = () => {
      const times = timesRef.current;
      const measure = measureRef.current;
      if (!times || !measure) {
        setShowDuration(false);
        return;
      }
      const styles = getComputedStyle(row);
      const gap = Number.parseFloat(styles.columnGap || styles.gap || "0") || 0;
      const iconWidth = isLinked ? 12 + gap : 0;
      const used = iconWidth + times.offsetWidth + gap;
      setShowDuration(row.clientWidth >= used + measure.offsetWidth);
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(row);
    return () => observer.disconnect();
  }, [durationLabel, isLinked, startTime, endTime, timeFormat]);

  return (
    <div
      ref={rowRef}
      className="relative flex min-w-0 items-center gap-1 overflow-hidden px-0.5 text-[10px] font-medium text-muted-foreground"
    >
      {isLinked ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <span className="inline-flex shrink-0">
                <Link2 className="h-3 w-3 text-primary" />
              </span>
            }
          />
          <TooltipContent>{t("linkedSlotTooltip")}</TooltipContent>
        </Tooltip>
      ) : null}
      <span ref={timesRef} className="shrink-0 whitespace-nowrap">
        {formatTimeString(startTime, timeFormat)} – {formatTimeString(endTime, timeFormat)}
      </span>
      {showDuration ? <span className="shrink-0 whitespace-nowrap">{durationLabel}</span> : null}
      <span
        ref={measureRef}
        className="pointer-events-none invisible absolute whitespace-nowrap"
        aria-hidden
      >
        {durationLabel}
      </span>
    </div>
  );
}
