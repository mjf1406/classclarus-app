import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { toast } from "@/components/ui/toast-manager";
import { useMarkNotificationSeen } from "@/hooks/notifications/useNotificationMutations";
import { useNotificationsList } from "@/hooks/notifications/useNotifications";

function inboxToastId(notificationId: string): string {
  return `inbox-notification:${notificationId}`;
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
        toast.close(inboxToastId(id));
      }
    }

    for (const item of items) {
      const idKey = String(item._id);
      const toastId = inboxToastId(idKey);
      if (item.kind !== "calendar_reminder" && item.kind !== "points_badge_alert") continue;
      if (item.isSeen) {
        toast.close(toastId);
        continue;
      }
      if (shownIdsRef.current.has(idKey)) continue;
      shownIdsRef.current.add(idKey);

      const notificationId = item._id;
      const classId = item.data.classId;
      const closeToast = () => toast.close(toastId);

      const title =
        item.kind === "points_badge_alert"
          ? item.data.metric === "warning"
            ? t("pointsBadgeAlertWarning", {
                name: item.data.studentName,
                count: item.data.count,
              })
            : t("pointsBadgeAlertMinus", {
                name: item.data.studentName,
                count: item.data.count,
              })
          : item.data.title;
      const description =
        item.kind === "points_badge_alert"
          ? item.data.action?.trim() || item.data.className
          : item.kind === "calendar_reminder" && item.data.description?.trim()
            ? item.data.description.trim()
            : item.data.className;

      toast.add({
        id: toastId,
        type: item.kind === "points_badge_alert" ? "warning" : "info",
        timeout: 0,
        priority: "high",
        title,
        description:
          item.kind === "calendar_reminder" && item.data.description?.trim() ? (
            <span className="line-clamp-4 whitespace-pre-wrap">{item.data.description.trim()}</span>
          ) : (
            description ||
            (item.kind === "points_badge_alert" ? t("pointsBadgeAlert") : t("calendarReminder"))
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
                if (item.kind === "calendar_reminder") {
                  void navigateRef.current({
                    to: "/class/$classId/calendar/event/$eventId",
                    params: { classId, eventId: item.data.eventId },
                  });
                } else {
                  void navigateRef.current({
                    to: "/class/$classId/points",
                    params: { classId },
                  });
                }
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
