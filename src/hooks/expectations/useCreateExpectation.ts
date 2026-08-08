import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { expectationsListQueryKey } from "@/hooks/expectations/useExpectations";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import type { ExpectationInputType, ExpectationList } from "@/lib/expectations/expectations";
import { messageFromError } from "@/lib/errors/convexError";
import { randomClientId } from "@/lib/optimistic";

type CreateExpectationArgs = {
  classId: Id<"classes">;
  name: string;
  description?: string;
  inputType: ExpectationInputType;
  unit: string;
};

export function useCreateExpectation() {
  const { t } = useTranslation("expectations");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.expectations.create);

  return useOptimisticMutation({
    mutationFn: (args: CreateExpectationArgs) => mutationFn(args),
    queryKeys: (args) => [expectationsListQueryKey(args.classId)],
    applyOptimisticUpdate: (queryClient, args) => {
      const key = expectationsListQueryKey(args.classId);
      const now = Date.now();
      const optimisticId = `optimistic:${randomClientId()}` as Id<"expectations">;

      queryClient.setQueryData<ExpectationList>(key, (old) => {
        const next: ExpectationList[number] = {
          _id: optimisticId,
          _creationTime: now,
          classId: args.classId,
          name: args.name,
          description: args.description,
          inputType: args.inputType,
          unit: args.unit,
          createdBy: `optimistic:${randomClientId()}` as Id<"users">,
          createdAt: now,
          updatedAt: now,
          valueCount: 0,
        };
        if (!old) return [next];
        return [...old, next].sort((a, b) => a.name.localeCompare(b.name));
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
