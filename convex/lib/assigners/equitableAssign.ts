import { ConvexError } from "convex/values";

export type EquitableAssignScope = "class" | "groups";

export type EquitableAssignRecipient = {
  studentUserId: string;
  groupId?: string;
  groupName?: string;
  genderBucket?: "m" | "f" | "other" | "unknown";
};

export type EquitableAssignAssignment = {
  studentUserId: string;
  item: string;
  groupId?: string;
  groupName?: string;
};

export type EquitableAssignInput = {
  items: ReadonlyArray<string>;
  recipients: ReadonlyArray<EquitableAssignRecipient>;
  scope: EquitableAssignScope;
  balanceGender: boolean;
  /** Prior runs for this assigner — used to compute experience counts. */
  priorAssignments: ReadonlyArray<EquitableAssignAssignment>;
};

/**
 * Equitable assigner balances experience across students to produce fair assignments.
 * Prioritizes least-experienced students first, then assigns what they've done the least,
 * with optional separate balancing for boys and girls.
 *
 * TODO: implement algorithm.
 */
export function assignEquitable(_input: EquitableAssignInput): EquitableAssignAssignment[] {
  throw new ConvexError({
    code: "NOT_IMPLEMENTED",
    message: "Equitable assignment algorithm is not implemented yet",
  });
}
