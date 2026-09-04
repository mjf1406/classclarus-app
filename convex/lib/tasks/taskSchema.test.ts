import { describe, expect, test } from "vite-plus/test";

import {
  createTaskClientFormSchema,
  MAX_TASK_ATTACHMENTS,
  parseTaskInput,
  TASK_FORM_MESSAGES_EN,
} from "./taskSchema";

describe("parseTaskInput", () => {
  test("trims name and accepts attachments under the cap", () => {
    const parsed = parseTaskInput({
      name: "  Read pages  ",
      description: "Chapter 1",
      attachmentFileIds: ["file1", "file2"],
    });
    expect(parsed.name).toBe("Read pages");
    expect(parsed.attachmentFileIds).toHaveLength(2);
  });

  test("rejects more than five attachments", () => {
    expect(() =>
      parseTaskInput({
        name: "Too many",
        attachmentFileIds: ["a", "b", "c", "d", "e", "f"],
      }),
    ).toThrow(TASK_FORM_MESSAGES_EN.attachmentsTooMany);
    expect(MAX_TASK_ATTACHMENTS).toBe(5);
  });

  test("rejects an empty name", () => {
    expect(() => parseTaskInput({ name: "   " })).toThrow(TASK_FORM_MESSAGES_EN.nameRequired);
  });

  test("keeps procedure steps and drops blank resource rows", () => {
    const parsed = parseTaskInput({
      name: "Lab",
      procedureSteps: [{ key: "s1", body: "  Wash hands  " }],
      resources: [
        { key: "r1", url: "https://example.com/guide", label: "Guide" },
        { key: "r2", url: "   " },
      ],
    });
    expect(parsed.procedureSteps).toEqual([{ key: "s1", body: "Wash hands" }]);
    expect(parsed.resources).toEqual([
      { key: "r1", url: "https://example.com/guide", label: "Guide" },
    ]);
    expect(parsed.acceptLinkSubmissions).toBe(false);
    expect(parsed.hiddenFromStudents).toBe(false);
  });

  test("rejects an empty procedure step", () => {
    expect(() =>
      parseTaskInput({
        name: "Lab",
        procedureSteps: [{ key: "s1", body: "   " }],
      }),
    ).toThrow(TASK_FORM_MESSAGES_EN.procedureStepRequired);
  });
});

describe("createTaskClientFormSchema", () => {
  const schema = createTaskClientFormSchema(TASK_FORM_MESSAGES_EN);

  function clientValues(overrides: Record<string, unknown> = {}) {
    return {
      name: "Read pages",
      description: "",
      dueDateKey: "",
      attachmentFileIds: [],
      procedureSteps: [],
      resources: [],
      acceptLinkSubmissions: false,
      releaseMode: "released",
      scheduledReleaseAt: "",
      ...overrides,
    };
  }

  test("accepts the create/edit form shape with releaseMode", () => {
    const parsed = schema.safeParse(clientValues({ releaseMode: "hidden" }));
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.releaseMode).toBe("hidden");
      expect("hiddenFromStudents" in parsed.data).toBe(false);
    }
  });

  test("rejects a missing name on the client form", () => {
    const parsed = schema.safeParse(clientValues({ name: "   " }));
    expect(parsed.success).toBe(false);
  });

  test("accepts a scheduled release datetime string", () => {
    const parsed = schema.safeParse(
      clientValues({
        releaseMode: "scheduled",
        scheduledReleaseAt: "2026-09-03T14:05",
      }),
    );
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.scheduledReleaseAt).toBe("2026-09-03T14:05");
    }
  });
});
