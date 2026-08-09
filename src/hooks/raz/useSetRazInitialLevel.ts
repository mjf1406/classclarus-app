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
      const now = Date.now();
      queryClient.setQueryData<RazInitialLevelEntry[]>(key, (old) => {
        if (!old) {
          return [
            {
              studentUserId: args.studentUserId,
              initialLevel: args.initialLevel,
              currentLevel: args.initialLevel,
              lastAssessedAt: null,
              lastAssessmentResult: null,
              scheduleAnchorAt: now,
              manualStatus: null,
            },
          ];
        }
        const index = old.findIndex((row) => row.studentUserId === args.studentUserId);
        if (index < 0) {
          return [
            ...old,
            {
              studentUserId: args.studentUserId,
              initialLevel: args.initialLevel,
              currentLevel: args.initialLevel,
              lastAssessedAt: null,
              lastAssessmentResult: null,
              scheduleAnchorAt: now,
              manualStatus: null,
            },
          ];
        }
        const existing = old[index]!;
        const copy = [...old];
        copy[index] = {
          ...existing,
          initialLevel: args.initialLevel,
          // Match server: do not overwrite an existing currentLevel on patch.
          currentLevel: existing.currentLevel || args.initialLevel,
          // Only reset the schedule when there is no assessment yet.
          scheduleAnchorAt: existing.lastAssessedAt == null ? now : existing.scheduleAnchorAt,
        };
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
