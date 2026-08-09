import { RAZ_LEVEL_KEYS } from "@/lib/raz/levels";

export type RazAssessmentResult = "level_up" | "stay" | "level_down";

export type ScoreRecommendation = {
  result: RazAssessmentResult;
  level: string;
  accuracy: number;
  quizPercentage: number;
  actionKey: "recommendActionLevelUp" | "recommendActionStay" | "recommendActionLevelDown";
};

function normalizeRazLevel(currentLevel: string | null): string {
  if (!currentLevel) return "";
  return currentLevel.toLowerCase() === "aa" ? "aa" : currentLevel.toUpperCase();
}

/**
 * RAZ Read + Respond score → result / next level recommendation.
 * `respondScore` is raw 0–5 (not a percentage).
 */
export function getScoreRecommendation(
  accuracy: number,
  respondScore: number,
  currentLevel: string | null,
): ScoreRecommendation {
  const quizPercentage = (respondScore / 5) * 100;
  let recResult: RazAssessmentResult;

  if (accuracy >= 95) {
    if (Math.round(quizPercentage) === 100) {
      recResult = "level_up";
    } else if (quizPercentage >= 80) {
      recResult = "stay";
    } else {
      recResult = "level_down";
    }
  } else if (accuracy >= 90) {
    if (quizPercentage >= 80) {
      recResult = "stay";
    } else {
      recResult = "level_down";
    }
  } else {
    recResult = "level_down";
  }

  const normalizedLevel = normalizeRazLevel(currentLevel);
  let recLevel = currentLevel ?? "";

  const idx = RAZ_LEVEL_KEYS.indexOf(normalizedLevel as (typeof RAZ_LEVEL_KEYS)[number]);
  if (normalizedLevel && idx >= 0) {
    if (recResult === "level_up" && idx < RAZ_LEVEL_KEYS.length - 1) {
      recLevel = RAZ_LEVEL_KEYS[idx + 1] ?? normalizedLevel;
    } else if (recResult === "level_down" && idx > 0) {
      recLevel = RAZ_LEVEL_KEYS[idx - 1] ?? normalizedLevel;
    } else {
      recLevel = normalizedLevel;
    }
  } else if (normalizedLevel) {
    recLevel = normalizedLevel;
  }

  const actionKey =
    recResult === "level_up"
      ? ("recommendActionLevelUp" as const)
      : recResult === "stay"
        ? ("recommendActionStay" as const)
        : ("recommendActionLevelDown" as const);

  return {
    result: recResult,
    level: recLevel,
    accuracy,
    quizPercentage: Math.round(quizPercentage),
    actionKey,
  };
}
