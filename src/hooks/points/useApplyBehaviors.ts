import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { pointsBoardQueryKey } from "@/hooks/points/usePointsBoard";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import { messageFromError } from "@/lib/errors/convexError";
import type { PointsBoard } from "@/lib/points/points";

type ApplyBehaviorsArgs = {
  classId: Id<"classes">;
  dateKey: string;
  studentUserIds: Array<Id<"users">>;
  mode: "award" | "remove";
  items: Array<{ behaviorId: Id<"behaviors">; quantity: number; points: number }>;
  note?: string;
};

export function useApplyBehaviors() {
  const { t } = useTranslation("points");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.points.applyBehaviors);

  return useOptimisticMutation({
    mutationFn: (args: ApplyBehaviorsArgs) =>
      mutationFn({
        classId: args.classId,
        studentUserIds: args.studentUserIds,
        mode: args.mode,
        items: args.items.map((item) => ({
          behaviorId: item.behaviorId,
          quantity: item.quantity,
        })),
        ...(args.note ? { note: args.note } : {}),
      }),
    queryKeys: (args) => [pointsBoardQueryKey(args.classId, args.dateKey)],
    applyOptimisticUpdate: (queryClient, args) => {
      const queryKey = pointsBoardQueryKey(args.classId, args.dateKey);
      const selected = new Set(args.studentUserIds);
      queryClient.setQueryData<PointsBoard>(queryKey, (old) => {
        if (!old) return old;
        return old.map((student) => {
          if (!selected.has(student.userId)) return student;
          let pointsBalance = student.pointsBalance;
          let pointsAwarded = student.pointsAwarded;
          let pointsRemoved = student.pointsRemoved;
          let minusCount = student.minusCount;
          for (const item of args.items) {
            const applied = item.points * item.quantity;
            pointsBalance += applied;
            if (applied > 0) pointsAwarded += applied;
            if (applied < 0) {
              pointsRemoved += Math.abs(applied);
              minusCount += item.quantity;
            }
          }
          return { ...student, pointsBalance, pointsAwarded, pointsRemoved, minusCount };
        });
      });
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("applyFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
