import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { seatConstraintsListQueryKey } from "@/hooks/assigners/useSeatConstraints";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import type {
  SeatConstraintList,
  SeatConstraintPolarity,
  SeatConstraintType,
} from "@/lib/assigners/seatConstraints";
import { messageFromError } from "@/lib/errors/convexError";
import { randomClientId } from "@/lib/optimistic";

type CreateSeatConstraintArgs = {
  classId: Id<"classes">;
  type: SeatConstraintType;
  polarity: SeatConstraintPolarity;
  studentUserId: Id<"users">;
  otherStudentUserId?: Id<"users">;
  zoneName?: string;
};

export function useCreateSeatConstraint() {
  const { t } = useTranslation("assigners");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.seatConstraints.create);

  return useOptimisticMutation({
    mutationFn: (args: CreateSeatConstraintArgs) => mutationFn(args),
    queryKeys: (args) => [seatConstraintsListQueryKey(args.classId)],
    applyOptimisticUpdate: (queryClient, args) => {
      const queryKey = seatConstraintsListQueryKey(args.classId);
      const now = Date.now();
      const optimisticId = `optimistic:${randomClientId()}` as Id<"seatConstraints">;
      queryClient.setQueryData<SeatConstraintList>(queryKey, (old) => {
        const next: SeatConstraintList[number] = {
          _id: optimisticId,
          _creationTime: now,
          classId: args.classId,
          type: args.type,
          polarity: args.polarity,
          studentUserId: args.studentUserId,
          ...(args.otherStudentUserId !== undefined
            ? { otherStudentUserId: args.otherStudentUserId }
            : {}),
          ...(args.zoneName !== undefined ? { zoneName: args.zoneName.trim() } : {}),
          updatedAt: now,
          createdBy: "optimistic" as Id<"users">,
        };
        if (!old) return [next];
        return [next, ...old];
      });
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("constraintSaveFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
