import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { razInitialLevelsQueryKey } from "@/hooks/raz/useRazInitialLevels";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import { messageFromError } from "@/lib/errors/convexError";
import type { RazInitialLevelEntry } from "@/lib/raz/levels";

export type SetRazInitialLevelArgs = {
  classId: Id<"classes">;
  studentUserId: Id<"users">;
  initialLevel: string;
};

export function useSetRazInitialLevel() {
  const { t } = useTranslation("raz");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.raz.setInitialLevel);

  return useOptimisticMutation({
    mutationFn: (args: SetRazInitialLevelArgs) =>
      mutationFn({
        classId: args.classId,
        studentUserId: args.studentUserId,
        initialLevel: args.initialLevel,
      }),
    queryKeys: (args) => [razInitialLevelsQueryKey(args.classId)],
    applyOptimisticUpdate: (queryClient, args) => {
      const key = razInitialLevelsQueryKey(args.classId);
      queryClient.setQueryData<RazInitialLevelEntry[]>(key, (old) => {
        const nextEntry: RazInitialLevelEntry = {
          studentUserId: args.studentUserId,
          initialLevel: args.initialLevel,
        };
        if (!old) return [nextEntry];
        const index = old.findIndex((row) => row.studentUserId === args.studentUserId);
        if (index < 0) return [...old, nextEntry];
        const copy = [...old];
        copy[index] = nextEntry;
        return copy;
      });
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("levelSaveFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
