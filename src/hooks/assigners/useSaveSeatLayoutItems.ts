import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { seatLayoutQueryKey } from "@/hooks/assigners/useSeatLayout";
import { seatLayoutsListQueryKey } from "@/hooks/assigners/useSeatLayouts";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import type { SeatLayout, SeatLayoutItem, SeatLayoutList } from "@/lib/assigners/seatLayouts";
import { messageFromError } from "@/lib/errors/convexError";

type SaveSeatLayoutItemsArgs = {
  classId: Id<"classes">;
  layoutId: Id<"seatLayouts">;
  canvasWidth: number;
  canvasHeight: number;
  nextDeskNumber: number;
  items: Array<SeatLayoutItem>;
};

export function useSaveSeatLayoutItems() {
  const { t } = useTranslation("assigners");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.seatLayouts.saveItems);

  return useOptimisticMutation({
    mutationFn: (args: SaveSeatLayoutItemsArgs) => mutationFn(args),
    queryKeys: (args) => [
      seatLayoutQueryKey(args.classId, args.layoutId),
      seatLayoutsListQueryKey(args.classId),
    ],
    applyOptimisticUpdate: (queryClient, args) => {
      const now = Date.now();
      const deskCount = args.items.filter((item) => item.kind === "desk").length;
      queryClient.setQueryData<SeatLayout | null>(
        seatLayoutQueryKey(args.classId, args.layoutId),
        (old) =>
          old
            ? {
                ...old,
                canvasWidth: args.canvasWidth,
                canvasHeight: args.canvasHeight,
                nextDeskNumber: args.nextDeskNumber,
                items: args.items,
                updatedAt: now,
              }
            : old,
      );
      queryClient.setQueryData<SeatLayoutList>(seatLayoutsListQueryKey(args.classId), (old) => {
        if (!old) return old;
        return old.map((row) =>
          row._id === args.layoutId
            ? {
                ...row,
                updatedAt: now,
                deskCount,
                itemCount: args.items.length,
              }
            : row,
        );
      });
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("saveFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
