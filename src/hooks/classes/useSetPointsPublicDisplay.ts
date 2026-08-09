import { useConvexMutation } from "@convex-dev/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { classDetailQueryKey } from "@/hooks/classes/useClass";
import { classesListQueryKey } from "@/hooks/classes/useClasses";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import type { ClassPublic } from "@/lib/classes/classes";
import { messageFromError } from "@/lib/errors/convexError";
import { patchDoc } from "@/lib/optimistic";

type ClassDoc = Doc<"classes">;

type SetPointsPublicDisplayArgs = {
  classId: Id<"classes">;
  enabled: boolean;
};

export function useSetPointsPublicDisplay() {
  const { t } = useTranslation("classes");
  const { t: tCommon } = useTranslation("common");
  const queryClient = useQueryClient();
  const mutationFn = useConvexMutation(api.classes.setPointsPublicDisplay);
  const listKey = classesListQueryKey();

  return useOptimisticMutation({
    mutationFn: (args: SetPointsPublicDisplayArgs) => mutationFn(args),
    queryKeys: (args) => [listKey, classDetailQueryKey(args.classId)],
    applyOptimisticUpdate: (queryClient, args) => {
      const detailKey = classDetailQueryKey(args.classId);
      const now = Date.now();
      const patch = {
        pointsPublicEnabled: args.enabled,
        updatedAt: now,
      };
      queryClient.setQueryData<ClassPublic[]>(listKey, (old) => {
        if (!old) return old;
        return old.map((classDoc) =>
          classDoc._id === args.classId ? { ...classDoc, ...patch } : classDoc,
        );
      });
      queryClient.setQueryData<ClassDoc | null>(detailKey, (old) =>
        patchDoc(old ?? null, (doc) => ({ ...doc, ...patch })),
      );
    },
    onSuccess: (data, args) => {
      // Server allocates pointsPublicSlug on first enable — apply immediately so QR/copy UI
      // does not wait on invalidate/refetch.
      const detailKey = classDetailQueryKey(args.classId);
      const patch = {
        pointsPublicEnabled: data.pointsPublicEnabled,
        pointsPublicSlug: data.pointsPublicSlug,
        updatedAt: data.updatedAt,
      };
      queryClient.setQueryData<ClassPublic[]>(listKey, (old) => {
        if (!old) return old;
        return old.map((classDoc) =>
          classDoc._id === args.classId ? { ...classDoc, ...patch } : classDoc,
        );
      });
      queryClient.setQueryData<ClassDoc | null>(detailKey, (old) =>
        patchDoc(old ?? null, (doc) => ({ ...doc, ...patch })),
      );
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(
          error,
          t("pointsPublicDisplayToggleFailed"),
          tCommon("rateLimited"),
        ),
        type: "error",
      });
    },
  });
}
