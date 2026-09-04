export {
  DEFAULT_CLOCK_SETTINGS,
  DEFAULT_DISPLAY_CONTENT_FONT_SIZE,
  DEFAULT_DISPLAY_HEADING_FONT_SIZE,
  DEFAULT_DISPLAY_SECTION_HEADING_FONT_SIZE,
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
export type SizeStepDirection = "up" | "down";

export type ClockFontSizes = {
  clockSize: number;
  dateSize: number;
  currentTimeSize: number;
  endTimeSize: number;
  timerTitleSize: number;
};

export type LessonFontSizes = {
  displayContentFontSize: number;
  displayHeadingFontSize: number;
};

export function snapToSizeOption(value: number, options: readonly { value: number }[]): number {
  return options.reduce(
    (closest, option) =>
      Math.abs(option.value - value) < Math.abs(closest.value - value) ? option : closest,
    options[0]!,
  ).value;
}

export function stepSizeOption(
  value: number,
  options: readonly { value: number }[],
  direction: SizeStepDirection,
): number {
  const snapped = snapToSizeOption(value, options);
  const index = options.findIndex((option) => option.value === snapped);
  const nextIndex = direction === "up" ? index + 1 : index - 1;
  if (nextIndex < 0) return options[0]!.value;
  if (nextIndex >= options.length) return options[options.length - 1]!.value;
  return options[nextIndex]!.value;
}

export function canStepSizeOption(
  value: number,
  options: readonly { value: number }[],
  direction: SizeStepDirection,
): boolean {
  return stepSizeOption(value, options, direction) !== snapToSizeOption(value, options);
}

export function stepClockFontSizes(
  sizes: ClockFontSizes,
  direction: SizeStepDirection,
): ClockFontSizes {
  return {
    clockSize: stepSizeOption(sizes.clockSize, CLOCK_SIZE_OPTIONS, direction),
    dateSize: stepSizeOption(sizes.dateSize, DATE_SIZE_OPTIONS, direction),
    currentTimeSize: stepSizeOption(sizes.currentTimeSize, DATE_SIZE_OPTIONS, direction),
    endTimeSize: stepSizeOption(sizes.endTimeSize, DATE_SIZE_OPTIONS, direction),
    timerTitleSize: stepSizeOption(sizes.timerTitleSize, DATE_SIZE_OPTIONS, direction),
  };
}

export function canStepClockFontSizes(
  sizes: ClockFontSizes,
  direction: SizeStepDirection,
): boolean {
  return (
    canStepSizeOption(sizes.clockSize, CLOCK_SIZE_OPTIONS, direction) ||
    canStepSizeOption(sizes.dateSize, DATE_SIZE_OPTIONS, direction) ||
    canStepSizeOption(sizes.currentTimeSize, DATE_SIZE_OPTIONS, direction) ||
    canStepSizeOption(sizes.endTimeSize, DATE_SIZE_OPTIONS, direction) ||
    canStepSizeOption(sizes.timerTitleSize, DATE_SIZE_OPTIONS, direction)
  );
}

export function stepLessonFontSizes(
  sizes: LessonFontSizes,
  direction: SizeStepDirection,
): LessonFontSizes {
  return {
    displayContentFontSize: stepSizeOption(
      sizes.displayContentFontSize,
      DISPLAY_FONT_SIZE_OPTIONS,
      direction,
    ),
    displayHeadingFontSize: stepSizeOption(
      sizes.displayHeadingFontSize,
      DISPLAY_FONT_SIZE_OPTIONS,
      direction,
    ),
  };
}

export function canStepLessonFontSizes(
  sizes: LessonFontSizes,
  direction: SizeStepDirection,
): boolean {
  return (
    canStepSizeOption(sizes.displayContentFontSize, DISPLAY_FONT_SIZE_OPTIONS, direction) ||
    canStepSizeOption(sizes.displayHeadingFontSize, DISPLAY_FONT_SIZE_OPTIONS, direction)
  );
}
