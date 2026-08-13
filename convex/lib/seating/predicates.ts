import type { Id } from "../../_generated/dataModel.js";
import type {
  GenderParityAssignment,
  GenderParityMode,
  SeatingConstraint,
  SeatingDeskSlot,
  SeatingStudent,
} from "./types.js";

type AssignmentMap = Map<Id<"users">, SeatingDeskSlot>;

export function areNeighbors(left: SeatingDeskSlot, right: SeatingDeskSlot): boolean {
  return (
    left.deskItemId !== right.deskItemId &&
    (left.neighborDeskIds.includes(right.deskItemId) ||
      right.neighborDeskIds.includes(left.deskItemId))
  );
}

export function areTeammates(left: SeatingDeskSlot, right: SeatingDeskSlot): boolean {
  return (
    left.groupId === right.groupId &&
    left.deskItemId !== right.deskItemId &&
    left.teamKey !== undefined &&
    left.teamKey === right.teamKey
  );
}

export function parityAllows(
  mode: GenderParityMode,
  assignment: GenderParityAssignment,
  student: Pick<SeatingStudent, "genderBucket">,
  slot: SeatingDeskSlot,
): boolean {
  if (mode === "off") return true;
  if (student.genderBucket !== "m" && student.genderBucket !== "f") return true;
  if (slot.deskNumber === undefined) return false;
  const odd = slot.deskNumber % 2 === 1;
  return student.genderBucket === "m"
    ? odd === assignment.malesOnOddDesks
    : odd !== assignment.malesOnOddDesks;
}

export function constraintSatisfied(
  constraint: SeatingConstraint,
  assignmentByStudent: AssignmentMap,
): boolean {
  const slot = assignmentByStudent.get(constraint.studentUserId);
  if (constraint.type === "zone") {
    if (!slot) return constraint.polarity === "mustNot";
    const matches = (slot.zoneName ?? "") === (constraint.zoneName?.trim() ?? "");
    return constraint.polarity === "must" ? matches : !matches;
  }

  const otherId = constraint.otherStudentUserId;
  const otherSlot = otherId ? assignmentByStudent.get(otherId) : undefined;
  if (!slot || !otherSlot) return constraint.polarity === "mustNot";
  const matches =
    constraint.type === "neighbor" ? areNeighbors(slot, otherSlot) : areTeammates(slot, otherSlot);
  return constraint.polarity === "must" ? matches : !matches;
}
