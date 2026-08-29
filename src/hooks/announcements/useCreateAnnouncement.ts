import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { announcementsListQueryKey } from "@/hooks/announcements/useAnnouncements";
import {
  recentAnnouncementsQueryKey,
  DASHBOARD_ANNOUNCEMENT_LIMIT,
} from "@/hooks/announcements/useRecentAnnouncements";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import type { AnnouncementList, RecentAnnouncementList } from "@/lib/announcements/announcements";
import { EMPTY_ANNOUNCEMENT_BODY_JSON } from "@/lib/announcements/tiptapExtensions";
import { messageFromError } from "@/lib/errors/convexError";
import { randomClientId } from "@/lib/optimistic";

type CreateAnnouncementArgs = {
  classId: Id<"classes">;
  title: string;
  bodyJson: string;
  attachmentFileIds?: Array<Id<"files">>;
  isPublic?: boolean;
};

export function useCreateAnnouncement() {
  const { t } = useTranslation("announcements");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.announcements.create);

  return useOptimisticMutation({
    mutationFn: (args: CreateAnnouncementArgs) => mutationFn(args),
    queryKeys: (args) => [
      announcementsListQueryKey(args.classId),
      recentAnnouncementsQueryKey(args.classId),
    ],
    applyOptimisticUpdate: (queryClient, args) => {
      const queryKey = announcementsListQueryKey(args.classId);
      const now = Date.now();
      const optimisticId = `optimistic:${randomClientId()}` as Id<"announcements">;
      const attachmentFileIds = args.attachmentFileIds ?? [];
      queryClient.setQueryData<AnnouncementList>(queryKey, (old) => {
        const next: AnnouncementList[number] = {
          _id: optimisticId,
          _creationTime: now,
          classId: args.classId,
          authorId: `optimistic:${randomClientId()}` as Id<"users">,
          title: args.title,
          bodyJson: args.bodyJson || EMPTY_ANNOUNCEMENT_BODY_JSON,
          isPublic: args.isPublic === true,
          publicSlug: undefined,
          attachmentFileIds,
          attachments: attachmentFileIds.map((fileId) => ({
            fileId,
            name: "",
            contentType: "application/octet-stream",
            size: 0,
            preset: "documents",
          })),
          createdAt: now,
          updatedAt: now,
        };
        if (!old) return [next];
        return [next, ...old];
      });

      const recentKey = recentAnnouncementsQueryKey(args.classId);
      queryClient.setQueryData<RecentAnnouncementList>(recentKey, (old) => {
        const summary: RecentAnnouncementList[number] = {
          _id: optimisticId,
          title: args.title,
          createdAt: now,
          updatedAt: now,
        };
        if (!old) return [summary];
        return [summary, ...old].slice(0, DASHBOARD_ANNOUNCEMENT_LIMIT);
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
