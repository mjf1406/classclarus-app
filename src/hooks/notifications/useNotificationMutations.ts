import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import { toast } from "@/components/ui/toast-manager";
import {
  findNotificationHistoryQueryKeys,
  patchNotificationHistory,
} from "@/hooks/notifications/useNotificationHistory";
import {
  notificationsCountsQueryKey,
  notificationsListQueryKey,
} from "@/hooks/notifications/useNotifications";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import { messageFromError } from "@/lib/errors/convexError";

type NotificationList = NonNullable<
  ReturnType<typeof import("@/hooks/notifications/useNotifications").useNotificationsList>["data"]
>;
type NotificationCounts = NonNullable<
  ReturnType<typeof import("@/hooks/notifications/useNotifications").useNotificationCounts>["data"]
>;

export function useMarkNotificationSeen() {
  const { t } = useTranslation("notifications");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.notifications.markSeen);
  const listKey = notificationsListQueryKey();
  const countsKey = notificationsCountsQueryKey();

  return useOptimisticMutation({
    mutationFn: (args: { notificationId: string }) => mutationFn(args),
    queryKeys: (_args, queryClient) => [
      listKey,
      countsKey,
      ...findNotificationHistoryQueryKeys(queryClient),
    ],
    applyOptimisticUpdate: (queryClient, args) => {
      const previous = queryClient.getQueryData<NotificationList>(listKey);
      const wasUnseen = previous?.some((item) => item._id === args.notificationId && !item.isSeen);
      queryClient.setQueryData<NotificationList>(listKey, (old) => {
        if (!old) return old;
        return old.map((item) =>
          item._id === args.notificationId ? { ...item, isSeen: true, seenAt: Date.now() } : item,
        );
      });
      queryClient.setQueryData<NotificationCounts>(countsKey, (old) => {
        if (!old || !wasUnseen) return old;
        return { ...old, unseen: Math.max(0, old.unseen - 1) };
      });
      const now = Date.now();
      patchNotificationHistory(queryClient, (item) => {
        if (item.notificationId !== args.notificationId) return item;
        if (item.isDismissed) return { ...item, isSeen: true, seenAt: item.seenAt ?? now };
        return {
          ...item,
          isSeen: true,
          seenAt: now,
          statusKey: "read",
        };
      });
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("updateFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}

export function useMarkAllNotificationsSeen() {
  const { t } = useTranslation("notifications");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.notifications.markAllSeen);
  const listKey = notificationsListQueryKey();
  const countsKey = notificationsCountsQueryKey();

  return useOptimisticMutation({
    mutationFn: (_args: Record<string, never>) => mutationFn({}),
    queryKeys: (_args, queryClient) => [
      listKey,
      countsKey,
      ...findNotificationHistoryQueryKeys(queryClient),
    ],
    applyOptimisticUpdate: (queryClient) => {
      const now = Date.now();
      queryClient.setQueryData<NotificationList>(listKey, (old) => {
        if (!old) return old;
        return old.map((item) => ({ ...item, isSeen: true, seenAt: item.seenAt ?? now }));
      });
      queryClient.setQueryData<NotificationCounts>(countsKey, (old) => {
        if (!old) return old;
        return { ...old, unseen: 0 };
      });
      patchNotificationHistory(queryClient, (item) => {
        if (item.isDismissed || item.isSeen) return item;
        return { ...item, isSeen: true, seenAt: item.seenAt ?? now, statusKey: "read" };
      });
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("updateFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}

export function useDismissNotification() {
  const { t } = useTranslation("notifications");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.notifications.dismiss);
  const listKey = notificationsListQueryKey();
  const countsKey = notificationsCountsQueryKey();

  return useOptimisticMutation({
    mutationFn: (args: { notificationId: string }) => mutationFn(args),
    queryKeys: (_args, queryClient) => [
      listKey,
      countsKey,
      ...findNotificationHistoryQueryKeys(queryClient),
    ],
    applyOptimisticUpdate: (queryClient, args) => {
      let removedUnseen = false;
      queryClient.setQueryData<NotificationList>(listKey, (old) => {
        if (!old) return old;
        return old.filter((item) => {
          if (item._id !== args.notificationId) return true;
          if (!item.isSeen) removedUnseen = true;
          return false;
        });
      });
      queryClient.setQueryData<NotificationCounts>(countsKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          active: Math.max(0, old.active - 1),
          unseen: removedUnseen ? Math.max(0, old.unseen - 1) : old.unseen,
        };
      });
      const now = Date.now();
      patchNotificationHistory(queryClient, (item) => {
        if (item.notificationId !== args.notificationId) return item;
        return {
          ...item,
          isDismissed: true,
          isSeen: true,
          dismissedAt: now,
          seenAt: item.seenAt ?? now,
          statusKey: "dismissed",
        };
      });
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("updateFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
