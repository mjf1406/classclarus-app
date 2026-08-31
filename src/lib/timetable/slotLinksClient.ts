import type { Id } from "../../../convex/_generated/dataModel";
import type {
  TimetableLesson,
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

function toLessonLinkLike(lesson: TimetableLesson): LessonLinkLike {
  return {
    _id: lesson._id,
    slotId: lesson.slotId,
    subjectId: lesson.subjectId,
    year: lesson.year,
    weekNumber: lesson.weekNumber,
    complete: lesson.complete,
    materials: lesson.materials,
    announcements: lesson.announcements,
    agenda: lesson.agenda,
    lessonUrl: lesson.lessonUrl,
    lessonUrlShared: lesson.lessonUrlShared,
  };
}

function applyOpToLesson(
  lesson: TimetableLesson,
  op: {
    materials: TimetableLesson["materials"];
    announcements: TimetableLesson["announcements"];
    agenda: TimetableLesson["agenda"];
    complete: boolean;
    lessonUrl?: string;
    lessonUrlShared?: boolean;
  },
  now: number,
): TimetableLesson {
  return {
    ...lesson,
    materials: op.materials,
    announcements: op.announcements,
    agenda: op.agenda,
    complete: op.complete,
    lessonUrl: op.lessonUrl,
    lessonUrlShared: op.lessonUrlShared === true,
    updatedAt: now,
  };
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
    bundle.lessons.map(toLessonLinkLike),
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
        complete: op.complete,
        materials: op.materials,
        announcements: op.announcements,
        agenda: op.agenda,
        lessonUrl: op.lessonUrl,
        lessonUrlShared: op.lessonUrlShared === true,
        createdAt: now,
        updatedAt: now,
        subject,
        upcomingEvents: [],
      });
      continue;
    }
    if (op.op === "updateLesson") {
      nextLessons = nextLessons.map((lesson) =>
        lesson._id === op.lessonId ? applyOpToLesson(lesson, op, now) : lesson,
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
    lessons: bundle.lessons.map(toLessonLinkLike),
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
            complete: op.complete,
            materials: op.materials,
            announcements: op.announcements,
            agenda: op.agenda,
            lessonUrl: op.lessonUrl,
            lessonUrlShared: op.lessonUrlShared === true,
            createdAt: now,
            updatedAt: now,
            subject,
            upcomingEvents: [],
          },
        ];
      } else if (op.op === "updateLesson") {
        nextLessons = nextLessons.map((lesson) =>
          lesson._id === op.lessonId ? applyOpToLesson(lesson, op, now) : lesson,
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
