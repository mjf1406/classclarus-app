import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { announcementDetailQueryKey } from "@/hooks/announcements/useAnnouncement";
import { announcementsListQueryKey } from "@/hooks/announcements/useAnnouncements";
import { recentAnnouncementsQueryKey } from "@/hooks/announcements/useRecentAnnouncements";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import type {
  Announcement,
  AnnouncementList,
  RecentAnnouncementList,
} from "@/lib/announcements/announcements";
import { messageFromError } from "@/lib/errors/convexError";

type UpdateAnnouncementArgs = {
  classId: Id<"classes">;
  announcementId: Id<"announcements">;
  title: string;
  bodyJson: string;
  attachmentFileIds?: Array<Id<"files">>;
};

export function useUpdateAnnouncement() {
  const { t } = useTranslation("announcements");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.announcements.update);

  return useOptimisticMutation({
    mutationFn: (args: UpdateAnnouncementArgs) => mutationFn(args),
    queryKeys: (args) => [
      announcementsListQueryKey(args.classId),
      recentAnnouncementsQueryKey(args.classId),
      announcementDetailQueryKey(args.classId, args.announcementId),
    ],
    applyOptimisticUpdate: (queryClient, args) => {
      const now = Date.now();
      const listKey = announcementsListQueryKey(args.classId);
      const detailKey = announcementDetailQueryKey(args.classId, args.announcementId);

      queryClient.setQueryData<AnnouncementList>(listKey, (old) => {
        if (!old) return old;
        return old.map((item) =>
          item._id === args.announcementId
            ? {
                ...item,
                title: args.title,
                bodyJson: args.bodyJson,
                attachmentFileIds: args.attachmentFileIds ?? item.attachmentFileIds,
                updatedAt: now,
              }
            : item,
        );
      });

      queryClient.setQueryData<Announcement | null>(detailKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          title: args.title,
          bodyJson: args.bodyJson,
          attachmentFileIds: args.attachmentFileIds ?? old.attachmentFileIds,
          updatedAt: now,
        };
      });

      const recentKey = recentAnnouncementsQueryKey(args.classId);
      queryClient.setQueryData<RecentAnnouncementList>(recentKey, (old) => {
        if (!old) return old;
        return old.map((item) =>
          item._id === args.announcementId ? { ...item, title: args.title, updatedAt: now } : item,
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
