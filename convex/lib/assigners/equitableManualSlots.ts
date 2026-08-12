import type { Id } from "../../_generated/dataModel.js";
import type { EquitableAssignScope } from "./equitableAssign.js";
import {
  type EquitableGenderBucket,
  normalizeEquitableGenderBuckets,
} from "./equitableGenderBuckets.js";

export type EquitableManualGenderBucket = EquitableGenderBucket;

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
  genderRequired?: EquitableGenderBucket;
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

type ManualStudentPool = {
  genderBucket: EquitableManualGenderBucket;
  groupId?: Id<"groups">;
};

function encodeItem(item: string): string {
  return encodeURIComponent(item);
}

function activeGenderBucketsForPool(
  recipients: ReadonlyArray<ManualStudentPool>,
  genderBuckets: ReadonlyArray<EquitableGenderBucket>,
): EquitableGenderBucket[] {
  const present = new Set<EquitableGenderBucket>();
  for (const recipient of recipients) {
    present.add(recipient.genderBucket);
  }
  return genderBuckets.filter((bucket) => present.has(bucket));
}

function recipientsInPool(
  recipients: ReadonlyArray<ManualStudentPool>,
  scope: EquitableAssignScope,
  group?: EquitableManualGroup,
): ManualStudentPool[] {
  if (scope === "groups" && group) {
    return recipients.filter((recipient) => recipient.groupId === group.groupId);
  }
  return [...recipients];
}

function pushItemSlots(
  slots: EquitableManualSlot[],
  item: string,
  scope: EquitableAssignScope,
  balanceGender: boolean,
  genderBuckets: ReadonlyArray<EquitableGenderBucket>,
  poolRecipients: ReadonlyArray<ManualStudentPool>,
  group?: EquitableManualGroup,
): void {
  const prefix = group ? `group:${group.groupId}:${encodeItem(item)}` : `class:${encodeItem(item)}`;
  const base = {
    item,
    scope,
    ...(group ? { groupId: group.groupId, groupName: group.groupName } : {}),
  };

  if (balanceGender) {
    const activeBuckets = activeGenderBucketsForPool(poolRecipients, genderBuckets);
    for (const bucket of activeBuckets) {
      slots.push({ id: `${prefix}:${bucket}`, ...base, genderRequired: bucket });
    }
    return;
  }

  slots.push({ id: prefix, ...base });
}

export function buildEquitableManualSlots(args: {
  items: ReadonlyArray<string>;
  scope: EquitableAssignScope;
  balanceGender: boolean;
  genderBuckets?: ReadonlyArray<EquitableGenderBucket>;
  groups: ReadonlyArray<EquitableManualGroup>;
  recipients?: ReadonlyArray<ManualStudentPool>;
}): EquitableManualSlot[] {
  const genderBuckets = normalizeEquitableGenderBuckets(args.genderBuckets);
  const recipients = args.recipients ?? [];
  const slots: EquitableManualSlot[] = [];

  if (args.scope === "groups") {
    for (const group of args.groups) {
      const poolRecipients = recipientsInPool(recipients, args.scope, group);
      for (const item of args.items) {
        pushItemSlots(
          slots,
          item,
          args.scope,
          args.balanceGender,
          genderBuckets,
          poolRecipients,
          group,
        );
      }
    }
    return slots;
  }

  const poolRecipients = recipientsInPool(recipients, args.scope);
  for (const item of args.items) {
    pushItemSlots(slots, item, args.scope, args.balanceGender, genderBuckets, poolRecipients);
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
