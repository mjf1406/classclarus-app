import { describe, expect, test } from "vite-plus/test";

import {
  canStepClockFontSizes,
  canStepLessonFontSizes,
  canStepSizeOption,
  CLOCK_SIZE_OPTIONS,
  DATE_SIZE_OPTIONS,
  DISPLAY_FONT_SIZE_OPTIONS,
  snapToSizeOption,
  stepClockFontSizes,
  stepLessonFontSizes,
  stepSizeOption,
} from "./clockSettings";

describe("snapToSizeOption", () => {
  test("returns the nearest option", () => {
    expect(snapToSizeOption(70, CLOCK_SIZE_OPTIONS)).toBe(72);
    expect(snapToSizeOption(13, DATE_SIZE_OPTIONS)).toBe(12);
  });

  test("returns an exact match unchanged", () => {
    expect(snapToSizeOption(24, DISPLAY_FONT_SIZE_OPTIONS)).toBe(24);
  });
});

describe("stepSizeOption", () => {
  test("steps up and down from a snapped value", () => {
    expect(stepSizeOption(72, CLOCK_SIZE_OPTIONS, "up")).toBe(88);
    expect(stepSizeOption(72, CLOCK_SIZE_OPTIONS, "down")).toBe(64);
  });

  test("snaps off-scale values before stepping", () => {
    expect(stepSizeOption(70, CLOCK_SIZE_OPTIONS, "up")).toBe(88);
    expect(stepSizeOption(70, CLOCK_SIZE_OPTIONS, "down")).toBe(64);
  });

  test("clamps at the first and last options", () => {
    expect(stepSizeOption(32, CLOCK_SIZE_OPTIONS, "down")).toBe(32);
    expect(stepSizeOption(192, CLOCK_SIZE_OPTIONS, "up")).toBe(192);
    expect(stepSizeOption(12, DISPLAY_FONT_SIZE_OPTIONS, "down")).toBe(12);
    expect(stepSizeOption(64, DISPLAY_FONT_SIZE_OPTIONS, "up")).toBe(64);
  });
});

describe("canStepSizeOption", () => {
  test("is false at each boundary after snapping", () => {
    expect(canStepSizeOption(32, CLOCK_SIZE_OPTIONS, "down")).toBe(false);
    expect(canStepSizeOption(33, CLOCK_SIZE_OPTIONS, "down")).toBe(false);
    expect(canStepSizeOption(192, CLOCK_SIZE_OPTIONS, "up")).toBe(false);
  });

  test("is true when another step exists", () => {
    expect(canStepSizeOption(32, CLOCK_SIZE_OPTIONS, "up")).toBe(true);
    expect(canStepSizeOption(192, CLOCK_SIZE_OPTIONS, "down")).toBe(true);
    expect(canStepSizeOption(70, CLOCK_SIZE_OPTIONS, "up")).toBe(true);
  });
});

describe("stepClockFontSizes", () => {
  const mid = {
    clockSize: 72,
    dateSize: 24,
    currentTimeSize: 24,
    endTimeSize: 24,
    timerTitleSize: 20,
  };

  test("steps every clock size on its own scale", () => {
    expect(stepClockFontSizes(mid, "up")).toEqual({
      clockSize: 88,
      dateSize: 28,
      currentTimeSize: 28,
      endTimeSize: 28,
      timerTitleSize: 24,
    });
    expect(stepClockFontSizes(mid, "down")).toEqual({
      clockSize: 64,
      dateSize: 20,
      currentTimeSize: 20,
      endTimeSize: 20,
      timerTitleSize: 16,
    });
  });

  test("clamps each field independently", () => {
    const mixed = {
      clockSize: 192,
      dateSize: 12,
      currentTimeSize: 24,
      endTimeSize: 64,
      timerTitleSize: 20,
    };
    expect(stepClockFontSizes(mixed, "up")).toEqual({
      clockSize: 192,
      dateSize: 16,
      currentTimeSize: 28,
      endTimeSize: 64,
      timerTitleSize: 24,
    });
  });
});

describe("canStepClockFontSizes", () => {
  test("is false only when every clock size is at that boundary", () => {
    expect(
      canStepClockFontSizes(
        {
          clockSize: 32,
          dateSize: 12,
          currentTimeSize: 12,
          endTimeSize: 12,
          timerTitleSize: 12,
        },
        "down",
      ),
    ).toBe(false);
    expect(
      canStepClockFontSizes(
        {
          clockSize: 192,
          dateSize: 12,
          currentTimeSize: 12,
          endTimeSize: 12,
          timerTitleSize: 12,
        },
        "down",
      ),
    ).toBe(true);
  });
});

describe("stepLessonFontSizes", () => {
  test("steps body and heading sizes together", () => {
    expect(
      stepLessonFontSizes({ displayContentFontSize: 16, displayHeadingFontSize: 32 }, "up"),
    ).toEqual({
      displayContentFontSize: 18,
      displayHeadingFontSize: 36,
    });
  });

  test("does not include section heading size", () => {
    const next = stepLessonFontSizes(
      { displayContentFontSize: 16, displayHeadingFontSize: 32 },
      "down",
    );
    expect(next).toEqual({
      displayContentFontSize: 14,
      displayHeadingFontSize: 28,
    });
    expect(next).not.toHaveProperty("displaySectionHeadingFontSize");
  });
});

describe("canStepLessonFontSizes", () => {
  test("is false only when both lesson sizes are at that boundary", () => {
    expect(
      canStepLessonFontSizes({ displayContentFontSize: 12, displayHeadingFontSize: 12 }, "down"),
    ).toBe(false);
    expect(
      canStepLessonFontSizes({ displayContentFontSize: 12, displayHeadingFontSize: 16 }, "down"),
    ).toBe(true);
  });
});
