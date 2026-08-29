import type { Id } from "../../_generated/dataModel.js";
import type { AgendaItem, SectionItem } from "./sectionItems.js";

export type SlotLinkLike = {
  _id: Id<"timetableSlots">;
  linkGroupId?: string;
};

export type LessonLinkLike = {
  _id: Id<"timetableLessons">;
  slotId: Id<"timetableSlots">;
  subjectId: Id<"timetableSubjects">;
  year: number;
  weekNumber: number;
  complete: boolean;
  materials: Array<SectionItem>;
  announcements: Array<SectionItem>;
  agenda: Array<AgendaItem>;
};

export type LessonSectionFields = {
  materials: Array<SectionItem>;
  announcements: Array<SectionItem>;
  agenda: Array<AgendaItem>;
  complete: boolean;
};

export function createLinkGroupId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function getLinkedSlotIds(
  slotId: Id<"timetableSlots">,
  slots: Array<SlotLinkLike>,
): Array<Id<"timetableSlots">> {
  const slot = slots.find((s) => s._id === slotId);
  if (!slot?.linkGroupId) return [];

  return slots
    .filter((s) => s.linkGroupId === slot.linkGroupId && s._id !== slotId)
    .map((s) => s._id);
}

export function getSlotIdsInGroup(
  linkGroupId: string,
  slots: Array<SlotLinkLike>,
): Array<Id<"timetableSlots">> {
  return slots.filter((s) => s.linkGroupId === linkGroupId).map((s) => s._id);
}

function collectGroupIdsForSlots(
  slotIds: Array<Id<"timetableSlots">>,
  slots: Array<SlotLinkLike>,
): Set<string> {
  const groupIds = new Set<string>();
  for (const slotId of slotIds) {
    const slot = slots.find((s) => s._id === slotId);
    if (slot?.linkGroupId) {
      groupIds.add(slot.linkGroupId);
    }
  }
  return groupIds;
}

function findLessonForSlotAndSubject(
  lessons: Array<LessonLinkLike>,
  slotId: Id<"timetableSlots">,
  year: number,
  weekNumber: number,
  subjectId: Id<"timetableSubjects">,
): LessonLinkLike | undefined {
  return lessons.find(
    (lesson) =>
      lesson.slotId === slotId &&
      lesson.year === year &&
      lesson.weekNumber === weekNumber &&
      lesson.subjectId === subjectId,
  );
}

export type MirrorLessonAdd = {
  type: "add";
  sourceSlotId: Id<"timetableSlots">;
  subjectId: Id<"timetableSubjects">;
} & LessonSectionFields;

export type MirrorLessonUpdate = {
  type: "update";
  sourceLesson: LessonLinkLike;
};

export type MirrorLessonDelete = {
  type: "delete";
  sourceLesson: LessonLinkLike;
};

export type MirrorLessonChange = MirrorLessonAdd | MirrorLessonUpdate | MirrorLessonDelete;

export type MirrorLessonOp =
  | ({
      op: "createLesson";
      slotId: Id<"timetableSlots">;
      subjectId: Id<"timetableSubjects">;
    } & LessonSectionFields)
  | ({
      op: "updateLesson";
      lessonId: Id<"timetableLessons">;
    } & LessonSectionFields)
  | { op: "deleteLesson"; lessonId: Id<"timetableLessons"> };

export function buildMirrorLessonOps(
  change: MirrorLessonChange,
  slots: Array<SlotLinkLike>,
  lessons: Array<LessonLinkLike>,
  year: number,
  weekNumber: number,
): Array<MirrorLessonOp> {
  const sourceSlotId = change.type === "add" ? change.sourceSlotId : change.sourceLesson.slotId;

  const linkedSlotIds = getLinkedSlotIds(sourceSlotId, slots);
  if (linkedSlotIds.length === 0) return [];

  const ops: Array<MirrorLessonOp> = [];

  if (change.type === "add") {
    for (const targetSlotId of linkedSlotIds) {
      const existing = findLessonForSlotAndSubject(
        lessons,
        targetSlotId,
        year,
        weekNumber,
        change.subjectId,
      );
      if (existing) {
        ops.push({
          op: "updateLesson",
          lessonId: existing._id,
          materials: change.materials,
          announcements: change.announcements,
          agenda: change.agenda,
          complete: change.complete,
        });
      } else {
        ops.push({
          op: "createLesson",
          slotId: targetSlotId,
          subjectId: change.subjectId,
          materials: change.materials,
          announcements: change.announcements,
          agenda: change.agenda,
          complete: change.complete,
        });
      }
    }
    return ops;
  }

  const sourceLesson = change.sourceLesson;
  const subjectId = sourceLesson.subjectId;

  if (change.type === "update") {
    for (const targetSlotId of linkedSlotIds) {
      const existing = findLessonForSlotAndSubject(
        lessons,
        targetSlotId,
        year,
        weekNumber,
        subjectId,
      );
      if (existing) {
        ops.push({
          op: "updateLesson",
          lessonId: existing._id,
          materials: sourceLesson.materials,
          announcements: sourceLesson.announcements,
          agenda: sourceLesson.agenda,
          complete: sourceLesson.complete,
        });
      }
    }
    return ops;
  }

  for (const targetSlotId of linkedSlotIds) {
    const existing = findLessonForSlotAndSubject(
      lessons,
      targetSlotId,
      year,
      weekNumber,
      subjectId,
    );
    if (existing) {
      ops.push({ op: "deleteLesson", lessonId: existing._id });
    }
  }

  return ops;
}

export type LinkSlotsParams = {
  sourceSlotId: Id<"timetableSlots">;
  targetSlotIds: Array<Id<"timetableSlots">>;
  slots: Array<SlotLinkLike>;
  lessons: Array<LessonLinkLike>;
  year: number;
  weekNumber: number;
};

export type LinkSlotsResult = {
  linkGroupId: string;
  slotIdsToUpdate: Array<Id<"timetableSlots">>;
  syncOps: Array<MirrorLessonOp>;
};

export function planLinkSlots({
  sourceSlotId,
  targetSlotIds,
  slots,
  lessons,
  year,
  weekNumber,
}: LinkSlotsParams): LinkSlotsResult {
  const sourceSlot = slots.find((s) => s._id === sourceSlotId);
  if (!sourceSlot) {
    throw new Error("Source slot not found");
  }

  const uniqueTargetIds = [...new Set(targetSlotIds.filter((id) => id !== sourceSlotId))];

  const existingGroupIds = collectGroupIdsForSlots([sourceSlotId, ...uniqueTargetIds], slots);

  const linkGroupId = sourceSlot.linkGroupId ?? [...existingGroupIds][0] ?? createLinkGroupId();

  const slotIdsToUpdate = new Set<Id<"timetableSlots">>([sourceSlotId, ...uniqueTargetIds]);

  for (const groupId of existingGroupIds) {
    for (const slotId of getSlotIdsInGroup(groupId, slots)) {
      slotIdsToUpdate.add(slotId);
    }
  }

  const sourceLessons = lessons.filter(
    (lesson) =>
      lesson.slotId === sourceSlotId && lesson.year === year && lesson.weekNumber === weekNumber,
  );

  const syncOps: Array<MirrorLessonOp> = [];
  const otherSlotIds = [...slotIdsToUpdate].filter((id) => id !== sourceSlotId);

  for (const sourceLesson of sourceLessons) {
    for (const targetSlotId of otherSlotIds) {
      const existing = findLessonForSlotAndSubject(
        lessons,
        targetSlotId,
        year,
        weekNumber,
        sourceLesson.subjectId,
      );
      if (existing) {
        syncOps.push({
          op: "updateLesson",
          lessonId: existing._id,
          materials: sourceLesson.materials,
          announcements: sourceLesson.announcements,
          agenda: sourceLesson.agenda,
          complete: sourceLesson.complete,
        });
      } else {
        syncOps.push({
          op: "createLesson",
          slotId: targetSlotId,
          subjectId: sourceLesson.subjectId,
          materials: sourceLesson.materials,
          announcements: sourceLesson.announcements,
          agenda: sourceLesson.agenda,
          complete: sourceLesson.complete,
        });
      }
    }
  }

  return {
    linkGroupId,
    slotIdsToUpdate: [...slotIdsToUpdate],
    syncOps,
  };
}

export function planUnlinkSlot({
  slotId,
  slots,
}: {
  slotId: Id<"timetableSlots">;
  slots: Array<SlotLinkLike>;
}): { slotIdsToClear: Array<Id<"timetableSlots">> } {
  const slot = slots.find((s) => s._id === slotId);
  if (!slot?.linkGroupId) {
    return { slotIdsToClear: [] };
  }

  const groupSlotIds = getSlotIdsInGroup(slot.linkGroupId, slots);
  const remainingAfterUnlink = groupSlotIds.filter((id) => id !== slotId);

  if (remainingAfterUnlink.length === 1) {
    return { slotIdsToClear: [slotId, remainingAfterUnlink[0]!] };
  }

  return { slotIdsToClear: [slotId] };
}

export function planRemoveSlotsFromGroup(
  slotIdsToRemove: Array<Id<"timetableSlots">>,
  slots: Array<SlotLinkLike>,
): Array<Id<"timetableSlots">> {
  const toClear = new Set<Id<"timetableSlots">>();

  for (const slotId of slotIdsToRemove) {
    const slot = slots.find((s) => s._id === slotId);
    if (!slot?.linkGroupId) continue;

    const groupIds = getSlotIdsInGroup(slot.linkGroupId, slots);
    const remaining = groupIds.filter((id) => id !== slotId && !slotIdsToRemove.includes(id));

    toClear.add(slotId);
    if (remaining.length === 1) {
      toClear.add(remaining[0]!);
    }
  }

  return [...toClear];
}

export function planSyncSlotLinkMembership({
  sourceSlotId,
  selectedSlotIds,
  slots,
  lessons,
  year,
  weekNumber,
}: {
  sourceSlotId: Id<"timetableSlots">;
  selectedSlotIds: Array<Id<"timetableSlots">>;
  slots: Array<SlotLinkLike>;
  lessons: Array<LessonLinkLike>;
  year: number;
  weekNumber: number;
}): {
  slotIdsToClear: Array<Id<"timetableSlots">>;
  linkPlan: LinkSlotsResult | null;
} {
  const sourceSlot = slots.find((s) => s._id === sourceSlotId);
  if (!sourceSlot) {
    throw new Error("Source slot not found");
  }

  const currentMembers = sourceSlot.linkGroupId
    ? getSlotIdsInGroup(sourceSlot.linkGroupId, slots)
    : [sourceSlotId];

  const selectedSet = new Set(selectedSlotIds);
  const toRemove = currentMembers.filter(
    (memberId) => memberId !== sourceSlotId && !selectedSet.has(memberId),
  );

  const slotIdsToClear = planRemoveSlotsFromGroup(toRemove, slots);

  const remainingSelected = selectedSlotIds.filter((slotId) => !toRemove.includes(slotId));

  if (remainingSelected.length === 0) {
    return {
      slotIdsToClear: [...new Set([...slotIdsToClear, sourceSlotId])],
      linkPlan: null,
    };
  }

  const linkPlan = planLinkSlots({
    sourceSlotId,
    targetSlotIds: remainingSelected,
    slots,
    lessons,
    year,
    weekNumber,
  });

  return { slotIdsToClear, linkPlan };
}

export function planRepairGroupAfterSlotDelete(
  deletedSlotId: Id<"timetableSlots">,
  slots: Array<SlotLinkLike>,
): Array<Id<"timetableSlots">> {
  const deletedSlot = slots.find((s) => s._id === deletedSlotId);
  if (!deletedSlot?.linkGroupId) return [];

  const groupSlotIds = getSlotIdsInGroup(deletedSlot.linkGroupId, slots).filter(
    (id) => id !== deletedSlotId,
  );

  if (groupSlotIds.length === 1) {
    return groupSlotIds;
  }

  return [];
}
