import { describe, expect, test } from "vite-plus/test";

import { MAX_TASK_ATTACHMENTS, parseTaskInput, TASK_FORM_MESSAGES_EN } from "./taskSchema";

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
});
