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
  ExpectationList,
  ExpectationValue,
  ExpectationValueList,
} from "@/lib/expectations/expectations";
import { messageFromError } from "@/lib/errors/convexError";
import { randomClientId } from "@/lib/optimistic";

type UpsertExpectationValueArgs = {
  classId: Id<"classes">;
  expectationId: Id<"expectations">;
  studentUserId: Id<"users">;
  numberValue?: number;
  rangeMin?: number;
  rangeMax?: number;
  clear?: boolean;
};

function patchValueList(
  old: ExpectationValueList | undefined,
  args: UpsertExpectationValueArgs,
  now: number,
): ExpectationValueList | undefined {
  if (!old) return old;
  const index = old.findIndex(
    (row) => row.expectationId === args.expectationId && row.studentUserId === args.studentUserId,
  );
  if (args.clear) {
    if (index < 0) return old;
    return old.filter((_, i) => i !== index);
  }

  const next: ExpectationValue = {
    _id:
      index >= 0 ? old[index]!._id : (`optimistic:${randomClientId()}` as Id<"expectationValues">),
    _creationTime: index >= 0 ? old[index]!._creationTime : now,
    classId: args.classId,
    expectationId: args.expectationId,
    studentUserId: args.studentUserId,
    numberValue: args.numberValue,
    rangeMin: args.rangeMin,
    rangeMax: args.rangeMax,
    updatedAt: now,
    updatedBy: `optimistic:${randomClientId()}` as Id<"users">,
  };

  if (index < 0) return [...old, next];
  const copy = [...old];
  copy[index] = next;
  return copy;
}

export function useUpsertExpectationValue() {
  const { t } = useTranslation("expectations");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.expectations.upsertValue);

  return useOptimisticMutation({
    mutationFn: (args: UpsertExpectationValueArgs) => mutationFn(args),
    queryKeys: (args) => [
      expectationsListQueryKey(args.classId),
      expectationDetailQueryKey(args.classId, args.expectationId),
      expectationValuesQueryKey(args.classId),
      expectationValuesForExpectationQueryKey(args.classId, args.expectationId),
    ],
    applyOptimisticUpdate: (queryClient, args) => {
      const now = Date.now();
      const valuesKey = expectationValuesQueryKey(args.classId);
      const forExpectationKey = expectationValuesForExpectationQueryKey(
        args.classId,
        args.expectationId,
      );
      const before = queryClient.getQueryData<ExpectationValueList>(valuesKey);
      const existed =
        before?.some(
          (row) =>
            row.expectationId === args.expectationId && row.studentUserId === args.studentUserId,
        ) ?? false;

      queryClient.setQueryData<ExpectationValueList>(valuesKey, (old) =>
        patchValueList(old, args, now),
      );
      queryClient.setQueryData<ExpectationValueList>(forExpectationKey, (old) =>
        patchValueList(old, args, now),
      );

      const delta = args.clear ? (existed ? -1 : 0) : existed ? 0 : 1;
      if (delta !== 0) {
        queryClient.setQueryData<ExpectationList>(expectationsListQueryKey(args.classId), (old) =>
          old
            ? old.map((item) =>
                item._id === args.expectationId
                  ? { ...item, valueCount: Math.max(0, item.valueCount + delta) }
                  : item,
              )
            : old,
        );
        queryClient.setQueryData<ExpectationDetail | null>(
          expectationDetailQueryKey(args.classId, args.expectationId),
          (old) => (old ? { ...old, valueCount: Math.max(0, old.valueCount + delta) } : old),
        );
      }
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("valueSaveFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
