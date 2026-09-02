import { describe, expect, test } from "vite-plus/test";

import {
  createTimetableLessonFormSchema,
  TIMETABLE_LESSON_FORM_MESSAGES_EN,
} from "./timetableFormSchema";
import {
  classroomVisibleLessonUrl,
  normalizeOptionalLessonUrl,
  weekBundleVisibleLessonUrl,
} from "./timetableSchema";

const schema = createTimetableLessonFormSchema(TIMETABLE_LESSON_FORM_MESSAGES_EN);

const emptyLesson = {
  complete: false,
  lessonUrlShared: false,
  resources: [],
  resourcesShared: false,
  materials: [],
  announcements: [],
  agenda: [],
};

describe("normalizeOptionalLessonUrl", () => {
  test("treats blank input as absent", () => {
    expect(normalizeOptionalLessonUrl("")).toBeUndefined();
    expect(normalizeOptionalLessonUrl("   ")).toBeUndefined();
    expect(normalizeOptionalLessonUrl(undefined)).toBeUndefined();
  });

  test("keeps a trimmed http(s) URL", () => {
    expect(normalizeOptionalLessonUrl(" https://www.canva.com/design/abc ")).toBe(
      "https://www.canva.com/design/abc",
    );
  });

  test("rejects a non-http URL", () => {
    expect(() => normalizeOptionalLessonUrl("javascript:alert(1)")).toThrow(/http/);
  });
});

describe("createTimetableLessonFormSchema", () => {
  test("accepts an empty lesson URL", () => {
    expect(schema.safeParse({ ...emptyLesson, lessonUrl: "" }).success).toBe(true);
  });

  test("rejects an invalid lesson URL", () => {
    const result = schema.safeParse({ ...emptyLesson, lessonUrl: "not-a-url" });
    expect(result.success).toBe(false);
  });

  test("rejects a lesson without a share flag", () => {
    const { lessonUrlShared: _unused, ...withoutShare } = { ...emptyLesson, lessonUrl: "" };
    expect(schema.safeParse(withoutShare).success).toBe(false);
  });
});

describe("classroomVisibleLessonUrl", () => {
  test("hides an unshared URL", () => {
    expect(
      classroomVisibleLessonUrl({
        lessonUrl: "https://example.com",
        lessonUrlShared: false,
      }),
    ).toBeUndefined();
  });

  test("treats a missing share flag as hidden", () => {
    expect(classroomVisibleLessonUrl({ lessonUrl: "https://example.com" })).toBeUndefined();
  });

  test("reveals a shared URL", () => {
    expect(
      classroomVisibleLessonUrl({
        lessonUrl: "https://example.com",
        lessonUrlShared: true,
      }),
    ).toBe("https://example.com");
  });
});

describe("weekBundleVisibleLessonUrl", () => {
  test("lets managers see an unshared URL", () => {
    expect(
      weekBundleVisibleLessonUrl(
        { lessonUrl: "https://example.com", lessonUrlShared: false },
        true,
      ),
    ).toBe("https://example.com");
  });

  test("hides an unshared URL from other roles", () => {
    expect(
      weekBundleVisibleLessonUrl(
        { lessonUrl: "https://example.com", lessonUrlShared: false },
        false,
      ),
    ).toBeUndefined();
  });
});
