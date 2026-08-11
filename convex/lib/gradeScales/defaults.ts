import type { Doc } from "../../_generated/dataModel.js";

export type GradeScaleSystemKey = "highRange" | "perfectScore" | "standard" | "letterGrades";

export type GradeScaleLevel = Doc<"gradeScales">["levels"][number];

export type SystemGradeScaleSeed = {
  systemKey: GradeScaleSystemKey;
  nameKey: string;
  levels: GradeScaleLevel[];
};

export const GRADE_SCALE_SYSTEM_KEYS: readonly GradeScaleSystemKey[] = [
  "highRange",
  "perfectScore",
  "standard",
  "letterGrades",
] as const;

export const SYSTEM_GRADE_SCALE_SEEDS: readonly SystemGradeScaleSeed[] = [
  {
    systemKey: "highRange",
    nameKey: "defaultScale_highRange",
    levels: [
      { key: "5", label: "5", minPercent: 95, maxPercent: 100 },
      { key: "4", label: "4", minPercent: 80, maxPercent: 94 },
      { key: "3", label: "3", minPercent: 70, maxPercent: 79 },
      { key: "2", label: "2", minPercent: 0, maxPercent: 69 },
    ],
  },
  {
    systemKey: "perfectScore",
    nameKey: "defaultScale_perfectScore",
    levels: [
      { key: "5", label: "5", minPercent: 100, maxPercent: 100 },
      { key: "4", label: "4", minPercent: 80, maxPercent: 99 },
      { key: "3", label: "3", minPercent: 70, maxPercent: 79 },
      { key: "2", label: "2", minPercent: 60, maxPercent: 69 },
      { key: "1", label: "1", minPercent: 0, maxPercent: 59 },
    ],
  },
  {
    systemKey: "standard",
    nameKey: "defaultScale_standard",
    levels: [
      { key: "5", label: "5", minPercent: 90, maxPercent: 100 },
      { key: "4", label: "4", minPercent: 80, maxPercent: 89 },
      { key: "3", label: "3", minPercent: 70, maxPercent: 79 },
      { key: "2", label: "2", minPercent: 0, maxPercent: 69 },
    ],
  },
  {
    systemKey: "letterGrades",
    nameKey: "defaultScale_letterGrades",
    levels: [
      { key: "A", label: "A", minPercent: 90, maxPercent: 100 },
      { key: "B", label: "B", minPercent: 80, maxPercent: 89 },
      { key: "C", label: "C", minPercent: 70, maxPercent: 79 },
      { key: "D", label: "D", minPercent: 60, maxPercent: 69 },
      { key: "F", label: "F", minPercent: 0, maxPercent: 59 },
    ],
  },
] as const;
