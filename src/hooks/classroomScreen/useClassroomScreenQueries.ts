import { convexQuery } from "@convex-dev/react-query";

import { api } from "../../../convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "../../../convex/_generated/dataModel";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { GC_TIME } from "@/lib/queryCache";

export type ClassroomDisplayBundle = FunctionReturnType<
  typeof api.classroomScreen.getDisplayBundle
>;
export type ClassroomScreenBundle = FunctionReturnType<typeof api.classroomScreen.getScreenBundle>;
export type ClassroomTimer = ClassroomScreenBundle["timers"][number];
export type ClassroomRotation = FunctionReturnType<
  typeof api.classroomScreen.listRotations
>[number];
export type ClassroomAudioFile = ClassroomScreenBundle["audioFiles"][number];
export type ClassroomClockSettings = ClassroomDisplayBundle["settings"];
export type ClassroomDisplaySession = ClassroomDisplayBundle["displaySession"];
export type ClassroomLessonDisplay = NonNullable<ClassroomDisplayBundle["currentLesson"]>;

export function classroomMinuteBucket(nowMs = Date.now()): number {
  return Math.floor(nowMs / 60_000);
}

export function classroomDisplayBundleQueryOptions(
  classId: Id<"classes">,
  nowMinuteBucket: number,
) {
  return {
    ...convexQuery(api.classroomScreen.getDisplayBundle, { classId, nowMinuteBucket }),
    gcTime: GC_TIME.realtime,
  };
}

export function classroomDisplayBundleQueryKey(classId: Id<"classes">, nowMinuteBucket: number) {
  return classroomDisplayBundleQueryOptions(classId, nowMinuteBucket).queryKey;
}

const DISPLAY_BUNDLE_QUERY_ID = "classroomScreen:getDisplayBundle";

/** Matches only getDisplayBundle caches for a class — not listAudioFiles, listTimers, etc. */
export function isClassroomDisplayBundleQueryKey(
  queryKey: readonly unknown[],
  classId: Id<"classes">,
): boolean {
  if (!Array.isArray(queryKey)) return false;
  if (queryKey[1] !== DISPLAY_BUNDLE_QUERY_ID) return false;
  const args = queryKey[2] as { classId?: Id<"classes"> } | undefined;
  return args?.classId === classId;
}

export function classroomScreenBundleQueryKey(classId: Id<"classes">) {
  return convexQuery(api.classroomScreen.getScreenBundle, { classId }).queryKey;
}

export function classroomTimersQueryOptions(classId: Id<"classes">) {
  return {
    ...convexQuery(api.classroomScreen.listTimers, { classId }),
    gcTime: GC_TIME.stable,
  };
}

export function classroomTimersQueryKey(classId: Id<"classes">) {
  return classroomTimersQueryOptions(classId).queryKey;
}

export function classroomRotationsQueryOptions(classId: Id<"classes">) {
  return {
    ...convexQuery(api.classroomScreen.listRotations, { classId }),
    gcTime: GC_TIME.stable,
  };
}

export function classroomRotationsQueryKey(classId: Id<"classes">) {
  return classroomRotationsQueryOptions(classId).queryKey;
}

export function classroomAudioQueryOptions(classId: Id<"classes">) {
  return {
    ...convexQuery(api.classroomScreen.listAudioFiles, { classId }),
    gcTime: GC_TIME.stable,
  };
}

export function classroomAudioQueryKey(classId: Id<"classes">) {
  return classroomAudioQueryOptions(classId).queryKey;
}

export function classroomSettingsQueryOptions(classId: Id<"classes">) {
  return {
    ...convexQuery(api.classroomScreen.getSettings, { classId }),
    gcTime: GC_TIME.stable,
  };
}

export function classroomSettingsQueryKey(classId: Id<"classes">) {
  return classroomSettingsQueryOptions(classId).queryKey;
}

export function useClassroomDisplayBundle(
  classId: Id<"classes"> | undefined,
  nowMinuteBucket: number,
) {
  return useAuthedQuery(
    api.classroomScreen.getDisplayBundle,
    classId ? { classId, nowMinuteBucket } : "skip",
    { gcTime: GC_TIME.realtime },
  );
}

/** @deprecated Prefer useClassroomDisplayBundle plus split timer/audio queries. */
export function useClassroomScreenBundle(classId: Id<"classes"> | undefined) {
  return useAuthedQuery(api.classroomScreen.getScreenBundle, classId ? { classId } : "skip", {
    gcTime: GC_TIME.realtime,
  });
}

export function useClassroomTimers(classId: Id<"classes"> | undefined) {
  return useAuthedQuery(api.classroomScreen.listTimers, classId ? { classId } : "skip", {
    gcTime: GC_TIME.stable,
  });
}

export function useClassroomRotations(classId: Id<"classes"> | undefined) {
  return useAuthedQuery(api.classroomScreen.listRotations, classId ? { classId } : "skip", {
    gcTime: GC_TIME.stable,
  });
}

export function useClassroomAudioFiles(classId: Id<"classes"> | undefined) {
  return useAuthedQuery(api.classroomScreen.listAudioFiles, classId ? { classId } : "skip", {
    gcTime: GC_TIME.stable,
  });
}

export function useClassroomSettings(classId: Id<"classes"> | undefined) {
  return useAuthedQuery(api.classroomScreen.getSettings, classId ? { classId } : "skip", {
    gcTime: GC_TIME.stable,
  });
}
