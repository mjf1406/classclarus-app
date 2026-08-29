export {
  DEFAULT_CLOCK_SETTINGS,
  DEFAULT_DISPLAY_CONTENT_FONT_SIZE,
  DEFAULT_DISPLAY_HEADING_FONT_SIZE,
  DEFAULT_QUICK_TEXT_TITLE,
} from "../../../convex/lib/classroomScreen/clockSettingsDefaults";

export const CLOCK_SIZE_OPTIONS = [
  { value: 32, labelKey: "sizeTiny" },
  { value: 40, labelKey: "sizeExtraSmall" },
  { value: 48, labelKey: "sizeSmall" },
  { value: 56, labelKey: "sizeCompact" },
  { value: 64, labelKey: "sizeModerate" },
  { value: 72, labelKey: "sizeMedium" },
  { value: 88, labelKey: "sizeMediumLarge" },
  { value: 96, labelKey: "sizeLarge" },
  { value: 112, labelKey: "sizeExtraLarge" },
  { value: 120, labelKey: "sizeVeryLarge" },
  { value: 144, labelKey: "sizeHuge" },
  { value: 168, labelKey: "sizeGiant" },
  { value: 192, labelKey: "sizeMassive" },
] as const;

export const DATE_SIZE_OPTIONS = [
  { value: 12, labelKey: "sizeTiny" },
  { value: 16, labelKey: "sizeExtraSmall" },
  { value: 20, labelKey: "sizeSmall" },
  { value: 24, labelKey: "sizeMedium" },
  { value: 28, labelKey: "sizeModerate" },
  { value: 32, labelKey: "sizeLarge" },
  { value: 40, labelKey: "sizeExtraLarge" },
  { value: 48, labelKey: "sizeHuge" },
  { value: 56, labelKey: "sizeGiant" },
  { value: 64, labelKey: "sizeMassive" },
] as const;

export const DISPLAY_FONT_SIZE_OPTIONS = [
  { value: 12 },
  { value: 14 },
  { value: 16 },
  { value: 18 },
  { value: 20 },
  { value: 24 },
  { value: 28 },
  { value: 32 },
  { value: 36 },
  { value: 40 },
  { value: 48 },
  { value: 56 },
  { value: 64 },
] as const;

export type SizeLabelKey = (typeof CLOCK_SIZE_OPTIONS)[number]["labelKey"];

export function snapToSizeOption(value: number, options: readonly { value: number }[]): number {
  return options.reduce(
    (closest, option) =>
      Math.abs(option.value - value) < Math.abs(closest.value - value) ? option : closest,
    options[0]!,
  ).value;
}
