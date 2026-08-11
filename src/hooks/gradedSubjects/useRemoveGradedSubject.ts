import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import {
  gradedSubjectsListQueryKey,
  type GradedSubjectList,
} from "@/hooks/gradedSubjects/useGradedSubjects";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import { messageFromError } from "@/lib/errors/convexError";

type RemoveGradedSubjectArgs = {
  classId: Id<"classes">;
  gradedSubjectId: Id<"gradedSubjects">;
};

export function useRemoveGradedSubject() {
  const { t } = useTranslation("studentWork");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.gradedSubjects.remove);

  return useOptimisticMutation({
    mutationFn: (args: RemoveGradedSubjectArgs) => mutationFn(args),
    queryKeys: (args) => [gradedSubjectsListQueryKey(args.classId)],
    applyOptimisticUpdate: (queryClient, args) => {
      const key = gradedSubjectsListQueryKey(args.classId);
      queryClient.setQueryData<GradedSubjectList>(key, (old) => {
        if (!old) return old;
        return old.filter((subject) => subject._id !== args.gradedSubjectId);
      });
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("subjectDeleteFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
