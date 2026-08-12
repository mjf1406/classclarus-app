import {
  type EquitableGenderBucket,
  normalizeEquitableGenderBuckets,
} from "./equitableGenderBuckets.js";

export type EquitableAssignScope = "class" | "groups";

export type EquitableAssignRecipient = {
  studentUserId: string;
  groupId?: string;
  groupName?: string;
  genderBucket?: EquitableGenderBucket;
  /** Used for deterministic tie-breaks when roster numbers are unavailable. */
  rosterNumber?: number;
};

export type EquitableAssignAssignment = {
  studentUserId: string;
  item: string;
  groupId?: string;
  groupName?: string;
};

export type EquitableAssignSlot = {
  id: string;
  item: string;
  scope: EquitableAssignScope;
  groupId?: string;
  groupName?: string;
  genderRequired?: EquitableGenderBucket;
};

export type EquitableAssignLockedAssignment = {
  slotId: string;
  studentUserId: string;
};

export type EquitableSlotAssignmentResult = {
  slotId: string;
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
  /** Selected gender buckets when balanceGender is true. */
  genderBuckets?: ReadonlyArray<EquitableGenderBucket>;
  /** Prior runs for this assigner — global history across groups. */
  priorAssignments: ReadonlyArray<EquitableAssignAssignment>;
  /** Slots already filled manually; preserved in the result. */
  lockedAssignments?: ReadonlyArray<EquitableAssignLockedAssignment>;
  /** Optional pre-built slots (e.g. manual editor). */
  slots?: ReadonlyArray<EquitableAssignSlot>;
  /** Optional injectable RNG for tie-break rotation (defaults to Math.random). */
  random?: () => number;
  /** Run count for this group/team in old solver; used as rotation offset. */
  runCount?: number;
};

type EquitableAssignGroup = {
  groupId: string;
  groupName: string;
};

type ExperienceCounts = {
  totalByStudent: Map<string, number>;
  itemByStudent: Map<string, Map<string, number>>;
  lastAssignedOrderByStudent: Map<string, number>;
};

function encodeItem(item: string): string {
  return encodeURIComponent(item);
}

function recipientEligibleForSlot(
  recipient: EquitableAssignRecipient,
  slot: EquitableAssignSlot,
  scope: EquitableAssignScope,
): boolean {
  if (scope === "groups") {
    if (!slot.groupId || recipient.groupId !== slot.groupId) return false;
  }
  if (slot.genderRequired && recipient.genderBucket !== slot.genderRequired) return false;
  return true;
}

function recipientsInPool(
  recipients: ReadonlyArray<EquitableAssignRecipient>,
  scope: EquitableAssignScope,
  group?: EquitableAssignGroup,
): EquitableAssignRecipient[] {
  if (scope === "groups" && group) {
    return recipients.filter((recipient) => recipient.groupId === group.groupId);
  }
  return [...recipients];
}

function activeGenderBucketsForPool(
  recipients: ReadonlyArray<EquitableAssignRecipient>,
  genderBuckets: ReadonlyArray<EquitableGenderBucket>,
): EquitableGenderBucket[] {
  const present = new Set<EquitableGenderBucket>();
  for (const recipient of recipients) {
    if (recipient.genderBucket) present.add(recipient.genderBucket);
  }
  return genderBuckets.filter((bucket) => present.has(bucket));
}

function pushItemSlots(
  slots: EquitableAssignSlot[],
  item: string,
  scope: EquitableAssignScope,
  balanceGender: boolean,
  genderBuckets: ReadonlyArray<EquitableGenderBucket>,
  poolRecipients: ReadonlyArray<EquitableAssignRecipient>,
  group?: EquitableAssignGroup,
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

export function buildEquitableAssignSlots(args: {
  items: ReadonlyArray<string>;
  scope: EquitableAssignScope;
  balanceGender: boolean;
  genderBuckets?: ReadonlyArray<EquitableGenderBucket>;
  groups: ReadonlyArray<EquitableAssignGroup>;
  recipients: ReadonlyArray<EquitableAssignRecipient>;
}): EquitableAssignSlot[] {
  const genderBuckets = normalizeEquitableGenderBuckets(args.genderBuckets);
  const slots: EquitableAssignSlot[] = [];

  if (args.scope === "groups") {
    for (const group of args.groups) {
      const poolRecipients = recipientsInPool(args.recipients, args.scope, group);
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

  const poolRecipients = recipientsInPool(args.recipients, args.scope);
  for (const item of args.items) {
    pushItemSlots(slots, item, args.scope, args.balanceGender, genderBuckets, poolRecipients);
  }

  return slots;
}

export function buildExperienceCounts(
  priorAssignments: ReadonlyArray<EquitableAssignAssignment>,
): ExperienceCounts {
  const totalByStudent = new Map<string, number>();
  const itemByStudent = new Map<string, Map<string, number>>();
  const lastAssignedOrderByStudent = new Map<string, number>();

  for (let index = 0; index < priorAssignments.length; index += 1) {
    const row = priorAssignments[index]!;
    totalByStudent.set(row.studentUserId, (totalByStudent.get(row.studentUserId) ?? 0) + 1);

    let byItem = itemByStudent.get(row.studentUserId);
    if (!byItem) {
      byItem = new Map<string, number>();
      itemByStudent.set(row.studentUserId, byItem);
    }
    byItem.set(row.item, (byItem.get(row.item) ?? 0) + 1);

    lastAssignedOrderByStudent.set(row.studentUserId, index);
  }

  return { totalByStudent, itemByStudent, lastAssignedOrderByStudent };
}

function getTotalJobs(studentId: string, experience: ExperienceCounts): number {
  return experience.totalByStudent.get(studentId) ?? 0;
}

function getItemJobs(studentId: string, item: string, experience: ExperienceCounts): number {
  return experience.itemByStudent.get(studentId)?.get(item) ?? 0;
}

function getLastAssignedOrder(studentId: string, experience: ExperienceCounts): number {
  return experience.lastAssignedOrderByStudent.get(studentId) ?? -1;
}

function compareRecipientsForRun(
  a: EquitableAssignRecipient,
  b: EquitableAssignRecipient,
  items: ReadonlyArray<string>,
  experience: ExperienceCounts,
): number {
  const totalA = getTotalJobs(a.studentUserId, experience);
  const totalB = getTotalJobs(b.studentUserId, experience);
  if (totalA !== totalB) return totalA - totalB;

  const minItemA = Math.min(...items.map((item) => getItemJobs(a.studentUserId, item, experience)));
  const minItemB = Math.min(...items.map((item) => getItemJobs(b.studentUserId, item, experience)));
  if (minItemA !== minItemB) return minItemA - minItemB;

  const recencyA = getLastAssignedOrder(a.studentUserId, experience);
  const recencyB = getLastAssignedOrder(b.studentUserId, experience);
  if (recencyA !== recencyB) return recencyA - recencyB;

  return 0;
}

function compareRecipientFallback(
  a: EquitableAssignRecipient,
  b: EquitableAssignRecipient,
): number {
  const numA = a.rosterNumber ?? Number.MAX_SAFE_INTEGER;
  const numB = b.rosterNumber ?? Number.MAX_SAFE_INTEGER;
  if (numA !== numB) return numA - numB;

  return a.studentUserId.localeCompare(b.studentUserId);
}

function poolKey(slot: EquitableAssignSlot): string {
  return `${slot.groupId ?? ""}::${slot.genderRequired ?? ""}`;
}

function assignPoolStudentFirst(args: {
  slots: EquitableAssignSlot[];
  recipients: ReadonlyArray<EquitableAssignRecipient>;
  scope: EquitableAssignScope;
  experience: ExperienceCounts;
  assignedStudentIds: Set<string>;
  filledSlotIds: Set<string>;
  items: ReadonlyArray<string>;
  runCount: number;
  random: () => number;
}): EquitableSlotAssignmentResult[] {
  const results: EquitableSlotAssignmentResult[] = [];
  const pools = new Map<string, EquitableAssignSlot[]>();

  for (const slot of args.slots) {
    if (args.filledSlotIds.has(slot.id)) continue;
    const key = poolKey(slot);
    const list = pools.get(key) ?? [];
    list.push(slot);
    pools.set(key, list);
  }

  for (const poolSlots of pools.values()) {
    const sortedPoolSlots = sortSlotsDeterministic(poolSlots);
    const sampleSlot = sortedPoolSlots[0]!;
    const eligibleStudents = args.recipients.filter(
      (recipient) =>
        !args.assignedStudentIds.has(recipient.studentUserId) &&
        recipientEligibleForSlot(recipient, sampleSlot, args.scope),
    );
    if (eligibleStudents.length === 0) continue;

    // Draw once per student so the comparator remains transitive and seeded runs are reproducible.
    const randomKeyByStudent = new Map(
      eligibleStudents.map((student) => [student.studentUserId, args.random()] as const),
    );
    const sortedStudents = [...eligibleStudents].sort((a, b) => {
      const primary = compareRecipientsForRun(a, b, args.items, args.experience);
      if (primary !== 0) return primary;
      const randomOrder =
        (randomKeyByStudent.get(a.studentUserId) ?? 0) -
        (randomKeyByStudent.get(b.studentUserId) ?? 0);
      if (randomOrder !== 0) return randomOrder;
      return compareRecipientFallback(a, b);
    });

    const availableSlots = [...sortedPoolSlots];
    const assignmentCount = Math.min(sortedStudents.length, availableSlots.length);

    for (let index = 0; index < assignmentCount; index += 1) {
      const student = sortedStudents[index]!;
      let bestSlot = availableSlots[0]!;
      let bestItemCount = getItemJobs(student.studentUserId, bestSlot.item, args.experience);
      let bestRotation = (availableSlots.indexOf(bestSlot) + args.runCount) % availableSlots.length;

      for (let slotIndex = 1; slotIndex < availableSlots.length; slotIndex += 1) {
        const slot = availableSlots[slotIndex]!;
        const itemCount = getItemJobs(student.studentUserId, slot.item, args.experience);
        const rotation = (slotIndex + args.runCount) % availableSlots.length;
        if (itemCount < bestItemCount) {
          bestItemCount = itemCount;
          bestRotation = rotation;
          bestSlot = slot;
        } else if (itemCount === bestItemCount && rotation < bestRotation) {
          bestRotation = rotation;
          bestSlot = slot;
        }
      }

      args.assignedStudentIds.add(student.studentUserId);
      args.filledSlotIds.add(bestSlot.id);
      availableSlots.splice(availableSlots.indexOf(bestSlot), 1);
      results.push(toSlotAssignment(bestSlot, student));
    }
  }

  return results;
}

function sortSlotsDeterministic(slots: ReadonlyArray<EquitableAssignSlot>): EquitableAssignSlot[] {
  return [...slots].sort((a, b) => {
    const groupA = a.groupName ?? "";
    const groupB = b.groupName ?? "";
    if (groupA !== groupB) return groupA.localeCompare(groupB);
    if (a.item !== b.item) return a.item.localeCompare(b.item);
    const genderA = a.genderRequired ?? "";
    const genderB = b.genderRequired ?? "";
    if (genderA !== genderB) return genderA.localeCompare(genderB);
    return a.id.localeCompare(b.id);
  });
}

function recipientFromLocked(
  recipients: ReadonlyArray<EquitableAssignRecipient>,
  studentUserId: string,
): EquitableAssignRecipient | undefined {
  return recipients.find((recipient) => recipient.studentUserId === studentUserId);
}

function toSlotAssignment(
  slot: EquitableAssignSlot,
  recipient: EquitableAssignRecipient,
): EquitableSlotAssignmentResult {
  return {
    slotId: slot.id,
    studentUserId: recipient.studentUserId,
    item: slot.item,
    ...(slot.groupId ? { groupId: slot.groupId, groupName: slot.groupName } : {}),
  };
}

/**
 * Equitable assigner balances experience across students to produce fair assignments.
 * Prioritizes least-experienced students first, then assigns what they've done the least,
 * with optional separate balancing for selected gender buckets.
 */
export function assignEquitableSlots(input: EquitableAssignInput): EquitableSlotAssignmentResult[] {
  const genderBuckets = normalizeEquitableGenderBuckets(input.genderBuckets);
  const groups = collectGroups(input.recipients, input.scope);
  const slots =
    input.slots ??
    buildEquitableAssignSlots({
      items: input.items,
      scope: input.scope,
      balanceGender: input.balanceGender,
      genderBuckets,
      groups,
      recipients: input.recipients,
    });

  if (slots.length === 0 || input.recipients.length === 0) return [];

  const slotById = new Map(slots.map((slot) => [slot.id, slot]));
  const experience = buildExperienceCounts(input.priorAssignments);
  const assignedStudentIds = new Set<string>();
  const filledSlotIds = new Set<string>();
  const results: EquitableSlotAssignmentResult[] = [];

  for (const locked of input.lockedAssignments ?? []) {
    const slot = slotById.get(locked.slotId);
    const recipient = recipientFromLocked(input.recipients, locked.studentUserId);
    if (!slot || !recipient) continue;
    if (!recipientEligibleForSlot(recipient, slot, input.scope)) continue;
    if (assignedStudentIds.has(locked.studentUserId)) continue;
    assignedStudentIds.add(locked.studentUserId);
    filledSlotIds.add(locked.slotId);
    results.push(toSlotAssignment(slot, recipient));
  }

  const remainingSlots = sortSlotsDeterministic(
    slots.filter((slot) => !filledSlotIds.has(slot.id)),
  );

  const runCount = input.runCount ?? 0;
  const random = input.random ?? Math.random;

  results.push(
    ...assignPoolStudentFirst({
      slots: remainingSlots,
      recipients: input.recipients,
      scope: input.scope,
      experience,
      assignedStudentIds,
      filledSlotIds,
      items: input.items,
      runCount,
      random,
    }),
  );

  return results;
}

export function assignEquitable(input: EquitableAssignInput): EquitableAssignAssignment[] {
  return assignEquitableSlots(input).map((row) => ({
    studentUserId: row.studentUserId,
    item: row.item,
    ...(row.groupId ? { groupId: row.groupId, groupName: row.groupName } : {}),
  }));
}

function collectGroups(
  recipients: ReadonlyArray<EquitableAssignRecipient>,
  scope: EquitableAssignScope,
): EquitableAssignGroup[] {
  if (scope !== "groups") return [];
  const groups = new Map<string, EquitableAssignGroup>();
  for (const recipient of recipients) {
    if (!recipient.groupId) continue;
    if (!groups.has(recipient.groupId)) {
      groups.set(recipient.groupId, {
        groupId: recipient.groupId,
        groupName: recipient.groupName ?? recipient.groupId,
      });
    }
  }
  return [...groups.values()].sort((a, b) => a.groupName.localeCompare(b.groupName));
}
