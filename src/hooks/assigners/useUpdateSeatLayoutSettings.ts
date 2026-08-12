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

type UpdateSeatLayoutSettingsArgs = {
  classId: Id<"classes">;
  layoutId: Id<"seatLayouts">;
  genderParity: { mode: "off" | "oddEven" };
};

export function useUpdateSeatLayoutSettings() {
  const { t } = useTranslation("assigners");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.seatLayouts.updateSettings);

  return useOptimisticMutation({
    mutationFn: (args: UpdateSeatLayoutSettingsArgs) => mutationFn(args),
    queryKeys: (args) => [
      seatLayoutsListQueryKey(args.classId),
      seatLayoutQueryKey(args.classId, args.layoutId),
    ],
    applyOptimisticUpdate: (queryClient, args) => {
      const now = Date.now();
      const genderParity = {
        mode: args.genderParity.mode === "off" ? ("off" as const) : ("oddEven" as const),
      };
      queryClient.setQueryData<SeatLayoutList>(seatLayoutsListQueryKey(args.classId), (old) => {
        if (!old) return old;
        return old.map((row) => (row._id === args.layoutId ? { ...row, updatedAt: now } : row));
      });
      queryClient.setQueryData<SeatLayout | null>(
        seatLayoutQueryKey(args.classId, args.layoutId),
        (old) => (old ? { ...old, genderParity, updatedAt: now } : old),
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
