import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { groupsBoardQueryKey } from "@/hooks/groups/useGroupsBoard";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import { messageFromError } from "@/lib/errors/convexError";
import { clearGroupStudentsOnBoard, type GroupsBoard } from "@/lib/groups/groups";

type ClearGroupStudentsArgs = {
  classId: Id<"classes">;
  groupId: Id<"groups">;
};

export function useClearGroupStudents() {
  const { t } = useTranslation("classes");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.groups.clearGroupStudents);

  return useOptimisticMutation({
    mutationFn: (args: ClearGroupStudentsArgs) =>
      mutationFn({
        classId: args.classId,
        groupId: args.groupId,
      }),
    queryKeys: (args) => [groupsBoardQueryKey(args.classId)],
    applyOptimisticUpdate: (queryClient, args) => {
      const queryKey = groupsBoardQueryKey(args.classId);
      queryClient.setQueryData<GroupsBoard>(queryKey, (old) => {
        if (!old) return old;
        return clearGroupStudentsOnBoard(old, args.groupId);
      });
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("groupsClearStudentsFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
