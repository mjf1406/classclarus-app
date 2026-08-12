export type RazAssessmentResult = "level_up" | "stay" | "level_down";

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
