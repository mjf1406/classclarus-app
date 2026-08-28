import { describe, expect, test } from "vite-plus/test";

import { planImportedSlots, planImportedSubjects } from "./importFromClass";

describe("planImportedSubjects", () => {
  test("skips subjects whose names already exist, ignoring case", () => {
    const planned = planImportedSubjects(
      [
        { name: "Math", bgColor: "#111111", textColor: "#ffffff" },
        { name: "PE", bgColor: "#222222", textColor: "#ffffff" },
        { name: "math", bgColor: "#333333", textColor: "#000000" },
      ],
      ["MATH"],
    );
    expect(planned).toEqual([{ name: "PE", bgColor: "#222222", textColor: "#ffffff" }]);
  });

  test("copies default notes and icons for new subjects", () => {
    const planned = planImportedSubjects(
      [
        {
          name: "Art",
          bgColor: "#abcdef",
          textColor: "#000000",
          iconName: "palette",
          defaultNotesJson: '{"type":"doc"}',
        },
      ],
      [],
    );
    expect(planned[0]).toMatchObject({
      name: "Art",
      iconName: "palette",
      defaultNotesJson: '{"type":"doc"}',
    });
  });
});

describe("planImportedSlots", () => {
  test("skips slots that already exist on the same day and times", () => {
    const planned = planImportedSlots(
      [
        { day: "Monday", startTime: "09:00", endTime: "09:50", disabled: false },
        { day: "Monday", startTime: "10:00", endTime: "10:50", disabled: false },
      ],
      [{ day: "Monday", startTime: "09:00", endTime: "09:50" }],
    );
    expect(planned).toEqual([
      { day: "Monday", startTime: "10:00", endTime: "10:50", disabled: false },
    ]);
  });

  test("skips slots on days the target term does not meet", () => {
    const planned = planImportedSlots(
      [
        { day: "Monday", startTime: "09:00", endTime: "09:50", disabled: false },
        { day: "Saturday", startTime: "09:00", endTime: "09:50", disabled: false },
      ],
      [],
      new Set(["Monday"]),
    );
    expect(planned.map((slot) => slot.day)).toEqual(["Monday"]);
  });

  test("remaps link groups and drops groups with a single remaining member", () => {
    const planned = planImportedSlots(
      [
        {
          day: "Monday",
          startTime: "09:00",
          endTime: "09:50",
          disabled: false,
          linkGroupId: "old-a",
        },
        {
          day: "Tuesday",
          startTime: "09:00",
          endTime: "09:50",
          disabled: false,
          linkGroupId: "old-a",
        },
        {
          day: "Wednesday",
          startTime: "09:00",
          endTime: "09:50",
          disabled: false,
          linkGroupId: "old-b",
        },
      ],
      [{ day: "Wednesday", startTime: "09:00", endTime: "09:50" }],
    );
    expect(planned).toHaveLength(2);
    expect(planned[0]?.linkGroupId).toBeTruthy();
    expect(planned[0]?.linkGroupId).not.toBe("old-a");
    expect(planned[1]?.linkGroupId).toBe(planned[0]?.linkGroupId);
  });
});
