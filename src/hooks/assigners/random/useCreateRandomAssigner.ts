import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import {
  randomAssignersListQueryKey,
  type RandomAssignerList,
} from "@/hooks/assigners/random/useRandomAssigners";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import type { RandomAssignerFormValues } from "@/lib/assigners/randomAssigners";
import { randomAssignerMutationPayloadFromForm } from "@/lib/assigners/randomAssigners";
import { messageFromError } from "@/lib/errors/convexError";
import { randomClientId } from "@/lib/optimistic";

type CreateRandomAssignerArgs = {
  classId: Id<"classes">;
  values: RandomAssignerFormValues;
};

export function useCreateRandomAssigner() {
  const { t } = useTranslation("assigners");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.randomAssigners.create);

  return useOptimisticMutation({
    mutationFn: (args: CreateRandomAssignerArgs) => {
      const payload = randomAssignerMutationPayloadFromForm(args.values);
      return mutationFn({
        classId: args.classId,
        ...payload,
      });
    },
    queryKeys: (args) => [randomAssignersListQueryKey(args.classId)],
    applyOptimisticUpdate: (queryClient, args) => {
      const key = randomAssignersListQueryKey(args.classId);
      const payload = randomAssignerMutationPayloadFromForm(args.values);
      const now = Date.now();
      const optimisticId = `optimistic:${randomClientId()}` as Id<"randomAssigners">;

      queryClient.setQueryData<RandomAssignerList>(key, (old) => {
        const next = {
          _id: optimisticId,
          _creationTime: now,
          name: payload.name,
          items: payload.items,
          defaultReplicates: payload.defaultReplicates,
          defaultScope: payload.defaultScope,
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
        title: messageFromError(error, t("randomSaveFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
