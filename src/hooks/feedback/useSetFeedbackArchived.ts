import { useConvexMutation } from "@convex-dev/react-query";
import type { FunctionReturnType } from "convex/server";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import {
  feedbackAdminListQueryKey,
  type FeedbackAdminListArgs,
} from "@/hooks/feedback/useFeedbackAdminList";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import { messageFromError } from "@/lib/errors/convexError";

type FeedbackListItem = FunctionReturnType<typeof api.feedback.list>[number];

type SetArchivedArgs = {
  feedbackId: Id<"feedback">;
  archived: boolean;
};

export function useSetFeedbackArchived(listArgs: FeedbackAdminListArgs) {
  const { t } = useTranslation("feedback");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.feedback.setArchived);
  const activeKey = feedbackAdminListQueryKey({ archived: false });
  const archivedKey = feedbackAdminListQueryKey({ archived: true });
  const currentKey = feedbackAdminListQueryKey(listArgs);

  return useOptimisticMutation({
    mutationFn: (args: SetArchivedArgs) => mutationFn(args),
    queryKeys: [activeKey, archivedKey],
    applyOptimisticUpdate: (queryClient, args) => {
      const removeFrom = args.archived ? activeKey : archivedKey;
      const addTo = args.archived ? archivedKey : activeKey;

      let moved: FeedbackListItem | undefined;
      queryClient.setQueryData<FeedbackListItem[]>(removeFrom, (old) => {
        if (!old) return old;
        const next = old.filter((row) => {
          if (row._id !== args.feedbackId) return true;
          moved = row;
          return false;
        });
        return next;
      });

      if (!moved) {
        queryClient.setQueryData<FeedbackListItem[]>(currentKey, (old) =>
          old?.filter((row) => row._id !== args.feedbackId),
        );
        return;
      }

      const nextRow: FeedbackListItem = {
        ...moved,
        archivedAt: args.archived ? Date.now() : undefined,
      };
      queryClient.setQueryData<FeedbackListItem[]>(addTo, (old) =>
        old ? [nextRow, ...old.filter((row) => row._id !== args.feedbackId)] : [nextRow],
      );
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("archiveFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
