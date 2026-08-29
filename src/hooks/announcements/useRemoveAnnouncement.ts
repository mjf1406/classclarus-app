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

type RemoveAnnouncementArgs = {
  classId: Id<"classes">;
  announcementId: Id<"announcements">;
};

export function useRemoveAnnouncement() {
  const { t } = useTranslation("announcements");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.announcements.remove);

  return useOptimisticMutation({
    mutationFn: (args: RemoveAnnouncementArgs) => mutationFn(args),
    queryKeys: (args) => [
      announcementsListQueryKey(args.classId),
      recentAnnouncementsQueryKey(args.classId),
      announcementDetailQueryKey(args.classId, args.announcementId),
    ],
    applyOptimisticUpdate: (queryClient, args) => {
      const listKey = announcementsListQueryKey(args.classId);
      const detailKey = announcementDetailQueryKey(args.classId, args.announcementId);
      queryClient.setQueryData<AnnouncementList>(listKey, (old) => {
        if (!old) return old;
        return old.filter((item) => item._id !== args.announcementId);
      });
      queryClient.setQueryData<Announcement | null>(detailKey, () => null);

      const recentKey = recentAnnouncementsQueryKey(args.classId);
      queryClient.setQueryData<RecentAnnouncementList>(recentKey, (old) => {
        if (!old) return old;
        return old.filter((item) => item._id !== args.announcementId);
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
