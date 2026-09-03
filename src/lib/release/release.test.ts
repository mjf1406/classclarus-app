import { describe, expect, test } from "vite-plus/test";

import {
  msToDatetimeLocal,
  releaseModeFromDoc,
  releasePayloadFromForm,
} from "@/lib/release/release";

describe("msToDatetimeLocal", () => {
  test("formats local date and time at minute precision", () => {
    const date = new Date(2026, 8, 3, 14, 5);
    expect(msToDatetimeLocal(date.getTime())).toBe("2026-09-03T14:05");
  });

  test("returns empty string for invalid timestamps", () => {
    expect(msToDatetimeLocal(Number.NaN)).toBe("");
  });
});

describe("releaseModeFromDoc", () => {
  test("prefers scheduled when a release time is set", () => {
    expect(
      releaseModeFromDoc({ hiddenFromStudents: true, scheduledReleaseAt: 1_700_000_000_000 }),
    ).toBe("scheduled");
  });

  test("returns hidden when the item is hidden with no schedule", () => {
    expect(releaseModeFromDoc({ hiddenFromStudents: true })).toBe("hidden");
  });

  test("returns released otherwise", () => {
    expect(releaseModeFromDoc({})).toBe("released");
    expect(releaseModeFromDoc({ hiddenFromStudents: false })).toBe("released");
  });
});

describe("releasePayloadFromForm", () => {
  test("maps released and hidden modes", () => {
    expect(releasePayloadFromForm({ releaseMode: "released" })).toEqual({
      hiddenFromStudents: false,
    });
    expect(releasePayloadFromForm({ releaseMode: "hidden" })).toEqual({
      hiddenFromStudents: true,
    });
  });

  test("parses a scheduled local datetime", () => {
    const payload = releasePayloadFromForm({
      releaseMode: "scheduled",
      scheduledReleaseAt: "2026-09-03T14:05",
    });
    expect(payload.hiddenFromStudents).toBe(true);
    expect(payload.scheduledReleaseAt).toBe(new Date(2026, 8, 3, 14, 5).getTime());
  });

  test("throws when scheduled mode has no valid datetime", () => {
    expect(() => releasePayloadFromForm({ releaseMode: "scheduled" })).toThrow(
      "Choose a release date and time.",
    );
    expect(() =>
      releasePayloadFromForm({ releaseMode: "scheduled", scheduledReleaseAt: "not-a-date" }),
    ).toThrow("Choose a release date and time.");
  });
});
