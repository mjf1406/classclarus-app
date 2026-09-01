import { useConvexMutation } from "@convex-dev/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { classDetailQueryKey } from "@/hooks/classes/useClass";
import { classesListQueryKey } from "@/hooks/classes/useClasses";
import { isClassroomDisplayBundleQueryKey } from "@/hooks/classroomScreen/useClassroomScreenQueries";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import type { ClassPublic } from "@/lib/classes/classes";
import { messageFromError } from "@/lib/errors/convexError";
import { patchDoc } from "@/lib/optimistic";

type ClassDoc = Doc<"classes">;

type SetUpcomingAnnouncementEventLimitArgs = {
  classId: Id<"classes">;
  upcomingAnnouncementEventLimit: number;
};

function queryTouchesClassUpcomingEvents(
  queryKey: readonly unknown[],
  classId: Id<"classes">,
): boolean {
  if (isClassroomDisplayBundleQueryKey(queryKey, classId)) return true;
  const id = queryKey[1];
  if (id !== "classroomScreen:getScreenBundle" && id !== "timetable:getWeekBundle") {
    return false;
  }
  const args = queryKey[2] as { classId?: Id<"classes"> } | undefined;
  return args?.classId === classId;
}

export function useSetUpcomingAnnouncementEventLimit() {
  const { t } = useTranslation("classes");
  const { t: tCommon } = useTranslation("common");
  const queryClient = useQueryClient();
  const mutationFn = useConvexMutation(api.classes.setUpcomingAnnouncementEventLimit);
  const listKey = classesListQueryKey();

  return useOptimisticMutation({
    mutationFn: (args: SetUpcomingAnnouncementEventLimitArgs) => mutationFn(args),
    queryKeys: (args) => [listKey, classDetailQueryKey(args.classId)],
    applyOptimisticUpdate: (client, args) => {
      const detailKey = classDetailQueryKey(args.classId);
      const now = Date.now();
      const patch = {
        upcomingAnnouncementEventLimit: args.upcomingAnnouncementEventLimit,
        updatedAt: now,
      };
      client.setQueryData<ClassPublic[]>(listKey, (old) => {
        if (!old) return old;
        return old.map((classDoc) =>
          classDoc._id === args.classId ? { ...classDoc, ...patch } : classDoc,
        );
      });
      client.setQueryData<ClassDoc | null>(detailKey, (old) =>
        patchDoc(old ?? null, (doc) => ({ ...doc, ...patch })),
      );
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(
          error,
          t("upcomingAnnouncementEventsSaveFailed"),
          tCommon("rateLimited"),
        ),
        type: "error",
      });
    },
    onSettled: (_data, _error, args) => {
      void queryClient.invalidateQueries({
        predicate: (query) => queryTouchesClassUpcomingEvents(query.queryKey, args.classId),
      });
    },
  });
}
