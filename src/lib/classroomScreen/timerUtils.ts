export {
  durationToSeconds,
  formatDuration,
  normalizeEndTime,
  secondsUntilEndTime,
} from "../../../convex/lib/classroomScreen/timerUtils";

export type DurationUnit = "seconds" | "minutes";

export function formatDurationLabel(
  seconds: number,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  if (seconds < 60) return t("durationSecondsShort", { count: seconds });

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes < 60) {
    if (remainingSeconds === 0) return t("durationMinutesShort", { count: minutes });
    return t("durationMinutesSecondsShort", { minutes, seconds: remainingSeconds });
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) return t("durationHoursShort", { count: hours });
  return t("durationHoursMinutesShort", { hours, minutes: remainingMinutes });
}

export function secondsToDurationParts(seconds: number): {
  value: string;
  unit: DurationUnit;
} {
  if (seconds >= 60) {
    const minutes = Math.round((seconds / 60) * 100) / 100;
    return { value: String(minutes), unit: "minutes" };
  }
  return { value: String(seconds), unit: "seconds" };
}
