export const DURATION_PRESETS = [
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

export const TIME_ADJUST_PRESETS = [
  { unit: "seconds" as const, count: 1, seconds: 1 },
  { unit: "seconds" as const, count: 10, seconds: 10 },
  { unit: "seconds" as const, count: 30, seconds: 30 },
  { unit: "minutes" as const, count: 1, seconds: 60 },
  { unit: "minutes" as const, count: 5, seconds: 300 },
] as const;

export type DurationPreset = (typeof DURATION_PRESETS)[number];
export type TimeAdjustPreset = (typeof TIME_ADJUST_PRESETS)[number];
