import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import {
  randomAssignersListQueryKey,
  type RandomAssignerList,
} from "@/hooks/assigners/random/useRandomAssigners";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import { messageFromError } from "@/lib/errors/convexError";

type RemoveRandomAssignerArgs = {
  classId: Id<"classes">;
  assignerId: Id<"randomAssigners">;
};

export function useRemoveRandomAssigner() {
  const { t } = useTranslation("assigners");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.randomAssigners.remove);

  return useOptimisticMutation({
    mutationFn: (args: RemoveRandomAssignerArgs) =>
      mutationFn({ classId: args.classId, assignerId: args.assignerId }),
    queryKeys: (args) => [randomAssignersListQueryKey(args.classId)],
    applyOptimisticUpdate: (queryClient, args) => {
      queryClient.setQueryData<RandomAssignerList>(
        randomAssignersListQueryKey(args.classId),
        (old) => old?.filter((row) => row._id !== args.assignerId) ?? old,
      );
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("randomDeleteFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
