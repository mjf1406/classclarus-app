import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { calendarEventQueryKey } from "@/hooks/calendar/useCalendarEvent";
import {
  findCalendarRangeQueryKeys,
  patchCalendarRanges,
} from "@/hooks/calendar/useCalendarEventsInRange";
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

type RemoveCalendarEventArgs = {
  classId: Id<"classes">;
  eventId: Id<"calendarEvents">;
};

type NotificationList = NonNullable<
  ReturnType<typeof import("@/hooks/notifications/useNotifications").useNotificationsList>["data"]
>;
type NotificationCounts = NonNullable<
  ReturnType<typeof import("@/hooks/notifications/useNotifications").useNotificationCounts>["data"]
>;

export function useRemoveCalendarEvent() {
  const { t } = useTranslation("calendar");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.calendar.remove);
  const listKey = notificationsListQueryKey();
  const countsKey = notificationsCountsQueryKey();

  return useOptimisticMutation({
    mutationFn: (args: RemoveCalendarEventArgs) => mutationFn(args),
    queryKeys: (args, queryClient) => [
      ...findCalendarRangeQueryKeys(queryClient, args.classId),
      calendarEventQueryKey(args.classId, args.eventId),
      listKey,
      countsKey,
      ...findNotificationHistoryQueryKeys(queryClient),
    ],
    applyOptimisticUpdate: (queryClient, args) => {
      patchCalendarRanges(queryClient, args.classId, (old) =>
        old.filter((event) => event._id !== args.eventId),
      );
      queryClient.setQueryData(calendarEventQueryKey(args.classId, args.eventId), null);

      const previous = queryClient.getQueryData<NotificationList>(listKey);
      const removed =
        previous?.filter(
          (item) => item.kind === "calendar_reminder" && item.data.eventId === args.eventId,
        ) ?? [];
      const removedUnseen = removed.filter((item) => !item.isSeen).length;

      queryClient.setQueryData<NotificationList>(listKey, (old) => {
        if (!old) return old;
        return old.filter(
          (item) => !(item.kind === "calendar_reminder" && item.data.eventId === args.eventId),
        );
      });
      queryClient.setQueryData<NotificationCounts>(countsKey, (old) => {
        if (!old || removed.length === 0) return old;
        return {
          ...old,
          active: Math.max(0, old.active - removed.length),
          unseen: Math.max(0, old.unseen - removedUnseen),
        };
      });

      const now = Date.now();
      patchNotificationHistory(queryClient, (item) => {
        if (item.kind !== "calendar_reminder" || item.eventId !== args.eventId) return item;
        if (item.isDismissed) return item;
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
        title: messageFromError(error, t("deleteFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
