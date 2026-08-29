import {
  formatPushOverrideRemainingSeconds,
  isPushOverrideActive,
} from "@/lib/classroomScreen/activeSession";
import { isEarlyPreviewSlot, minutesUntilSlotStart } from "@/lib/classroomScreen/currentLesson";
import type { ClassroomDisplayBundle } from "@/hooks/classroomScreen/useClassroomScreenQueries";

export type LessonDisplayState = {
  pushActive: boolean;
  activeLesson: ClassroomDisplayBundle["currentLesson"];
  autoSlot: ClassroomDisplayBundle["currentSlot"];
  showLessonContent: boolean;
  globalQuickText: string | null;
};

export type LessonDisplayStatus =
  | { kind: "pushed"; pushedUntil: number }
  | { kind: "upcoming"; minutes: number }
  | { kind: "current" }
  | { kind: "quickText" }
  | { kind: "empty" };

function toNowMs(now: Date | number): number {
  return typeof now === "number" ? now : now.getTime();
}

function toDate(now: Date | number): Date {
  return typeof now === "number" ? new Date(now) : now;
}

export function resolveLessonDisplayState(
  bundle: ClassroomDisplayBundle | null | undefined,
  now: Date | number = new Date(),
): LessonDisplayState {
  if (!bundle) {
    return {
      pushActive: false,
      activeLesson: null,
      autoSlot: null,
      showLessonContent: false,
      globalQuickText: null,
    };
  }

  const nowMs = toNowMs(now);
  const pushActive =
    !!bundle.pushedLesson && isPushOverrideActive(bundle.displaySession.pushedUntil, nowMs);
  const autoLesson = bundle.currentLesson;
  const activeLesson = pushActive ? (bundle.pushedLesson ?? null) : autoLesson;
  const showLessonContent = !!activeLesson;
  const globalQuickText =
    !pushActive && !showLessonContent ? (bundle.settings.quickText ?? null) : null;
  const autoSlot = autoLesson ? bundle.currentSlot : null;

  return { pushActive, activeLesson, autoSlot, showLessonContent, globalQuickText };
}

export function resolveLessonDisplayStatus(
  state: LessonDisplayState,
  pushedUntil: number | null | undefined,
  now: Date | number = new Date(),
): LessonDisplayStatus {
  if (state.pushActive && pushedUntil != null) {
    return { kind: "pushed", pushedUntil };
  }

  if (state.showLessonContent && state.autoSlot) {
    const nowDate = toDate(now);
    const timeZone = state.activeLesson?.timeZone;
    if (isEarlyPreviewSlot(state.autoSlot, nowDate, timeZone)) {
      return {
        kind: "upcoming",
        minutes: minutesUntilSlotStart(state.autoSlot, nowDate, timeZone),
      };
    }
    return { kind: "current" };
  }

  if (state.globalQuickText) {
    return { kind: "quickText" };
  }

  return { kind: "empty" };
}

export function lessonSlotTimes(
  lesson: { startTime?: string; endTime?: string } | null,
  currentSlot: { startTime: string; endTime: string } | null | undefined,
) {
  if (lesson?.startTime && lesson.endTime) {
    return { startTime: lesson.startTime, endTime: lesson.endTime };
  }
  if (currentSlot) {
    return { startTime: currentSlot.startTime, endTime: currentSlot.endTime };
  }
  return null;
}

type StatusTranslator = (key: string, options?: Record<string, unknown>) => string;

export function formatLessonDisplayStatusLabel(
  status: LessonDisplayStatus,
  t: StatusTranslator,
  now: Date | number = new Date(),
): string | null {
  switch (status.kind) {
    case "pushed": {
      const secondsLeft = formatPushOverrideRemainingSeconds(status.pushedUntil, toNowMs(now));
      const remaining =
        secondsLeft >= 60
          ? t("pushedRemainingMinutes", { count: Math.ceil(secondsLeft / 60) })
          : t("pushedRemainingSeconds", { count: secondsLeft });
      return t("statusPushedLesson", { remaining });
    }
    case "upcoming":
      return t("statusUpcomingLesson", { minutes: status.minutes });
    case "current":
      return t("statusCurrentLesson");
    case "quickText":
      return t("statusQuickText");
    case "empty":
      return null;
  }
}
