import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { seatLayoutsListQueryKey } from "@/hooks/assigners/useSeatLayouts";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import type { SeatLayoutList } from "@/lib/assigners/seatLayouts";
import { messageFromError } from "@/lib/errors/convexError";
import { randomClientId } from "@/lib/optimistic";

type CopySeatLayoutArgs = {
  classId: Id<"classes">;
  name: string;
  sourceClassId: Id<"classes">;
  sourceLayoutId: Id<"seatLayouts">;
};

/** Optimistic list insert; source layout counts come from the source-class list cache when present. */
export function useCopySeatLayout() {
  const { t } = useTranslation("assigners");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.seatLayouts.copyFromLayout);

  return useOptimisticMutation({
    mutationFn: (args: CopySeatLayoutArgs) =>
      mutationFn({
        classId: args.classId,
        name: args.name,
        sourceClassId: args.sourceClassId,
        sourceLayoutId: args.sourceLayoutId,
      }),
    queryKeys: (args) => [seatLayoutsListQueryKey(args.classId)],
    applyOptimisticUpdate: (queryClient, args) => {
      const queryKey = seatLayoutsListQueryKey(args.classId);
      const sourceList = queryClient.getQueryData<SeatLayoutList>(
        seatLayoutsListQueryKey(args.sourceClassId),
      );
      const source = sourceList?.find((layout) => layout._id === args.sourceLayoutId);
      const now = Date.now();
      const optimisticId = `optimistic:${randomClientId()}` as Id<"seatLayouts">;
      queryClient.setQueryData<SeatLayoutList>(queryKey, (old) => {
        const next: SeatLayoutList[number] = {
          _id: optimisticId,
          _creationTime: now,
          name: args.name.trim(),
          updatedAt: now,
          deskCount: source?.deskCount ?? 0,
          itemCount: source?.itemCount ?? 0,
        };
        if (!old) return [next];
        return [next, ...old];
      });
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("copyFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
