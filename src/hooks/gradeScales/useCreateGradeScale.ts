import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { gradeScalesListQueryKey } from "@/hooks/gradeScales/useGradeScales";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import type { GradeScaleFormLevel } from "@/lib/gradeScales/gradeScales";
import type { GradeScaleList } from "@/hooks/gradeScales/useGradeScales";
import { messageFromError } from "@/lib/errors/convexError";
import { randomClientId } from "@/lib/optimistic";

type CreateGradeScaleArgs = {
  classId: Id<"classes">;
  name: string;
  levels: GradeScaleFormLevel[];
};

export function useCreateGradeScale() {
  const { t } = useTranslation("studentWork");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.gradeScales.create);

  return useOptimisticMutation({
    mutationFn: (args: CreateGradeScaleArgs) => mutationFn(args),
    queryKeys: (args) => [gradeScalesListQueryKey(args.classId)],
    applyOptimisticUpdate: (queryClient, args) => {
      const key = gradeScalesListQueryKey(args.classId);
      const now = Date.now();
      const optimisticId = `optimistic:${randomClientId()}` as Id<"gradeScales">;
      const normalizedLevels = args.levels.map((level, index) => ({
        key: level.key?.trim() || `level-${index}`,
        label: level.label.trim(),
        minPercent: Math.round(level.minPercent),
        maxPercent: Math.round(level.maxPercent),
      }));

      queryClient.setQueryData<GradeScaleList>(key, (old) => {
        const next = {
          _id: optimisticId,
          _creationTime: now,
          isSystem: false,
          isHidden: false,
          name: args.name.trim(),
          levels: normalizedLevels,
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
        title: messageFromError(error, t("saveFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
