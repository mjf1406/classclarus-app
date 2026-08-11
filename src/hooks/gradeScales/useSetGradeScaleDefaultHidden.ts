import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { gradeScalesListQueryKey } from "@/hooks/gradeScales/useGradeScales";
import type { GradeScaleList } from "@/hooks/gradeScales/useGradeScales";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import type { GradeScaleSystemKey } from "@/lib/gradeScales/gradeScales";
import { messageFromError } from "@/lib/errors/convexError";

type SetSystemDefaultHiddenArgs = {
  classId: Id<"classes">;
  systemKey: GradeScaleSystemKey;
  hidden: boolean;
};

export function useSetGradeScaleDefaultHidden() {
  const { t } = useTranslation("studentWork");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.gradeScales.setSystemDefaultHidden);

  return useOptimisticMutation({
    mutationFn: (args: SetSystemDefaultHiddenArgs) => mutationFn(args),
    queryKeys: (args) => [gradeScalesListQueryKey(args.classId)],
    applyOptimisticUpdate: (queryClient, args) => {
      const key = gradeScalesListQueryKey(args.classId);
      queryClient.setQueryData<GradeScaleList>(key, (old) => {
        if (!old) return old;
        return old.map((scale) =>
          scale.isSystem && scale.systemKey === args.systemKey
            ? { ...scale, isHidden: args.hidden }
            : scale,
        );
      });
    },
    onError: (error, args) => {
      toast.add({
        title: messageFromError(
          error,
          args.hidden ? t("hideDefaultFailed") : t("showDefaultFailed"),
          tCommon("rateLimited"),
        ),
        type: "error",
      });
    },
  });
}
