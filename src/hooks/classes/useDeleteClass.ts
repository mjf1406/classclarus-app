import { useConvexMutation } from "@convex-dev/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { classDetailQueryKey } from "@/hooks/classes/useClass";
import { classDeletionJobsQueryKey } from "@/hooks/classes/useClassDeletionJobs";
import { classesListQueryKey } from "@/hooks/classes/useClasses";
import { ownedClassesQueryKey } from "@/hooks/classes/useOwnedClasses";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import { accountDeletionBlockersQueryKey } from "@/hooks/user/useAccountDeletionBlockers";
import type { ClassPublic } from "@/lib/classes/classes";
import { messageFromError } from "@/lib/errors/convexError";
import { removeById } from "@/lib/optimistic";

type ClassDoc = Doc<"classes">;

type DeleteClassArgs = {
  classId: Id<"classes">;
  confirmation: string;
};

function removeClassScopedQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  classId: Id<"classes">,
) {
  const classIdLiteral = classId as string;
  queryClient.removeQueries({
    predicate: (query) => JSON.stringify(query.queryKey).includes(classIdLiteral),
  });
}

export function useDeleteClass() {
  const { t } = useTranslation("classes");
  const { t: tCommon } = useTranslation("common");
  const queryClient = useQueryClient();
  const mutationFn = useConvexMutation(api.classes.remove);
  const listKey = classesListQueryKey();
  const ownedKey = ownedClassesQueryKey();
  const jobsKey = classDeletionJobsQueryKey();
  const blockersKey = accountDeletionBlockersQueryKey();

  return useOptimisticMutation({
    mutationFn: (args: DeleteClassArgs) => mutationFn(args),
    queryKeys: (args) => [listKey, ownedKey, classDetailQueryKey(args.classId), jobsKey],
    applyOptimisticUpdate: (client, args) => {
      const detailKey = classDetailQueryKey(args.classId);
      client.setQueryData<ClassPublic[]>(listKey, (old) =>
        old ? removeById(old, args.classId) : old,
      );
      client.setQueryData<ClassDoc[]>(ownedKey, (old) =>
        old ? removeById(old, args.classId) : old,
      );
      client.setQueryData<ClassDoc | null>(detailKey, null);
    },
    invalidateQueryKeys: [blockersKey],
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("deleteFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
    onSettled: (_data, error, variables) => {
      if (!error) {
        removeClassScopedQueries(queryClient, variables.classId);
      }
    },
  });
}
