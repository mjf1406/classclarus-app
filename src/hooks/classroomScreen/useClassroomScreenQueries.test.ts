import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vite-plus/test";

import type { Id } from "../../../convex/_generated/dataModel";
import {
  classroomAudioQueryKey,
  classroomDisplayBundleQueryKey,
  classroomMinuteBucket,
  classroomScreenBundleQueryKey,
  classroomRotationsQueryKey,
  classroomSettingsQueryKey,
  classroomTimersQueryKey,
  isClassroomDisplayBundleQueryKey,
  type ClassroomAudioFile,
  type ClassroomDisplayBundle,
} from "@/hooks/classroomScreen/useClassroomScreenQueries";

const classId = "k5760dnm43rwxxy6gseazphqts8bek0s" as Id<"classes">;

describe("isClassroomDisplayBundleQueryKey", () => {
  it("matches getDisplayBundle keys for the class", () => {
    const key = classroomDisplayBundleQueryKey(classId, classroomMinuteBucket());
    expect(isClassroomDisplayBundleQueryKey(key, classId)).toBe(true);
  });

  it("does not match other classroom queries that share classId", () => {
    expect(isClassroomDisplayBundleQueryKey(classroomAudioQueryKey(classId), classId)).toBe(false);
    expect(isClassroomDisplayBundleQueryKey(classroomTimersQueryKey(classId), classId)).toBe(false);
    expect(isClassroomDisplayBundleQueryKey(classroomRotationsQueryKey(classId), classId)).toBe(
      false,
    );
    expect(isClassroomDisplayBundleQueryKey(classroomSettingsQueryKey(classId), classId)).toBe(
      false,
    );
    expect(isClassroomDisplayBundleQueryKey(classroomScreenBundleQueryKey(classId), classId)).toBe(
      false,
    );
  });

  it("does not match getDisplayBundle for a different class", () => {
    const otherClassId = "k5760dnm43rwxxy6gseazphqts8bek0s0000" as Id<"classes">;
    const key = classroomDisplayBundleQueryKey(otherClassId, classroomMinuteBucket());
    expect(isClassroomDisplayBundleQueryKey(key, classId)).toBe(false);
  });

  it("does not match unrelated query keys", () => {
    expect(
      isClassroomDisplayBundleQueryKey(
        ["convexQuery", "classroomScreen:getDisplayBundle"],
        classId,
      ),
    ).toBe(false);
  });
});

describe("display bundle optimistic patch isolation", () => {
  it("updates display bundle settings without corrupting audio file array cache", () => {
    const queryClient = new QueryClient();
    const bucket = classroomMinuteBucket();
    const audioFile = {
      _id: "audio123" as Id<"classroomAudioFiles">,
      _creationTime: 1,
      classId,
      name: "chime.mp3",
      fileId: "file123" as Id<"files">,
      contentType: "audio/mpeg",
      size: 1000,
      url: "https://example.com/chime.mp3",
      createdBy: "user123" as Id<"users">,
      createdAt: 1,
    } satisfies ClassroomAudioFile;

    const bundle = {
      settings: { classId, clockSize: 72, updatedAt: 0 },
      displaySession: { classId, paused: false, updatedAt: 0 },
      pushedLesson: null,
      currentLesson: null,
      currentSlot: null,
    } as unknown as ClassroomDisplayBundle;

    queryClient.setQueryData(classroomDisplayBundleQueryKey(classId, bucket), bundle);
    queryClient.setQueryData(classroomAudioQueryKey(classId), [audioFile]);

    queryClient.setQueriesData<ClassroomDisplayBundle>(
      { predicate: (query) => isClassroomDisplayBundleQueryKey(query.queryKey, classId) },
      (old) =>
        old
          ? {
              ...old,
              settings: { ...old.settings, clockSize: 120, updatedAt: Date.now() },
            }
          : old,
    );

    const audioCache = queryClient.getQueryData<ClassroomAudioFile[]>(
      classroomAudioQueryKey(classId),
    );
    expect(Array.isArray(audioCache)).toBe(true);
    expect(audioCache).toHaveLength(1);
    expect(audioCache?.[0]?.name).toBe("chime.mp3");

    const bundleCache = queryClient.getQueryData<ClassroomDisplayBundle>(
      classroomDisplayBundleQueryKey(classId, bucket),
    );
    expect(bundleCache?.settings.clockSize).toBe(120);
  });
});
