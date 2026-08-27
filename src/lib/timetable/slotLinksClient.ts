import type { Id } from "../../../convex/_generated/dataModel";
import type {
  LessonLinkFormValues,
  TimetableSlot,
  TimetableWeekBundle,
} from "@/lib/timetable/timetable";
import {
  buildMirrorLessonOps,
  getLinkedSlotIds,
  planSyncSlotLinkMembership,
  planUnlinkSlot,
  type LessonLinkLike,
  type SlotLinkLike,
} from "../../../convex/lib/timetable/slotLinks";

export function getMirrorTargetSlotIds(
  sourceSlotId: Id<"timetableSlots">,
  slots: Array<TimetableSlot>,
): Array<Id<"timetableSlots">> {
  return getLinkedSlotIds(sourceSlotId, slots as Array<SlotLinkLike>);
}

export function mirrorLessonsInBundle(
  bundle: TimetableWeekBundle,
  _sourceSlotId: Id<"timetableSlots">,
  year: number,
  weekNumber: number,
  change: Parameters<typeof buildMirrorLessonOps>[0],
): TimetableWeekBundle {
  const ops = buildMirrorLessonOps(
    change,
    bundle.slots as Array<SlotLinkLike>,
    bundle.lessons as Array<LessonLinkLike>,
    year,
    weekNumber,
  );

  let nextLessons = [...bundle.lessons];
  const now = Date.now();

  for (const op of ops) {
    if (op.op === "createLesson") {
      const subject = bundle.subjects.find((s) => s._id === op.subjectId);
      if (!subject) continue;
      nextLessons.push({
        _id: `optimistic:mirror-${op.slotId}-${op.subjectId}` as Id<"timetableLessons">,
        _creationTime: now,
        classId: bundle.term.classId,
        termId: bundle.term._id,
        slotId: op.slotId,
        subjectId: op.subjectId,
        year,
        weekNumber,
        notesJson: op.notesJson,
        complete: op.complete,
        links: op.links as Array<LessonLinkFormValues>,
        createdAt: now,
        updatedAt: now,
        subject,
      });
      continue;
    }
    if (op.op === "updateLesson") {
      nextLessons = nextLessons.map((lesson) =>
        lesson._id === op.lessonId
          ? {
              ...lesson,
              notesJson: op.notesJson,
              complete: op.complete,
              links: op.links as Array<LessonLinkFormValues>,
              updatedAt: now,
            }
          : lesson,
      );
      continue;
    }
    nextLessons = nextLessons.filter((lesson) => lesson._id !== op.lessonId);
  }

  return { ...bundle, lessons: nextLessons };
}

export function applyOptimisticLinkMembership(
  bundle: TimetableWeekBundle,
  sourceSlotId: Id<"timetableSlots">,
  selectedSlotIds: Array<Id<"timetableSlots">>,
  year: number,
  weekNumber: number,
): TimetableWeekBundle {
  const { slotIdsToClear, linkPlan } = planSyncSlotLinkMembership({
    sourceSlotId,
    selectedSlotIds,
    slots: bundle.slots as Array<SlotLinkLike>,
    lessons: bundle.lessons as Array<LessonLinkLike>,
    year,
    weekNumber,
  });

  const clearSet = new Set(slotIdsToClear);
  let nextSlots = bundle.slots.map((slot) =>
    clearSet.has(slot._id) ? { ...slot, linkGroupId: undefined } : slot,
  );

  let nextLessons = bundle.lessons;
  if (linkPlan) {
    nextSlots = nextSlots.map((slot) =>
      linkPlan.slotIdsToUpdate.includes(slot._id)
        ? { ...slot, linkGroupId: linkPlan.linkGroupId }
        : slot,
    );
    const now = Date.now();
    for (const op of linkPlan.syncOps) {
      if (op.op === "createLesson") {
        const subject = bundle.subjects.find((s) => s._id === op.subjectId);
        if (!subject) continue;
        nextLessons = [
          ...nextLessons,
          {
            _id: `optimistic:link-${op.slotId}-${op.subjectId}` as Id<"timetableLessons">,
            _creationTime: now,
            classId: bundle.term.classId,
            termId: bundle.term._id,
            slotId: op.slotId,
            subjectId: op.subjectId,
            year,
            weekNumber,
            notesJson: op.notesJson,
            complete: op.complete,
            links: op.links as Array<LessonLinkFormValues>,
            createdAt: now,
            updatedAt: now,
            subject,
          },
        ];
      } else if (op.op === "updateLesson") {
        nextLessons = nextLessons.map((lesson) =>
          lesson._id === op.lessonId
            ? {
                ...lesson,
                notesJson: op.notesJson,
                complete: op.complete,
                links: op.links as Array<LessonLinkFormValues>,
                updatedAt: now,
              }
            : lesson,
        );
      }
    }
  }

  return { ...bundle, slots: nextSlots, lessons: nextLessons };
}

export function applyOptimisticUnlink(
  bundle: TimetableWeekBundle,
  slotId: Id<"timetableSlots">,
): TimetableWeekBundle {
  const { slotIdsToClear } = planUnlinkSlot({
    slotId,
    slots: bundle.slots as Array<SlotLinkLike>,
  });
  const clearSet = new Set(slotIdsToClear);
  return {
    ...bundle,
    slots: bundle.slots.map((slot) =>
      clearSet.has(slot._id) ? { ...slot, linkGroupId: undefined } : slot,
    ),
  };
}
