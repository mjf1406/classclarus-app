import type { Id } from "../../_generated/dataModel.js";
import type { EquitableAssignScope } from "./equitableAssign.js";

export type EquitableManualGenderBucket = "m" | "f" | "other" | "unknown";

export type EquitableManualGroup = {
  groupId: Id<"groups">;
  groupName: string;
};

export type EquitableManualSlot = {
  id: string;
  item: string;
  scope: EquitableAssignScope;
  groupId?: Id<"groups">;
  groupName?: string;
  genderRequired?: "m" | "f";
};

export type EquitableManualSlotAssignmentInput = {
  slotId: string;
  studentUserId: Id<"users">;
};

export type EquitableManualRecipient = {
  studentUserId: Id<"users">;
  genderBucket: EquitableManualGenderBucket;
  groupId?: Id<"groups">;
};

export type EquitableManualValidationError =
  | "INVALID_SLOT"
  | "DUPLICATE_STUDENT"
  | "MISSING_SLOT"
  | "INELIGIBLE_STUDENT"
  | "GENDER_MISMATCH"
  | "GROUP_MISMATCH";

export function buildEquitableManualSlots(args: {
  items: ReadonlyArray<string>;
  scope: EquitableAssignScope;
  balanceGender: boolean;
  groups: ReadonlyArray<EquitableManualGroup>;
}): EquitableManualSlot[] {
  const slots: EquitableManualSlot[] = [];

  const pushItemSlots = (item: string, group?: EquitableManualGroup) => {
    const prefix = group
      ? `group:${group.groupId}:${encodeURIComponent(item)}`
      : `class:${encodeURIComponent(item)}`;
    const base = {
      item,
      scope: args.scope,
      ...(group ? { groupId: group.groupId, groupName: group.groupName } : {}),
    };

    if (args.balanceGender) {
      slots.push({ id: `${prefix}:m`, ...base, genderRequired: "m" });
      slots.push({ id: `${prefix}:f`, ...base, genderRequired: "f" });
      return;
    }

    slots.push({ id: prefix, ...base });
  };

  if (args.scope === "groups") {
    for (const group of args.groups) {
      for (const item of args.items) {
        pushItemSlots(item, group);
      }
    }
    return slots;
  }

  for (const item of args.items) {
    pushItemSlots(item);
  }

  return slots;
}

function slotMap(slots: ReadonlyArray<EquitableManualSlot>): Map<string, EquitableManualSlot> {
  return new Map(slots.map((slot) => [slot.id, slot]));
}

export function validateEquitableManualAssignments(args: {
  slots: ReadonlyArray<EquitableManualSlot>;
  assignments: ReadonlyArray<EquitableManualSlotAssignmentInput>;
  recipients: ReadonlyArray<EquitableManualRecipient>;
  scope: EquitableAssignScope;
  balanceGender: boolean;
}): { ok: true } | { ok: false; code: EquitableManualValidationError } {
  const slotsById = slotMap(args.slots);
  const recipientById = new Map(args.recipients.map((r) => [r.studentUserId, r]));
  const seenStudents = new Set<string>();
  const filledSlots = new Set<string>();

  for (const assignment of args.assignments) {
    const slot = slotsById.get(assignment.slotId);
    if (!slot) {
      return { ok: false, code: "INVALID_SLOT" };
    }
    if (filledSlots.has(assignment.slotId)) {
      return { ok: false, code: "INVALID_SLOT" };
    }
    filledSlots.add(assignment.slotId);

    if (seenStudents.has(assignment.studentUserId)) {
      return { ok: false, code: "DUPLICATE_STUDENT" };
    }
    seenStudents.add(assignment.studentUserId);

    const recipient = recipientById.get(assignment.studentUserId);
    if (!recipient) {
      return { ok: false, code: "INELIGIBLE_STUDENT" };
    }

    if (args.scope === "groups") {
      if (!slot.groupId || recipient.groupId !== slot.groupId) {
        return { ok: false, code: "GROUP_MISMATCH" };
      }
    }

    if (slot.genderRequired) {
      if (recipient.genderBucket !== slot.genderRequired) {
        return { ok: false, code: "GENDER_MISMATCH" };
      }
    } else if (args.balanceGender) {
      return { ok: false, code: "INVALID_SLOT" };
    }
  }

  if (filledSlots.size !== args.slots.length) {
    return { ok: false, code: "MISSING_SLOT" };
  }

  return { ok: true };
}

export function assignmentsComplete(
  slots: ReadonlyArray<EquitableManualSlot>,
  assignments: ReadonlyArray<EquitableManualSlotAssignmentInput>,
): boolean {
  if (assignments.length !== slots.length) return false;
  const slotIds = new Set(slots.map((slot) => slot.id));
  const seen = new Set<string>();
  for (const assignment of assignments) {
    if (!slotIds.has(assignment.slotId) || seen.has(assignment.slotId)) return false;
    seen.add(assignment.slotId);
  }
  return seen.size === slots.length;
}
