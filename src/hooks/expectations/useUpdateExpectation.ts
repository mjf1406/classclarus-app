import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { expectationDetailQueryKey } from "@/hooks/expectations/useExpectation";
import { expectationsListQueryKey } from "@/hooks/expectations/useExpectations";
import { expectationValuesQueryKey } from "@/hooks/expectations/useExpectationValues";
import { expectationValuesForExpectationQueryKey } from "@/hooks/expectations/useExpectationValuesForExpectation";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import type {
  ExpectationDetail,
  ExpectationInputType,
  ExpectationList,
  ExpectationValueList,
} from "@/lib/expectations/expectations";
import { messageFromError } from "@/lib/errors/convexError";

type UpdateExpectationArgs = {
  classId: Id<"classes">;
  expectationId: Id<"expectations">;
  name: string;
  description?: string;
  inputType: ExpectationInputType;
  unit: string;
};

export function useUpdateExpectation() {
  const { t } = useTranslation("expectations");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.expectations.update);

  return useOptimisticMutation({
    mutationFn: (args: UpdateExpectationArgs) => mutationFn(args),
    queryKeys: (args) => [
      expectationsListQueryKey(args.classId),
      expectationDetailQueryKey(args.classId, args.expectationId),
      expectationValuesQueryKey(args.classId),
      expectationValuesForExpectationQueryKey(args.classId, args.expectationId),
    ],
    applyOptimisticUpdate: (queryClient, args) => {
      const listKey = expectationsListQueryKey(args.classId);
      const detailKey = expectationDetailQueryKey(args.classId, args.expectationId);
      const previous = queryClient.getQueryData<ExpectationList>(listKey);
      const previousItem = previous?.find((item) => item._id === args.expectationId);
      const inputTypeChanged = previousItem != null && previousItem.inputType !== args.inputType;
      const now = Date.now();

      queryClient.setQueryData<ExpectationList>(listKey, (old) => {
        if (!old) return old;
        return old
          .map((item) =>
            item._id === args.expectationId
              ? {
                  ...item,
                  name: args.name,
                  description: args.description,
                  inputType: args.inputType,
                  unit: args.unit,
                  updatedAt: now,
                  valueCount: inputTypeChanged ? 0 : item.valueCount,
                }
              : item,
          )
          .sort((a, b) => a.name.localeCompare(b.name));
      });

      queryClient.setQueryData<ExpectationDetail | null>(detailKey, (old) =>
        old
          ? {
              ...old,
              name: args.name,
              description: args.description,
              inputType: args.inputType,
              unit: args.unit,
              updatedAt: now,
              valueCount: inputTypeChanged ? 0 : old.valueCount,
            }
          : old,
      );

      if (inputTypeChanged) {
        queryClient.setQueryData<ExpectationValueList>(
          expectationValuesQueryKey(args.classId),
          (old) => (old ? old.filter((row) => row.expectationId !== args.expectationId) : old),
        );
        queryClient.setQueryData<ExpectationValueList>(
          expectationValuesForExpectationQueryKey(args.classId, args.expectationId),
          () => [],
        );
      }
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("saveFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
