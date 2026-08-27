import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import {
  timetableTermsQueryKey,
  timetableWeekBundleQueryKey,
} from "@/hooks/timetable/useTimetableQueries";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import { messageFromError } from "@/lib/errors/convexError";
import type { LessonLinkFormValues, TimetableWeekBundle } from "@/lib/timetable/timetable";

function weekKeys(
  classId: Id<"classes">,
  termId: Id<"timetableTerms">,
  year: number,
  weekNumber: number,
) {
  return [timetableWeekBundleQueryKey(classId, termId, year, weekNumber)];
}

export function useAddLessonToSlot() {
  const { t } = useTranslation("timetable");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.timetable.addLessonToSlot);

  return useOptimisticMutation({
    mutationFn: mutationFn,
    queryKeys: (args) => weekKeys(args.classId, args.termId, args.year, args.weekNumber),
    applyOptimisticUpdate: (queryClient, args) => {
      const key = timetableWeekBundleQueryKey(
        args.classId,
        args.termId,
        args.year,
        args.weekNumber,
      );
      queryClient.setQueryData<TimetableWeekBundle>(key, (old) => {
        if (!old) return old;
        const subject = old.subjects.find((s) => s._id === args.subjectId);
        if (!subject) return old;
        const now = Date.now();
        const optimisticLesson = {
          _id: `optimistic:${args.slotId}-${args.subjectId}` as Id<"timetableLessons">,
          _creationTime: now,
          classId: args.classId,
          termId: args.termId,
          slotId: args.slotId,
          subjectId: args.subjectId,
          year: args.year,
          weekNumber: args.weekNumber,
          complete: false,
          links: [],
          createdAt: now,
          updatedAt: now,
          subject,
        };
        return { ...old, lessons: [...old.lessons, optimisticLesson] };
      });
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("saveFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}

export function useRemoveLesson() {
  const { t } = useTranslation("timetable");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.timetable.removeLesson);

  return useOptimisticMutation({
    mutationFn: (args: {
      classId: Id<"classes">;
      termId: Id<"timetableTerms">;
      year: number;
      weekNumber: number;
      lessonId: Id<"timetableLessons">;
    }) => mutationFn({ classId: args.classId, lessonId: args.lessonId }),
    queryKeys: (args) => weekKeys(args.classId, args.termId, args.year, args.weekNumber),
    applyOptimisticUpdate: (queryClient, args) => {
      const key = timetableWeekBundleQueryKey(
        args.classId,
        args.termId,
        args.year,
        args.weekNumber,
      );
      queryClient.setQueryData<TimetableWeekBundle>(key, (old) => {
        if (!old) return old;
        return {
          ...old,
          lessons: old.lessons.filter((lesson) => lesson._id !== args.lessonId),
        };
      });
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("saveFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}

export type UpsertLessonArgs = {
  classId: Id<"classes">;
  termId: Id<"timetableTerms">;
  slotId: Id<"timetableSlots">;
  subjectId: Id<"timetableSubjects">;
  year: number;
  weekNumber: number;
  notesJson?: string;
  complete: boolean;
  links: Array<LessonLinkFormValues>;
  lessonId?: Id<"timetableLessons">;
};

export function useUpsertLesson() {
  const { t } = useTranslation("timetable");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.timetable.upsertLesson);

  return useOptimisticMutation({
    mutationFn: (args: UpsertLessonArgs) =>
      mutationFn({
        classId: args.classId,
        termId: args.termId,
        slotId: args.slotId,
        subjectId: args.subjectId,
        year: args.year,
        weekNumber: args.weekNumber,
        notesJson: args.notesJson,
        complete: args.complete,
        links: args.links,
      }),
    queryKeys: (args: UpsertLessonArgs) =>
      weekKeys(args.classId, args.termId, args.year, args.weekNumber),
    applyOptimisticUpdate: (queryClient, args: UpsertLessonArgs) => {
      const key = timetableWeekBundleQueryKey(
        args.classId,
        args.termId,
        args.year,
        args.weekNumber,
      );
      queryClient.setQueryData<TimetableWeekBundle>(key, (old) => {
        if (!old) return old;
        const subject = old.subjects.find((s) => s._id === args.subjectId);
        if (!subject) return old;
        const now = Date.now();
        const nextLessons = old.lessons.map((lesson) => {
          if (
            lesson._id === args.lessonId ||
            (lesson.slotId === args.slotId && lesson.subjectId === args.subjectId)
          ) {
            return {
              ...lesson,
              notesJson: args.notesJson,
              complete: args.complete,
              links: args.links,
              updatedAt: now,
              subject,
            };
          }
          return lesson;
        });
        const hasMatch = nextLessons.some(
          (l) => l.slotId === args.slotId && l.subjectId === args.subjectId,
        );
        if (!hasMatch) {
          nextLessons.push({
            _id: args.lessonId ?? (`optimistic:${args.slotId}` as Id<"timetableLessons">),
            _creationTime: now,
            classId: args.classId,
            termId: args.termId,
            slotId: args.slotId,
            subjectId: args.subjectId,
            year: args.year,
            weekNumber: args.weekNumber,
            notesJson: args.notesJson,
            complete: args.complete,
            links: args.links,
            createdAt: now,
            updatedAt: now,
            subject,
          });
        }
        return { ...old, lessons: nextLessons };
      });
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("saveFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}

export function useCreateTimetableSubject() {
  const { t } = useTranslation("timetable");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.timetable.createSubject);

  type Args = {
    classId: Id<"classes">;
    termId: Id<"timetableTerms">;
    year: number;
    weekNumber: number;
    name: string;
    bgColor: string;
    textColor: string;
    iconName?: string;
  };

  return useOptimisticMutation({
    mutationFn: (args: Args) =>
      mutationFn({
        classId: args.classId,
        name: args.name,
        bgColor: args.bgColor,
        textColor: args.textColor,
        iconName: args.iconName,
      }),
    queryKeys: (args: Args) => weekKeys(args.classId, args.termId, args.year, args.weekNumber),
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("saveFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}

export function useToggleSlotDisabledForWeek() {
  const { t } = useTranslation("timetable");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.timetable.toggleSlotDisabledForWeek);

  return useOptimisticMutation({
    mutationFn: (args: {
      classId: Id<"classes">;
      termId: Id<"timetableTerms">;
      year: number;
      weekNumber: number;
      slotId: Id<"timetableSlots">;
      disabled: boolean;
    }) =>
      mutationFn({
        classId: args.classId,
        slotId: args.slotId,
        year: args.year,
        weekNumber: args.weekNumber,
        disabled: args.disabled,
      }),
    queryKeys: (args) => weekKeys(args.classId, args.termId, args.year, args.weekNumber),
    applyOptimisticUpdate: (queryClient, args) => {
      const key = timetableWeekBundleQueryKey(
        args.classId,
        args.termId,
        args.year,
        args.weekNumber,
      );
      queryClient.setQueryData<TimetableWeekBundle>(key, (old) => {
        if (!old) return old;
        const set = new Set(old.disabledSlotIds);
        if (args.disabled) set.add(args.slotId);
        else set.delete(args.slotId);
        return { ...old, disabledSlotIds: [...set] };
      });
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("saveFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}

export function useCreateTimetableSlot() {
  const { t } = useTranslation("timetable");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.timetable.createSlot);

  type Args = {
    classId: Id<"classes">;
    termId: Id<"timetableTerms">;
    year: number;
    weekNumber: number;
    day: string;
    startTime: string;
    endTime: string;
  };

  return useOptimisticMutation({
    mutationFn: (args: Args) =>
      mutationFn({
        classId: args.classId,
        termId: args.termId,
        day: args.day,
        startTime: args.startTime,
        endTime: args.endTime,
      }),
    queryKeys: (args: Args) => weekKeys(args.classId, args.termId, args.year, args.weekNumber),
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("saveFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}

export function useRemoveTimetableTerm() {
  const { t } = useTranslation("timetable");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.timetable.removeTerm);

  return useOptimisticMutation({
    mutationFn: (args: { classId: Id<"classes">; termId: Id<"timetableTerms"> }) =>
      mutationFn(args),
    queryKeys: (args) => [timetableTermsQueryKey(args.classId)],
    applyOptimisticUpdate: (queryClient, args) => {
      const key = timetableTermsQueryKey(args.classId);
      queryClient.setQueryData(key, (old: Array<{ _id: Id<"timetableTerms"> }> | undefined) =>
        (old ?? []).filter((term) => term._id !== args.termId),
      );
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("saveFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
