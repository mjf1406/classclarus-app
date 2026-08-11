import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import {
  randomAssignerDetailQueryKey,
  randomAssignersListQueryKey,
  type RandomAssignerList,
} from "@/hooks/assigners/random/useRandomAssigners";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import type { RandomAssignerFormValues } from "@/lib/assigners/randomAssigners";
import { randomAssignerMutationPayloadFromForm } from "@/lib/assigners/randomAssigners";
import { messageFromError } from "@/lib/errors/convexError";

type UpdateRandomAssignerArgs = {
  classId: Id<"classes">;
  assignerId: Id<"randomAssigners">;
  values: RandomAssignerFormValues;
};

export function useUpdateRandomAssigner() {
  const { t } = useTranslation("assigners");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.randomAssigners.update);

  return useOptimisticMutation({
    mutationFn: (args: UpdateRandomAssignerArgs) => {
      const payload = randomAssignerMutationPayloadFromForm(args.values);
      return mutationFn({
        classId: args.classId,
        assignerId: args.assignerId,
        ...payload,
      });
    },
    queryKeys: (args) => [
      randomAssignersListQueryKey(args.classId),
      randomAssignerDetailQueryKey(args.classId, args.assignerId),
    ],
    applyOptimisticUpdate: (queryClient, args) => {
      const payload = randomAssignerMutationPayloadFromForm(args.values);
      const now = Date.now();

      queryClient.setQueryData<RandomAssignerList>(
        randomAssignersListQueryKey(args.classId),
        (old) => {
          if (!old) return old;
          return old.map((row) =>
            row._id === args.assignerId
              ? {
                  ...row,
                  name: payload.name,
                  items: payload.items,
                  defaultReplicates: payload.defaultReplicates,
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
        title: messageFromError(error, t("randomSaveFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
