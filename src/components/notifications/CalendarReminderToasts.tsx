import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { toast } from "@/components/ui/toast-manager";
import { useMarkNotificationSeen } from "@/hooks/notifications/useNotificationMutations";
import { useNotificationsList } from "@/hooks/notifications/useNotifications";

function reminderToastId(notificationId: string): string {
  return `calendar-reminder:${notificationId}`;
}

export function CalendarReminderToasts() {
  const { t } = useTranslation("notifications");
  const navigate = useNavigate();
  const { data: items } = useNotificationsList();
  const markSeen = useMarkNotificationSeen();
  const shownIdsRef = useRef(new Set<string>());
  const markSeenRef = useRef(markSeen);
  const navigateRef = useRef(navigate);
  markSeenRef.current = markSeen;
  navigateRef.current = navigate;

  useEffect(() => {
    if (!items) return;

    const activeIds = new Set(items.map((item) => String(item._id)));
    for (const id of shownIdsRef.current) {
      if (!activeIds.has(id)) {
        toast.close(reminderToastId(id));
      }
    }

    for (const item of items) {
      const idKey = String(item._id);
      const toastId = reminderToastId(idKey);
      if (item.kind !== "calendar_reminder") continue;
      if (item.isSeen) {
        toast.close(toastId);
        continue;
      }
      if (shownIdsRef.current.has(idKey)) continue;
      shownIdsRef.current.add(idKey);

      const notificationId = item._id;
      const classId = item.data.classId;
      const eventId = item.data.eventId;
      const eventDescription = item.data.description?.trim() ?? "";
      const closeToast = () => toast.close(toastId);

      toast.add({
        id: toastId,
        type: "info",
        timeout: 0,
        priority: "high",
        title: item.data.title,
        description: eventDescription ? (
          <span className="line-clamp-4 whitespace-pre-wrap">{eventDescription}</span>
        ) : (
          item.data.className || t("calendarReminder")
        ),
        data: {
          extraActions: [
            {
              label: t("markSeen"),
              onClick: () => {
                closeToast();
                void markSeenRef.current.mutateAsync({ notificationId });
              },
            },
            {
              label: t("view"),
              onClick: () => {
                closeToast();
                void markSeenRef.current.mutateAsync({ notificationId });
                void navigateRef.current({
                  to: "/class/$classId/calendar/event/$eventId",
                  params: { classId, eventId },
                });
              },
            },
            {
              label: t("dismiss"),
              onClick: closeToast,
            },
          ],
        },
      });
    }
  }, [items, t]);

  return null;
}
