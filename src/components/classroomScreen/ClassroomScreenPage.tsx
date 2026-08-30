import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Maximize, Minimize } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Clock } from "@/components/classroomScreen/Clock";
import { LessonDisplayPanel } from "@/components/classroomScreen/LessonDisplayPanel";
import { Button } from "@/components/ui/button";
import { useCan } from "@/hooks/permissions/useCan";
import { ErrorState } from "@/components/ui/error-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useClearPushedLesson,
  useClearQuickText,
} from "@/hooks/classroomScreen/useClassroomScreenMutations";
import {
  classroomMinuteBucket,
  useClassroomAudioFiles,
  useClassroomDisplayBundle,
  useClassroomRotations,
  useClassroomTimers,
} from "@/hooks/classroomScreen/useClassroomScreenQueries";
import {
  formatLessonDisplayStatusLabel,
  resolveLessonDisplayState,
  resolveLessonDisplayStatus,
} from "@/lib/classroomScreen/lessonDisplayState";
import type { AudioCues } from "@/lib/classroomScreen/audioCues";
import {
  DEFAULT_BG_TRANSITION,
  isBgTransition,
  type BgTransition,
} from "@/lib/classroomScreen/bgTransitions";
import type { TimerEndBehavior } from "@/lib/classroomScreen/activeSession";
import { isPushOverrideActive } from "@/lib/classroomScreen/activeSession";
import { DEFAULT_CLOCK_SETTINGS } from "@/lib/classroomScreen/clockSettings";
import { toIntlLocale } from "@/lib/languages";
import { cn } from "@/lib/utils";
import type { Id } from "../../../convex/_generated/dataModel";

type DisplayLayout = "clockOnly" | "classOnly" | "vertical" | "horizontal";

type ClassroomScreenPageProps = {
  classId: Id<"classes">;
};

export function ClassroomScreenPage({ classId }: ClassroomScreenPageProps) {
  const { t, i18n } = useTranslation("classroomScreen");
  const locale = toIntlLocale(i18n.language);
  const { can } = useCan();
  const canManageScreen = can("classroomScreen:manage");
  const [minuteBucket, setMinuteBucket] = useState(() => classroomMinuteBucket());
  const {
    data: displayBundle,
    isPending,
    isError,
    refetch,
  } = useClassroomDisplayBundle(classId, minuteBucket);
  const { data: timers } = useClassroomTimers(classId);
  const { data: rotations } = useClassroomRotations(classId);
  const { data: audioFiles } = useClassroomAudioFiles(classId);
  const clearPushedLesson = useClearPushedLesson();
  const clearQuickTextMutation = useClearQuickText();

  const containerRef = useRef<HTMLDivElement>(null);
  const clearedPushRef = useRef(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [layout, setLayout] = useState<DisplayLayout>("horizontal");
  const [splitRatio, setSplitRatio] = useState(45);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 5_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const syncMinuteBucket = () => {
      const next = classroomMinuteBucket();
      setMinuteBucket((current) => (current === next ? current : next));
    };
    syncMinuteBucket();
    const interval = window.setInterval(syncMinuteBucket, 30_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    if (!canManageScreen) return;
    if (!displayBundle?.displaySession.pushedLessonId) {
      clearedPushRef.current = false;
      return;
    }

    const pushedUntil = displayBundle.displaySession.pushedUntil;
    if (isPushOverrideActive(pushedUntil, now.getTime())) {
      clearedPushRef.current = false;
      return;
    }

    if (clearedPushRef.current) return;
    clearedPushRef.current = true;
    void clearPushedLesson.mutateAsync({ classId });
  }, [displayBundle, canManageScreen, classId, clearPushedLesson, now]);

  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      await containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  const beginSplitResize = useCallback(
    (startX: number, startY: number) => {
      const isHorizontal = layout === "horizontal";
      const start = isHorizontal ? startX : startY;
      const startRatio = splitRatio;

      const onMove = (ev: PointerEvent) => {
        const container = containerRef.current;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const total = isHorizontal ? rect.width : rect.height;
        const current = isHorizontal ? ev.clientX : ev.clientY;
        const next = Math.min(75, Math.max(25, startRatio + ((current - start) / total) * 100));
        setSplitRatio(next);
      };

      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [layout, splitRatio],
  );

  const formattedDate = now.toLocaleDateString(locale, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const lessonState = useMemo(
    () => resolveLessonDisplayState(displayBundle, now),
    [displayBundle, now],
  );

  if (isPending && !displayBundle) {
    return <Skeleton className="h-svh w-full rounded-none" />;
  }

  if (isError || !displayBundle) {
    return (
      <div className="flex h-svh items-center justify-center p-8">
        <ErrorState card onRetry={() => void refetch()} description={t("loadFailed")} />
      </div>
    );
  }

  const settings = displayBundle.settings;
  const bgTransition: BgTransition =
    settings.bgTransition && isBgTransition(settings.bgTransition)
      ? settings.bgTransition
      : DEFAULT_BG_TRANSITION;

  const statusLabel = formatLessonDisplayStatusLabel(
    resolveLessonDisplayStatus(lessonState, displayBundle.displaySession.pushedUntil, now),
    t,
    now,
  );

  const quickTextTitle = settings.quickTextTitle?.trim() || t("statusQuickText");

  const clockPanel = (
    <div className="min-h-0 min-w-0 h-full w-full overflow-hidden">
      <Clock
        classId={classId}
        isRunner
        canControlSession={canManageScreen}
        compact
        showTimeAdjust={canManageScreen}
        fillWidth
        timeFormat={settings.timeFormat}
        clockSize={settings.clockSize}
        dateSize={settings.dateSize}
        dateLocation={settings.dateLocation}
        clockBgColor={settings.clockBgColor}
        timerBgColor={settings.timerBgColor}
        currentTimeSize={settings.currentTimeSize}
        endTimeSize={settings.endTimeSize}
        timerTitleSize={settings.timerTitleSize}
        timerEndBehavior={(settings.timerEndBehavior as TimerEndBehavior | undefined) ?? "countUp"}
        overtimeAutoDismissSeconds={settings.overtimeAutoDismissSeconds ?? 0}
        bgTransition={bgTransition}
        globalAudioCues={settings.audioCues as AudioCues | undefined}
        displaySession={displayBundle.displaySession}
        timers={timers}
        rotations={rotations}
        audioFiles={audioFiles}
      />
    </div>
  );

  const lessonPanel = (
    <div
      className={cn(
        "min-h-0 min-w-0 h-full w-full flex-1 overflow-hidden",
        layout === "horizontal" && "border-l",
        layout === "vertical" && "border-t",
      )}
    >
      <LessonDisplayPanel
        classId={classId}
        lesson={lessonState.showLessonContent ? lessonState.activeLesson : null}
        formattedDate={formattedDate}
        contentFontSize={
          settings.displayContentFontSize ?? DEFAULT_CLOCK_SETTINGS.displayContentFontSize
        }
        headingFontSize={
          settings.displayHeadingFontSize ?? DEFAULT_CLOCK_SETTINGS.displayHeadingFontSize
        }
        quickText={lessonState.globalQuickText}
        quickTextTitle={quickTextTitle}
        onClearQuickText={
          canManageScreen && lessonState.globalQuickText
            ? () => void clearQuickTextMutation.mutateAsync({ classId })
            : undefined
        }
        isClearingQuickText={clearQuickTextMutation.isPending}
      />
    </div>
  );

  const splitDivider = (
    <div
      className={cn(
        "relative shrink-0 touch-none",
        layout === "horizontal"
          ? "flex w-8 cursor-col-resize items-stretch justify-center"
          : "flex h-8 cursor-row-resize flex-col items-stretch justify-center",
      )}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        beginSplitResize(e.clientX, e.clientY);
      }}
    >
      <div
        className={cn(
          "bg-border hover:bg-primary/30",
          layout === "horizontal" ? "h-full w-2" : "h-2 w-full",
        )}
      />
    </div>
  );

  return (
    <div ref={containerRef} className="relative flex h-svh min-h-0 w-full flex-col bg-background">
      <div className="absolute top-3 left-3 z-20 flex flex-col gap-1">
        <div className="flex items-center gap-1">
          <Select value={layout} onValueChange={(value) => setLayout(value as DisplayLayout)}>
            <SelectTrigger size="sm" className="bg-background" aria-label={t("layoutLabel")}>
              <SelectValue>
                {
                  {
                    clockOnly: t("layoutClockOnly"),
                    classOnly: t("layoutLessonOnly"),
                    vertical: t("layoutVertical"),
                    horizontal: t("layoutHorizontal"),
                  }[layout]
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="clockOnly">{t("layoutClockOnly")}</SelectItem>
              <SelectItem value="classOnly">{t("layoutLessonOnly")}</SelectItem>
              <SelectItem value="vertical">{t("layoutVertical")}</SelectItem>
              <SelectItem value="horizontal">{t("layoutHorizontal")}</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={() => void toggleFullscreen()}
            title={isFullscreen ? t("exitFullscreen") : t("enterFullscreen")}
            aria-label={isFullscreen ? t("exitFullscreen") : t("enterFullscreen")}
          >
            {isFullscreen ? <Minimize /> : <Maximize />}
          </Button>
        </div>
        {statusLabel ? <span className="text-xs text-muted-foreground">{statusLabel}</span> : null}
      </div>

      {layout === "clockOnly" ? (
        <div className="min-h-0 flex-1">{clockPanel}</div>
      ) : layout === "classOnly" ? (
        <div className="min-h-0 flex-1">{lessonPanel}</div>
      ) : (
        <div
          className={cn("flex min-h-0 flex-1", layout === "horizontal" ? "flex-row" : "flex-col")}
        >
          <div
            className="min-h-0 min-w-0 overflow-hidden"
            style={{
              [layout === "horizontal" ? "width" : "height"]: `${splitRatio}%`,
            }}
          >
            {clockPanel}
          </div>
          {splitDivider}
          {lessonPanel}
        </div>
      )}
    </div>
  );
}
