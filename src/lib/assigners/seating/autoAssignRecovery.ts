import type { Id } from "../../../../convex/_generated/dataModel";
import type {
  SeatingConflictDiagnosis,
  SeatingRelaxableRule,
  SeatingRelaxations,
} from "../../../../convex/lib/seating/types";
import type { SeatChartAssignment } from "@/lib/assigners/seatCharts";
import type { SeatAutoAssignSetupValues } from "@/components/assigners/SeatAutoAssignSetupCredenza";
import type { StudentFailureContext } from "@/lib/assigners/seating/failureStudentContext";

export type AutoAssignRunContext = {
  classId: Id<"classes">;
  layoutId: Id<"seatLayouts">;
  layoutName: string;
  chartName: string;
  targetChartId?: Id<"seatCharts">;
  lockedAssignments: Array<SeatChartAssignment>;
};

export type AutoAssignFailureState = {
  context: AutoAssignRunContext;
  diagnosis: SeatingConflictDiagnosis;
  code: string;
  /** Rules pre-selected for temporary relaxation (minimal conflict set). */
  selectedRules: Array<SeatingRelaxableRule>;
  /** Client-side classification of affected students (grouped, ungrouped, stale, etc.). */
  studentContexts?: Map<Id<"users">, StudentFailureContext>;
};

export function runContextFromSetup(
  classId: Id<"classes">,
  values: SeatAutoAssignSetupValues,
  args: {
    targetChartId?: Id<"seatCharts">;
    lockedAssignments?: Array<SeatChartAssignment>;
  },
): AutoAssignRunContext {
  return {
    classId,
    layoutId: values.layoutId,
    layoutName: values.layoutName,
    chartName: values.chartName,
    targetChartId: args.targetChartId,
    lockedAssignments: args.lockedAssignments ?? [],
  };
}

export function relaxationsFromSelectedRules(
  rules: ReadonlyArray<SeatingRelaxableRule>,
): SeatingRelaxations {
  const omittedConstraintIds: Array<Id<"seatConstraints">> = [];
  const omittedLockedStudentIds: Array<Id<"users">> = [];
  let omitGenderParity = false;

  for (const rule of rules) {
    if (rule.kind === "constraint") {
      omittedConstraintIds.push(rule.constraintId);
    } else if (rule.kind === "genderParity") {
      omitGenderParity = true;
    } else {
      omittedLockedStudentIds.push(rule.studentUserId);
    }
  }

  return {
    ...(omittedConstraintIds.length > 0 ? { omittedConstraintIds } : {}),
    ...(omittedLockedStudentIds.length > 0 ? { omittedLockedStudentIds } : {}),
    ...(omitGenderParity ? { omitGenderParity: true } : {}),
  };
}

export function hasAppliedRelaxations(relaxations: SeatingRelaxations | undefined): boolean {
  if (!relaxations) return false;
  return (
    (relaxations.omittedConstraintIds?.length ?? 0) > 0 ||
    (relaxations.omittedLockedStudentIds?.length ?? 0) > 0 ||
    relaxations.omitGenderParity === true
  );
}

export function defaultSelectedRules(
  diagnosis: SeatingConflictDiagnosis,
): Array<SeatingRelaxableRule> {
  if (diagnosis.status === "minimalConflict") {
    return [...diagnosis.rules];
  }
  return [];
}

export function pruneSelectedRulesForConstraints(
  rules: ReadonlyArray<SeatingRelaxableRule>,
  constraints: ReadonlyArray<{ _id: Id<"seatConstraints"> }>,
): Array<SeatingRelaxableRule> {
  const liveConstraintIds = new Set(constraints.map((constraint) => constraint._id));
  return rules.filter(
    (rule) => rule.kind !== "constraint" || liveConstraintIds.has(rule.constraintId),
  );
}
