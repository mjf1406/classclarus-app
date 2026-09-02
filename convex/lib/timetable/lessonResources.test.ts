import { describe, expect, test } from "vite-plus/test";

import {
  createTimetableLessonFormSchema,
  TIMETABLE_LESSON_FORM_MESSAGES_EN,
} from "./timetableFormSchema";
import {
  classroomVisibleResources,
  MAX_LESSON_RESOURCES,
  MAX_RESOURCE_LABEL_LENGTH,
  normalizeLessonResources,
  weekBundleVisibleResources,
} from "./timetableSchema";

const schema = createTimetableLessonFormSchema(TIMETABLE_LESSON_FORM_MESSAGES_EN);

const emptyLesson = {
  complete: false,
  lessonUrl: "",
  lessonUrlShared: false,
  resources: [],
  resourcesShared: false,
  materials: [],
  announcements: [],
  agenda: [],
};

describe("normalizeLessonResources", () => {
  test("drops blank URLs", () => {
    expect(normalizeLessonResources([{ key: "a", url: "  ", label: "Ignored" }])).toEqual([]);
  });

  test("keeps a trimmed http(s) URL and drops an empty label", () => {
    expect(
      normalizeLessonResources([{ key: "a", url: " https://example.com/doc ", label: "  " }]),
    ).toEqual([{ key: "a", url: "https://example.com/doc" }]);
  });

  test("keeps a trimmed label", () => {
    expect(
      normalizeLessonResources([{ key: "a", url: "https://example.com", label: " Worksheet " }]),
    ).toEqual([{ key: "a", url: "https://example.com", label: "Worksheet" }]);
  });

  test("rejects a non-http URL", () => {
    expect(() => normalizeLessonResources([{ key: "a", url: "javascript:alert(1)" }])).toThrow(
      /http/,
    );
  });

  test("rejects a duplicate key", () => {
    expect(() =>
      normalizeLessonResources([
        { key: "a", url: "https://example.com/one" },
        { key: "a", url: "https://example.com/two" },
      ]),
    ).toThrow(/Duplicate/);
  });

  test("rejects too many resources", () => {
    const resources = Array.from({ length: MAX_LESSON_RESOURCES + 1 }, (_, index) => ({
      key: `k${index}`,
      url: `https://example.com/${index}`,
    }));
    expect(() => normalizeLessonResources(resources)).toThrow(/20/);
  });

  test("rejects a label that is too long", () => {
    expect(() =>
      normalizeLessonResources([
        {
          key: "a",
          url: "https://example.com",
          label: "x".repeat(MAX_RESOURCE_LABEL_LENGTH + 1),
        },
      ]),
    ).toThrow(/120/);
  });
});

describe("createTimetableLessonFormSchema resources", () => {
  test("accepts a resource without a label", () => {
    expect(
      schema.safeParse({
        ...emptyLesson,
        resources: [{ key: "a", url: "https://example.com" }],
      }).success,
    ).toBe(true);
  });

  test("accepts an empty resource URL while editing", () => {
    expect(
      schema.safeParse({
        ...emptyLesson,
        resources: [{ key: "a", url: "", label: "" }],
      }).success,
    ).toBe(true);
  });

  test("rejects an invalid resource URL", () => {
    const result = schema.safeParse({
      ...emptyLesson,
      resources: [{ key: "a", url: "not-a-url", label: "" }],
    });
    expect(result.success).toBe(false);
  });
});

describe("classroomVisibleResources", () => {
  const resources = [{ key: "a", url: "https://example.com" }];

  test("hides unshared resources", () => {
    expect(classroomVisibleResources({ resources, resourcesShared: false })).toEqual([]);
  });

  test("treats a missing share flag as hidden", () => {
    expect(classroomVisibleResources({ resources })).toEqual([]);
  });

  test("reveals shared resources", () => {
    expect(classroomVisibleResources({ resources, resourcesShared: true })).toEqual(resources);
  });
});

describe("weekBundleVisibleResources", () => {
  const resources = [{ key: "a", url: "https://example.com" }];

  test("lets managers see unshared resources", () => {
    expect(weekBundleVisibleResources({ resources, resourcesShared: false }, true)).toEqual(
      resources,
    );
  });

  test("hides unshared resources from other roles", () => {
    expect(weekBundleVisibleResources({ resources, resourcesShared: false }, false)).toEqual([]);
  });
});
