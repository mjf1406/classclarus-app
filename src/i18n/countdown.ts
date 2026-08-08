export type CountdownUnit = "second" | "minute" | "hour" | "day";

export type DueDurationUnit = "minute" | "hour" | "day";

/** Pick the largest useful unit for an absolute duration (days → hours → minutes → seconds). */
export function pickDurationUnit(durationMs: number): { value: number; unit: CountdownUnit } {
  const remainingSeconds = Math.floor(Math.abs(durationMs) / 1000);
  if (remainingSeconds < 60) {
    return { value: remainingSeconds, unit: "second" };
  }

  const remainingMinutes = Math.floor(remainingSeconds / 60);
  if (remainingMinutes < 60) {
    return { value: remainingMinutes, unit: "minute" };
  }

  const remainingHours = Math.floor(remainingMinutes / 60);
  if (remainingHours < 24) {
    return { value: remainingHours, unit: "hour" };
  }

  const remainingDays = Math.floor(remainingHours / 24);
  return { value: remainingDays, unit: "day" };
}

/** Pick the largest useful countdown unit for the remaining duration. */
export function pickCountdownUnit(remainingMs: number): { value: number; unit: CountdownUnit } {
  if (remainingMs <= 0) {
    return { value: 0, unit: "second" };
  }
  return pickDurationUnit(remainingMs);
}

/**
 * Largest useful unit for due-date relative labels (days → hours → minutes).
 * Returns null when under one minute (too noisy for due dates).
 */
export function pickDueDurationUnit(
  durationMs: number,
): { value: number; unit: DueDurationUnit } | null {
  const absMs = Math.abs(durationMs);
  if (absMs < 60_000) return null;

  const { value, unit } = pickDurationUnit(absMs);
  if (unit === "second") return null;
  return { value, unit };
}
