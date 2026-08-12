import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import {
  equitableAssignersListQueryKey,
  type EquitableAssignerList,
} from "@/hooks/assigners/equitable/useEquitableAssigners";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import type { EquitableAssignerFormValues } from "@/lib/assigners/equitableAssigners";
import { equitableAssignerMutationPayloadFromForm } from "@/lib/assigners/equitableAssigners";
import { messageFromError } from "@/lib/errors/convexError";
import { randomClientId } from "@/lib/optimistic";

type CreateEquitableAssignerArgs = {
  classId: Id<"classes">;
  values: EquitableAssignerFormValues;
};

export function useCreateEquitableAssigner() {
  const { t } = useTranslation("assigners");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.equitableAssigners.create);

  return useOptimisticMutation({
    mutationFn: (args: CreateEquitableAssignerArgs) => {
      const payload = equitableAssignerMutationPayloadFromForm(args.values);
      return mutationFn({
        classId: args.classId,
        ...payload,
      });
    },
    queryKeys: (args) => [equitableAssignersListQueryKey(args.classId)],
    applyOptimisticUpdate: (queryClient, args) => {
      const key = equitableAssignersListQueryKey(args.classId);
      const payload = equitableAssignerMutationPayloadFromForm(args.values);
      const now = Date.now();
      const optimisticId = `optimistic:${randomClientId()}` as Id<"equitableAssigners">;

      queryClient.setQueryData<EquitableAssignerList>(key, (old) => {
        const next = {
          _id: optimisticId,
          _creationTime: now,
          name: payload.name,
          items: payload.items,
          defaultBalanceGender: payload.defaultBalanceGender,
          defaultScope: payload.defaultScope,
          defaultGenderBuckets: payload.defaultGenderBuckets,
          createdBy: `optimistic:${randomClientId()}` as Id<"users">,
          createdAt: now,
          updatedAt: now,
          runCount: 0,
          latestRunId: null,
          latestRunAt: null,
        };
        if (!old) return [next];
        return [...old, next];
      });
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("equitableSaveFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
