import { useEffect, useState } from "react";
import { Monitor } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useClearPushedLesson,
  usePushLessonToDisplay,
} from "@/hooks/classroomScreen/useClassroomScreenMutations";
import {
  classroomMinuteBucket,
  useClassroomDisplayBundle,
} from "@/hooks/classroomScreen/useClassroomScreenQueries";
import { useCan } from "@/hooks/permissions/useCan";
import { useTimetableWeekBundle } from "@/hooks/timetable/useTimetableQueries";
import { isPushOverrideActive } from "@/lib/classroomScreen/activeSession";
import { secondsUntilSlotEndToday } from "@/lib/classroomScreen/slotEndRemaining";
import { isOptimisticId } from "@/lib/optimistic";
import { utcMsToZonedParts } from "../../../convex/lib/calendar/timeZone";
import { weekdayNameFromDateKey } from "../../../convex/lib/timetable/timetableSchema";
import { cn } from "@/lib/utils";
import type { Id } from "../../../convex/_generated/dataModel";

const PUSH_DURATION_PRESETS_SECONDS = [5 * 60, 15 * 60] as const;

type TimetableLessonPushToScreenProps = {
  classId: Id<"classes">;
  termId: Id<"timetableTerms">;
  year: number;
  weekNumber: number;
  lessonId: Id<"timetableLessons">;
  slotId: Id<"timetableSlots">;
  timeZone: string;
  className?: string;
};

export function TimetableLessonPushToScreen({
  classId,
  termId,
  year,
  weekNumber,
  lessonId,
  slotId,
  timeZone,
  className,
}: TimetableLessonPushToScreenProps) {
  const { t } = useTranslation("timetable");
  const { t: tScreen } = useTranslation("classroomScreen");
  const { can, isPending: permissionsPending } = useCan();
  const canPush = !permissionsPending && can("classroomScreen:manage") && !isOptimisticId(lessonId);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const minuteBucket = classroomMinuteBucket(nowMs);
  const displayQuery = useClassroomDisplayBundle(canPush ? classId : undefined, minuteBucket);
  const weekQuery = useTimetableWeekBundle(classId, canPush ? termId : undefined, year, weekNumber);
  const pushLesson = usePushLessonToDisplay();
  const clearPushedLesson = useClearPushedLesson();

  const session = displayQuery.data?.displaySession;
  const isThisLessonPushed =
    session?.pushedLessonId === lessonId && isPushOverrideActive(session.pushedUntil, nowMs);

  useEffect(() => {
    if (!isThisLessonPushed) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [isThisLessonPushed]);

  if (!canPush) return null;

  const slot = weekQuery.data?.slots.find((item) => item._id === slotId);
  const todayName = weekdayNameFromDateKey(utcMsToZonedParts(nowMs, timeZone).dateKey);
  const remainingUntilSlotEnds =
    slot && slot.day === todayName ? secondsUntilSlotEndToday(slot.endTime, timeZone, nowMs) : 0;
  const pending = pushLesson.isPending || clearPushedLesson.isPending;

  const handlePush = (durationSeconds: number) => {
    void pushLesson.mutateAsync({ classId, lessonId, durationSeconds });
  };

  if (isThisLessonPushed) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn("h-7 px-2", className)}
        disabled={pending}
        onClick={() => {
          void clearPushedLesson.mutateAsync({ classId });
        }}
      >
        <Monitor className="h-3.5 w-3.5" />
        {t("stopPushLessonToScreen")}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn("h-7 px-2", className)}
            disabled={pending}
          />
        }
      >
        <Monitor className="h-3.5 w-3.5" />
        {t("pushLessonToScreen")}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {PUSH_DURATION_PRESETS_SECONDS.map((seconds) => (
          <DropdownMenuItem key={seconds} onClick={() => handlePush(seconds)}>
            {tScreen("presetMinutes", { count: seconds / 60 })}
          </DropdownMenuItem>
        ))}
        {remainingUntilSlotEnds > 0 ? (
          <DropdownMenuItem onClick={() => handlePush(remainingUntilSlotEnds)}>
            {t("pushLessonUntilSlotEnds")}
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
