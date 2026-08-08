import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { pointsBoardQueryKey } from "@/hooks/points/usePointsBoard";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import { messageFromError } from "@/lib/errors/convexError";
import type { PointsBoard } from "@/lib/points/points";

type WarningArgs = {
  classId: Id<"classes">;
  studentUserId: Id<"users">;
  dateKey: string;
};

export function useGiveWarning() {
  const { t } = useTranslation("points");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.points.giveWarning);

  return useOptimisticMutation({
    mutationFn: (args: WarningArgs) => mutationFn(args),
    queryKeys: (args) => [pointsBoardQueryKey(args.classId, args.dateKey)],
    applyOptimisticUpdate: (queryClient, args) => {
      const queryKey = pointsBoardQueryKey(args.classId, args.dateKey);
      queryClient.setQueryData<PointsBoard>(queryKey, (old) => {
        if (!old) return old;
        return old.map((student) =>
          student.userId === args.studentUserId
            ? { ...student, warningCount: student.warningCount + 1 }
            : student,
        );
      });
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("warningFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}

export function useUndoLastWarning() {
  const { t } = useTranslation("points");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.points.undoLastWarning);

  return useOptimisticMutation({
    mutationFn: (args: WarningArgs) => mutationFn(args),
    queryKeys: (args) => [pointsBoardQueryKey(args.classId, args.dateKey)],
    applyOptimisticUpdate: (queryClient, args) => {
      const queryKey = pointsBoardQueryKey(args.classId, args.dateKey);
      queryClient.setQueryData<PointsBoard>(queryKey, (old) => {
        if (!old) return old;
        return old.map((student) =>
          student.userId === args.studentUserId
            ? { ...student, warningCount: Math.max(0, student.warningCount - 1) }
            : student,
        );
      });
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("undoWarningFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}

export function useClearWarnings() {
  const { t } = useTranslation("points");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.points.clearWarnings);

  return useOptimisticMutation({
    mutationFn: (args: WarningArgs) => mutationFn(args),
    queryKeys: (args) => [pointsBoardQueryKey(args.classId, args.dateKey)],
    applyOptimisticUpdate: (queryClient, args) => {
      const queryKey = pointsBoardQueryKey(args.classId, args.dateKey);
      queryClient.setQueryData<PointsBoard>(queryKey, (old) => {
        if (!old) return old;
        return old.map((student) =>
          student.userId === args.studentUserId ? { ...student, warningCount: 0 } : student,
        );
      });
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("clearWarningsFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
