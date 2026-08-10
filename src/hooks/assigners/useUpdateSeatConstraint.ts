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

type UpdateSeatConstraintArgs = {
  classId: Id<"classes">;
  constraintId: Id<"seatConstraints">;
  type: SeatConstraintType;
  polarity: SeatConstraintPolarity;
  studentUserId: Id<"users">;
  otherStudentUserId?: Id<"users">;
  zoneName?: string;
};

export function useUpdateSeatConstraint() {
  const { t } = useTranslation("assigners");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.seatConstraints.update);

  return useOptimisticMutation({
    mutationFn: (args: UpdateSeatConstraintArgs) => mutationFn(args),
    queryKeys: (args) => [seatConstraintsListQueryKey(args.classId)],
    applyOptimisticUpdate: (queryClient, args) => {
      const now = Date.now();
      queryClient.setQueryData<SeatConstraintList>(
        seatConstraintsListQueryKey(args.classId),
        (old) => {
          if (!old) return old;
          return old.map((row) => {
            if (row._id !== args.constraintId) return row;
            return {
              _id: row._id,
              _creationTime: row._creationTime,
              classId: row.classId,
              type: args.type,
              polarity: args.polarity,
              studentUserId: args.studentUserId,
              ...(args.otherStudentUserId !== undefined
                ? { otherStudentUserId: args.otherStudentUserId }
                : {}),
              ...(args.zoneName !== undefined ? { zoneName: args.zoneName.trim() } : {}),
              updatedAt: now,
              createdBy: row.createdBy,
            };
          });
        },
      );
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("constraintSaveFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
