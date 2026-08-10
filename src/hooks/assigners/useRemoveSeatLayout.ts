import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { seatLayoutQueryKey } from "@/hooks/assigners/useSeatLayout";
import { seatLayoutsListQueryKey } from "@/hooks/assigners/useSeatLayouts";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import type { SeatLayoutList } from "@/lib/assigners/seatLayouts";
import { messageFromError } from "@/lib/errors/convexError";

type RemoveSeatLayoutArgs = {
  classId: Id<"classes">;
  layoutId: Id<"seatLayouts">;
};

export function useRemoveSeatLayout() {
  const { t } = useTranslation("assigners");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.seatLayouts.remove);

  return useOptimisticMutation({
    mutationFn: (args: RemoveSeatLayoutArgs) => mutationFn(args),
    queryKeys: (args) => [
      seatLayoutsListQueryKey(args.classId),
      seatLayoutQueryKey(args.classId, args.layoutId),
    ],
    applyOptimisticUpdate: (queryClient, args) => {
      queryClient.setQueryData<SeatLayoutList>(seatLayoutsListQueryKey(args.classId), (old) => {
        if (!old) return old;
        return old.filter((row) => row._id !== args.layoutId);
      });
      queryClient.setQueryData(seatLayoutQueryKey(args.classId, args.layoutId), null);
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("saveFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
