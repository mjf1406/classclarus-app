import type { FunctionReturnType } from "convex/server";

import type { AssignmentDetail, AssignmentSection } from "@/lib/assignments/assignments";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export type AssignmentScore = FunctionReturnType<typeof api.assignmentScores.listScores>[number];
export type AssignmentScoreList = FunctionReturnType<typeof api.assignmentScores.listScores>;
export type AssignmentSectionScore = NonNullable<AssignmentScore["sectionScores"]>[number];

export type GradeColumn =
  | { id: "total"; kind: "total"; maxPoints: number; label: string }
  | {
      id: string;
      kind: "points";
      sectionKey: string;
      maxPoints: number;
      label: string;
    }
  | {
      id: string;
      kind: "rubricLevels";
      sectionKey: string;
      label: string;
      levels: Array<{ key: string; description: string; points: number }>;
    }
  | {
      id: string;
      kind: "rubricCheckboxes";
      sectionKey: string;
      label: string;
      items: Array<{ key: string; description: string; points: number }>;
    };

export type SectionScoreDraft = {
  pointsEarned?: number;
  selectedLevelKey?: string;
  checkedItemKeys?: string[];
};

/** Client draft for one student — undefined fields mean "not set / blank". */
export type StudentScoreDraft = {
  totalPointsEarned?: number;
  sectionScores: Record<string, SectionScoreDraft>;
  excused: boolean;
};

export type UpsertAssignmentScorePayload = {
  classId: Id<"classes">;
  assignmentId: Id<"assignments">;
  studentUserId: Id<"users">;
  totalPointsEarned?: number;
  sectionScores?: Array<{
    sectionKey: string;
    pointsEarned?: number;
    selectedLevelKey?: string;
    checkedItemKeys?: string[];
  }>;
  excused?: boolean;
  clear?: boolean;
};

export type ScoreTotals = {
  earned: number;
  possible: number;
  /** True when any numeric score field is present. */
  hasScore: boolean;
  percent: number | null;
};

export function scoreByStudentId(scores: AssignmentScoreList): Map<Id<"users">, AssignmentScore> {
  const map = new Map<Id<"users">, AssignmentScore>();
  for (const score of scores) {
    map.set(score.studentUserId, score);
  }
  return map;
}

type ScoreLike = {
  totalPointsEarned?: number;
  sectionScores?: Array<{
    sectionKey: string;
    pointsEarned?: number;
    selectedLevelKey?: string;
    checkedItemKeys?: string[];
  }>;
  excused?: boolean;
};

export function draftFromScore(score: ScoreLike | undefined): StudentScoreDraft {
  const sectionScores: Record<string, SectionScoreDraft> = {};
  for (const entry of score?.sectionScores ?? []) {
    sectionScores[entry.sectionKey] = {
      ...(entry.pointsEarned !== undefined ? { pointsEarned: entry.pointsEarned } : {}),
      ...(entry.selectedLevelKey !== undefined ? { selectedLevelKey: entry.selectedLevelKey } : {}),
      ...(entry.checkedItemKeys !== undefined
        ? { checkedItemKeys: [...entry.checkedItemKeys] }
        : {}),
    };
  }
  return {
    ...(score?.totalPointsEarned !== undefined
      ? { totalPointsEarned: score.totalPointsEarned }
      : {}),
    sectionScores,
    excused: score?.excused === true,
  };
}

export function buildGradeColumns(
  assignment: Pick<AssignmentDetail, "scoringMode" | "totalPoints" | "sections">,
  labels: { total: string },
): GradeColumn[] {
  if (assignment.scoringMode === "total") {
    return [
      {
        id: "total",
        kind: "total",
        maxPoints: assignment.totalPoints ?? 0,
        label: labels.total,
      },
    ];
  }

  const sections = assignment.sections ?? [];
  return sections.map((section) => columnFromSection(section));
}

function columnFromSection(section: AssignmentSection): GradeColumn {
  if (section.type === "points") {
    return {
      id: `section:${section.key}`,
      kind: "points",
      sectionKey: section.key,
      maxPoints: section.maxPoints ?? 0,
      label: section.name,
    };
  }
  if (section.type === "rubricLevels") {
    return {
      id: `section:${section.key}`,
      kind: "rubricLevels",
      sectionKey: section.key,
      label: section.name,
      levels: section.levels ?? [],
    };
  }
  return {
    id: `section:${section.key}`,
    kind: "rubricCheckboxes",
    sectionKey: section.key,
    label: section.name,
    items: section.items ?? [],
  };
}

function sectionMaxPoints(section: AssignmentSection): number {
  if (section.type === "points") {
    return section.maxPoints ?? 0;
  }
  if (section.type === "rubricLevels") {
    const levels = section.levels ?? [];
    if (levels.length === 0) return 0;
    return Math.max(...levels.map((level) => level.points));
  }
  return (section.items ?? []).reduce((sum, item) => sum + item.points, 0);
}

export function assignmentPossiblePoints(
  assignment: Pick<AssignmentDetail, "scoringMode" | "totalPoints" | "sections">,
): number {
  if (assignment.scoringMode === "total") {
    return assignment.totalPoints ?? 0;
  }
  return (assignment.sections ?? []).reduce((sum, section) => sum + sectionMaxPoints(section), 0);
}

export function computeScoreTotals(
  assignment: Pick<AssignmentDetail, "scoringMode" | "totalPoints" | "sections">,
  draft: StudentScoreDraft,
): ScoreTotals {
  const possible = assignmentPossiblePoints(assignment);

  if (assignment.scoringMode === "total") {
    const hasScore = draft.totalPointsEarned !== undefined;
    const earned = draft.totalPointsEarned ?? 0;
    return {
      earned,
      possible,
      hasScore,
      percent: hasScore && possible > 0 ? (earned / possible) * 100 : hasScore ? 0 : null,
    };
  }

  let earned = 0;
  let hasScore = false;
  for (const section of assignment.sections ?? []) {
    const entry = draft.sectionScores[section.key];
    if (!entry) continue;

    if (section.type === "points") {
      if (entry.pointsEarned === undefined) continue;
      hasScore = true;
      earned += entry.pointsEarned;
      continue;
    }

    if (section.type === "rubricLevels") {
      if (!entry.selectedLevelKey) continue;
      const level = (section.levels ?? []).find((item) => item.key === entry.selectedLevelKey);
      if (!level) continue;
      hasScore = true;
      earned += level.points;
      continue;
    }

    const keys = entry.checkedItemKeys ?? [];
    if (keys.length === 0) continue;
    hasScore = true;
    for (const key of keys) {
      const item = (section.items ?? []).find((entryItem) => entryItem.key === key);
      if (item) earned += item.points;
    }
  }

  return {
    earned,
    possible,
    hasScore,
    percent: hasScore && possible > 0 ? (earned / possible) * 100 : hasScore ? 0 : null,
  };
}

export function formatScoreFraction(totals: ScoreTotals, emptyLabel: string): string {
  if (!totals.hasScore) return emptyLabel;
  return `${totals.earned} / ${totals.possible}`;
}

export function formatScorePercent(totals: ScoreTotals, emptyLabel: string): string {
  if (totals.percent === null) return emptyLabel;
  const rounded = Math.round(totals.percent * 10) / 10;
  return `${rounded}%`;
}

/** True when the draft has no score data and is not excused (should delete the row). */
export function isScoreDraftEmpty(draft: StudentScoreDraft): boolean {
  if (draft.excused) return false;
  if (draft.totalPointsEarned !== undefined) {
    return false;
  }
  for (const entry of Object.values(draft.sectionScores)) {
    if (entry.pointsEarned !== undefined) return false;
    if (entry.selectedLevelKey) return false;
    if (entry.checkedItemKeys && entry.checkedItemKeys.length > 0) return false;
  }
  return true;
}

export function draftToUpsertPayload(
  draft: StudentScoreDraft,
  base: {
    classId: Id<"classes">;
    assignmentId: Id<"assignments">;
    studentUserId: Id<"users">;
  },
): UpsertAssignmentScorePayload {
  if (isScoreDraftEmpty(draft)) {
    return { ...base, clear: true };
  }

  const sectionScores = Object.entries(draft.sectionScores)
    .map(([sectionKey, entry]) => {
      if (entry.pointsEarned !== undefined) {
        return { sectionKey, pointsEarned: entry.pointsEarned };
      }
      if (entry.selectedLevelKey) {
        return { sectionKey, selectedLevelKey: entry.selectedLevelKey };
      }
      if (entry.checkedItemKeys && entry.checkedItemKeys.length > 0) {
        return { sectionKey, checkedItemKeys: entry.checkedItemKeys };
      }
      return null;
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  return {
    ...base,
    ...(draft.totalPointsEarned !== undefined
      ? { totalPointsEarned: draft.totalPointsEarned }
      : {}),
    ...(sectionScores.length > 0 ? { sectionScores } : {}),
    excused: draft.excused,
  };
}

export function formatScoreDisplay(value: number | undefined, emptyLabel: string): string {
  if (value === undefined) return emptyLabel;
  return String(value);
}

export function formatLevelDisplay(
  levels: Array<{ key: string; description: string; points: number }>,
  selectedKey: string | undefined,
  emptyLabel: string,
): string {
  if (!selectedKey) return emptyLabel;
  const level = levels.find((item) => item.key === selectedKey);
  if (!level) return emptyLabel;
  return `(${level.points}) ${level.description}`;
}

export function formatCheckboxDisplay(
  items: Array<{ key: string; description: string; points: number }>,
  checkedKeys: string[] | undefined,
  emptyLabel: string,
): string {
  if (!checkedKeys || checkedKeys.length === 0) return emptyLabel;
  const selected = items.filter((item) => checkedKeys.includes(item.key));
  if (selected.length === 0) return emptyLabel;
  return selected.map((item) => item.description).join(", ");
}
