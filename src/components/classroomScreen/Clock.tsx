import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ListPlus, Pause, Play, RotateCcw, SkipForward, Square, TimerOff } from "lucide-react";
import { useTranslation } from "react-i18next";

import { AnimatedBackground } from "@/components/classroomScreen/AnimatedBackground";
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
  useClassroomScreenBundle,
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
}: ClockProps) {
  const { t, i18n } = useTranslation("classroomScreen");
  const locale = toIntlLocale(i18n.language);
  const [now, setNow] = useState(() => new Date());
  const [queuePopoverOpen, setQueuePopoverOpen] = useState(false);
  const [tick, setTick] = useState(0);

  const { data: bundle } = useClassroomScreenBundle(classId);
  const startSession = useStartClassroomSession();
  const stopSessionMutation = useStopClassroomSession();
  const pauseSession = usePauseClassroomSession();
  const resumeSession = useResumeClassroomSession();
  const adjustSession = useAdjustClassroomSession();
  const skipSegmentMutation = useSkipClassroomSessionSegment();
  const updateSession = useUpdateClassroomSession();

  const displaySession = bundle?.displaySession;
  const timers = bundle?.timers;
  const session = useMemo(
    () => parseSessionJson(displaySession?.sessionJson),
    [displaySession?.sessionJson],
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

  const urlMap = createAudioUrlMap(toAudioUrlList(bundle?.audioFiles ?? []));
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
      if (!isRunner) return;
      const segment = activeSession.segments[activeSession.index]!;
      stopPlayDuringRef.current();
      playByIdRef.current(
        segment.audioCues.segmentStart.audioId,
        segment.audioCues.segmentStart.repeat,
      );
      startPlayDuringRef.current(segment.audioCues.playDuring.audioId);
    },
    [isRunner],
  );

  const currentBgColor = getCurrentBgColor(session, clockBgColor);
  const activeBgTransition = resolveBgTransition(session?.bgTransition, bgTransition);
  const textColor = getContrastTextColor(currentBgColor);
  const overtimeTextColor = getOvertimeTextColor(currentBgColor);

  const handleStartSession = useCallback(
    async (newSession: ActiveSession) => {
      unlock();
      if (isRunner) {
        resetSegmentAudioState(newSession.index);
        prevRemainingRef.current = resolveSegmentDuration(newSession.segments[newSession.index]!);
        playSegmentStart(newSession);
      }
      await startSession.mutateAsync({ classId, session: newSession });
    },
    [classId, unlock, isRunner, resetSegmentAudioState, playSegmentStart, startSession],
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
      if (!session) return;
      const updated = appendTimerToSession(session, timer, globalAudioCues);
      await updateSession.mutateAsync({ classId, session: updated });
      setQueuePopoverOpen(false);
    },
    [session, globalAudioCues, updateSession, classId],
  );

  const handleClearUpcoming = useCallback(async () => {
    const current = sessionRef.current;
    if (!current || !hasUpcomingSegments(current)) return;
    const updated = truncateUpcomingSegments(current);
    await updateSession.mutateAsync({ classId, session: updated });
  }, [updateSession, classId]);

  const adjustTime = useCallback(
    (deltaSeconds: number) => {
      void adjustSession.mutateAsync({ classId, deltaSeconds });
    },
    [classId, adjustSession],
  );

  const stopSession = useCallback(
    async (playSound = false) => {
      if (playSound && isRunner && sessionRef.current) {
        stopAllRef.current();
        const segment = getCurrentSegment(sessionRef.current);
        playByIdRef.current(segment.audioCues.stop.audioId, segment.audioCues.stop.repeat, true);
      } else if (isRunner) {
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
    [classId, isRunner, stopSessionMutation],
  );

  const skipSegment = useCallback(async () => {
    const current = sessionRef.current;
    if (!current) return;

    if (isRunner) {
      const segment = getCurrentSegment(current);
      stopPlayDuringRef.current();
      playByIdRef.current(segment.audioCues.skip.audioId, segment.audioCues.skip.repeat);
    }

    await skipSegmentMutation.mutateAsync({ classId });
    const nextSession = sessionRef.current;
    if (nextSession && isRunner) {
      resetSegmentAudioState(nextSession.index);
      prevRemainingRef.current = resolveSegmentDuration(nextSession.segments[nextSession.index]!);
      playSegmentStart(nextSession);
    } else if (!nextSession && isRunner) {
      stopAllRef.current();
    }
  }, [classId, isRunner, resetSegmentAudioState, playSegmentStart, skipSegmentMutation]);

  const handlePauseToggle = useCallback(async () => {
    const current = sessionRef.current;
    if (!current) return;

    if (paused) {
      const remainingMs = pausedRemainingMs ?? (endsAt ? Math.max(0, endsAt - Date.now()) : 0);
      if (isRunner) {
        const cues = getCurrentSegment(current).audioCues;
        playByIdRef.current(cues.resume.audioId, cues.resume.repeat, true, true);
        resumeAllRef.current();
      }
      await resumeSession.mutateAsync({ classId, remainingMs });
    } else {
      const remainingMs = endsAt ? Math.max(0, endsAt - Date.now()) : 0;
      if (isRunner) {
        pauseAllRef.current();
        const cues = getCurrentSegment(current).audioCues;
        playByIdRef.current(cues.pause.audioId, cues.pause.repeat, true, true);
      }
      await pauseSession.mutateAsync({ classId, remainingMs });
    }
  }, [classId, paused, pausedRemainingMs, endsAt, isRunner, resumeSession, pauseSession]);

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
      setTick((value) => value + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!isRunner || !session) return;
    if (lastSessionIndexRef.current !== session.index) {
      lastSessionIndexRef.current = session.index;
      resetSegmentAudioState(session.index);
      prevRemainingRef.current = remaining;
      playSegmentStart(session);
    }
  }, [session, isRunner, resetSegmentAudioState, playSegmentStart, remaining]);

  useEffect(() => {
    if (!isRunner || !session || paused) return;

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
  }, [remaining, session, paused, timerEndBehavior, isRunner]);

  useEffect(() => {
    if (!isRunner || !session || paused) return;
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
    isRunner,
    resetSegmentAudioState,
    playSegmentStart,
    skipSegmentMutation,
  ]);

  useEffect(() => {
    if (!isRunner || !session || paused) return;
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
    isRunner,
  ]);

  const dateElement = (
    <p className="font-mono tabular-nums" style={{ fontSize: `${dateSize}px` }}>
      {formatDate(now, locale)}
    </p>
  );

  const wallTimeElement = (
    <p className="font-mono tabular-nums" style={{ fontSize: `${currentTimeSize}px` }}>
      {formatWallTime(now, timeFormat, locale)}
    </p>
  );

  const countdownElement = (
    <time
      className="font-mono tabular-nums leading-none tracking-tight select-none"
      style={{
        fontSize: `${clockSize}px`,
        color: remaining < 0 ? overtimeTextColor : undefined,
      }}
    >
      {formatCountdown(remaining)}
    </time>
  );

  const idleWallClockElement = (
    <time
      className="font-mono tabular-nums leading-none tracking-tight select-none"
      style={{ fontSize: `${clockSize}px` }}
      dateTime={now.toISOString()}
    >
      {formatTime(now, timeFormat, locale)}
    </time>
  );

  const activeSegment = session ? getCurrentSegment(session) : null;
  const upcomingSegments = session ? session.segments.slice(session.index + 1) : [];
  const hasUpcoming = session ? hasUpcomingSegments(session) : false;

  const activeVisualContent = session && activeSegment && (
    <>
      <div className="flex w-full flex-col items-center gap-1">
        {dateLocation === "above" && dateElement}
        {wallTimeElement}
      </div>
      <div className="flex w-full flex-col items-center gap-1">
        <p className="font-medium" style={{ fontSize: `${timerTitleSize}px` }}>
          {activeSegment.label}
        </p>
        {countdownElement}
        {dateLocation === "below" && dateElement}
      </div>
      <div className="flex flex-col items-center gap-1" style={{ fontSize: `${endTimeSize}px` }}>
        <p className="font-mono tabular-nums">
          {t("endsAt")} {endsAt !== null ? formatEndTimestamp(endsAt, timeFormat, locale) : ""}
        </p>
        {upcomingSegments.length > 0 && (
          <div className="flex flex-col items-center gap-0.5 opacity-70">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">{t("upNext")}</p>
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

  const activeTransportContent = session && activeSegment && !compact && (
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

  const activeTimeAdjustContent = session && activeSegment && showTimeAdjust && compact && (
    <div className="flex w-full min-w-0 flex-col items-center gap-3 px-4">
      <TimeAdjustControls remaining={remaining} onAdjust={adjustTime} showProminentThirty={false} />
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

  const activeMainContent =
    session &&
    activeSegment &&
    (fillWidth ? (
      <div className="flex h-full w-full items-center justify-center overflow-y-auto px-2 py-2">
        <div className="flex w-full flex-col items-center gap-3">
          {activeVisualContent}
          {activeTransportContent}
          {activeTimeAdjustContent}
        </div>
      </div>
    ) : (
      <>
        {activeVisualContent}
        {activeTransportContent}
        {activeTimeAdjustContent}
      </>
    ));

  const idleClockCluster = (
    <div className="flex w-full flex-col items-center gap-1">
      {dateLocation === "above" && dateElement}
      {idleWallClockElement}
      {dateLocation === "below" && dateElement}
    </div>
  );

  const idleControls = (
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
  );

  const idleMainContent =
    !session &&
    (fillWidth ? (
      <div className="flex h-full w-full items-center justify-center overflow-y-auto px-2 py-2">
        <div className="flex w-full flex-col items-center gap-3">
          {idleClockCluster}
          {idleControls}
        </div>
      </div>
    ) : (
      <>
        {idleClockCluster}
        {idleControls}
      </>
    ));

  const activeVideo = session && activeSegment ? activeSegment.audioCues.video : null;

  return (
    <div
      className={cn(
        "relative flex h-full w-full flex-col items-center overflow-hidden p-2",
        !fillWidth && "justify-center",
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
          "relative z-10",
          fillWidth ? "h-full w-full" : "flex w-full max-w-2xl flex-col items-center gap-3",
        )}
        style={{ color: textColor }}
      >
        {activeMainContent}
        {idleMainContent}
      </div>
    </div>
  );
}
