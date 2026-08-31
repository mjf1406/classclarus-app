import type { Query, QueryClient } from "@tanstack/react-query";
import type { FunctionArgs } from "convex/server";
import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { ActiveSession } from "../../../convex/lib/classroomScreen/activeSession";
import type { AudioCues } from "../../../convex/lib/classroomScreen/audioCues";
import {
  classroomAudioQueryKey,
  classroomRotationsQueryKey,
  classroomSettingsQueryKey,
  classroomTimersQueryKey,
  isClassroomDisplayBundleQueryKey,
  type ClassroomAudioFile,
  type ClassroomDisplayBundle,
  type ClassroomRotation,
  type ClassroomTimer,
} from "@/hooks/classroomScreen/useClassroomScreenQueries";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import { toast } from "@/components/ui/toast-manager";
import { messageFromError } from "@/lib/errors/convexError";
import { randomClientId } from "@/lib/optimistic";

function showMutationError(message: string) {
  toast.add({ type: "error", title: message });
}

function isDisplayBundleQuery(query: Query, classId: Id<"classes">): boolean {
  return isClassroomDisplayBundleQueryKey(query.queryKey, classId);
}

function patchDisplayBundle(
  queryClient: QueryClient,
  classId: Id<"classes">,
  patch: (bundle: ClassroomDisplayBundle) => ClassroomDisplayBundle,
) {
  queryClient.setQueriesData<ClassroomDisplayBundle>(
    { predicate: (query) => isDisplayBundleQuery(query, classId) },
    (old) => (old ? patch(old) : old),
  );
}

function displayBundleKeys(classId: Id<"classes">) {
  return (_variables: { classId: Id<"classes"> }, queryClient: QueryClient) =>
    queryClient
      .getQueryCache()
      .findAll({ predicate: (query) => isDisplayBundleQuery(query, classId) })
      .map((query) => query.queryKey);
}

function timerKeys(classId: Id<"classes">) {
  return [classroomTimersQueryKey(classId)];
}

type CreateClassroomTimerArgs = {
  classId: Id<"classes">;
  name: string;
  durationSeconds: number;
  bgColor: string;
  endTime?: string;
  bgTransition?: string;
  audioCues?: ClassroomTimer["audioCues"];
  nextTimerId?: Id<"classroomTimers">;
};

/** Appends a client timer so create paints before Convex round-trip. Seeds `[]` if the list cache is empty. */
export function applyOptimisticTimerCreate(
  queryClient: QueryClient,
  args: CreateClassroomTimerArgs,
  now = Date.now(),
): void {
  queryClient.setQueryData<ClassroomTimer[]>(classroomTimersQueryKey(args.classId), (old) => {
    const timers = old ?? [];
    return [
      ...timers,
      {
        _id: `optimistic:${randomClientId()}` as Id<"classroomTimers">,
        _creationTime: now,
        classId: args.classId,
        name: args.name,
        durationSeconds: args.durationSeconds,
        bgColor: args.bgColor,
        endTime: args.endTime,
        bgTransition: args.bgTransition,
        audioCues: args.audioCues,
        nextTimerId: args.nextTimerId,
        sortOrder: timers.length,
        createdBy: `optimistic:${randomClientId()}` as Id<"users">,
        createdAt: now,
        updatedAt: now,
      },
    ];
  });
}

function rotationKeys(classId: Id<"classes">) {
  return [classroomRotationsQueryKey(classId)];
}

function audioKeys(classId: Id<"classes">) {
  return [classroomAudioQueryKey(classId)];
}

function settingsKeys(_variables: { classId: Id<"classes"> }, queryClient: QueryClient) {
  const classId = _variables.classId;
  return [
    classroomSettingsQueryKey(classId),
    ...displayBundleKeys(classId)(_variables, queryClient),
  ];
}

function patchTimers(
  queryClient: QueryClient,
  classId: Id<"classes">,
  patch: (timers: ClassroomTimer[]) => ClassroomTimer[],
) {
  queryClient.setQueryData<ClassroomTimer[]>(classroomTimersQueryKey(classId), (old) =>
    old ? patch(old) : old,
  );
}

function patchRotations(
  queryClient: QueryClient,
  classId: Id<"classes">,
  patch: (rotations: ClassroomRotation[]) => ClassroomRotation[],
) {
  queryClient.setQueryData<ClassroomRotation[]>(classroomRotationsQueryKey(classId), (old) =>
    old ? patch(old) : old,
  );
}

export function useUpsertClassroomSettings() {
  const { t } = useTranslation("classroomScreen");
  const mutationFn = useConvexMutation(api.classroomScreen.upsertSettings);

  return useOptimisticMutation({
    mutationFn,
    queryKeys: (args, queryClient) => settingsKeys(args, queryClient),
    applyOptimisticUpdate: (queryClient, args) => {
      const { classId, ...updates } = args;
      const now = Date.now();
      patchDisplayBundle(queryClient, classId, (bundle) => ({
        ...bundle,
        settings: {
          ...bundle.settings,
          ...updates,
          updatedAt: now,
        },
      }));
      queryClient.setQueryData(
        classroomSettingsQueryKey(classId),
        (old: ClassroomDisplayBundle["settings"] | undefined) =>
          old ? { ...old, ...updates, updatedAt: now } : old,
      );
    },
    onError: (error) => {
      showMutationError(messageFromError(error, t("settingsSaveError")));
    },
  });
}

export function useCreateClassroomTimer() {
  const mutationFn = useConvexMutation(api.classroomScreen.createTimer);

  return useOptimisticMutation({
    mutationFn,
    queryKeys: (args) => timerKeys(args.classId),
    applyOptimisticUpdate: (queryClient, args) => {
      applyOptimisticTimerCreate(queryClient, args);
    },
  });
}

export function useUpdateClassroomTimer() {
  const mutationFn = useConvexMutation(api.classroomScreen.updateTimer);

  return useOptimisticMutation({
    mutationFn,
    queryKeys: (args) => timerKeys(args.classId),
    applyOptimisticUpdate: (queryClient, args) => {
      patchTimers(queryClient, args.classId, (timers) =>
        timers.map((timer) =>
          timer._id === args.timerId
            ? {
                ...timer,
                name: args.name ?? timer.name,
                durationSeconds: args.durationSeconds ?? timer.durationSeconds,
                bgColor: args.bgColor ?? timer.bgColor,
                endTime: args.endTime === undefined ? timer.endTime : (args.endTime ?? undefined),
                bgTransition: args.bgTransition ?? timer.bgTransition,
                audioCues: args.audioCues ?? timer.audioCues,
                nextTimerId:
                  args.nextTimerId === null
                    ? undefined
                    : args.nextTimerId !== undefined
                      ? args.nextTimerId
                      : timer.nextTimerId,
                updatedAt: Date.now(),
              }
            : timer,
        ),
      );
    },
  });
}

export function useCreateClassroomRotation() {
  const mutationFn = useConvexMutation(api.classroomScreen.createRotation);

  return useOptimisticMutation({
    mutationFn,
    queryKeys: (args) => rotationKeys(args.classId),
    applyOptimisticUpdate: (queryClient, args) => {
      const now = Date.now();
      patchRotations(queryClient, args.classId, (rotations) => [
        ...rotations,
        {
          _id: `optimistic:${now}` as Id<"classroomRotations">,
          _creationTime: now,
          classId: args.classId,
          name: args.name,
          rotationDurationSeconds: args.rotationDurationSeconds,
          numberOfRotations: args.numberOfRotations,
          transitionDurationSeconds: args.transitionDurationSeconds,
          rotationBgColor: args.rotationBgColor,
          transitionBgColor: args.transitionBgColor,
          finalTransition: args.finalTransition,
          bgTransition: args.bgTransition,
          audioCues: args.audioCues,
          workCues: args.workCues,
          transitionCues: args.transitionCues,
          sortOrder: rotations.length,
          createdBy: "" as Id<"users">,
          createdAt: now,
          updatedAt: now,
        },
      ]);
    },
  });
}

export function useUpdateClassroomRotation() {
  const mutationFn = useConvexMutation(api.classroomScreen.updateRotation);

  return useOptimisticMutation({
    mutationFn,
    queryKeys: (args) => rotationKeys(args.classId),
    applyOptimisticUpdate: (queryClient, args) => {
      patchRotations(queryClient, args.classId, (rotations) =>
        rotations.map((rotation) =>
          rotation._id === args.rotationId
            ? {
                ...rotation,
                name: args.name,
                rotationDurationSeconds: args.rotationDurationSeconds,
                numberOfRotations: args.numberOfRotations,
                transitionDurationSeconds: args.transitionDurationSeconds,
                rotationBgColor: args.rotationBgColor,
                transitionBgColor: args.transitionBgColor,
                finalTransition: args.finalTransition ?? rotation.finalTransition,
                bgTransition:
                  args.bgTransition === null
                    ? undefined
                    : args.bgTransition !== undefined
                      ? args.bgTransition
                      : rotation.bgTransition,
                audioCues: args.audioCues ?? rotation.audioCues,
                workCues: args.workCues ?? rotation.workCues,
                transitionCues: args.transitionCues ?? rotation.transitionCues,
                updatedAt: Date.now(),
              }
            : rotation,
        ),
      );
    },
  });
}

export function useDeleteClassroomRotation() {
  const { t } = useTranslation("classroomScreen");
  const mutationFn = useConvexMutation(api.classroomScreen.deleteRotation);

  return useOptimisticMutation({
    mutationFn,
    queryKeys: (args) => rotationKeys(args.classId),
    applyOptimisticUpdate: (queryClient, args) => {
      patchRotations(queryClient, args.classId, (rotations) =>
        rotations.filter((rotation) => rotation._id !== args.rotationId),
      );
    },
    onError: (error) => {
      showMutationError(messageFromError(error, t("rotationDeleteError")));
    },
  });
}

export function useDeleteClassroomTimer() {
  const { t } = useTranslation("classroomScreen");
  const mutationFn = useConvexMutation(api.classroomScreen.deleteTimer);

  return useOptimisticMutation({
    mutationFn,
    queryKeys: (args) => timerKeys(args.classId),
    applyOptimisticUpdate: (queryClient, args) => {
      patchTimers(queryClient, args.classId, (timers) =>
        timers.filter((timer) => timer._id !== args.timerId),
      );
    },
    onError: (error) => {
      showMutationError(messageFromError(error, t("timerDeleteError")));
    },
  });
}

export function useRegisterClassroomAudio() {
  const { t } = useTranslation("classroomScreen");
  const mutationFn = useConvexMutation(api.classroomScreen.registerAudioFile);

  return useOptimisticMutation({
    mutationFn,
    queryKeys: (args) => audioKeys(args.classId),
    onError: (error) => {
      showMutationError(messageFromError(error, t("audioSaveError")));
    },
  });
}

export function useDeleteClassroomAudio() {
  const { t } = useTranslation("classroomScreen");
  const mutationFn = useConvexMutation(api.classroomScreen.deleteAudioFile);

  return useOptimisticMutation({
    mutationFn,
    queryKeys: (args) => audioKeys(args.classId),
    applyOptimisticUpdate: (queryClient, args) => {
      queryClient.setQueryData<ClassroomAudioFile[]>(classroomAudioQueryKey(args.classId), (old) =>
        old?.filter((file) => file._id !== args.audioFileId),
      );
    },
    onError: (error) => {
      showMutationError(messageFromError(error, t("audioDeleteError")));
    },
  });
}

type DisplaySessionMutation =
  | typeof api.classroomScreen.startSession
  | typeof api.classroomScreen.stopSession
  | typeof api.classroomScreen.pauseSession
  | typeof api.classroomScreen.resumeSession
  | typeof api.classroomScreen.adjustSession
  | typeof api.classroomScreen.skipSessionSegment;

function useDisplaySessionMutation<TMutation extends DisplaySessionMutation>(
  mutationRef: TMutation,
  applyPatch: (
    bundle: ClassroomDisplayBundle,
    args: FunctionArgs<TMutation>,
  ) => ClassroomDisplayBundle["displaySession"],
) {
  const mutationFn = useConvexMutation(mutationRef);

  return useOptimisticMutation({
    mutationFn: mutationFn as unknown as (args: FunctionArgs<TMutation>) => Promise<null>,
    queryKeys: (args, queryClient) => displayBundleKeys(args.classId)(args, queryClient),
    applyOptimisticUpdate: (queryClient, args: FunctionArgs<TMutation>) => {
      patchDisplayBundle(queryClient, args.classId, (bundle) => ({
        ...bundle,
        displaySession: applyPatch(bundle, args),
      }));
    },
  });
}

export function useStartClassroomSession() {
  return useDisplaySessionMutation(api.classroomScreen.startSession, (bundle, args) => {
    const session = args.session as ActiveSession;
    const duration = session.segments[session.index]?.durationSeconds ?? 0;
    return {
      ...bundle.displaySession,
      sessionJson: session,
      endsAt: Date.now() + duration * 1000,
      paused: false,
      pausedRemainingMs: undefined,
      updatedAt: Date.now(),
    };
  });
}

export function useStopClassroomSession() {
  return useDisplaySessionMutation(api.classroomScreen.stopSession, (bundle) => ({
    ...bundle.displaySession,
    sessionJson: undefined,
    endsAt: undefined,
    paused: false,
    pausedRemainingMs: undefined,
    updatedAt: Date.now(),
  }));
}

export function usePauseClassroomSession() {
  return useDisplaySessionMutation(api.classroomScreen.pauseSession, (bundle, args) => ({
    ...bundle.displaySession,
    paused: true,
    pausedRemainingMs: args.remainingMs,
    endsAt: undefined,
    updatedAt: Date.now(),
  }));
}

export function useResumeClassroomSession() {
  return useDisplaySessionMutation(api.classroomScreen.resumeSession, (bundle, args) => ({
    ...bundle.displaySession,
    paused: false,
    pausedRemainingMs: undefined,
    endsAt: Date.now() + args.remainingMs,
    updatedAt: Date.now(),
  }));
}

export function useAdjustClassroomSession() {
  return useDisplaySessionMutation(api.classroomScreen.adjustSession, (bundle, args) => {
    const session = bundle.displaySession;
    if (session.paused && session.pausedRemainingMs !== undefined) {
      const nextMs = session.pausedRemainingMs + args.deltaSeconds * 1000;
      if (nextMs < 0) return session;
      return { ...session, pausedRemainingMs: nextMs, updatedAt: Date.now() };
    }
    if (session.endsAt === undefined) return session;
    const nextEndsAt = session.endsAt + args.deltaSeconds * 1000;
    const nextRemaining = Math.floor((nextEndsAt - Date.now()) / 1000);
    if (nextRemaining < 0) return session;
    return { ...session, endsAt: nextEndsAt, updatedAt: Date.now() };
  });
}

export function useSkipClassroomSessionSegment() {
  const mutationFn = useConvexMutation(api.classroomScreen.skipSessionSegment);
  return useOptimisticMutation({
    mutationFn,
    queryKeys: (args, queryClient) => displayBundleKeys(args.classId)(args, queryClient),
    applyOptimisticUpdate: (queryClient, args) => {
      patchDisplayBundle(queryClient, args.classId, (bundle) => {
        const parsed = bundle.displaySession.sessionJson as ActiveSession | undefined;
        if (!parsed) return bundle;
        const nextIndex = parsed.index + 1;
        if (nextIndex >= parsed.segments.length) {
          return {
            ...bundle,
            displaySession: {
              ...bundle.displaySession,
              sessionJson: undefined,
              endsAt: undefined,
              paused: false,
              pausedRemainingMs: undefined,
              updatedAt: Date.now(),
            },
          };
        }
        const nextSession = { ...parsed, index: nextIndex };
        const duration = nextSession.segments[nextIndex]?.durationSeconds ?? 0;
        return {
          ...bundle,
          displaySession: {
            ...bundle.displaySession,
            sessionJson: nextSession,
            endsAt: Date.now() + duration * 1000,
            paused: false,
            pausedRemainingMs: undefined,
            updatedAt: Date.now(),
          },
        };
      });
    },
  });
}

export function useUpdateClassroomSession() {
  const mutationFn = useConvexMutation(api.classroomScreen.updateSession);
  return useOptimisticMutation({
    mutationFn,
    queryKeys: (args, queryClient) => displayBundleKeys(args.classId)(args, queryClient),
    applyOptimisticUpdate: (queryClient, args) => {
      patchDisplayBundle(queryClient, args.classId, (bundle) => ({
        ...bundle,
        displaySession: {
          ...bundle.displaySession,
          sessionJson: args.session,
          updatedAt: Date.now(),
        },
      }));
    },
  });
}

export function usePushLessonToDisplay() {
  const mutationFn = useConvexMutation(api.classroomScreen.pushLessonToDisplay);
  return useOptimisticMutation({
    mutationFn,
    queryKeys: (args, queryClient) => displayBundleKeys(args.classId)(args, queryClient),
    applyOptimisticUpdate: (queryClient, args) => {
      patchDisplayBundle(queryClient, args.classId, (bundle) => ({
        ...bundle,
        displaySession: {
          ...bundle.displaySession,
          pushedLessonId: args.lessonId,
          pushedUntil: Date.now() + args.durationSeconds * 1000,
          updatedAt: Date.now(),
        },
      }));
    },
  });
}

export function useClearPushedLesson() {
  const mutationFn = useConvexMutation(api.classroomScreen.clearPushedLesson);
  return useOptimisticMutation({
    mutationFn,
    queryKeys: (args, queryClient) => displayBundleKeys(args.classId)(args, queryClient),
    applyOptimisticUpdate: (queryClient, args) => {
      patchDisplayBundle(queryClient, args.classId, (bundle) => ({
        ...bundle,
        displaySession: {
          ...bundle.displaySession,
          pushedLessonId: undefined,
          pushedUntil: undefined,
          updatedAt: Date.now(),
        },
        pushedLesson: null,
      }));
    },
  });
}

export function useClearQuickText() {
  const mutationFn = useConvexMutation(api.classroomScreen.clearQuickText);
  return useOptimisticMutation({
    mutationFn,
    queryKeys: (args, queryClient) => settingsKeys(args, queryClient),
    applyOptimisticUpdate: (queryClient, args) => {
      patchDisplayBundle(queryClient, args.classId, (bundle) => ({
        ...bundle,
        settings: { ...bundle.settings, quickText: undefined, updatedAt: Date.now() },
      }));
      queryClient.setQueryData(
        classroomSettingsQueryKey(args.classId),
        (old: ClassroomDisplayBundle["settings"] | undefined) =>
          old ? { ...old, quickText: undefined, updatedAt: Date.now() } : old,
      );
    },
  });
}

export type { ActiveSession, AudioCues };
