import { RAZ_MAX_LEVEL } from "./razLevels";

export type RazAssessmentResult = "level_up" | "stay" | "level_down";

export type RazAutoManualStatus = "rti" | "ineligible";

/** Passing Z2 assessments required before auto-ineligible (max level). */
export const RAZ_INELIGIBLE_Z2_PASS_COUNT = 7;

export type RazAssessmentLevelResult = {
  level: string;
  result: RazAssessmentResult;
};

/**
 * Auto-RTI when the student levels down, or fails to level up on two
 * consecutive assessments (immediate retest).
 */
export function shouldAutoSetRazRti(
  result: RazAssessmentResult,
  previousResult: RazAssessmentResult | null | undefined,
): boolean {
  if (result === "level_down") return true;
  if (result === "level_up") return false;
  return previousResult != null && previousResult !== "level_up";
}

/** Stay or level-up at Z2 counts as a pass (there is no higher level). */
export function isRazZ2Pass(level: string, result: RazAssessmentResult): boolean {
  return level === RAZ_MAX_LEVEL && result !== "level_down";
}

export function countRazZ2Passes(assessments: ReadonlyArray<RazAssessmentLevelResult>): number {
  let count = 0;
  for (const assessment of assessments) {
    if (isRazZ2Pass(assessment.level, assessment.result)) count += 1;
  }
  return count;
}

/**
 * Auto-ineligible when this assessment is a Z2 pass and the student now
 * has seven passing Z2 assessments (maximum level).
 */
export function shouldAutoSetRazIneligible(args: {
  level: string;
  result: RazAssessmentResult;
  priorAssessments: ReadonlyArray<RazAssessmentLevelResult>;
}): boolean {
  if (!isRazZ2Pass(args.level, args.result)) return false;
  return countRazZ2Passes(args.priorAssessments) + 1 >= RAZ_INELIGIBLE_Z2_PASS_COUNT;
}

export type RazStoredManualStatus = "rti" | "pending" | "ineligible";

/**
 * Manual status to apply after recording an assessment, or null to leave
 * the existing override unchanged.
 *
 * Ineligible wins over RTI. A Z2 pass never auto-sets RTI — stay at max
 * level is success, not a failed level-up.
 */
export function resolveRazAutoManualStatus(args: {
  level: string;
  result: RazAssessmentResult;
  previousResult: RazAssessmentResult | null | undefined;
  priorAssessments: ReadonlyArray<RazAssessmentLevelResult>;
}): RazAutoManualStatus | null {
  if (shouldAutoSetRazIneligible(args)) return "ineligible";
  if (isRazZ2Pass(args.level, args.result)) return null;
  if (shouldAutoSetRazRti(args.result, args.previousResult)) return "rti";
  return null;
}

/**
 * Stored manual status after recording an assessment.
 *
 * Pending is a temporary "scores not entered yet" flag, so it always
 * clears back to Auto unless auto-RTI or auto-ineligible applies.
 * RTI and ineligible stay until a teacher clears them (or auto-status
 * replaces them).
 */
export function nextRazManualStatusAfterAssessment(args: {
  level: string;
  result: RazAssessmentResult;
  previousResult: RazAssessmentResult | null | undefined;
  priorAssessments: ReadonlyArray<RazAssessmentLevelResult>;
  currentManualStatus: RazStoredManualStatus | null | undefined;
}): RazAutoManualStatus | null {
  const autoStatus = resolveRazAutoManualStatus(args);
  if (autoStatus !== null) return autoStatus;
  if (args.currentManualStatus === "pending") return null;
  if (args.currentManualStatus === "rti" || args.currentManualStatus === "ineligible") {
    return args.currentManualStatus;
  }
  return null;
}
