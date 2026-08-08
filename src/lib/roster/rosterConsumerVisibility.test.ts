import { describe, expect, test } from "vite-plus/test";

import {
  parseRosterConsumerVisibility,
  rosterConsumerVisibilityStorageKey,
  serializeRosterConsumerVisibility,
} from "./rosterConsumerVisibility";
import { DEFAULT_ROSTER_COLUMN_VISIBILITY } from "./roster";

describe("rosterConsumerVisibility", () => {
  test("storage key is scoped by surface and class", () => {
    const key = rosterConsumerVisibilityStorageKey("class123", "tasks");
    expect(key).toContain("tasks");
    expect(key).toContain("class123");
    expect(key).toContain("roster-col-vis");
  });

  test("parse returns null for empty or invalid payloads", () => {
    expect(parseRosterConsumerVisibility(null)).toBeNull();
    expect(parseRosterConsumerVisibility("")).toBeNull();
    expect(parseRosterConsumerVisibility("not-json")).toBeNull();
    expect(parseRosterConsumerVisibility("[]")).toBeNull();
    expect(parseRosterConsumerVisibility("{}")).toBeNull();
  });

  test("parse normalizes known column ids and fills defaults", () => {
    const parsed = parseRosterConsumerVisibility(
      JSON.stringify({ email: false, unknownColumn: true }),
    );
    expect(parsed).not.toBeNull();
    expect(parsed?.email).toBe(false);
    expect(parsed?.firstName).toBe(DEFAULT_ROSTER_COLUMN_VISIBILITY.firstName);
  });

  test("serialize round-trips through parse", () => {
    const next = { ...DEFAULT_ROSTER_COLUMN_VISIBILITY, gender: false };
    const parsed = parseRosterConsumerVisibility(serializeRosterConsumerVisibility(next));
    expect(parsed).toEqual(next);
  });
});
