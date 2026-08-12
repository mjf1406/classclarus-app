import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import {
  equitableAssignersListQueryKey,
  type EquitableAssignerList,
} from "@/hooks/assigners/equitable/useEquitableAssigners";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import { messageFromError } from "@/lib/errors/convexError";

type RemoveEquitableAssignerArgs = {
  classId: Id<"classes">;
  assignerId: Id<"equitableAssigners">;
};

export function useRemoveEquitableAssigner() {
  const { t } = useTranslation("assigners");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.equitableAssigners.remove);

  return useOptimisticMutation({
    mutationFn: (args: RemoveEquitableAssignerArgs) =>
      mutationFn({ classId: args.classId, assignerId: args.assignerId }),
    queryKeys: (args) => [equitableAssignersListQueryKey(args.classId)],
    applyOptimisticUpdate: (queryClient, args) => {
      queryClient.setQueryData<EquitableAssignerList>(
        equitableAssignersListQueryKey(args.classId),
        (old) => old?.filter((row) => row._id !== args.assignerId) ?? old,
      );
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("equitableDeleteFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
