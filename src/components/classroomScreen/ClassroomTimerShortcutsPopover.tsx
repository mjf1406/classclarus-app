import { useCallback, useState } from "react";
import { Pause, Play, SkipForward, Square, Timer } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "@/components/ui/toast-manager";
import {
  useAdjustClassroomSession,
  usePauseClassroomSession,
  useResumeClassroomSession,
  useSkipClassroomSessionSegment,
  useStartClassroomSession,
  useStopClassroomSession,
} from "@/hooks/classroomScreen/useClassroomScreenMutations";
import {
  classroomMinuteBucket,
  useClassroomDisplayBundle,
  useClassroomRotations,
  useClassroomTimers,
} from "@/hooks/classroomScreen/useClassroomScreenQueries";
import { useCan } from "@/hooks/permissions/useCan";
import type { AudioCues } from "@/lib/classroomScreen/audioCues";
import {
  buildCustomTimerSession,
  buildQuickPresetSession,
  buildRotationSession,
  parseSessionJson,
  remainingFromDisplaySession,
  type ActiveSession,
} from "@/lib/classroomScreen/activeSession";
import { DEFAULT_CLOCK_SETTINGS } from "@/lib/classroomScreen/clockSettings";
import { TimeAdjustControls } from "@/components/classroomScreen/TimeAdjustControls";
import { DURATION_PRESETS } from "@/lib/classroomScreen/durationPresets";
import { messageFromError } from "@/lib/errors/convexError";
import type { Id } from "../../../convex/_generated/dataModel";

type ClassroomTimerShortcutsPopoverProps = {
  classId: Id<"classes">;
};

export function ClassroomTimerShortcutsPopover({ classId }: ClassroomTimerShortcutsPopoverProps) {
  const { t } = useTranslation("classroomScreen");
  const { can, isPending: permissionsPending } = useCan();
  const canManage = !permissionsPending && can("classroomScreen:manage");
  const [minuteBucket] = useState(() => classroomMinuteBucket());

  const queryClassId = canManage ? classId : undefined;
  const { data: displayBundle } = useClassroomDisplayBundle(queryClassId, minuteBucket);
  const { data: timers } = useClassroomTimers(queryClassId);
  const { data: rotations } = useClassroomRotations(queryClassId);

  const startSession = useStartClassroomSession();
  const stopSession = useStopClassroomSession();
  const pauseSession = usePauseClassroomSession();
  const resumeSession = useResumeClassroomSession();
  const adjustSession = useAdjustClassroomSession();
  const skipSegment = useSkipClassroomSessionSegment();

  const session = parseSessionJson(displayBundle?.displaySession.sessionJson);
  const endsAt = displayBundle?.displaySession.endsAt ?? null;
  const paused = displayBundle?.displaySession.paused ?? false;
  const pausedRemainingMs = displayBundle?.displaySession.pausedRemainingMs ?? null;
  const remaining = remainingFromDisplaySession(endsAt, paused, pausedRemainingMs);
  const canSkip = session != null && session.segments.length > 1;

  const timerBgColor = displayBundle?.settings.timerBgColor ?? DEFAULT_CLOCK_SETTINGS.timerBgColor;
  const globalAudioCues = displayBundle?.settings.audioCues as AudioCues | undefined;

  const busy =
    startSession.isPending ||
    stopSession.isPending ||
    pauseSession.isPending ||
    resumeSession.isPending ||
    adjustSession.isPending ||
    skipSegment.isPending;

  const showControlError = useCallback(
    (error: unknown) => {
      toast.add({
        type: "error",
        title: messageFromError(error, t("sessionControlError")),
      });
    },
    [t],
  );

  const handleStartSession = useCallback(
    async (nextSession: ActiveSession) => {
      try {
        await startSession.mutateAsync({ classId, session: nextSession });
      } catch (error) {
        showControlError(error);
      }
    },
    [classId, showControlError, startSession],
  );

  const handleQuickPreset = useCallback(
    (seconds: number) => {
      void handleStartSession(buildQuickPresetSession(seconds, timerBgColor, globalAudioCues));
    },
    [globalAudioCues, handleStartSession, timerBgColor],
  );

  const handleAdjust = useCallback(
    async (deltaSeconds: number) => {
      const currentRemaining = remainingFromDisplaySession(endsAt, paused, pausedRemainingMs);
      if (currentRemaining + deltaSeconds < 0) {
        return;
      }
      try {
        await adjustSession.mutateAsync({ classId, deltaSeconds });
      } catch (error) {
        showControlError(error);
      }
    },
    [adjustSession, classId, endsAt, paused, pausedRemainingMs, showControlError],
  );

  const handlePauseToggle = useCallback(async () => {
    const remainingMs = paused
      ? (pausedRemainingMs ?? (endsAt ? Math.max(0, endsAt - Date.now()) : 0))
      : endsAt
        ? Math.max(0, endsAt - Date.now())
        : 0;
    try {
      if (paused) {
        await resumeSession.mutateAsync({ classId, remainingMs });
      } else {
        await pauseSession.mutateAsync({ classId, remainingMs });
      }
    } catch (error) {
      showControlError(error);
    }
  }, [classId, endsAt, pauseSession, paused, pausedRemainingMs, resumeSession, showControlError]);

  const handleSkip = useCallback(async () => {
    try {
      await skipSegment.mutateAsync({ classId });
    } catch (error) {
      showControlError(error);
    }
  }, [classId, showControlError, skipSegment]);

  const handleStop = useCallback(async () => {
    try {
      await stopSession.mutateAsync({ classId });
    } catch (error) {
      showControlError(error);
    }
  }, [classId, showControlError, stopSession]);

  if (!canManage) {
    return null;
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button type="button" variant="ghost" size="icon" aria-label={t("timerShortcutsLabel")} />
        }
      >
        <Timer />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-max max-w-[calc(100vw-2rem)] gap-3">
        <PopoverHeader>
          <PopoverTitle>{t("timerShortcutsLabel")}</PopoverTitle>
        </PopoverHeader>

        {session ? (
          <div className="flex flex-col gap-2">
            <TimeAdjustControls
              remaining={remaining}
              onAdjust={(delta) => void handleAdjust(delta)}
              size="xs"
              disabled={busy}
            />
            <div className="flex flex-wrap items-center gap-1">
              <Button
                type="button"
                variant="secondary"
                size="xs"
                disabled={busy}
                onClick={() => void handlePauseToggle()}
              >
                {paused ? <Play /> : <Pause />}
                {paused ? t("transportResume") : t("transportPause")}
              </Button>
              {canSkip ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="xs"
                  disabled={busy}
                  onClick={() => void handleSkip()}
                >
                  <SkipForward />
                  {t("transportSkip")}
                </Button>
              ) : null}
              <Button
                type="button"
                variant="secondary"
                size="xs"
                disabled={busy}
                onClick={() => void handleStop()}
              >
                <Square />
                {t("transportStop")}
              </Button>
            </div>
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-muted-foreground">{t("timersTitle")}</p>
          <div className="flex flex-wrap gap-1">
            {DURATION_PRESETS.map((preset) => (
              <Button
                key={`${preset.unit}-${preset.count}`}
                type="button"
                variant="secondary"
                size="xs"
                disabled={busy}
                onClick={() => handleQuickPreset(preset.seconds)}
              >
                {t(preset.unit === "seconds" ? "presetSeconds" : "presetMinutes", {
                  count: preset.count,
                })}
              </Button>
            ))}
          </div>
          {timers === undefined ? (
            <p className="text-xs text-muted-foreground">{t("loading")}</p>
          ) : timers.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("noSavedTimers")}</p>
          ) : (
            <div className="flex flex-wrap gap-1">
              {timers.map((timer) => (
                <Button
                  key={timer._id}
                  type="button"
                  variant="secondary"
                  size="xs"
                  disabled={busy}
                  onClick={() =>
                    void handleStartSession(
                      buildCustomTimerSession(
                        timer,
                        displayBundle?.timeZone ?? "UTC",
                        globalAudioCues,
                        timers,
                      ),
                    )
                  }
                >
                  {timer.name}
                </Button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-muted-foreground">{t("rotationsTitle")}</p>
          {rotations === undefined ? (
            <p className="text-xs text-muted-foreground">{t("loading")}</p>
          ) : rotations.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("noSavedRotations")}</p>
          ) : (
            <div className="flex flex-wrap gap-1">
              {rotations.map((rotation) => (
                <Button
                  key={rotation._id}
                  type="button"
                  variant="secondary"
                  size="xs"
                  disabled={busy}
                  onClick={() =>
                    void handleStartSession(buildRotationSession(rotation, globalAudioCues))
                  }
                >
                  {rotation.name}
                </Button>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
