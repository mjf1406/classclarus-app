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

type CreateSeatLayoutArgs = {
  classId: Id<"classes">;
  name: string;
};

export function useCreateSeatLayout() {
  const { t } = useTranslation("assigners");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.seatLayouts.create);

  return useOptimisticMutation({
    mutationFn: (args: CreateSeatLayoutArgs) => mutationFn(args),
    queryKeys: (args) => [seatLayoutsListQueryKey(args.classId)],
    applyOptimisticUpdate: (queryClient, args) => {
      const queryKey = seatLayoutsListQueryKey(args.classId);
      const now = Date.now();
      const optimisticId = `optimistic:${randomClientId()}` as Id<"seatLayouts">;
      queryClient.setQueryData<SeatLayoutList>(queryKey, (old) => {
        const next: SeatLayoutList[number] = {
          _id: optimisticId,
          _creationTime: now,
          name: args.name.trim(),
          updatedAt: now,
          deskCount: 0,
          itemCount: 0,
        };
        if (!old) return [next];
        return [next, ...old];
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
