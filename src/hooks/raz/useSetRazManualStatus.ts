import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { razInitialLevelsQueryKey } from "@/hooks/raz/useRazInitialLevels";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import { messageFromError } from "@/lib/errors/convexError";
import type { RazInitialLevelEntry, RazManualStatus } from "@/lib/raz/levels";

export type SetRazManualStatusArgs = {
  classId: Id<"classes">;
  studentUserId: Id<"users">;
  manualStatus: RazManualStatus | null;
};

/** gcTime: N/A (mutation). Patches levels query (ONE_HOUR). */
export function useSetRazManualStatus() {
  const { t } = useTranslation("raz");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.raz.setManualStatus);

  return useOptimisticMutation({
    mutationFn: (args: SetRazManualStatusArgs) =>
      mutationFn({
        classId: args.classId,
        studentUserId: args.studentUserId,
        manualStatus: args.manualStatus,
      }),
    queryKeys: (args) => [razInitialLevelsQueryKey(args.classId)],
    applyOptimisticUpdate: (queryClient, args) => {
      const key = razInitialLevelsQueryKey(args.classId);
      queryClient.setQueryData<RazInitialLevelEntry[]>(key, (old) => {
        if (!old) return old;
        return old.map((row) =>
          row.studentUserId === args.studentUserId
            ? { ...row, manualStatus: args.manualStatus }
            : row,
        );
      });
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("statusSaveFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
