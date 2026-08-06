export type CountdownUnit = "second" | "minute" | "hour" | "day";

/** Pick the largest useful countdown unit for the remaining duration. */
export function pickCountdownUnit(remainingMs: number): { value: number; unit: CountdownUnit } {
  if (remainingMs <= 0) {
    return { value: 0, unit: "second" };
  }

  const remainingSeconds = Math.floor(remainingMs / 1000);
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
