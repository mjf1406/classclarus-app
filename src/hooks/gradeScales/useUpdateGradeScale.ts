import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { gradeScalesListQueryKey } from "@/hooks/gradeScales/useGradeScales";
import type { GradeScaleList } from "@/hooks/gradeScales/useGradeScales";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import type { GradeScaleFormLevel } from "@/lib/gradeScales/gradeScales";
import { messageFromError } from "@/lib/errors/convexError";

type UpdateGradeScaleArgs = {
  classId: Id<"classes">;
  gradeScaleId: Id<"gradeScales">;
  name: string;
  levels: GradeScaleFormLevel[];
};

export function useUpdateGradeScale() {
  const { t } = useTranslation("studentWork");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.gradeScales.update);

  return useOptimisticMutation({
    mutationFn: (args: UpdateGradeScaleArgs) => mutationFn(args),
    queryKeys: (args) => [gradeScalesListQueryKey(args.classId)],
    applyOptimisticUpdate: (queryClient, args) => {
      const key = gradeScalesListQueryKey(args.classId);
      const now = Date.now();
      const normalizedLevels = args.levels.map((level, index) => ({
        key: level.key?.trim() || `level-${index}`,
        label: level.label.trim(),
        minPercent: Math.round(level.minPercent),
        maxPercent: Math.round(level.maxPercent),
      }));

      queryClient.setQueryData<GradeScaleList>(key, (old) => {
        if (!old) return old;
        return old.map((scale) =>
          scale._id === args.gradeScaleId
            ? {
                ...scale,
                name: args.name.trim(),
                levels: normalizedLevels,
                updatedAt: now,
              }
            : scale,
        );
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
