import { BellIcon, XIcon } from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useMarkAllNotificationsSeen,
  useDismissNotification,
  useMarkNotificationSeen,
} from "@/hooks/notifications/useNotificationMutations";
import {
  useNotificationCounts,
  useNotificationsList,
} from "@/hooks/notifications/useNotifications";

export function NotificationInboxButton() {
  const { t } = useTranslation("notifications");
  const navigate = useNavigate();
  const { data: items } = useNotificationsList();
  const { data: counts } = useNotificationCounts();
  const markSeen = useMarkNotificationSeen();
  const markAllSeen = useMarkAllNotificationsSeen();
  const dismiss = useDismissNotification();
  const unseen = counts?.unseen ?? 0;
  const list = items ?? [];

  return (
    <Popover>
      <PopoverTrigger
        render={<Button type="button" variant="ghost" size="icon" className="relative" />}
      >
        <BellIcon />
        <span className="sr-only">{t("title")}</span>
        {unseen > 0 ? (
          <Badge
            variant="destructive"
            className="absolute -top-1 -right-1 h-5 min-w-5 px-1 text-[10px]"
          >
            {unseen > 99 ? "99+" : unseen}
          </Badge>
        ) : null}
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
          <p className="text-sm font-medium">{t("title")}</p>
          {unseen > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => void markAllSeen.mutateAsync({})}
            >
              {t("markAllSeen")}
            </Button>
          ) : null}
        </div>
        {list.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <ScrollArea className="max-h-80">
            <ul className="flex flex-col p-1">
              {list.map((item) => {
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
                    : item.kind === "calendar_reminder"
                      ? item.data.title
                      : t("title");
                const subtitle =
                  item.kind === "points_badge_alert"
                    ? item.data.action?.trim() || item.data.className
                    : item.kind === "calendar_reminder"
                      ? item.data.className
                      : "";
                return (
                  <li
                    key={item._id}
                    className={
                      item.isSeen
                        ? "flex items-start gap-1 rounded-lg p-2"
                        : "flex items-start gap-1 rounded-lg bg-muted/50 p-2"
                    }
                  >
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => {
                        if (!item.isSeen) {
                          void markSeen.mutateAsync({ notificationId: item._id });
                        }
                        if (item.kind === "calendar_reminder") {
                          void navigate({
                            to: "/class/$classId/calendar/event/$eventId",
                            params: {
                              classId: item.data.classId,
                              eventId: item.data.eventId,
                            },
                          });
                        } else if (item.kind === "points_badge_alert") {
                          void navigate({
                            to: "/class/$classId/points",
                            params: { classId: item.data.classId },
                          });
                        }
                      }}
                    >
                      <div className="truncate text-sm font-medium">{title}</div>
                      {subtitle ? (
                        <div className="truncate text-xs text-muted-foreground">{subtitle}</div>
                      ) : null}
                    </button>
                    <Button
                      type="button"
                      size="icon-xs"
                      variant="ghost"
                      aria-label={t("dismiss")}
                      onClick={() => void dismiss.mutateAsync({ notificationId: item._id })}
                    >
                      <XIcon />
                    </Button>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        )}
        <div className="border-t border-border px-3 py-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full"
            nativeButton={false}
            render={<Link to="/notifications" />}
          >
            {t("viewAll")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
