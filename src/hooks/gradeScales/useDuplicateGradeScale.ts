import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { gradeScalesListQueryKey } from "@/hooks/gradeScales/useGradeScales";
import type { GradeScaleList } from "@/hooks/gradeScales/useGradeScales";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import { messageFromError } from "@/lib/errors/convexError";
import { randomClientId } from "@/lib/optimistic";

type DuplicateGradeScaleArgs = {
  classId: Id<"classes">;
  gradeScaleId: Id<"gradeScales">;
  name: string;
};

export function useDuplicateGradeScale() {
  const { t } = useTranslation("studentWork");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.gradeScales.duplicate);

  return useOptimisticMutation({
    mutationFn: (args: DuplicateGradeScaleArgs) => mutationFn(args),
    queryKeys: (args) => [gradeScalesListQueryKey(args.classId)],
    applyOptimisticUpdate: (queryClient, args) => {
      const key = gradeScalesListQueryKey(args.classId);
      const now = Date.now();
      const optimisticId = `optimistic:${randomClientId()}` as Id<"gradeScales">;

      queryClient.setQueryData<GradeScaleList>(key, (old) => {
        const source = old?.find((scale) => scale._id === args.gradeScaleId);
        if (!source) return old;
        const next = {
          _id: optimisticId,
          _creationTime: now,
          isSystem: false,
          isHidden: false,
          name: args.name.trim(),
          levels: source.levels.map((level) => ({ ...level })),
          createdBy: `optimistic:${randomClientId()}` as Id<"users">,
          createdAt: now,
          updatedAt: now,
        };
        if (!old) return [next];
        return [...old, next];
      });
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("duplicateFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
