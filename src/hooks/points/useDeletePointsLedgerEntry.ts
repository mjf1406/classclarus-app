import { useConvexMutation } from "@convex-dev/react-query";
import type { InfiniteData } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { pointsBoardQueryKey } from "@/hooks/points/usePointsBoard";
import type { PointsLedgerItem } from "@/hooks/points/usePointsLedgerForAudience";
import { pointsLedgerForStudentQueryKey } from "@/hooks/points/usePointsLedgerForStudent";
import { rewardPurchaseLimitsQueryKeyRoot } from "@/hooks/points/useRewardPurchaseLimits";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import { messageFromError } from "@/lib/errors/convexError";
import type { PointsBoard } from "@/lib/points/points";
import {
  applyLedgerDeleteToBoard,
  removeLedgerItemFromInfiniteData,
  type DeletableLedgerKind,
  type PointsLedgerPage,
} from "@/lib/points/pointsLedgerOptimistic";

type DeletePointsLedgerEntryArgs = {
  classId: Id<"classes">;
  dateKey: string;
  studentUserId: Id<"users">;
  item: Extract<PointsLedgerItem, { kind: DeletableLedgerKind }>;
};

export function useDeletePointsLedgerEntry() {
  const { t } = useTranslation("points");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.points.deleteLedgerEntry);

  return useOptimisticMutation({
    mutationFn: (args: DeletePointsLedgerEntryArgs) =>
      mutationFn({
        classId: args.classId,
        entry:
          args.item.kind === "behavior"
            ? { kind: "behavior" as const, entryId: args.item.id }
            : { kind: "reward" as const, entryId: args.item.id },
      }),
    queryKeys: (args) => [
      pointsLedgerForStudentQueryKey(args.classId, args.studentUserId),
      pointsBoardQueryKey(args.classId, args.dateKey),
    ],
    applyOptimisticUpdate: (queryClient, args) => {
      queryClient.setQueryData<InfiniteData<PointsLedgerPage>>(
        pointsLedgerForStudentQueryKey(args.classId, args.studentUserId),
        (current) => removeLedgerItemFromInfiniteData(current, args.item.kind, args.item.id),
      );
      queryClient.setQueryData<PointsBoard>(
        pointsBoardQueryKey(args.classId, args.dateKey),
        (current) =>
          current ? applyLedgerDeleteToBoard(current, args.studentUserId, args.item) : current,
      );
    },
    invalidateQueryKeys: () => [rewardPurchaseLimitsQueryKeyRoot()],
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("ledgerDeleteFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
