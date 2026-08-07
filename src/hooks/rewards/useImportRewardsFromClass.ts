import { useConvexMutation } from "@convex-dev/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { rewardFoldersListQueryKey } from "@/hooks/rewardFolders/useRewardFolders";
import { rewardsListQueryKey } from "@/hooks/rewards/useRewards";
import { messageFromError } from "@/lib/errors/convexError";

type ImportRewardsArgs = {
  classId: Id<"classes">;
  sourceClassId: Id<"classes">;
};

export function useImportRewardsFromClass() {
  const { t } = useTranslation("rewards");
  const { t: tCommon } = useTranslation("common");
  const queryClient = useQueryClient();
  const mutationFn = useConvexMutation(api.rewards.importFromClass);

  return useMutation({
    mutationFn: (args: ImportRewardsArgs) => mutationFn(args),
    onSuccess: async (_result, args) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: rewardsListQueryKey(args.classId) }),
        queryClient.invalidateQueries({ queryKey: rewardFoldersListQueryKey(args.classId) }),
      ]);
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("importFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
