import type { Id } from "../../_generated/dataModel.js";
import { slotKey } from "./seatChartGeometry.js";
import { affectedStudentIdsFromEvidence, lockedAssignmentEvidence } from "./failureEvidence.js";
import { solveSeating } from "./solve.js";
import type {
  SeatingAlgorithmInfeasible,
  SeatingAlgorithmInput,
  SeatingAlgorithmResult,
  SeatingAlgorithmSearchExhausted,
  SeatingAlgorithmSuccess,
  SeatingConstraint,
  SeatingFailureEvidence,
  SeatingFailureRunContext,
  SeatingRelaxableRule,
  SeatingRelaxations,
  SeatingStructuralCause,
  SeatingConflictDiagnosis,
} from "./types.js";

type StructuralDiagnosis = Extract<SeatingConflictDiagnosis, { status: "structural" }>;

function isProvenInfeasible(result: SeatingAlgorithmResult): result is SeatingAlgorithmInfeasible {
  return result.status === "infeasible";
}

function isSuccess(result: SeatingAlgorithmResult): result is SeatingAlgorithmSuccess {
  return result.status === "ok";
}

function isInconclusive(result: SeatingAlgorithmResult): result is SeatingAlgorithmSearchExhausted {
  return result.status === "search_exhausted";
}

export function buildRunContext(input: SeatingAlgorithmInput): SeatingFailureRunContext {
  const slotByKey = new Map(
    input.slots.map((slot) => [slotKey(slot.deskItemId, slot.groupId), slot]),
  );
  const lockedAssignments = input.locked.map((locked) => {
    const slot = slotByKey.get(slotKey(locked.deskItemId, locked.groupId));
    return lockedAssignmentEvidence(locked, slot?.deskNumber, slot?.zoneName);
  });

  return {
    layoutId: input.layoutId,
    genderParityMode: input.genderParityMode,
    malesOnOddDesks: input.genderParityAssignment.malesOnOddDesks,
    lockedAssignments,
    counts: {
      solverStudentCount: input.students.length,
      constraintCount: input.constraints.length,
      slotCount: input.slots.length,
      lockedCount: input.locked.length,
    },
  };
}

function structuralCauseFromEvidence(
  evidence: SeatingFailureEvidence,
): SeatingStructuralCause | undefined {
  switch (evidence.kind) {
    case "unavailableStudents":
      return "unavailableStudent";
    case "capacityExceeded":
      return "capacityExceeded";
    case "noValidSeat":
      return "noValidSeat";
    case "unavailableSeat":
      return "unavailableSeat";
    case "duplicateManual":
      return "duplicateManual";
    case "parityLockedConflict":
      return "parityLockedConflict";
    case "manualConstraintConflict":
      return "manualConstraintConflict";
    case "constraintParityConflict":
      return "constraintParityConflict";
    case "searchExhausted":
      return undefined;
    default:
      return undefined;
  }
}

function structuralDiagnosis(
  result: SeatingAlgorithmInfeasible,
  runContext: SeatingFailureRunContext,
): StructuralDiagnosis | undefined {
  const cause = structuralCauseFromEvidence(result.evidence);
  if (!cause) return undefined;
  return {
    status: "structural",
    cause,
    evidence: result.evidence,
    affectedStudentIds: affectedStudentIdsFromEvidence(result.evidence),
    runContext,
  };
}

const PRIMARY_STRUCTURAL_EVIDENCE = new Set<SeatingFailureEvidence["kind"]>([
  "unavailableStudents",
  "capacityExceeded",
  "noValidSeat",
  "unavailableSeat",
  "duplicateManual",
]);

function preferStructuralDiagnosis(
  result: SeatingAlgorithmInfeasible,
  runContext: SeatingFailureRunContext,
): StructuralDiagnosis | undefined {
  const structural = structuralDiagnosis(result, runContext);
  if (!structural) return undefined;
  if (PRIMARY_STRUCTURAL_EVIDENCE.has(structural.evidence.kind)) {
    return structural;
  }
  return undefined;
}

/** Apply temporary relaxations without mutating the original input. */
export function applySeatingRelaxations(
  input: SeatingAlgorithmInput,
  relaxations: SeatingRelaxations,
): SeatingAlgorithmInput {
  const omittedConstraintIds = new Set(relaxations.omittedConstraintIds ?? []);
  const omittedLockedIds = new Set(relaxations.omittedLockedStudentIds ?? []);

  const constraints = input.constraints.filter(
    (constraint) => !omittedConstraintIds.has(constraint.id),
  );
  const locked = input.locked.filter(
    (assignment) => !omittedLockedIds.has(assignment.studentUserId),
  );
  const genderParityMode = relaxations.omitGenderParity === true ? "off" : input.genderParityMode;

  return {
    ...input,
    constraints,
    locked,
    genderParityMode,
  };
}

export function collectActiveRelaxableRules(input: SeatingAlgorithmInput): SeatingRelaxableRule[] {
  const rules: SeatingRelaxableRule[] = input.constraints.map((constraint) => ({
    kind: "constraint",
    constraintId: constraint.id,
  }));
  if (input.genderParityMode === "oddEven") {
    rules.push({ kind: "genderParity" });
  }
  for (const locked of input.locked) {
    rules.push({ kind: "lockedSeat", studentUserId: locked.studentUserId });
  }
  return rules;
}

function ruleKey(rule: SeatingRelaxableRule): string {
  if (rule.kind === "constraint") return `constraint:${rule.constraintId}`;
  if (rule.kind === "genderParity") return "genderParity";
  return `lockedSeat:${rule.studentUserId}`;
}

function relaxationsFromOmittedRules(omitted: ReadonlySet<string>): SeatingRelaxations {
  const omittedConstraintIds: Array<Id<"seatConstraints">> = [];
  const omittedLockedStudentIds: Array<Id<"users">> = [];
  let omitGenderParity = false;

  for (const key of omitted) {
    if (key === "genderParity") {
      omitGenderParity = true;
      continue;
    }
    if (key.startsWith("constraint:")) {
      omittedConstraintIds.push(key.slice("constraint:".length) as Id<"seatConstraints">);
      continue;
    }
    if (key.startsWith("lockedSeat:")) {
      omittedLockedStudentIds.push(key.slice("lockedSeat:".length) as Id<"users">);
    }
  }

  return {
    ...(omittedConstraintIds.length > 0 ? { omittedConstraintIds } : {}),
    ...(omittedLockedStudentIds.length > 0 ? { omittedLockedStudentIds } : {}),
    ...(omitGenderParity ? { omitGenderParity: true } : {}),
  };
}

function solveWithOmittedRules(
  input: SeatingAlgorithmInput,
  omitted: ReadonlySet<string>,
): SeatingAlgorithmResult {
  return solveSeating(applySeatingRelaxations(input, relaxationsFromOmittedRules(omitted)));
}

/**
 * Find an inclusion-minimal conflicting set of relaxable rules using deletion probes.
 * Returns undefined when any probe is inconclusive (search exhausted).
 */
function findMinimalConflictSet(
  input: SeatingAlgorithmInput,
  activeRules: SeatingRelaxableRule[],
): SeatingRelaxableRule[] | undefined {
  let candidate = [...activeRules];

  for (let index = 0; index < candidate.length; index += 1) {
    const rule = candidate[index]!;
    const omitted = new Set([ruleKey(rule)]);
    const probe = solveWithOmittedRules(input, omitted);
    if (isInconclusive(probe)) return undefined;
    if (isProvenInfeasible(probe)) {
      candidate = candidate.filter((item) => item !== rule);
      index -= 1;
    }
  }

  return candidate;
}

/**
 * Diagnose why seating cannot be satisfied and, when provable, return one
 * inclusion-minimal set of relaxable rules that conflict.
 */
export function diagnoseSeatingConflicts(input: SeatingAlgorithmInput): SeatingConflictDiagnosis {
  const runContext = buildRunContext(input);
  const full = solveSeating(input);
  if (isSuccess(full)) {
    return { status: "satisfiable" };
  }
  if (isInconclusive(full)) {
    return {
      status: "unknown",
      code: "SEATING_SEARCH_EXHAUSTED",
      evidence: full.evidence,
      runContext,
    };
  }

  const primaryStructural = preferStructuralDiagnosis(full, runContext);
  if (primaryStructural) return primaryStructural;

  const activeRules = collectActiveRelaxableRules(input);
  if (activeRules.length === 0) {
    const structural = structuralDiagnosis(full, runContext);
    if (structural) return structural;
    return { status: "unknown", code: "SEATING_INFEASIBLE", runContext };
  }

  const minimal = findMinimalConflictSet(input, activeRules);
  if (!minimal) {
    return {
      status: "unknown",
      code: "SEATING_SEARCH_EXHAUSTED",
      evidence: full.evidence,
      runContext,
    };
  }

  if (minimal.length === 0) {
    const structural = structuralDiagnosis(full, runContext);
    if (structural) return structural;
    return { status: "unknown", code: "SEATING_INFEASIBLE", runContext };
  }

  return { status: "minimalConflict", rules: minimal, runContext };
}

/** Re-export for tests — verify a relaxation set yields a solution. */
export function solveWithRelaxations(
  input: SeatingAlgorithmInput,
  relaxations: SeatingRelaxations,
): SeatingAlgorithmResult {
  return solveSeating(applySeatingRelaxations(input, relaxations));
}

export function relaxationsFromRules(
  rules: ReadonlyArray<SeatingRelaxableRule>,
): SeatingRelaxations {
  return relaxationsFromOmittedRules(new Set(rules.map(ruleKey)));
}

export function constraintsFromRules(
  allConstraints: ReadonlyArray<SeatingConstraint>,
  rules: ReadonlyArray<SeatingRelaxableRule>,
): SeatingConstraint[] {
  const ids = new Set(
    rules
      .filter(
        (rule): rule is Extract<SeatingRelaxableRule, { kind: "constraint" }> =>
          rule.kind === "constraint",
      )
      .map((rule) => rule.constraintId),
  );
  return allConstraints.filter((constraint) => ids.has(constraint.id));
}
