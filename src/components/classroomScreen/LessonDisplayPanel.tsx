import { X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { AnnouncementBody } from "@/components/announcements/AnnouncementBody";
import { FontAwesomeIconFromId } from "@/components/icons/FontAwesomeIconFromId";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ClassroomLessonDisplay } from "@/hooks/classroomScreen/useClassroomScreenQueries";
import { DEFAULT_CLOCK_SETTINGS } from "@/lib/classroomScreen/clockSettings";
import { cn } from "@/lib/utils";

type LessonDisplayPanelProps = {
  lesson: ClassroomLessonDisplay | null;
  formattedDate: string;
  contentFontSize?: number;
  headingFontSize?: number;
  quickText?: string | null;
  quickTextTitle?: string;
  onClearQuickText?: () => void;
  isClearingQuickText?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
};

export function LessonDisplayPanel({
  lesson,
  formattedDate,
  contentFontSize = DEFAULT_CLOCK_SETTINGS.displayContentFontSize,
  headingFontSize = DEFAULT_CLOCK_SETTINGS.displayHeadingFontSize,
  quickText,
  quickTextTitle,
  onClearQuickText,
  isClearingQuickText = false,
  emptyTitle,
  emptyDescription,
  className,
}: LessonDisplayPanelProps) {
  const { t } = useTranslation("classroomScreen");
  const headingStyle = { fontSize: `${headingFontSize}px` };
  const bodyStyle = { fontSize: `${contentFontSize}px` };
  const bodyClassName =
    "[&_.announcement-body]:text-[length:inherit] [&_.announcement-body_h2]:text-[1.25em] [&_.announcement-body_h3]:text-[1.1em]";

  if (lesson) {
    return (
      <div className={cn("flex h-full flex-col", className)}>
        <div
          className="flex items-center gap-3 border-b p-6"
          style={{
            backgroundColor: lesson.subjectBgColor,
            color: lesson.subjectTextColor,
          }}
        >
          {lesson.subjectIconName ? (
            <FontAwesomeIconFromId id={lesson.subjectIconName} className="size-8 shrink-0" />
          ) : (
            <span
              className="size-4 shrink-0 rounded-full ring-2 ring-white/30"
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
          {lesson.notesJson ? (
            <div className={bodyClassName} style={bodyStyle}>
              <AnnouncementBody bodyJson={lesson.notesJson} />
            </div>
          ) : (
            <p className="text-muted-foreground" style={bodyStyle}>
              {t("noLessonNotes")}
            </p>
          )}
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
