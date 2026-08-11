import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { gradeScalesListQueryKey } from "@/hooks/gradeScales/useGradeScales";
import type { GradeScaleList } from "@/hooks/gradeScales/useGradeScales";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import { messageFromError } from "@/lib/errors/convexError";

type RemoveGradeScaleArgs = {
  classId: Id<"classes">;
  gradeScaleId: Id<"gradeScales">;
};

export function useRemoveGradeScale() {
  const { t } = useTranslation("studentWork");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.gradeScales.remove);

  return useOptimisticMutation({
    mutationFn: (args: RemoveGradeScaleArgs) => mutationFn(args),
    queryKeys: (args) => [gradeScalesListQueryKey(args.classId)],
    applyOptimisticUpdate: (queryClient, args) => {
      const key = gradeScalesListQueryKey(args.classId);
      queryClient.setQueryData<GradeScaleList>(key, (old) => {
        if (!old) return old;
        return old.filter((scale) => scale._id !== args.gradeScaleId);
      });
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("deleteFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
