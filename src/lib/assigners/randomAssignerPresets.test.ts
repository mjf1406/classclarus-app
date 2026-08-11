import { describe, expect, it } from "vite-plus/test";

import {
  isClosedRandomAssignerNumber,
  mergeRandomAssignerPresetItems,
  RANDOM_ASSIGNER_PRESET_CLOSED_LETTERS,
  RANDOM_ASSIGNER_PRESET_LETTERS,
  randomAssignerItemsForPreset,
  randomAssignerPresetMaxCount,
} from "@/lib/assigners/randomAssigners";

describe("randomAssignerItemsForPreset", () => {
  it("returns the first N letters", () => {
    expect(randomAssignerItemsForPreset("letters", 3)).toEqual(["A", "B", "C"]);
    expect(randomAssignerItemsForPreset("letters", 26)).toEqual([
      ...RANDOM_ASSIGNER_PRESET_LETTERS,
    ]);
    expect(randomAssignerItemsForPreset("letters", 100)).toHaveLength(26);
  });

  it("returns closed letters without A B D O P Q", () => {
    expect(randomAssignerItemsForPreset("closedLetters", 4)).toEqual(["C", "E", "F", "G"]);
    const closed = new Set(RANDOM_ASSIGNER_PRESET_CLOSED_LETTERS);
    for (const omitted of ["A", "B", "D", "O", "P", "Q"]) {
      expect(closed.has(omitted)).toBe(false);
    }
    expect(closed.has("R")).toBe(true);
    expect(randomAssignerItemsForPreset("closedLetters", 100)).toHaveLength(
      RANDOM_ASSIGNER_PRESET_CLOSED_LETTERS.length,
    );
  });

  it("generates 1..N for numbers", () => {
    expect(randomAssignerItemsForPreset("numbers", 5)).toEqual(["1", "2", "3", "4", "5"]);
    expect(randomAssignerItemsForPreset("numbers", 40)).toHaveLength(40);
    expect(randomAssignerItemsForPreset("numbers", 40)[39]).toBe("40");
  });

  it("generates closed numbers that omit 0 4 6 8 9 digits", () => {
    expect(randomAssignerItemsForPreset("closedNumbers", 5)).toEqual(["1", "2", "3", "5", "7"]);
    expect(randomAssignerItemsForPreset("closedNumbers", 6)).toEqual([
      "1",
      "2",
      "3",
      "5",
      "7",
      "11",
    ]);
    for (const value of randomAssignerItemsForPreset("closedNumbers", 20)) {
      expect(isClosedRandomAssignerNumber(value)).toBe(true);
    }
  });

  it("returns empty for non-positive counts", () => {
    expect(randomAssignerItemsForPreset("letters", 0)).toEqual([]);
    expect(randomAssignerItemsForPreset("numbers", -2)).toEqual([]);
  });
});

describe("randomAssignerPresetMaxCount", () => {
  it("caps letter pools and allows large number counts", () => {
    expect(randomAssignerPresetMaxCount("letters")).toBe(26);
    expect(randomAssignerPresetMaxCount("closedLetters")).toBe(
      RANDOM_ASSIGNER_PRESET_CLOSED_LETTERS.length,
    );
    expect(randomAssignerPresetMaxCount("numbers")).toBe(200);
    expect(randomAssignerPresetMaxCount("closedNumbers")).toBe(200);
  });
});

describe("mergeRandomAssignerPresetItems", () => {
  it("adds the next unused items from the preset", () => {
    expect(mergeRandomAssignerPresetItems([""], "letters", 2)).toEqual(["A", "B"]);
    expect(mergeRandomAssignerPresetItems(["A", "B"], "letters", 4)).toEqual([
      "A",
      "B",
      "C",
      "D",
      "E",
      "F",
    ]);
    expect(mergeRandomAssignerPresetItems(["A", "C"], "letters", 3)).toEqual([
      "A",
      "C",
      "B",
      "D",
      "E",
    ]);
  });

  it("adds the next unused numbers", () => {
    expect(mergeRandomAssignerPresetItems(["2", "4"], "numbers", 3)).toEqual([
      "2",
      "4",
      "1",
      "3",
      "5",
    ]);
  });

  it("adds the next unused closed numbers", () => {
    expect(mergeRandomAssignerPresetItems(["1", "3"], "closedNumbers", 3)).toEqual([
      "1",
      "3",
      "2",
      "5",
      "7",
    ]);
  });
});
