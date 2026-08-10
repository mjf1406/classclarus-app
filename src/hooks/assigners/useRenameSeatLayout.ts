import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { seatLayoutQueryKey } from "@/hooks/assigners/useSeatLayout";
import { seatLayoutsListQueryKey } from "@/hooks/assigners/useSeatLayouts";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import type { SeatLayout, SeatLayoutList } from "@/lib/assigners/seatLayouts";
import { messageFromError } from "@/lib/errors/convexError";

type RenameSeatLayoutArgs = {
  classId: Id<"classes">;
  layoutId: Id<"seatLayouts">;
  name: string;
};

export function useRenameSeatLayout() {
  const { t } = useTranslation("assigners");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.seatLayouts.rename);

  return useOptimisticMutation({
    mutationFn: (args: RenameSeatLayoutArgs) => mutationFn(args),
    queryKeys: (args) => [
      seatLayoutsListQueryKey(args.classId),
      seatLayoutQueryKey(args.classId, args.layoutId),
    ],
    applyOptimisticUpdate: (queryClient, args) => {
      const name = args.name.trim();
      const now = Date.now();
      queryClient.setQueryData<SeatLayoutList>(seatLayoutsListQueryKey(args.classId), (old) => {
        if (!old) return old;
        return old.map((row) =>
          row._id === args.layoutId ? { ...row, name, updatedAt: now } : row,
        );
      });
      queryClient.setQueryData<SeatLayout | null>(
        seatLayoutQueryKey(args.classId, args.layoutId),
        (old) => (old ? { ...old, name, updatedAt: now } : old),
      );
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("saveFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
