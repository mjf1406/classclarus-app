import type { CSSProperties } from "react";
import { ExternalLink, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { AnnouncementBody } from "@/components/announcements/AnnouncementBody";
import { FontAwesomeIconFromId } from "@/components/icons/FontAwesomeIconFromId";
import { TimetableAgendaItemView } from "@/components/timetable/TimetableAgendaItemView";
import { TimetableTaggedText } from "@/components/timetable/TimetableTaggedText";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAssignments } from "@/hooks/assignments/useAssignments";
import type { ClassroomLessonDisplay } from "@/hooks/classroomScreen/useClassroomScreenQueries";
import { useTasks } from "@/hooks/tasks/useTasks";
import { DEFAULT_CLOCK_SETTINGS } from "@/lib/classroomScreen/clockSettings";
import { eventDaysUntil, formatEventTimeLabel } from "@/lib/calendar/calendar";
import { toIntlLocale } from "@/lib/languages";
import { findAgendaResourceName } from "@/lib/timetable/agendaItems";
import { cn } from "@/lib/utils";
import type { Id } from "../../../convex/_generated/dataModel";
import { isValidHttpUrl } from "../../../convex/lib/timetable/timetableSchema";

type LessonDisplayPanelProps = {
  classId: Id<"classes">;
  lesson: ClassroomLessonDisplay | null;
  formattedDate: string;
  now?: Date;
  contentFontSize?: number;
  headingFontSize?: number;
  sectionHeadingFontSize?: number;
  quickText?: string | null;
  quickTextTitle?: string;
  onClearQuickText?: () => void;
  isClearingQuickText?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
};

export function LessonDisplayPanel({
  classId,
  lesson,
  formattedDate,
  now = new Date(),
  contentFontSize = DEFAULT_CLOCK_SETTINGS.displayContentFontSize,
  headingFontSize = DEFAULT_CLOCK_SETTINGS.displayHeadingFontSize,
  sectionHeadingFontSize = DEFAULT_CLOCK_SETTINGS.displaySectionHeadingFontSize,
  quickText,
  quickTextTitle,
  onClearQuickText,
  isClearingQuickText = false,
  emptyTitle,
  emptyDescription,
  className,
}: LessonDisplayPanelProps) {
  const { t, i18n } = useTranslation("classroomScreen");
  const { t: tTimetable } = useTranslation("timetable");
  const assignments = useAssignments(classId);
  const tasks = useTasks(classId);
  const locale = toIntlLocale(i18n.language);
  const headingStyle = { fontSize: `${headingFontSize}px` };
  const sectionHeadingStyle = { fontSize: `${sectionHeadingFontSize}px` };
  const bodyStyle = { fontSize: `${contentFontSize}px` };
  const visibleResources = lesson?.resources.filter((item) => isValidHttpUrl(item.url)) ?? [];
  const bodyClassName =
    "[&_.announcement-body]:text-[length:inherit] [&_.announcement-body_h2]:text-[1.25em] [&_.announcement-body_h3]:text-[1.1em]";

  if (lesson) {
    return (
      <div className={cn("flex h-full flex-col", className)}>
        <div
          className="flex items-center gap-4 border-b p-6"
          style={{
            backgroundColor: lesson.subjectBgColor,
            color: lesson.subjectTextColor,
          }}
        >
          {lesson.subjectIconName ? (
            <FontAwesomeIconFromId
              id={lesson.subjectIconName}
              className="shrink-0"
              style={{ fontSize: `${Math.max(headingFontSize * 2.5, 96)}px` }}
            />
          ) : (
            <span
              className="size-24 shrink-0 rounded-full ring-2 ring-white/30"
              style={{ backgroundColor: lesson.subjectTextColor }}
            />
          )}
          <div className="min-w-0">
            <h2 className="truncate font-bold" style={headingStyle}>
              {lesson.subjectName}
            </h2>
            <p className="opacity-90">{formattedDate}</p>
          </div>
        </div>
        <ScrollArea className="grow p-6">
          <div className="flex flex-col gap-6" style={bodyStyle}>
            {lesson.lessonUrl && isValidHttpUrl(lesson.lessonUrl) ? (
              <a
                href={lesson.lessonUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 font-medium text-primary underline-offset-4 hover:underline"
              >
                <ExternalLink className="h-4 w-4" />
                {tTimetable("openLessonUrl")}
              </a>
            ) : null}
            {visibleResources.length > 0 ? (
              <div className="flex flex-col gap-2">
                <h3 className="font-medium" style={sectionHeadingStyle}>
                  {tTimetable("resourcesSection")}
                </h3>
                <ol className="flex flex-col gap-1">
                  {visibleResources.map((item, index) => (
                    <li key={item.key}>
                      {index + 1}.{" "}
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        {item.label?.trim() || item.url}
                      </a>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
            <LessonSection
              title={tTimetable("materialsSection")}
              titleStyle={sectionHeadingStyle}
              empty={tTimetable("noMaterials")}
              items={lesson.materials}
            />
            <div className="flex flex-col gap-2">
              <h3 className="font-medium" style={sectionHeadingStyle}>
                {tTimetable("announcementsSection")}
              </h3>
              {lesson.upcomingEvents.length === 0 ? (
                <p className="text-muted-foreground">{tTimetable("noUpcomingEvents")}</p>
              ) : (
                <ol className="flex flex-col gap-1">
                  {lesson.upcomingEvents.map((event, index) => {
                    const daysUntil = eventDaysUntil(event, now.getTime(), lesson.timeZone);
                    const countdown =
                      daysUntil === null
                        ? null
                        : daysUntil === 0
                          ? t("eventCountdownToday")
                          : daysUntil === 1
                            ? t("eventCountdownTomorrow")
                            : t("eventCountdownInDays", { count: daysUntil });
                    return (
                      <li key={event._id}>
                        {index + 1}. {event.title}
                        {" — "}
                        {formatEventTimeLabel(event, lesson.timeZone, locale, {
                          includeDate: true,
                        })}
                        {countdown ? ` (${countdown})` : null}
                      </li>
                    );
                  })}
                </ol>
              )}
              {lesson.announcements.length > 0 ? (
                <LessonSection items={lesson.announcements} />
              ) : null}
            </div>
            <LessonSection
              title={tTimetable("agendaSection")}
              titleStyle={sectionHeadingStyle}
              empty={tTimetable("noAgenda")}
              items={lesson.agenda}
              classId={classId}
              assignments={assignments.data}
              tasks={tasks.data}
            />
          </div>
        </ScrollArea>
      </div>
    );
  }

  if (quickText) {
    return (
      <div className={cn("flex h-full flex-col", className)}>
        <div className="flex items-center justify-between border-b bg-muted/50 p-6">
          <div>
            <h2 className="font-bold text-foreground" style={headingStyle}>
              {quickTextTitle}
            </h2>
            <p className="text-muted-foreground">{formattedDate}</p>
          </div>
          {onClearQuickText ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClearQuickText}
              disabled={isClearingQuickText}
              title={t("clearQuickText")}
              aria-label={t("clearQuickText")}
            >
              <X className="h-6 w-6" />
            </Button>
          ) : null}
        </div>
        <ScrollArea className="grow p-6">
          {quickText.trim().startsWith("{") ? (
            <div className={bodyClassName} style={bodyStyle}>
              <AnnouncementBody bodyJson={quickText} />
            </div>
          ) : (
            <p className="whitespace-pre-wrap" style={bodyStyle}>
              {quickText}
            </p>
          )}
        </ScrollArea>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex h-full flex-col items-center justify-center p-8 text-center text-muted-foreground",
        className,
      )}
    >
      <p className="font-medium" style={headingStyle}>
        {emptyTitle ?? t("noLessonScheduledTitle")}
      </p>
      <p className="mt-2 max-w-sm" style={bodyStyle}>
        {emptyDescription ?? t("noLessonScheduledDescription")}
      </p>
    </div>
  );
}

function LessonSection({
  title,
  titleStyle,
  empty,
  items,
  classId,
  assignments,
  tasks,
}: {
  title?: string;
  titleStyle?: CSSProperties;
  empty?: string;
  items: Array<{
    key: string;
    text: string;
    preface?: string;
    assignmentId?: string;
    taskId?: string;
    assignmentName?: string;
    taskName?: string;
  }>;
  classId?: Id<"classes">;
  assignments?: ReadonlyArray<{ _id: string; name: string }>;
  tasks?: ReadonlyArray<{ _id: string; name: string }>;
}) {
  return (
    <div className="flex flex-col gap-2">
      {title ? (
        <h3 className="font-medium" style={titleStyle}>
          {title}
        </h3>
      ) : null}
      {items.length === 0 ? (
        empty ? (
          <p className="text-muted-foreground">{empty}</p>
        ) : null
      ) : (
        <ol className="flex flex-col gap-1">
          {items.map((item, index) => (
            <li key={item.key} className="flex gap-1">
              <span className="shrink-0">{index + 1}.</span>
              {classId ? (
                <TimetableAgendaItemView
                  classId={classId}
                  text={item.text}
                  preface={item.preface}
                  assignmentId={item.assignmentId}
                  taskId={item.taskId}
                  assignmentName={
                    item.assignmentName ?? findAgendaResourceName(assignments, item.assignmentId)
                  }
                  taskName={item.taskName ?? findAgendaResourceName(tasks, item.taskId)}
                />
              ) : (
                <TimetableTaggedText text={item.text} />
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
