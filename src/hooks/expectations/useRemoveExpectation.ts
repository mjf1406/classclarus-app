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
import type { ExpectationList, ExpectationValueList } from "@/lib/expectations/expectations";
import { messageFromError } from "@/lib/errors/convexError";

type RemoveExpectationArgs = {
  classId: Id<"classes">;
  expectationId: Id<"expectations">;
};

export function useRemoveExpectation() {
  const { t } = useTranslation("expectations");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.expectations.remove);

  return useOptimisticMutation({
    mutationFn: (args: RemoveExpectationArgs) => mutationFn(args),
    queryKeys: (args) => [
      expectationsListQueryKey(args.classId),
      expectationDetailQueryKey(args.classId, args.expectationId),
      expectationValuesQueryKey(args.classId),
      expectationValuesForExpectationQueryKey(args.classId, args.expectationId),
    ],
    applyOptimisticUpdate: (queryClient, args) => {
      queryClient.setQueryData<ExpectationList>(expectationsListQueryKey(args.classId), (old) =>
        old ? old.filter((item) => item._id !== args.expectationId) : old,
      );
      queryClient.setQueryData(expectationDetailQueryKey(args.classId, args.expectationId), null);
      queryClient.setQueryData<ExpectationValueList>(
        expectationValuesQueryKey(args.classId),
        (old) => (old ? old.filter((row) => row.expectationId !== args.expectationId) : old),
      );
      queryClient.setQueryData<ExpectationValueList>(
        expectationValuesForExpectationQueryKey(args.classId, args.expectationId),
        () => [],
      );
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("deleteFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
