import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import {
  timetableTagsQueryKey,
  timetableTermsQueryKey,
  timetableWeekBundleQueryKey,
} from "@/hooks/timetable/useTimetableQueries";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import { messageFromError } from "@/lib/errors/convexError";
import {
  weekIsInScope,
  type SlotDisableScope,
} from "../../../convex/lib/timetable/slotDisableScope";
import {
  applyOptimisticLinkMembership,
  applyOptimisticUnlink,
  mirrorLessonsInBundle,
} from "@/lib/timetable/slotLinksClient";
import { toAgendaItems } from "@/lib/timetable/sectionItems";
import type {
  AgendaItemFormValues,
  SectionItemFormValues,
  TimetableTermKind,
  TimetableWeekBundle,
} from "@/lib/timetable/timetable";

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
        const sections = {
          materials: subject.defaultMaterials,
          announcements: subject.defaultAnnouncements,
          agenda: subject.defaultAgenda,
        };
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
          ...sections,
          createdAt: now,
          updatedAt: now,
          subject,
          upcomingEvents: [] as TimetableWeekBundle["lessons"][number]["upcomingEvents"],
          lessonUrl: undefined,
          lessonUrlShared: false,
        };
        const withPrimary = { ...old, lessons: [...old.lessons, optimisticLesson] };
        return mirrorLessonsInBundle(withPrimary, args.slotId, args.year, args.weekNumber, {
          type: "add",
          sourceSlotId: args.slotId,
          subjectId: args.subjectId,
          complete: false,
          ...sections,
        });
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
        const lesson = old.lessons.find((item) => item._id === args.lessonId);
        if (!lesson) {
          return {
            ...old,
            lessons: old.lessons.filter((item) => item._id !== args.lessonId),
          };
        }
        const withoutPrimary = {
          ...old,
          lessons: old.lessons.filter((item) => item._id !== args.lessonId),
        };
        return mirrorLessonsInBundle(
          withoutPrimary,
          lesson.slotId,
          lesson.year,
          lesson.weekNumber,
          {
            type: "delete",
            sourceLesson: {
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
            },
          },
        );
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
  complete: boolean;
  materials: Array<SectionItemFormValues>;
  announcements: Array<SectionItemFormValues>;
  agenda: Array<AgendaItemFormValues>;
  lessonUrl?: string;
  lessonUrlShared?: boolean;
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
        complete: args.complete,
        materials: args.materials,
        announcements: args.announcements,
        agenda: toAgendaItems(args.agenda),
        lessonUrl: args.lessonUrl,
        lessonUrlShared: args.lessonUrlShared === true,
      }),
    queryKeys: (args: UpsertLessonArgs) => [
      ...weekKeys(args.classId, args.termId, args.year, args.weekNumber),
      timetableTagsQueryKey(args.classId),
    ],
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
        const agenda = toAgendaItems(args.agenda);
        const nextLessons = old.lessons.map((lesson) => {
          if (
            lesson._id === args.lessonId ||
            (lesson.slotId === args.slotId && lesson.subjectId === args.subjectId)
          ) {
            return {
              ...lesson,
              complete: args.complete,
              materials: args.materials,
              announcements: args.announcements,
              agenda,
              lessonUrl: args.lessonUrl,
              lessonUrlShared: args.lessonUrlShared === true,
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
            complete: args.complete,
            materials: args.materials,
            announcements: args.announcements,
            agenda,
            lessonUrl: args.lessonUrl,
            lessonUrlShared: args.lessonUrlShared === true,
            createdAt: now,
            updatedAt: now,
            subject,
            upcomingEvents: [],
          });
        }
        const updatedLesson = nextLessons.find(
          (lesson) => lesson.slotId === args.slotId && lesson.subjectId === args.subjectId,
        );
        const withPrimary = { ...old, lessons: nextLessons };
        if (!updatedLesson) return withPrimary;
        return mirrorLessonsInBundle(
          withPrimary,
          args.slotId,
          args.year,
          args.weekNumber,
          hasMatch
            ? {
                type: "update",
                sourceLesson: {
                  _id: updatedLesson._id,
                  slotId: updatedLesson.slotId,
                  subjectId: updatedLesson.subjectId,
                  year: updatedLesson.year,
                  weekNumber: updatedLesson.weekNumber,
                  complete: updatedLesson.complete,
                  materials: updatedLesson.materials,
                  announcements: updatedLesson.announcements,
                  agenda: updatedLesson.agenda,
                  lessonUrl: updatedLesson.lessonUrl,
                  lessonUrlShared: updatedLesson.lessonUrlShared,
                },
              }
            : {
                type: "add",
                sourceSlotId: args.slotId,
                subjectId: args.subjectId,
                complete: args.complete,
                materials: args.materials,
                announcements: args.announcements,
                agenda,
                lessonUrl: args.lessonUrl,
                lessonUrlShared: args.lessonUrlShared === true,
              },
        );
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
    defaultMaterials: Array<SectionItemFormValues>;
    defaultAnnouncements: Array<SectionItemFormValues>;
    defaultAgenda: Array<AgendaItemFormValues>;
    calendarAudienceRoles: Array<string>;
  };

  return useOptimisticMutation({
    mutationFn: (args: Args) =>
      mutationFn({
        classId: args.classId,
        name: args.name,
        bgColor: args.bgColor,
        textColor: args.textColor,
        iconName: args.iconName,
        defaultMaterials: args.defaultMaterials,
        defaultAnnouncements: args.defaultAnnouncements,
        defaultAgenda: toAgendaItems(args.defaultAgenda),
        calendarAudienceRoles: args.calendarAudienceRoles as Array<
          "owner" | "teacher" | "assistant_teacher" | "student" | "guardian"
        >,
      }),
    queryKeys: (args: Args) => [
      ...weekKeys(args.classId, args.termId, args.year, args.weekNumber),
      timetableTagsQueryKey(args.classId),
    ],
    applyOptimisticUpdate: (queryClient, args: Args) => {
      const key = timetableWeekBundleQueryKey(
        args.classId,
        args.termId,
        args.year,
        args.weekNumber,
      );
      queryClient.setQueryData<TimetableWeekBundle>(key, (old) => {
        if (!old) return old;
        const now = Date.now();
        return {
          ...old,
          subjects: [
            ...old.subjects,
            {
              _id: `optimistic:${args.name}` as Id<"timetableSubjects">,
              _creationTime: now,
              classId: args.classId,
              name: args.name,
              bgColor: args.bgColor,
              textColor: args.textColor,
              iconName: args.iconName,
              defaultMaterials: args.defaultMaterials,
              defaultAnnouncements: args.defaultAnnouncements,
              defaultAgenda: toAgendaItems(args.defaultAgenda),
              calendarAudienceRoles: args.calendarAudienceRoles,
              createdAt: now,
              updatedAt: now,
            },
          ],
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

export function useUpdateTimetableSubject() {
  const { t } = useTranslation("timetable");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.timetable.updateSubject);

  type Args = {
    classId: Id<"classes">;
    termId: Id<"timetableTerms">;
    year: number;
    weekNumber: number;
    subjectId: Id<"timetableSubjects">;
    name: string;
    bgColor: string;
    textColor: string;
    iconName?: string;
    defaultMaterials: Array<SectionItemFormValues>;
    defaultAnnouncements: Array<SectionItemFormValues>;
    defaultAgenda: Array<AgendaItemFormValues>;
    calendarAudienceRoles: Array<string>;
  };

  return useOptimisticMutation({
    mutationFn: (args: Args) =>
      mutationFn({
        classId: args.classId,
        subjectId: args.subjectId,
        name: args.name,
        bgColor: args.bgColor,
        textColor: args.textColor,
        iconName: args.iconName,
        defaultMaterials: args.defaultMaterials,
        defaultAnnouncements: args.defaultAnnouncements,
        defaultAgenda: toAgendaItems(args.defaultAgenda),
        calendarAudienceRoles: args.calendarAudienceRoles as Array<
          "owner" | "teacher" | "assistant_teacher" | "student" | "guardian"
        >,
      }),
    queryKeys: (args: Args) => [
      ...weekKeys(args.classId, args.termId, args.year, args.weekNumber),
      timetableTagsQueryKey(args.classId),
    ],
    applyOptimisticUpdate: (queryClient, args: Args) => {
      const key = timetableWeekBundleQueryKey(
        args.classId,
        args.termId,
        args.year,
        args.weekNumber,
      );
      queryClient.setQueryData<TimetableWeekBundle>(key, (old) => {
        if (!old) return old;
        const now = Date.now();
        const nextSubject = {
          name: args.name,
          bgColor: args.bgColor,
          textColor: args.textColor,
          iconName: args.iconName,
          defaultMaterials: args.defaultMaterials,
          defaultAnnouncements: args.defaultAnnouncements,
          defaultAgenda: toAgendaItems(args.defaultAgenda),
          calendarAudienceRoles: args.calendarAudienceRoles,
          updatedAt: now,
        };
        return {
          ...old,
          subjects: old.subjects.map((subject) =>
            subject._id === args.subjectId ? { ...subject, ...nextSubject } : subject,
          ),
          lessons: old.lessons.map((lesson) =>
            lesson.subjectId === args.subjectId
              ? { ...lesson, subject: { ...lesson.subject, ...nextSubject } }
              : lesson,
          ),
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

export function useRemoveTimetableSubject() {
  const { t } = useTranslation("timetable");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.timetable.removeSubject);

  type Args = {
    classId: Id<"classes">;
    termId: Id<"timetableTerms">;
    year: number;
    weekNumber: number;
    subjectId: Id<"timetableSubjects">;
  };

  return useOptimisticMutation({
    mutationFn: (args: Args) =>
      mutationFn({
        classId: args.classId,
        subjectId: args.subjectId,
      }),
    queryKeys: (args: Args) => weekKeys(args.classId, args.termId, args.year, args.weekNumber),
    applyOptimisticUpdate: (queryClient, args: Args) => {
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
          subjects: old.subjects.filter((subject) => subject._id !== args.subjectId),
          lessons: old.lessons.filter((lesson) => lesson.subjectId !== args.subjectId),
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

export type SetSlotsDisabledArgs = {
  classId: Id<"classes">;
  termId: Id<"timetableTerms">;
  year: number;
  weekNumber: number;
  disabled: boolean;
  scope: SlotDisableScope;
  slotId?: Id<"timetableSlots">;
  day?: string;
};

function applyOptimisticDisableToBundle(
  bundle: TimetableWeekBundle,
  args: SetSlotsDisabledArgs,
  bundleWeek: { year: number; weekNumber: number },
): TimetableWeekBundle {
  const slotIds = new Set(
    args.slotId
      ? [args.slotId]
      : bundle.slots.filter((slot) => slot.day === args.day).map((slot) => slot._id),
  );
  if (slotIds.size === 0) return bundle;

  const weekAffected = weekIsInScope(bundleWeek, args, args.scope);
  const nextSlots =
    args.scope === "allWeeks" || (!args.disabled && bundle.slots.some((slot) => slot.disabled))
      ? bundle.slots.map((slot) =>
          slotIds.has(slot._id)
            ? {
                ...slot,
                disabled: args.scope === "allWeeks" ? args.disabled : false,
              }
            : slot,
        )
      : bundle.slots;

  const set = new Set(bundle.disabledSlotIds);
  if (weekAffected) {
    for (const slotId of slotIds) {
      if (args.disabled) set.add(slotId);
      else set.delete(slotId);
    }
  }

  return { ...bundle, slots: nextSlots, disabledSlotIds: [...set] };
}

export function useSetSlotsDisabled() {
  const { t } = useTranslation("timetable");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.timetable.setSlotsDisabled);

  return useOptimisticMutation({
    mutationFn: (args: SetSlotsDisabledArgs) =>
      mutationFn({
        classId: args.classId,
        termId: args.termId,
        year: args.year,
        weekNumber: args.weekNumber,
        disabled: args.disabled,
        scope: args.scope,
        slotId: args.slotId,
        day: args.day,
      }),
    queryKeys: (args, queryClient) => {
      const current = timetableWeekBundleQueryKey(
        args.classId,
        args.termId,
        args.year,
        args.weekNumber,
      );
      const extra = queryClient
        .getQueryCache()
        .getAll()
        .filter((query) => {
          const data = query.state.data;
          return (
            data !== undefined &&
            typeof data === "object" &&
            data !== null &&
            "disabledSlotIds" in data &&
            "term" in data &&
            (data as TimetableWeekBundle).term._id === args.termId
          );
        })
        .map((query) => query.queryKey);
      return [current, ...extra.filter((key) => key !== current)];
    },
    applyOptimisticUpdate: (queryClient, args) => {
      const currentKey = timetableWeekBundleQueryKey(
        args.classId,
        args.termId,
        args.year,
        args.weekNumber,
      );
      queryClient.setQueryData<TimetableWeekBundle>(currentKey, (old) => {
        if (!old) return old;
        return applyOptimisticDisableToBundle(old, args, {
          year: args.year,
          weekNumber: args.weekNumber,
        });
      });

      for (const query of queryClient.getQueryCache().getAll()) {
        if (query.queryKey === currentKey) continue;
        const data = query.state.data;
        if (
          data === undefined ||
          typeof data !== "object" ||
          data === null ||
          !("disabledSlotIds" in data) ||
          !("term" in data) ||
          (data as TimetableWeekBundle).term._id !== args.termId
        ) {
          continue;
        }
        const bundle = data as TimetableWeekBundle;
        const lessonWeek = bundle.lessons[0];
        const bundleWeek = lessonWeek
          ? { year: lessonWeek.year, weekNumber: lessonWeek.weekNumber }
          : { year: args.year, weekNumber: args.weekNumber };
        queryClient.setQueryData<TimetableWeekBundle>(query.queryKey, (old) => {
          if (!old) return old;
          return applyOptimisticDisableToBundle(old, args, bundleWeek);
        });
      }
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
    applyOptimisticUpdate: (queryClient, args) => {
      const key = timetableWeekBundleQueryKey(
        args.classId,
        args.termId,
        args.year,
        args.weekNumber,
      );
      queryClient.setQueryData<TimetableWeekBundle>(key, (old) => {
        if (!old) return old;
        const now = Date.now();
        const optimisticSlot = {
          _id: `optimistic:${args.day}-${args.startTime}` as Id<"timetableSlots">,
          _creationTime: now,
          classId: args.classId,
          termId: args.termId,
          day: args.day,
          startTime: args.startTime,
          endTime: args.endTime,
          disabled: false,
          createdAt: now,
          updatedAt: now,
        };
        return { ...old, slots: [...old.slots, optimisticSlot] };
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

export function useUpdateTimetableSlot() {
  const { t } = useTranslation("timetable");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.timetable.updateSlot);

  type Args = {
    classId: Id<"classes">;
    termId: Id<"timetableTerms">;
    year: number;
    weekNumber: number;
    slotId: Id<"timetableSlots">;
    day: string;
    startTime: string;
    endTime: string;
    disabled: boolean;
  };

  return useOptimisticMutation({
    mutationFn: (args: Args) =>
      mutationFn({
        classId: args.classId,
        slotId: args.slotId,
        day: args.day,
        startTime: args.startTime,
        endTime: args.endTime,
        disabled: args.disabled,
      }),
    queryKeys: (args: Args) => weekKeys(args.classId, args.termId, args.year, args.weekNumber),
    applyOptimisticUpdate: (queryClient, args) => {
      const key = timetableWeekBundleQueryKey(
        args.classId,
        args.termId,
        args.year,
        args.weekNumber,
      );
      queryClient.setQueryData<TimetableWeekBundle>(key, (old) => {
        if (!old) return old;
        const now = Date.now();
        return {
          ...old,
          slots: old.slots.map((slot) =>
            slot._id === args.slotId
              ? {
                  ...slot,
                  day: args.day,
                  startTime: args.startTime,
                  endTime: args.endTime,
                  disabled: args.disabled,
                  updatedAt: now,
                }
              : slot,
          ),
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

export function useRemoveTimetableSlot() {
  const { t } = useTranslation("timetable");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.timetable.removeSlot);

  type Args = {
    classId: Id<"classes">;
    termId: Id<"timetableTerms">;
    year: number;
    weekNumber: number;
    slotId: Id<"timetableSlots">;
  };

  return useOptimisticMutation({
    mutationFn: (args: Args) => mutationFn({ classId: args.classId, slotId: args.slotId }),
    queryKeys: (args: Args) => weekKeys(args.classId, args.termId, args.year, args.weekNumber),
    applyOptimisticUpdate: (queryClient, args) => {
      const key = timetableWeekBundleQueryKey(
        args.classId,
        args.termId,
        args.year,
        args.weekNumber,
      );
      queryClient.setQueryData<TimetableWeekBundle>(key, (old) => {
        if (!old) return old;
        const deletedSlot = old.slots.find((slot) => slot._id === args.slotId);
        const remainingSlots = old.slots.filter((slot) => slot._id !== args.slotId);
        let nextSlots = remainingSlots;
        if (deletedSlot?.linkGroupId) {
          const groupMembers = remainingSlots.filter(
            (slot) => slot.linkGroupId === deletedSlot.linkGroupId,
          );
          if (groupMembers.length === 1) {
            nextSlots = remainingSlots.map((slot) =>
              slot._id === groupMembers[0]!._id ? { ...slot, linkGroupId: undefined } : slot,
            );
          }
        }
        return {
          ...old,
          slots: nextSlots,
          lessons: old.lessons.filter((lesson) => lesson.slotId !== args.slotId),
          disabledSlotIds: old.disabledSlotIds.filter((slotId) => slotId !== args.slotId),
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

export function useSyncSlotLinks() {
  const { t } = useTranslation("timetable");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.timetable.syncSlotLinks);

  type Args = {
    classId: Id<"classes">;
    termId: Id<"timetableTerms">;
    sourceSlotId: Id<"timetableSlots">;
    selectedSlotIds: Array<Id<"timetableSlots">>;
    year: number;
    weekNumber: number;
  };

  return useOptimisticMutation({
    mutationFn: (args: Args) =>
      mutationFn({
        classId: args.classId,
        termId: args.termId,
        sourceSlotId: args.sourceSlotId,
        selectedSlotIds: args.selectedSlotIds,
        year: args.year,
        weekNumber: args.weekNumber,
      }),
    queryKeys: (args: Args) => weekKeys(args.classId, args.termId, args.year, args.weekNumber),
    applyOptimisticUpdate: (queryClient, args) => {
      const key = timetableWeekBundleQueryKey(
        args.classId,
        args.termId,
        args.year,
        args.weekNumber,
      );
      queryClient.setQueryData<TimetableWeekBundle>(key, (old) => {
        if (!old) return old;
        return applyOptimisticLinkMembership(
          old,
          args.sourceSlotId,
          args.selectedSlotIds,
          args.year,
          args.weekNumber,
        );
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

export function useUnlinkSlot() {
  const { t } = useTranslation("timetable");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.timetable.unlinkSlot);

  type Args = {
    classId: Id<"classes">;
    termId: Id<"timetableTerms">;
    year: number;
    weekNumber: number;
    slotId: Id<"timetableSlots">;
  };

  return useOptimisticMutation({
    mutationFn: (args: Args) =>
      mutationFn({
        classId: args.classId,
        termId: args.termId,
        slotId: args.slotId,
      }),
    queryKeys: (args: Args) => weekKeys(args.classId, args.termId, args.year, args.weekNumber),
    applyOptimisticUpdate: (queryClient, args) => {
      const key = timetableWeekBundleQueryKey(
        args.classId,
        args.termId,
        args.year,
        args.weekNumber,
      );
      queryClient.setQueryData<TimetableWeekBundle>(key, (old) => {
        if (!old) return old;
        return applyOptimisticUnlink(old, args.slotId);
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

export function useUpdateTimetableTerm() {
  const { t } = useTranslation("timetable");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.timetable.updateTerm);

  type Args = {
    classId: Id<"classes">;
    termId: Id<"timetableTerms">;
    year: number;
    weekNumber: number;
    name: string;
    kind: TimetableTermKind;
    startDateKey: string;
    endDateKey: string;
    days: Array<string>;
    startTime: string;
    endTime: string;
  };

  return useOptimisticMutation({
    mutationFn: (args: Args) =>
      mutationFn({
        classId: args.classId,
        termId: args.termId,
        name: args.name,
        kind: args.kind,
        startDateKey: args.startDateKey,
        endDateKey: args.endDateKey,
        days: args.days,
        startTime: args.startTime,
        endTime: args.endTime,
      }),
    queryKeys: (args: Args) => [
      timetableTermsQueryKey(args.classId),
      ...weekKeys(args.classId, args.termId, args.year, args.weekNumber),
    ],
    applyOptimisticUpdate: (queryClient, args) => {
      const termsKey = timetableTermsQueryKey(args.classId);
      const now = Date.now();
      queryClient.setQueryData<Array<TimetableWeekBundle["term"]>>(termsKey, (old) =>
        (old ?? []).map((term) =>
          term._id === args.termId
            ? {
                ...term,
                name: args.name,
                kind: args.kind,
                startDateKey: args.startDateKey,
                endDateKey: args.endDateKey,
                days: args.days,
                startTime: args.startTime,
                endTime: args.endTime,
                updatedAt: now,
              }
            : term,
        ),
      );

      const weekKey = timetableWeekBundleQueryKey(
        args.classId,
        args.termId,
        args.year,
        args.weekNumber,
      );
      queryClient.setQueryData<TimetableWeekBundle>(weekKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          term: {
            ...old.term,
            name: args.name,
            kind: args.kind,
            startDateKey: args.startDateKey,
            endDateKey: args.endDateKey,
            days: args.days,
            startTime: args.startTime,
            endTime: args.endTime,
            updatedAt: now,
          },
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

export function useImportTimetableFromClass() {
  const { t } = useTranslation("timetable");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.timetable.importFromClass);

  type Args = {
    classId: Id<"classes">;
    termId: Id<"timetableTerms">;
    year: number;
    weekNumber: number;
    sourceClassId: Id<"classes">;
    sourceTermId?: Id<"timetableTerms">;
    importSubjects: boolean;
    importSlots: boolean;
  };

  return useOptimisticMutation({
    mutationFn: (args: Args) =>
      mutationFn({
        classId: args.classId,
        sourceClassId: args.sourceClassId,
        targetTermId: args.termId,
        sourceTermId: args.sourceTermId,
        importSubjects: args.importSubjects,
        importSlots: args.importSlots,
      }),
    queryKeys: (args: Args) => weekKeys(args.classId, args.termId, args.year, args.weekNumber),
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("importFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
