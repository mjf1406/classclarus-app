import { useConvexMutation } from "@convex-dev/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { announcementDetailQueryKey } from "@/hooks/announcements/useAnnouncement";
import { announcementsListQueryKey } from "@/hooks/announcements/useAnnouncements";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import type { Announcement, AnnouncementList } from "@/lib/announcements/announcements";
import { messageFromError } from "@/lib/errors/convexError";

type SetAnnouncementPublicArgs = {
  classId: Id<"classes">;
  announcementId: Id<"announcements">;
  isPublic: boolean;
};

export function useSetAnnouncementPublic() {
  const { t } = useTranslation("announcements");
  const { t: tCommon } = useTranslation("common");
  const queryClient = useQueryClient();
  const mutationFn = useConvexMutation(api.announcements.setPublic);

  return useOptimisticMutation({
    mutationFn: (args: SetAnnouncementPublicArgs) => mutationFn(args),
    queryKeys: (args) => [
      announcementsListQueryKey(args.classId),
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
            ? { ...item, isPublic: args.isPublic, updatedAt: now }
            : item,
        );
      });

      queryClient.setQueryData<Announcement | null>(detailKey, (old) => {
        if (!old) return old;
        return { ...old, isPublic: args.isPublic, updatedAt: now };
      });
    },
    onSuccess: (data, args) => {
      // Server allocates publicSlug on first publish — apply immediately so the
      // copy-link UI does not wait on invalidate/refetch.
      const now = Date.now();
      const listKey = announcementsListQueryKey(args.classId);
      const detailKey = announcementDetailQueryKey(args.classId, args.announcementId);
      const patch = {
        isPublic: data.isPublic,
        publicSlug: data.publicSlug,
        updatedAt: now,
      };

      queryClient.setQueryData<AnnouncementList>(listKey, (old) => {
        if (!old) return old;
        return old.map((item) => (item._id === args.announcementId ? { ...item, ...patch } : item));
      });

      queryClient.setQueryData<Announcement | null>(detailKey, (old) => {
        if (!old) return old;
        return { ...old, ...patch };
      });
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("publicToggleFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
