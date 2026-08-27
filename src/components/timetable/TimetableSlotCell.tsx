import { Check, Link2, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FontAwesomeIconFromId } from "@/components/icons/FontAwesomeIconFromId";
import {
  COMPACT_SLOT_MAX_MINUTES,
  SLOT_MIN_HEIGHT_REM,
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
  onToggleWeekDisable?: () => void;
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
  onToggleWeekDisable,
}: TimetableSlotCellProps) {
  const { t } = useTranslation("timetable");
  const duration = slotDurationMinutes(slot.startTime, slot.endTime);
  const compact = duration < COMPACT_SLOT_MAX_MINUTES;
  const isDisabled = slot.disabled || isDisabledForWeek;

  return (
    <div
      className={cn(
        "rounded-md border px-1.5 py-1 shadow-sm transition-colors flex flex-col gap-1 relative group/slot",
        isDisabled
          ? "border-destructive/40 bg-destructive/10 opacity-50"
          : "border-primary/30 bg-primary/5 hover:bg-primary/10",
      )}
      style={{ minHeight: `${SLOT_MIN_HEIGHT_REM}rem` }}
    >
      {!compact ? (
        <div className="text-[10px] font-medium text-muted-foreground px-0.5">
          {formatTimeString(slot.startTime, timeFormat)} –{" "}
          {formatTimeString(slot.endTime, timeFormat)}
        </div>
      ) : null}

      <div className="flex flex-col gap-1 flex-1 min-w-0">
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
                    className="text-xs text-muted-foreground hover:text-foreground w-full text-left px-1 py-0.5 rounded border border-dashed border-muted-foreground/30 hover:border-muted-foreground/50 opacity-100 md:opacity-0 md:group-hover/slot:opacity-100"
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

      {canManage && (onEditSlot || onToggleWeekDisable) ? (
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
              <DropdownMenuItem onClick={onEditSlot}>{t("editSlot")}</DropdownMenuItem>
            ) : null}
            {onToggleWeekDisable ? (
              <DropdownMenuItem onClick={onToggleWeekDisable}>
                {isDisabledForWeek ? t("enableSlotThisWeek") : t("disableSlotThisWeek")}
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
    <span className="flex items-center gap-2 min-w-0">
      {subject.iconName ? (
        <FontAwesomeIconFromId
          id={subject.iconName}
          className="h-4 w-4 shrink-0"
          style={{ color: subject.textColor }}
        />
      ) : (
        <span
          className="size-2 rounded-full shrink-0"
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
  const subject = lesson.subject;
  const hasLinks = lesson.links.length > 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "text-left rounded-md flex items-center gap-1.5 shadow-sm border border-white/20 w-full hover:opacity-90 transition-opacity",
        compact ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-1.5",
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
      <span className="font-medium truncate flex-1">{subject.name}</span>
      {hasLinks ? (
        <Link2 className={cn("shrink-0 opacity-80", compact ? "h-3 w-3" : "h-3.5 w-3.5")} />
      ) : null}
      {canManage ? (
        <span
          role="button"
          tabIndex={0}
          className="shrink-0 opacity-0 group-hover/slot:opacity-100 hover:opacity-100 p-0.5"
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
