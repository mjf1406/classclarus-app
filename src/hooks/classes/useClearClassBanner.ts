import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { classDetailQueryKey } from "@/hooks/classes/useClass";
import { classesListQueryKey } from "@/hooks/classes/useClasses";
import { fileBytesQueryKey } from "@/hooks/files/useFileBytes";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import type { ClassPublic } from "@/lib/classes/classes";
import { messageFromError } from "@/lib/errors/convexError";
import { patchDoc } from "@/lib/optimistic";

type ClassDoc = Doc<"classes">;

type ClearClassBannerArgs = {
  classId: Id<"classes">;
};

export function useClearClassBanner() {
  const { t } = useTranslation("classes");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.classes.clearBanner);
  const listKey = classesListQueryKey();

  return useOptimisticMutation({
    mutationFn: (args: ClearClassBannerArgs) => mutationFn(args),
    queryKeys: (args) => [listKey, classDetailQueryKey(args.classId)],
    applyOptimisticUpdate: (queryClient, args) => {
      const detailKey = classDetailQueryKey(args.classId);
      const previous = queryClient.getQueryData<ClassDoc | null>(detailKey);
      if (previous?.bannerFileId !== undefined) {
        void queryClient.removeQueries({ queryKey: fileBytesQueryKey(previous.bannerFileId) });
      }
      const now = Date.now();
      queryClient.setQueryData<ClassPublic[]>(listKey, (old) => {
        if (!old) return old;
        return old.map((classDoc) =>
          classDoc._id === args.classId
            ? { ...classDoc, bannerFileId: undefined, updatedAt: now }
            : classDoc,
        );
      });
      queryClient.setQueryData<ClassDoc | null>(detailKey, (old) =>
        patchDoc(old ?? null, (doc) => ({
          ...doc,
          bannerFileId: undefined,
          updatedAt: now,
        })),
      );
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("bannerClearFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
