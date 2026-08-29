import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Maximize, Minimize, Music, Settings2, Timer } from "lucide-react";
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
import { useClassroomScreenBundle } from "@/hooks/classroomScreen/useClassroomScreenQueries";
import { DEFAULT_CLOCK_SETTINGS } from "@/lib/classroomScreen/clockSettings";
import {
  findSlotForLesson,
  isEarlyPreviewSlot,
  minutesUntilSlotStart,
  resolveCurrentLessonDisplay,
} from "@/lib/classroomScreen/currentLesson";
import type { AudioCues } from "@/lib/classroomScreen/audioCues";
import {
  DEFAULT_BG_TRANSITION,
  isBgTransition,
  type BgTransition,
} from "@/lib/classroomScreen/bgTransitions";
import type { TimerEndBehavior } from "@/lib/classroomScreen/activeSession";
import {
  formatPushOverrideRemainingSeconds,
  isPushOverrideActive,
} from "@/lib/classroomScreen/activeSession";
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
  const canOpenSettings = can("class:update") || canManageScreen;
  const { data: bundle, isPending, isError, refetch } = useClassroomScreenBundle(classId);
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
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    if (!bundle?.displaySession.pushedLessonId) {
      clearedPushRef.current = false;
      return;
    }

    const pushedUntil = bundle.displaySession.pushedUntil;
    if (isPushOverrideActive(pushedUntil, now.getTime())) {
      clearedPushRef.current = false;
      return;
    }

    if (clearedPushRef.current) return;
    clearedPushRef.current = true;
    void clearPushedLesson.mutateAsync({ classId });
  }, [bundle, classId, clearPushedLesson, now]);

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

  const lessonState = useMemo(() => {
    if (!bundle) {
      return {
        pushActive: false,
        activeLesson: null as ReturnType<typeof resolveCurrentLessonDisplay>,
        autoSlot: null as ReturnType<typeof findSlotForLesson>,
        showLessonContent: false,
        globalQuickText: null as string | null | undefined,
      };
    }

    const pushActive =
      !!bundle.pushedLesson &&
      isPushOverrideActive(bundle.displaySession.pushedUntil, now.getTime());

    const autoLesson = resolveCurrentLessonDisplay(bundle, now);
    const activeLesson = pushActive ? bundle.pushedLesson : autoLesson;
    const showLessonContent = !!activeLesson;
    const globalQuickText = !pushActive && !showLessonContent ? bundle.settings.quickText : null;

    const autoSlot = autoLesson ? findSlotForLesson(bundle, autoLesson) : null;

    return { pushActive, activeLesson, autoSlot, showLessonContent, globalQuickText };
  }, [bundle, now]);

  if (isPending && !bundle) {
    return <Skeleton className="h-svh w-full rounded-none" />;
  }

  if (isError || !bundle) {
    return (
      <div className="flex h-svh items-center justify-center p-8">
        <ErrorState card onRetry={() => void refetch()} description={t("loadFailed")} />
      </div>
    );
  }

  const settings = bundle.settings;
  const bgTransition: BgTransition =
    settings.bgTransition && isBgTransition(settings.bgTransition)
      ? settings.bgTransition
      : DEFAULT_BG_TRANSITION;

  const statusLabel = lessonState.pushActive
    ? t("statusPushedLesson", {
        remaining: (() => {
          const secondsLeft = formatPushOverrideRemainingSeconds(
            bundle.displaySession.pushedUntil!,
            now.getTime(),
          );
          return secondsLeft >= 60
            ? t("pushedRemainingMinutes", { count: Math.ceil(secondsLeft / 60) })
            : t("pushedRemainingSeconds", { count: secondsLeft });
        })(),
      })
    : lessonState.showLessonContent && lessonState.autoSlot
      ? isEarlyPreviewSlot(lessonState.autoSlot, now)
        ? t("statusUpcomingLesson", {
            minutes: minutesUntilSlotStart(lessonState.autoSlot, now),
          })
        : t("statusCurrentLesson")
      : lessonState.globalQuickText
        ? t("statusQuickText")
        : null;

  const quickTextTitle = settings.quickTextTitle?.trim() || t("statusQuickText");

  const clockPanel = (
    <div className="min-h-0 min-w-0 h-full w-full overflow-hidden">
      <Clock
        classId={classId}
        isRunner
        compact
        showTimeAdjust
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
          lessonState.globalQuickText
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
          {canOpenSettings ? (
            <Button
              variant="outline"
              size="icon"
              title={t("settings")}
              aria-label={t("settings")}
              render={<Link to="/class/$classId/settings" params={{ classId }} target="_blank" />}
            >
              <Settings2 />
            </Button>
          ) : null}
          {canManageScreen ? (
            <>
              <Button
                variant="outline"
                size="icon"
                title={t("manageTimers")}
                aria-label={t("manageTimers")}
                render={<Link to="/class/$classId/timers" params={{ classId }} target="_blank" />}
              >
                <Timer />
              </Button>
              <Button
                variant="outline"
                size="icon"
                title={t("manageAudio")}
                aria-label={t("manageAudio")}
                render={<Link to="/class/$classId/audio" params={{ classId }} target="_blank" />}
              >
                <Music />
              </Button>
            </>
          ) : null}
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
