import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { seatChartsListQueryKey } from "@/hooks/assigners/useSeatCharts";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import type { SeatChartList } from "@/lib/assigners/seatCharts";
import { messageFromError } from "@/lib/errors/convexError";
import { randomClientId } from "@/lib/optimistic";

type CreateSeatChartArgs = {
  classId: Id<"classes">;
  name: string;
  layoutId: Id<"seatLayouts">;
};

export function useCreateSeatChart() {
  const { t } = useTranslation("assigners");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.seatCharts.create);

  return useOptimisticMutation({
    mutationFn: (args: CreateSeatChartArgs) => mutationFn(args),
    queryKeys: (args) => [
      seatChartsListQueryKey(args.classId),
      seatChartsListQueryKey(args.classId, true),
    ],
    applyOptimisticUpdate: (queryClient, args) => {
      const now = Date.now();
      const optimisticId = `optimistic:${randomClientId()}` as Id<"seatCharts">;
      const patchList = (includeArchived?: boolean) => {
        const queryKey = seatChartsListQueryKey(args.classId, includeArchived);
        queryClient.setQueryData<SeatChartList>(queryKey, (old) => {
          const next = {
            _id: optimisticId,
            _creationTime: now,
            name: args.name.trim(),
            layoutId: args.layoutId,
            layoutName: "",
            updatedAt: now,
            recordCount: 0,
            seatedCount: 0,
          };
          if (!old) return [next];
          return [next, ...old];
        });
      };
      patchList(false);
      patchList(true);
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("chartSaveFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
