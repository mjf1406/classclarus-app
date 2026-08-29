import { convexQuery } from "@convex-dev/react-query";

import { api } from "../../../convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "../../../convex/_generated/dataModel";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { FIVE_MINUTES } from "@/lib/queryCache";

export type ClassroomScreenBundle = FunctionReturnType<typeof api.classroomScreen.getScreenBundle>;
export type ClassroomTimer = ClassroomScreenBundle["timers"][number];
export type ClassroomAudioFile = ClassroomScreenBundle["audioFiles"][number];
export type ClassroomClockSettings = ClassroomScreenBundle["settings"];
export type ClassroomDisplaySession = ClassroomScreenBundle["displaySession"];
export type ClassroomLessonDisplay = ClassroomScreenBundle["lessons"][number];

export function classroomScreenBundleQueryKey(classId: Id<"classes">) {
  return convexQuery(api.classroomScreen.getScreenBundle, { classId }).queryKey;
}

export function classroomTimersQueryKey(classId: Id<"classes">) {
  return convexQuery(api.classroomScreen.listTimers, { classId }).queryKey;
}

export function classroomAudioQueryKey(classId: Id<"classes">) {
  return convexQuery(api.classroomScreen.listAudioFiles, { classId }).queryKey;
}

export function classroomSettingsQueryKey(classId: Id<"classes">) {
  return convexQuery(api.classroomScreen.getSettings, { classId }).queryKey;
}

export function useClassroomScreenBundle(classId: Id<"classes"> | undefined) {
  return useAuthedQuery(api.classroomScreen.getScreenBundle, classId ? { classId } : "skip", {
    gcTime: FIVE_MINUTES,
  });
}

export function useClassroomTimers(classId: Id<"classes"> | undefined) {
  return useAuthedQuery(api.classroomScreen.listTimers, classId ? { classId } : "skip", {
    gcTime: FIVE_MINUTES,
  });
}

export function useClassroomAudioFiles(classId: Id<"classes"> | undefined) {
  return useAuthedQuery(api.classroomScreen.listAudioFiles, classId ? { classId } : "skip", {
    gcTime: FIVE_MINUTES,
  });
}

export function useClassroomSettings(classId: Id<"classes"> | undefined) {
  return useAuthedQuery(api.classroomScreen.getSettings, classId ? { classId } : "skip", {
    gcTime: FIVE_MINUTES,
  });
}
