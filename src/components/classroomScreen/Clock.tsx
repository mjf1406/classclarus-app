import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ListPlus, Pause, Play, RotateCcw, SkipForward, Square, TimerOff } from "lucide-react";
import { useTranslation } from "react-i18next";

import { AnimatedBackground } from "@/components/classroomScreen/AnimatedBackground";
import { FitText } from "@/components/classroomScreen/FitText";
import { useReservedFitHeight } from "@/hooks/classroomScreen/useFitFontSize";
import {
  PlusMinusThirtyButtons,
  TimeAdjustControls,
} from "@/components/classroomScreen/TimeAdjustControls";
import { YouTubeOverlay } from "@/components/classroomScreen/YouTubeOverlay";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  useAdjustClassroomSession,
  usePauseClassroomSession,
  useResumeClassroomSession,
  useSkipClassroomSessionSegment,
  useStartClassroomSession,
  useStopClassroomSession,
  useUpdateClassroomSession,
} from "@/hooks/classroomScreen/useClassroomScreenMutations";
import {
  type ClassroomAudioFile,
  type ClassroomDisplaySession,
  type ClassroomTimer,
} from "@/hooks/classroomScreen/useClassroomScreenQueries";
import type { Id } from "../../../convex/_generated/dataModel";
import { createAudioUrlMap, useAudioPlayer } from "@/lib/classroomScreen/audio-engine";
import { toAudioUrlList } from "@/lib/classroomScreen/audioOptions";
import type { AudioCues } from "@/lib/classroomScreen/audioCues";
import {
  appendTimerToSession,
  buildCustomTimerSession,
  buildQuickPresetSession,
  formatCountdown,
  formatEndTimestamp,
  formatWallTime,
  getCurrentBgColor,
  getCurrentSegment,
  hasUpcomingSegments,
  isLastSegment,
  parseSessionJson,
  remainingFromDisplaySession,
  resolveSegmentDuration,
  truncateUpcomingSegments,
  type ActiveSession,
  type TimerEndBehavior,
} from "@/lib/classroomScreen/activeSession";
import {
  DEFAULT_BG_TRANSITION,
  resolveBgTransition,
  type BgTransition,
} from "@/lib/classroomScreen/bgTransitions";
import { getContrastTextColor, getOvertimeTextColor } from "@/lib/classroomScreen/colorContrast";
import { toIntlLocale } from "@/lib/languages";
import { cn } from "@/lib/utils";

interface ClockProps {
  classId: Id<"classes">;
  isRunner?: boolean;
  canControlSession?: boolean;
  compact?: boolean;
  showTimeAdjust?: boolean;
  fillWidth?: boolean;
  timeFormat?: string;
  clockSize?: number;
  dateSize?: number;
  dateLocation?: string;
  clockBgColor?: string;
  timerBgColor?: string;
  currentTimeSize?: number;
  endTimeSize?: number;
  timerTitleSize?: number;
  timerEndBehavior?: TimerEndBehavior;
  overtimeAutoDismissSeconds?: number;
  bgTransition?: BgTransition;
  globalAudioCues?: AudioCues;
  displaySession?: ClassroomDisplaySession;
  timers?: ClassroomTimer[];
  audioFiles?: ClassroomAudioFile[];
}

function formatTime(date: Date, timeFormat: string, locale: string): string {
  return date.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: timeFormat === "12h",
  });
}

function formatDate(date: Date, locale: string): string {
  return date.toLocaleDateString(locale, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function digitWidthBenchmark(text: string): string {
  return text.replace(/\d/g, "0");
}

const DURATION_PRESETS = [
  { unit: "seconds" as const, count: 10, seconds: 10 },
  { unit: "seconds" as const, count: 30, seconds: 30 },
  { unit: "minutes" as const, count: 1, seconds: 60 },
  { unit: "minutes" as const, count: 5, seconds: 300 },
  { unit: "minutes" as const, count: 10, seconds: 600 },
  { unit: "minutes" as const, count: 15, seconds: 900 },
  { unit: "minutes" as const, count: 20, seconds: 1200 },
  { unit: "minutes" as const, count: 25, seconds: 1500 },
  { unit: "minutes" as const, count: 30, seconds: 1800 },
] as const;

function DurationPresetButtons({
  onSelect,
  largeControls = false,
}: {
  onSelect: (seconds: number) => void;
  largeControls?: boolean;
}) {
  const { t } = useTranslation("classroomScreen");

  return (
    <div className="w-full min-w-0 px-4">
      <div className="flex flex-wrap justify-center gap-2">
        {DURATION_PRESETS.map((preset) => (
          <Button
            key={`${preset.unit}-${preset.count}`}
            type="button"
            variant="secondary"
            size={largeControls ? "lg" : "sm"}
            className={cn("rounded-lg", largeControls ? "min-w-14 px-4" : "min-w-10 px-2")}
            onClick={() => onSelect(preset.seconds)}
          >
            {t(preset.unit === "seconds" ? "presetSeconds" : "presetMinutes", {
              count: preset.count,
            })}
          </Button>
        ))}
      </div>
    </div>
  );
}

function QuickPickList({
  title,
  items,
  onSelect,
  largeControls = false,
  loadingLabel,
  emptyLabel,
}: {
  title: string;
  items: ClassroomTimer[] | undefined;
  onSelect: (item: ClassroomTimer) => void;
  largeControls?: boolean;
  loadingLabel: string;
  emptyLabel: string;
}) {
  return (
    <div className="w-full min-w-0 px-4">
      <h2 className="mb-2 text-sm font-medium">{title}</h2>
      {items === undefined ? (
        <p className="text-sm text-muted-foreground">{loadingLabel}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <Button
              key={item._id}
              type="button"
              variant="secondary"
              size={largeControls ? "lg" : "sm"}
              onClick={() => onSelect(item)}
            >
              {item.name}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

function DisplayTransportControls({
  session,
  paused,
  remaining,
  hasUpcoming,
  onAdjust,
  onPauseToggle,
  onSkip,
  onStop,
  onClearUpcoming,
  labels,
}: {
  session: ActiveSession;
  paused: boolean;
  remaining: number;
  hasUpcoming: boolean;
  onAdjust: (deltaSeconds: number) => void;
  onPauseToggle: () => void;
  onSkip: () => void;
  onStop: () => void;
  onClearUpcoming: () => void;
  labels: {
    resume: string;
    pause: string;
    skip: string;
    cancelUpNext: string;
    stop: string;
  };
}) {
  const canSkip = session.segments.length > 1;

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <PlusMinusThirtyButtons remaining={remaining} onAdjust={onAdjust} size="sm" />
      <Button type="button" variant="secondary" size="sm" onClick={onPauseToggle}>
        {paused ? <Play /> : <Pause />}
        {paused ? labels.resume : labels.pause}
      </Button>
      {canSkip && (
        <Button type="button" variant="secondary" size="sm" onClick={onSkip}>
          <SkipForward />
          {labels.skip}
        </Button>
      )}
      {hasUpcoming && (
        <Button type="button" variant="secondary" size="sm" onClick={onClearUpcoming}>
          <TimerOff />
          {labels.cancelUpNext}
        </Button>
      )}
      <Button type="button" variant="secondary" size="sm" onClick={onStop}>
        <Square />
        {labels.stop}
      </Button>
    </div>
  );
}

function ActiveTransportControls({
  session,
  paused,
  remaining,
  hasUpcoming,
  onAdjust,
  onPauseToggle,
  onSkip,
  onStop,
  onClearUpcoming,
  labels,
}: {
  session: ActiveSession;
  paused: boolean;
  remaining: number;
  hasUpcoming: boolean;
  onAdjust: (deltaSeconds: number) => void;
  onPauseToggle: () => void;
  onSkip: () => void;
  onStop: () => void;
  onClearUpcoming: () => void;
  labels: {
    resume: string;
    pause: string;
    skip: string;
    cancelUpNext: string;
    stop: string;
    reset: string;
  };
}) {
  const canSkip = session.segments.length > 1;

  return (
    <div className="flex w-full min-w-0 flex-col items-center gap-3 px-4">
      <TimeAdjustControls remaining={remaining} onAdjust={onAdjust} />
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={onPauseToggle}>
          {paused ? <Play /> : <Pause />}
          {paused ? labels.resume : labels.pause}
        </Button>
        {canSkip && (
          <Button type="button" variant="secondary" size="sm" onClick={onSkip}>
            <SkipForward />
            {labels.skip}
          </Button>
        )}
        {hasUpcoming && (
          <Button type="button" variant="secondary" size="sm" onClick={onClearUpcoming}>
            <TimerOff />
            {labels.cancelUpNext}
          </Button>
        )}
        <Button type="button" variant="secondary" size="sm" onClick={onStop}>
          <Square />
          {labels.stop}
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={onStop}>
          <RotateCcw />
          {labels.reset}
        </Button>
      </div>
    </div>
  );
}

export function Clock({
  classId,
  isRunner = false,
  canControlSession = false,
  compact = false,
  showTimeAdjust = false,
  fillWidth = false,
  timeFormat = "24h",
  clockSize = 72,
  dateSize = 24,
  dateLocation = "below",
  clockBgColor = "#ffffff",
  timerBgColor = "#15803d",
  currentTimeSize = 24,
  endTimeSize = 24,
  timerTitleSize = 20,
  timerEndBehavior = "countUp",
  overtimeAutoDismissSeconds = 0,
  bgTransition = DEFAULT_BG_TRANSITION,
  globalAudioCues,
  displaySession,
  timers,
  audioFiles = [],
}: ClockProps) {
  const { t, i18n } = useTranslation("classroomScreen");
  const locale = toIntlLocale(i18n.language);
  const sessionRunner = isRunner && canControlSession;
  const [now, setNow] = useState(() => new Date());
  const [queuePopoverOpen, setQueuePopoverOpen] = useState(false);
  const [tick, setTick] = useState(0);
  const fitAreaRef = useRef<HTMLDivElement>(null);
  const reservedTopRef = useRef<HTMLDivElement>(null);
  const reservedBottomRef = useRef<HTMLDivElement>(null);

  const startSession = useStartClassroomSession();
  const stopSessionMutation = useStopClassroomSession();
  const pauseSession = usePauseClassroomSession();
  const resumeSession = useResumeClassroomSession();
  const adjustSession = useAdjustClassroomSession();
  const skipSegmentMutation = useSkipClassroomSessionSegment();
  const updateSession = useUpdateClassroomSession();

  const session = useMemo(
    () => parseSessionJson(displaySession?.sessionJson),
    [displaySession?.sessionJson],
  );
  const clockFitLayoutKey = `${fillWidth ? "fill" : "fixed"}-${session ? "active" : "idle"}-${dateLocation}-${canControlSession}-${compact}-${showTimeAdjust}`;
  const clockBudgetHeight = useReservedFitHeight(
    fitAreaRef,
    reservedTopRef,
    reservedBottomRef,
    clockFitLayoutKey,
  );
  const endsAt = displaySession?.endsAt ?? null;
  const paused = displaySession?.paused ?? false;
  const pausedRemainingMs = displaySession?.pausedRemainingMs ?? null;

  const remaining = useMemo(() => {
    void tick;
    return remainingFromDisplaySession(endsAt, paused, pausedRemainingMs);
  }, [endsAt, paused, pausedRemainingMs, tick]);

  const sessionRef = useRef<ActiveSession | null>(null);
  sessionRef.current = session;
  const prevRemainingRef = useRef<number | null>(null);
  const firedWarningsRef = useRef(new Set<string>());
  const firedOvertimeRef = useRef(false);
  const firedSegmentEndRef = useRef<number | null>(null);
  const lastTickSecondRef = useRef<number | null>(null);
  const segmentStartMsRef = useRef<number | null>(null);
  const lastIntervalChimeRef = useRef(0);
  const lastSessionIndexRef = useRef<number | null>(null);

  const urlMap = createAudioUrlMap(toAudioUrlList(audioFiles));
  const { playById, unlock, startPlayDuring, stopPlayDuring, stopAll, pauseAll, resumeAll } =
    useAudioPlayer(urlMap);
  const playByIdRef = useRef(playById);
  playByIdRef.current = playById;
  const startPlayDuringRef = useRef(startPlayDuring);
  startPlayDuringRef.current = startPlayDuring;
  const stopPlayDuringRef = useRef(stopPlayDuring);
  stopPlayDuringRef.current = stopPlayDuring;
  const stopAllRef = useRef(stopAll);
  stopAllRef.current = stopAll;
  const pauseAllRef = useRef(pauseAll);
  pauseAllRef.current = pauseAll;
  const resumeAllRef = useRef(resumeAll);
  resumeAllRef.current = resumeAll;

  const transportLabels = {
    resume: t("transportResume"),
    pause: t("transportPause"),
    skip: t("transportSkip"),
    cancelUpNext: t("transportCancelUpNext"),
    stop: t("transportStop"),
    reset: t("transportReset"),
  };

  const resetSegmentAudioState = useCallback((segmentIndex: number) => {
    firedWarningsRef.current = new Set(
      [...firedWarningsRef.current].filter((key) => !key.startsWith(`${segmentIndex}-`)),
    );
    firedOvertimeRef.current = false;
    firedSegmentEndRef.current = null;
    lastTickSecondRef.current = null;
    segmentStartMsRef.current = Date.now();
    lastIntervalChimeRef.current = 0;
  }, []);

  const playSegmentStart = useCallback(
    (activeSession: ActiveSession) => {
      if (!sessionRunner) return;
      const segment = activeSession.segments[activeSession.index]!;
      stopPlayDuringRef.current();
      playByIdRef.current(
        segment.audioCues.segmentStart.audioId,
        segment.audioCues.segmentStart.repeat,
      );
      startPlayDuringRef.current(segment.audioCues.playDuring.audioId);
    },
    [sessionRunner],
  );

  const currentBgColor = getCurrentBgColor(session, clockBgColor);
  const activeBgTransition = resolveBgTransition(session?.bgTransition, bgTransition);
  const textColor = getContrastTextColor(currentBgColor);
  const overtimeTextColor = getOvertimeTextColor(currentBgColor);

  const handleStartSession = useCallback(
    async (newSession: ActiveSession) => {
      if (!canControlSession) return;
      unlock();
      if (sessionRunner) {
        resetSegmentAudioState(newSession.index);
        prevRemainingRef.current = resolveSegmentDuration(newSession.segments[newSession.index]!);
        playSegmentStart(newSession);
      }
      await startSession.mutateAsync({ classId, session: newSession });
    },
    [
      canControlSession,
      classId,
      unlock,
      sessionRunner,
      resetSegmentAudioState,
      playSegmentStart,
      startSession,
    ],
  );

  const handleQuickPreset = useCallback(
    (seconds: number) => {
      void handleStartSession(buildQuickPresetSession(seconds, timerBgColor, globalAudioCues));
    },
    [handleStartSession, timerBgColor, globalAudioCues],
  );

  const handleTimerSelect = useCallback(
    (timer: ClassroomTimer) => {
      void handleStartSession(buildCustomTimerSession(timer, globalAudioCues, timers ?? []));
    },
    [handleStartSession, globalAudioCues, timers],
  );

  const handleQueueTimer = useCallback(
    async (timer: ClassroomTimer) => {
      if (!canControlSession || !session) return;
      const updated = appendTimerToSession(session, timer, globalAudioCues);
      await updateSession.mutateAsync({ classId, session: updated });
      setQueuePopoverOpen(false);
    },
    [canControlSession, session, globalAudioCues, updateSession, classId],
  );

  const handleClearUpcoming = useCallback(async () => {
    if (!canControlSession) return;
    const current = sessionRef.current;
    if (!current || !hasUpcomingSegments(current)) return;
    const updated = truncateUpcomingSegments(current);
    await updateSession.mutateAsync({ classId, session: updated });
  }, [canControlSession, updateSession, classId]);

  const adjustTime = useCallback(
    (deltaSeconds: number) => {
      if (!canControlSession) return;
      void adjustSession.mutateAsync({ classId, deltaSeconds });
    },
    [canControlSession, classId, adjustSession],
  );

  const stopSession = useCallback(
    async (playSound = false) => {
      if (!canControlSession) return;
      if (playSound && sessionRunner && sessionRef.current) {
        stopAllRef.current();
        const segment = getCurrentSegment(sessionRef.current);
        playByIdRef.current(segment.audioCues.stop.audioId, segment.audioCues.stop.repeat, true);
      } else if (sessionRunner) {
        stopPlayDuringRef.current();
      }
      prevRemainingRef.current = null;
      firedWarningsRef.current.clear();
      firedOvertimeRef.current = false;
      firedSegmentEndRef.current = null;
      lastTickSecondRef.current = null;
      segmentStartMsRef.current = null;
      lastIntervalChimeRef.current = 0;
      await stopSessionMutation.mutateAsync({ classId });
    },
    [canControlSession, classId, sessionRunner, stopSessionMutation],
  );

  const skipSegment = useCallback(async () => {
    if (!canControlSession) return;
    const current = sessionRef.current;
    if (!current) return;

    if (sessionRunner) {
      const segment = getCurrentSegment(current);
      stopPlayDuringRef.current();
      playByIdRef.current(segment.audioCues.skip.audioId, segment.audioCues.skip.repeat);
    }

    await skipSegmentMutation.mutateAsync({ classId });
    const nextSession = sessionRef.current;
    if (nextSession && sessionRunner) {
      resetSegmentAudioState(nextSession.index);
      prevRemainingRef.current = resolveSegmentDuration(nextSession.segments[nextSession.index]!);
      playSegmentStart(nextSession);
    } else if (!nextSession && sessionRunner) {
      stopAllRef.current();
    }
  }, [
    canControlSession,
    classId,
    sessionRunner,
    resetSegmentAudioState,
    playSegmentStart,
    skipSegmentMutation,
  ]);

  const handlePauseToggle = useCallback(async () => {
    if (!canControlSession) return;
    const current = sessionRef.current;
    if (!current) return;

    if (paused) {
      const remainingMs = pausedRemainingMs ?? (endsAt ? Math.max(0, endsAt - Date.now()) : 0);
      if (sessionRunner) {
        const cues = getCurrentSegment(current).audioCues;
        playByIdRef.current(cues.resume.audioId, cues.resume.repeat, true, true);
        resumeAllRef.current();
      }
      await resumeSession.mutateAsync({ classId, remainingMs });
    } else {
      const remainingMs = endsAt ? Math.max(0, endsAt - Date.now()) : 0;
      if (sessionRunner) {
        pauseAllRef.current();
        const cues = getCurrentSegment(current).audioCues;
        playByIdRef.current(cues.pause.audioId, cues.pause.repeat, true, true);
      }
      await pauseSession.mutateAsync({ classId, remainingMs });
    }
  }, [
    canControlSession,
    classId,
    paused,
    pausedRemainingMs,
    endsAt,
    sessionRunner,
    resumeSession,
    pauseSession,
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
      setTick((value) => value + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!sessionRunner || !session) return;
    if (lastSessionIndexRef.current !== session.index) {
      lastSessionIndexRef.current = session.index;
      resetSegmentAudioState(session.index);
      prevRemainingRef.current = remaining;
      playSegmentStart(session);
    }
  }, [session, sessionRunner, resetSegmentAudioState, playSegmentStart, remaining]);

  useEffect(() => {
    if (!sessionRunner || !session || paused) return;

    const segment = getCurrentSegment(session);
    const cues = segment.audioCues;
    const prev = prevRemainingRef.current;

    for (const rule of cues.timeRemaining) {
      const key = `${session.index}-${rule.secondsRemaining}`;
      if (
        rule.audioId &&
        prev !== null &&
        prev > rule.secondsRemaining &&
        remaining <= rule.secondsRemaining &&
        remaining > 0 &&
        !firedWarningsRef.current.has(key)
      ) {
        firedWarningsRef.current.add(key);
        playByIdRef.current(rule.audioId, rule.repeat);
      }
    }

    if (
      cues.countdownTick.audioId &&
      remaining > 0 &&
      remaining <= cues.countdownTick.lastSeconds &&
      lastTickSecondRef.current !== remaining
    ) {
      lastTickSecondRef.current = remaining;
      playByIdRef.current(cues.countdownTick.audioId, 1);
    }

    if (
      timerEndBehavior === "countUp" &&
      isLastSegment(session) &&
      prev !== null &&
      prev > 0 &&
      remaining <= 0 &&
      !firedOvertimeRef.current
    ) {
      firedOvertimeRef.current = true;
      playByIdRef.current(cues.overtimeStart.audioId, cues.overtimeStart.repeat);
    }

    if (segmentStartMsRef.current && cues.intervalChime.audioId) {
      const elapsedMinutes = Math.floor((Date.now() - segmentStartMsRef.current) / 60000);
      const chimeCount = Math.floor(elapsedMinutes / cues.intervalChime.everyMinutes);
      if (chimeCount > lastIntervalChimeRef.current && elapsedMinutes > 0) {
        lastIntervalChimeRef.current = chimeCount;
        playByIdRef.current(cues.intervalChime.audioId, 1);
      }
    }

    prevRemainingRef.current = remaining;
  }, [remaining, session, paused, timerEndBehavior, sessionRunner]);

  useEffect(() => {
    if (!canControlSession || !sessionRunner || !session || paused) return;
    if (remaining > 0) return;
    if (firedSegmentEndRef.current === session.index) return;

    const segment = getCurrentSegment(session);
    firedSegmentEndRef.current = session.index;
    stopPlayDuringRef.current();
    playByIdRef.current(segment.audioCues.segmentEnd.audioId, segment.audioCues.segmentEnd.repeat);

    if (!isLastSegment(session)) {
      void skipSegmentMutation.mutateAsync({ classId }).then(() => {
        const next = sessionRef.current;
        if (next) {
          resetSegmentAudioState(next.index);
          prevRemainingRef.current = resolveSegmentDuration(next.segments[next.index]!);
          playSegmentStart(next);
        }
      });
      return;
    }

    if (timerEndBehavior !== "countUp") {
      playByIdRef.current(
        segment.audioCues.sessionComplete.audioId,
        segment.audioCues.sessionComplete.repeat,
      );
    }

    if (timerEndBehavior === "return") {
      void stopSession();
    }
  }, [
    remaining,
    session,
    paused,
    timerEndBehavior,
    stopSession,
    classId,
    canControlSession,
    sessionRunner,
    resetSegmentAudioState,
    playSegmentStart,
    skipSegmentMutation,
  ]);

  useEffect(() => {
    if (!canControlSession || !sessionRunner || !session || paused) return;
    if (timerEndBehavior !== "countUp") return;
    if (overtimeAutoDismissSeconds <= 0) return;
    if (!isLastSegment(session)) return;
    if (remaining > -overtimeAutoDismissSeconds) return;

    const segment = getCurrentSegment(session);
    playByIdRef.current(
      segment.audioCues.sessionComplete.audioId,
      segment.audioCues.sessionComplete.repeat,
    );
    void stopSession();
  }, [
    remaining,
    session,
    paused,
    timerEndBehavior,
    overtimeAutoDismissSeconds,
    stopSession,
    canControlSession,
    sessionRunner,
  ]);

  const formattedClockTime = formatTime(now, timeFormat, locale);
  const formattedCountdown = formatCountdown(remaining);
  const formattedDateText = formatDate(now, locale);
  const clockFitClassName = cn(
    "font-mono tabular-nums w-full min-w-0",
    fillWidth ? "min-h-0 h-auto" : "h-24",
  );
  const clockFitWrapperClassName = fillWidth
    ? "flex w-full shrink-0 items-center justify-center"
    : "w-full";
  const clockMeasureRef = fillWidth ? fitAreaRef : undefined;
  const clockAvailableHeight = fillWidth ? clockBudgetHeight : undefined;

  const dateElement = (
    <FitText
      benchmark={formattedDateText}
      maxFontSize={dateSize}
      fitAxis="width"
      className="max-w-full px-2 font-mono tabular-nums"
    >
      <p className="whitespace-nowrap">{formattedDateText}</p>
    </FitText>
  );

  const wallTimeElement = (
    <p className="font-mono tabular-nums" style={{ fontSize: `${currentTimeSize}px` }}>
      {formatWallTime(now, timeFormat, locale)}
    </p>
  );

  const countdownElement = (
    <FitText
      benchmark={digitWidthBenchmark(formattedCountdown)}
      maxFontSize={clockSize}
      className={clockFitClassName}
      style={{ color: remaining < 0 ? overtimeTextColor : undefined }}
      measureRef={clockMeasureRef}
      availableHeight={clockAvailableHeight}
    >
      <time className="font-mono tabular-nums leading-none tracking-tight whitespace-nowrap select-none">
        {formattedCountdown}
      </time>
    </FitText>
  );

  const idleWallClockElement = (
    <FitText
      benchmark={digitWidthBenchmark(formattedClockTime)}
      maxFontSize={clockSize}
      className={clockFitClassName}
      measureRef={clockMeasureRef}
      availableHeight={clockAvailableHeight}
    >
      <time
        className="font-mono tabular-nums leading-none tracking-tight whitespace-nowrap select-none"
        dateTime={now.toISOString()}
      >
        {formattedClockTime}
      </time>
    </FitText>
  );

  const activeSegment = session ? getCurrentSegment(session) : null;
  const upcomingSegments = session ? session.segments.slice(session.index + 1) : [];
  const hasUpcoming = session ? hasUpcomingSegments(session) : false;

  const activeTopVisuals = session && activeSegment && (
    <>
      <div className="flex w-full flex-col items-center gap-1">
        {dateLocation === "above" && dateElement}
        {wallTimeElement}
      </div>
      <p className="font-medium" style={{ fontSize: `${timerTitleSize}px` }}>
        {activeSegment.label}
      </p>
    </>
  );

  const activeBottomVisuals = session && activeSegment && (
    <>
      {dateLocation === "below" ? dateElement : null}
      <div className="flex flex-col items-center gap-1" style={{ fontSize: `${endTimeSize}px` }}>
        <p className="font-mono tabular-nums">
          {t("endsAt")} {endsAt !== null ? formatEndTimestamp(endsAt, timeFormat, locale) : ""}
        </p>
        {upcomingSegments.length > 0 && (
          <div className="flex flex-col items-center gap-0.5 opacity-70">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">{t("upNext")}</p>
              {canControlSession ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-auto px-1 py-0 text-xs opacity-80 hover:opacity-100"
                  onClick={() => void handleClearUpcoming()}
                >
                  <TimerOff className="size-3" />
                  {t("cancel")}
                </Button>
              ) : null}
            </div>
            {upcomingSegments.map((seg, index) => (
              <p key={`${seg.label}-${index}`} className="font-mono tabular-nums text-sm">
                {seg.label}
              </p>
            ))}
          </div>
        )}
      </div>
    </>
  );

  const activeTransportContent = session && activeSegment && canControlSession && !compact && (
    <>
      <ActiveTransportControls
        session={session}
        paused={paused}
        remaining={remaining}
        hasUpcoming={hasUpcoming}
        onAdjust={adjustTime}
        onPauseToggle={() => void handlePauseToggle()}
        onSkip={() => void skipSegment()}
        onStop={() => void stopSession(true)}
        onClearUpcoming={() => void handleClearUpcoming()}
        labels={transportLabels}
      />
      <Popover open={queuePopoverOpen} onOpenChange={setQueuePopoverOpen}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setQueuePopoverOpen((open) => !open)}
            />
          }
        >
          <ListPlus />
          {t("queueTimer")}
        </PopoverTrigger>
        <PopoverContent className="w-72 p-3" side="top">
          <p className="mb-2 text-sm font-medium">{t("queueTimerHint")}</p>
          {timers === undefined ? (
            <p className="text-sm opacity-70">{t("loading")}</p>
          ) : timers.length === 0 ? (
            <p className="text-sm opacity-70">{t("noSavedTimers")}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {timers.map((timer) => (
                <Button
                  key={timer._id}
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => void handleQueueTimer(timer)}
                >
                  {timer.name}
                </Button>
              ))}
            </div>
          )}
        </PopoverContent>
      </Popover>
    </>
  );

  const activeTimeAdjustContent = session &&
    activeSegment &&
    canControlSession &&
    showTimeAdjust &&
    compact && (
      <div className="flex w-full min-w-0 flex-col items-center gap-3 px-4">
        <TimeAdjustControls
          remaining={remaining}
          onAdjust={adjustTime}
          showProminentThirty={false}
        />
        <DisplayTransportControls
          session={session}
          paused={paused}
          remaining={remaining}
          hasUpcoming={hasUpcoming}
          onAdjust={adjustTime}
          onPauseToggle={() => void handlePauseToggle()}
          onSkip={() => void skipSegment()}
          onStop={() => void stopSession(true)}
          onClearUpcoming={() => void handleClearUpcoming()}
          labels={transportLabels}
        />
      </div>
    );

  const reservedWrapClassName = "flex w-full shrink-0 flex-col items-center gap-1";

  const renderFillPane = (
    top: ReactNode,
    clock: ReactNode,
    bottom: ReactNode,
    controls: ReactNode,
  ) =>
    fillWidth ? (
      <div
        ref={fitAreaRef}
        className="flex h-full min-h-0 w-full flex-col items-center justify-center gap-1 overflow-hidden px-2 py-2"
      >
        {top ? (
          <div ref={reservedTopRef} className={reservedWrapClassName}>
            {top}
          </div>
        ) : null}
        <div className={clockFitWrapperClassName}>{clock}</div>
        {bottom || controls ? (
          <div ref={reservedBottomRef} className={reservedWrapClassName}>
            {bottom}
            {controls}
          </div>
        ) : null}
      </div>
    ) : (
      <>
        {top}
        <div className={clockFitWrapperClassName}>{clock}</div>
        {bottom}
        {controls}
      </>
    );

  const activeControls =
    activeTransportContent || activeTimeAdjustContent ? (
      <>
        {activeTransportContent}
        {activeTimeAdjustContent}
      </>
    ) : null;

  const activeMainContent =
    session &&
    activeSegment &&
    renderFillPane(activeTopVisuals, countdownElement, activeBottomVisuals, activeControls);

  const idleControls = canControlSession ? (
    <>
      <DurationPresetButtons onSelect={handleQuickPreset} largeControls={fillWidth} />
      <QuickPickList
        title={t("timersTitle")}
        items={timers}
        onSelect={handleTimerSelect}
        largeControls={fillWidth}
        loadingLabel={t("loading")}
        emptyLabel={t("noSavedTimers")}
      />
    </>
  ) : null;

  const idleMainContent =
    !session &&
    renderFillPane(
      dateLocation === "above" ? dateElement : null,
      idleWallClockElement,
      dateLocation === "below" ? dateElement : null,
      idleControls,
    );

  const activeVideo = session && activeSegment ? activeSegment.audioCues.video : null;

  return (
    <div
      className={cn(
        "relative flex h-full min-h-0 min-w-0 w-full flex-col items-center justify-center overflow-hidden p-2",
      )}
    >
      <AnimatedBackground color={currentBgColor} transition={activeBgTransition} />
      {activeVideo?.youtubeId && session && (
        <YouTubeOverlay
          video={activeVideo}
          segmentKey={`${session.name}-${session.index}`}
          paused={paused}
        />
      )}
      <div
        className={cn(
          "relative z-10 min-h-0 min-w-0",
          fillWidth
            ? "flex h-full w-full min-h-0 flex-col"
            : "flex w-full max-w-2xl flex-col items-center gap-3",
        )}
        style={{ color: textColor }}
      >
        {activeMainContent}
        {idleMainContent}
      </div>
    </div>
  );
}
