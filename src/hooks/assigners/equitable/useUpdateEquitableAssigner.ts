import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import {
  equitableAssignerDetailQueryKey,
  equitableAssignersListQueryKey,
  type EquitableAssignerList,
} from "@/hooks/assigners/equitable/useEquitableAssigners";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import type { EquitableAssignerFormValues } from "@/lib/assigners/equitableAssigners";
import { equitableAssignerMutationPayloadFromForm } from "@/lib/assigners/equitableAssigners";
import { messageFromError } from "@/lib/errors/convexError";

type UpdateEquitableAssignerArgs = {
  classId: Id<"classes">;
  assignerId: Id<"equitableAssigners">;
  values: EquitableAssignerFormValues;
};

export function useUpdateEquitableAssigner() {
  const { t } = useTranslation("assigners");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.equitableAssigners.update);

  return useOptimisticMutation({
    mutationFn: (args: UpdateEquitableAssignerArgs) => {
      const payload = equitableAssignerMutationPayloadFromForm(args.values);
      return mutationFn({
        classId: args.classId,
        assignerId: args.assignerId,
        ...payload,
      });
    },
    queryKeys: (args) => [
      equitableAssignersListQueryKey(args.classId),
      equitableAssignerDetailQueryKey(args.classId, args.assignerId),
    ],
    applyOptimisticUpdate: (queryClient, args) => {
      const payload = equitableAssignerMutationPayloadFromForm(args.values);
      const now = Date.now();

      queryClient.setQueryData<EquitableAssignerList>(
        equitableAssignersListQueryKey(args.classId),
        (old) => {
          if (!old) return old;
          return old.map((row) =>
            row._id === args.assignerId
              ? {
                  ...row,
                  name: payload.name,
                  items: payload.items,
                  defaultBalanceGender: payload.defaultBalanceGender,
                  defaultScope: payload.defaultScope,
                  updatedAt: now,
                }
              : row,
          );
        },
      );
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("equitableSaveFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
