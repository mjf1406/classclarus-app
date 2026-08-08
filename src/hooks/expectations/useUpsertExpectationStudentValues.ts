import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { expectationsListQueryKey } from "@/hooks/expectations/useExpectations";
import { expectationValuesQueryKey } from "@/hooks/expectations/useExpectationValues";
import { expectationValuesForExpectationQueryKey } from "@/hooks/expectations/useExpectationValuesForExpectation";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import type {
  ExpectationList,
  ExpectationValue,
  ExpectationValueDraft,
  ExpectationValueList,
} from "@/lib/expectations/expectations";
import { messageFromError } from "@/lib/errors/convexError";
import { randomClientId } from "@/lib/optimistic";

type UpsertExpectationStudentValuesArgs = {
  classId: Id<"classes">;
  studentUserId: Id<"users">;
  values: ExpectationValueDraft[];
};

export function useUpsertExpectationStudentValues() {
  const { t } = useTranslation("expectations");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.expectations.upsertStudentValues);

  return useOptimisticMutation({
    mutationFn: (args: UpsertExpectationStudentValuesArgs) => mutationFn(args),
    queryKeys: (args) => [
      expectationsListQueryKey(args.classId),
      expectationValuesQueryKey(args.classId),
      ...args.values.map((entry) =>
        expectationValuesForExpectationQueryKey(args.classId, entry.expectationId),
      ),
    ],
    applyOptimisticUpdate: (queryClient, args) => {
      const now = Date.now();
      const valuesKey = expectationValuesQueryKey(args.classId);
      const before = queryClient.getQueryData<ExpectationValueList>(valuesKey) ?? [];
      const countDeltas = new Map<Id<"expectations">, number>();

      let next = [...before];
      for (const entry of args.values) {
        const index = next.findIndex(
          (row) =>
            row.expectationId === entry.expectationId && row.studentUserId === args.studentUserId,
        );
        const existed = index >= 0;
        const forExpectationKey = expectationValuesForExpectationQueryKey(
          args.classId,
          entry.expectationId,
        );

        if (entry.clear) {
          if (existed) {
            next = next.filter((_, i) => i !== index);
            countDeltas.set(entry.expectationId, (countDeltas.get(entry.expectationId) ?? 0) - 1);
          }
          queryClient.setQueryData<ExpectationValueList>(forExpectationKey, (old) =>
            old ? old.filter((row) => row.studentUserId !== args.studentUserId) : old,
          );
          continue;
        }

        const row: ExpectationValue = {
          _id:
            index >= 0
              ? next[index]!._id
              : (`optimistic:${randomClientId()}` as Id<"expectationValues">),
          _creationTime: index >= 0 ? next[index]!._creationTime : now,
          classId: args.classId,
          expectationId: entry.expectationId,
          studentUserId: args.studentUserId,
          numberValue: entry.numberValue,
          rangeMin: entry.rangeMin,
          rangeMax: entry.rangeMax,
          updatedAt: now,
          updatedBy: `optimistic:${randomClientId()}` as Id<"users">,
        };
        if (index < 0) {
          next.push(row);
          countDeltas.set(entry.expectationId, (countDeltas.get(entry.expectationId) ?? 0) + 1);
        } else {
          next[index] = row;
        }

        queryClient.setQueryData<ExpectationValueList>(forExpectationKey, (old) => {
          if (!old) return [row];
          const existingIndex = old.findIndex((item) => item.studentUserId === args.studentUserId);
          if (existingIndex < 0) return [...old, row];
          const copy = [...old];
          copy[existingIndex] = row;
          return copy;
        });
      }

      queryClient.setQueryData<ExpectationValueList>(valuesKey, next);
      if (countDeltas.size > 0) {
        queryClient.setQueryData<ExpectationList>(expectationsListQueryKey(args.classId), (old) =>
          old
            ? old.map((item) => {
                const delta = countDeltas.get(item._id);
                if (!delta) return item;
                return { ...item, valueCount: Math.max(0, item.valueCount + delta) };
              })
            : old,
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
