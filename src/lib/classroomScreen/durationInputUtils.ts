export type DurationUnit = "seconds" | "minutes";

function formatDecimalMinutes(minutes: number): string {
  const rounded = Math.round(minutes * 100) / 100;
  return String(rounded);
}

export function convertDurationUnit(value: string, from: DurationUnit, to: DurationUnit): string {
  if (from === to) return value;

  const numeric = Number(value);
  if (Number.isNaN(numeric)) return value;

  if (from === "minutes" && to === "seconds") {
    return String(Math.round(numeric * 60));
  }

  return formatDecimalMinutes(numeric / 60);
}

export function durationToSeconds(value: string, unit: DurationUnit): number {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return 0;
  return unit === "minutes" ? Math.round(numeric * 60) : Math.round(numeric);
}

export function secondsToDurationParts(seconds: number): { value: string; unit: DurationUnit } {
  if (seconds >= 60 && seconds % 60 === 0) {
    return { value: String(seconds / 60), unit: "minutes" };
  }
  return { value: String(seconds), unit: "seconds" };
}
