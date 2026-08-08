import { describe, expect, test } from "vite-plus/test";

import {
  buildGradeColumns,
  computeScoreTotals,
  draftFromScore,
  draftToUpsertPayload,
  formatScoreFraction,
  formatScorePercent,
  isScoreDraftEmpty,
  type AssignmentScore,
} from "@/lib/assignments/assignmentScores";
import type { Id } from "../../../convex/_generated/dataModel";

const classId = "classes:1" as Id<"classes">;
const assignmentId = "assignments:1" as Id<"assignments">;
const studentUserId = "users:1" as Id<"users">;

describe("buildGradeColumns", () => {
  test("builds a total column", () => {
    const columns = buildGradeColumns(
      { scoringMode: "total", totalPoints: 100, sections: undefined },
      { total: "Score" },
    );
    expect(columns).toEqual([{ id: "total", kind: "total", maxPoints: 100, label: "Score" }]);
  });

  test("builds section columns for each type", () => {
    const columns = buildGradeColumns(
      {
        scoringMode: "sections",
        totalPoints: undefined,
        sections: [
          {
            key: "s1",
            name: "Content",
            type: "points",
            maxPoints: 10,
          },
          {
            key: "s2",
            name: "Quality",
            type: "rubricLevels",
            levels: [{ key: "l1", description: "Good", points: 5 }],
          },
          {
            key: "s3",
            name: "Extras",
            type: "rubricCheckboxes",
            items: [{ key: "i1", description: "Bonus", points: 1 }],
          },
        ],
      },
      { total: "Score" },
    );
    expect(columns.map((column) => column.kind)).toEqual([
      "points",
      "rubricLevels",
      "rubricCheckboxes",
    ]);
  });
});

describe("score draft helpers", () => {
  test("empty draft clears on upsert", () => {
    const draft = { sectionScores: {}, excused: false };
    expect(isScoreDraftEmpty(draft)).toBe(true);
    expect(draftToUpsertPayload(draft, { classId, assignmentId, studentUserId })).toEqual({
      classId,
      assignmentId,
      studentUserId,
      clear: true,
    });
  });

  test("excused-only draft is kept", () => {
    const draft = { sectionScores: {}, excused: true };
    expect(isScoreDraftEmpty(draft)).toBe(false);
    expect(draftToUpsertPayload(draft, { classId, assignmentId, studentUserId })).toEqual({
      classId,
      assignmentId,
      studentUserId,
      excused: true,
    });
  });

  test("draftFromScore and payload round-trip section data", () => {
    const score = {
      _id: "assignmentScores:1" as Id<"assignmentScores">,
      _creationTime: 1,
      classId,
      assignmentId,
      studentUserId,
      totalPointsEarned: undefined,
      sectionScores: [
        { sectionKey: "s1", pointsEarned: 8 },
        { sectionKey: "s2", selectedLevelKey: "l1" },
        { sectionKey: "s3", checkedItemKeys: ["i1"] },
      ],
      excused: false,
      updatedAt: 1,
      updatedBy: studentUserId,
    } satisfies AssignmentScore;

    const draft = draftFromScore(score);
    expect(isScoreDraftEmpty(draft)).toBe(false);
    expect(draftToUpsertPayload(draft, { classId, assignmentId, studentUserId })).toEqual({
      classId,
      assignmentId,
      studentUserId,
      sectionScores: [
        { sectionKey: "s1", pointsEarned: 8 },
        { sectionKey: "s2", selectedLevelKey: "l1" },
        { sectionKey: "s3", checkedItemKeys: ["i1"] },
      ],
      excused: false,
    });
  });
});

describe("computeScoreTotals", () => {
  test("computes total-mode fraction and percent", () => {
    const totals = computeScoreTotals(
      { scoringMode: "total", totalPoints: 100, sections: undefined },
      { totalPointsEarned: 85, sectionScores: {}, excused: false },
    );
    expect(formatScoreFraction(totals, "—")).toBe("85 / 100");
    expect(formatScorePercent(totals, "—")).toBe("85%");
  });

  test("sums section scores against max possible", () => {
    const assignment = {
      scoringMode: "sections" as const,
      totalPoints: undefined,
      sections: [
        { key: "s1", name: "Content", type: "points" as const, maxPoints: 10 },
        {
          key: "s2",
          name: "Quality",
          type: "rubricLevels" as const,
          levels: [
            { key: "l1", description: "Good", points: 5 },
            { key: "l2", description: "Great", points: 10 },
          ],
        },
        {
          key: "s3",
          name: "Extras",
          type: "rubricCheckboxes" as const,
          items: [
            { key: "i1", description: "Bonus", points: 1 },
            { key: "i2", description: "Extra", points: 2 },
          ],
        },
      ],
    };
    const totals = computeScoreTotals(assignment, {
      sectionScores: {
        s1: { pointsEarned: 8 },
        s2: { selectedLevelKey: "l1" },
        s3: { checkedItemKeys: ["i1"] },
      },
      excused: false,
    });
    expect(totals.earned).toBe(14);
    expect(totals.possible).toBe(23);
    expect(formatScorePercent(totals, "—")).toBe("60.9%");
  });
});
