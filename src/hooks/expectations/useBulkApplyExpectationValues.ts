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
import type { ExpectationBulkOperation } from "@/lib/expectations/expectations";
import { messageFromError } from "@/lib/errors/convexError";

type BulkApplyExpectationValuesArgs = {
  classId: Id<"classes">;
  expectationId: Id<"expectations">;
  operation: ExpectationBulkOperation;
  numberValue?: number;
  rangeMin?: number;
  rangeMax?: number;
};

/**
 * Bulk column ops need a full student roster rewrite server-side.
 * Invalidate on settle; skip optimistic value rewriting (too easy to get wrong for %).
 */
export function useBulkApplyExpectationValues() {
  const { t } = useTranslation("expectations");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.expectations.bulkApply);

  return useOptimisticMutation({
    mutationFn: (args: BulkApplyExpectationValuesArgs) => mutationFn(args),
    queryKeys: (args) => [
      expectationsListQueryKey(args.classId),
      expectationDetailQueryKey(args.classId, args.expectationId),
      expectationValuesQueryKey(args.classId),
      expectationValuesForExpectationQueryKey(args.classId, args.expectationId),
    ],
    applyOptimisticUpdate: () => {
      // No optimistic rewrite — wait for invalidate/reconcile.
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("bulkFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
