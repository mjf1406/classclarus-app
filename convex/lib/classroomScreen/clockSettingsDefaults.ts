/** Default classroom clock settings (non-rotation). */

export const DEFAULT_CLOCK_SIZE = 72;
export const DEFAULT_DATE_SIZE = 24;
export const DEFAULT_CURRENT_TIME_SIZE = 24;
export const DEFAULT_END_TIME_SIZE = 24;
export const DEFAULT_TIMER_TITLE_SIZE = 20;
export const DEFAULT_DISPLAY_CONTENT_FONT_SIZE = 16;
export const DEFAULT_DISPLAY_HEADING_FONT_SIZE = 32;
export const DEFAULT_DISPLAY_SECTION_HEADING_FONT_SIZE = 24;
export const DEFAULT_QUICK_TEXT_TITLE = "Quick text";

export const DISPLAY_FONT_SIZE_VALUES = [
  12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 56, 64,
] as const;

export type DisplayFontSize = (typeof DISPLAY_FONT_SIZE_VALUES)[number];

export function isDisplayFontSize(value: number): value is DisplayFontSize {
  return (DISPLAY_FONT_SIZE_VALUES as readonly number[]).includes(value);
}

export const DEFAULT_CLOCK_SETTINGS = {
  clockSize: DEFAULT_CLOCK_SIZE,
  dateSize: DEFAULT_DATE_SIZE,
  clockBgColor: "#ffffff",
  timerBgColor: "#15803d",
  dateLocation: "above" as const,
  timeFormat: "24h" as const,
  currentTimeSize: DEFAULT_CURRENT_TIME_SIZE,
  endTimeSize: DEFAULT_END_TIME_SIZE,
  timerTitleSize: DEFAULT_TIMER_TITLE_SIZE,
  timerEndBehavior: "countUp" as const,
  overtimeAutoDismissSeconds: 0,
  bgTransition: "circle",
  displayContentFontSize: DEFAULT_DISPLAY_CONTENT_FONT_SIZE,
  displayHeadingFontSize: DEFAULT_DISPLAY_HEADING_FONT_SIZE,
  displaySectionHeadingFontSize: DEFAULT_DISPLAY_SECTION_HEADING_FONT_SIZE,
  quickTextTitle: DEFAULT_QUICK_TEXT_TITLE,
};
