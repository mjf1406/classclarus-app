import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { classDeletionJobsQueryKey } from "@/hooks/classes/useClassDeletionJobs";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import { messageFromError } from "@/lib/errors/convexError";

type RetryClassDeletionArgs = {
  jobId: Id<"classDeletionJobs">;
};

export function useRetryClassDeletion() {
  const { t } = useTranslation("classes");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.classDeletion.retry);
  const jobsKey = classDeletionJobsQueryKey();

  return useOptimisticMutation({
    mutationFn: (args: RetryClassDeletionArgs) => mutationFn(args),
    queryKeys: [jobsKey],
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("deleteFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
