import { describe, expect, test } from "vite-plus/test";

import { buildActivityCsv } from "./csv";

describe("buildActivityCsv", () => {
  test("includes header and escapes quotes", () => {
    const csv = buildActivityCsv([
      {
        createdAt: Date.UTC(2026, 0, 2, 3, 4, 5),
        actorEmail: 'a"b@example.com',
        actorRole: "teacher",
        action: "read",
        resourceType: "class",
        resourceId: "c123",
        summary: 'Viewed class, "Home"',
      },
    ]);
    expect(csv.startsWith("timestamp,email,role,action,resourceType,resourceId,summary\n")).toBe(
      true,
    );
    expect(csv).toContain('"a""b@example.com"');
    expect(csv).toContain(",teacher,");
    expect(csv).toContain('"Viewed class, ""Home"""');
    expect(csv).toContain("2026-01-02T03:04:05.000Z");
  });
});
