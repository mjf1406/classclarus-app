import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { seatConstraintsListQueryKey } from "@/hooks/assigners/useSeatConstraints";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import type { SeatConstraintList } from "@/lib/assigners/seatConstraints";
import { messageFromError } from "@/lib/errors/convexError";

type RemoveSeatConstraintArgs = {
  classId: Id<"classes">;
  constraintId: Id<"seatConstraints">;
};

export function useRemoveSeatConstraint() {
  const { t } = useTranslation("assigners");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.seatConstraints.remove);

  return useOptimisticMutation({
    mutationFn: (args: RemoveSeatConstraintArgs) => mutationFn(args),
    queryKeys: (args) => [seatConstraintsListQueryKey(args.classId)],
    applyOptimisticUpdate: (queryClient, args) => {
      queryClient.setQueryData<SeatConstraintList>(
        seatConstraintsListQueryKey(args.classId),
        (old) => {
          if (!old) return old;
          return old.filter((row) => row._id !== args.constraintId);
        },
      );
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("constraintSaveFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
