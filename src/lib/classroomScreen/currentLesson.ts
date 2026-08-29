import {
  findCurrentSlot,
  isEarlyPreviewSlot,
  minutesUntilSlotStart,
} from "../../../convex/lib/classroomScreen/currentLesson";
import type {
  ClassroomLessonDisplay,
  ClassroomScreenBundle,
} from "@/hooks/classroomScreen/useClassroomScreenQueries";

export { isEarlyPreviewSlot, minutesUntilSlotStart };

export function resolveCurrentLessonDisplay(
  bundle: Pick<ClassroomScreenBundle, "slots" | "lessons">,
  now: Date = new Date(),
): ClassroomLessonDisplay | null {
  const currentSlot = findCurrentSlot(bundle.slots, now);
  if (!currentSlot) return null;
  return bundle.lessons.find((lesson) => lesson.slotId === currentSlot._id) ?? null;
}

export function findSlotForLesson(
  bundle: Pick<ClassroomScreenBundle, "slots">,
  lesson: ClassroomLessonDisplay,
) {
  return bundle.slots.find((slot) => slot._id === lesson.slotId) ?? null;
}
