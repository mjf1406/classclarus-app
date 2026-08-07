import { Link, useNavigate } from "@tanstack/react-router";
import { Eye, Globe, GlobeLock, Link2, Pencil, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { AnnouncementAttachmentList } from "@/components/announcements/AnnouncementAttachmentList";
import { AnnouncementBody } from "@/components/announcements/AnnouncementBody";
import { ActionMenu, type ActionMenuItem } from "@/components/ui/action-menu";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "@/components/ui/toast-manager";
import { formatLocalizedDateTime } from "@/i18n/formatDate";
import type { Announcement } from "@/lib/announcements/announcements";
import { announcementPublicUrl } from "@/lib/announcements/announcementUrls";
import type { Id } from "../../../convex/_generated/dataModel";

type AnnouncementCardProps = {
  classId: Id<"classes">;
  announcement: Announcement;
  onEdit: (announcement: Announcement) => void;
  onDelete: (announcement: Announcement) => void;
  onTogglePublic: (announcement: Announcement, isPublic: boolean) => void;
};

export function AnnouncementCard({
  classId,
  announcement,
  onEdit,
  onDelete,
  onTogglePublic,
}: AnnouncementCardProps) {
  const { t } = useTranslation("announcements");
  const { t: tCommon } = useTranslation("common");
  const navigate = useNavigate();

  const publicUrl =
    announcement.isPublic && announcement.publicSlug
      ? announcementPublicUrl(announcement.publicSlug)
      : "";

  const menuItems = useMemo<Array<ActionMenuItem>>(() => {
    const items: Array<ActionMenuItem> = [
      {
        id: "view",
        label: t("viewAction"),
        icon: <Eye />,
        group: "navigate",
        onSelect: () => {
          void navigate({
            to: "/class/$classId/announcements/$announcementId",
            params: { classId, announcementId: announcement._id },
          });
        },
      },
      {
        id: "edit",
        label: t("editAction"),
        icon: <Pencil />,
        permission: "announcements:manage",
        group: "manage",
        onSelect: () => onEdit(announcement),
      },
      {
        id: "public",
        label: announcement.isPublic ? t("unpublishAction") : t("publishAction"),
        icon: announcement.isPublic ? <GlobeLock /> : <Globe />,
        permission: "announcements:manage",
        group: "manage",
        onSelect: () => onTogglePublic(announcement, !announcement.isPublic),
      },
    ];

    if (publicUrl) {
      items.push({
        id: "copy-link",
        label: t("copyPublicLink"),
        icon: <Link2 />,
        group: "share",
        onSelect: () => {
          void navigator.clipboard.writeText(publicUrl).then(
            () => {
              toast.add({ title: tCommon("copied"), type: "success" });
            },
            () => {
              toast.add({
                title: tCommon("copyFailed"),
                description: tCommon("copyFailedDescription"),
                type: "error",
              });
            },
          );
        },
      });
    }

    items.push({
      id: "delete",
      label: t("deleteAction"),
      icon: <Trash2 />,
      permission: "announcements:manage",
      variant: "destructive",
      group: "danger",
      onSelect: () => onDelete(announcement),
    });

    return items;
  }, [announcement, classId, navigate, onDelete, onEdit, onTogglePublic, publicUrl, t, tCommon]);

  return (
    <Card size="sm" className="transition-colors hover:bg-accent/40">
      <CardHeader className="flex flex-row items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base font-semibold">
              <Link
                to="/class/$classId/announcements/$announcementId"
                params={{ classId, announcementId: announcement._id }}
                className="rounded-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
              >
                {announcement.title}
              </Link>
            </CardTitle>
            {announcement.isPublic ? <Badge variant="secondary">{t("publicBadge")}</Badge> : null}
          </div>
          <CardDescription className="mt-1">
            {formatLocalizedDateTime(announcement.createdAt)}
          </CardDescription>
        </div>
        <div className="shrink-0">
          <ActionMenu items={menuItems} label={t("actions")} />
        </div>
      </CardHeader>
      <CardContent>
        <AnnouncementBody bodyJson={announcement.bodyJson} />
      </CardContent>
      {announcement.attachments.length > 0 ? (
        <CardFooter className="flex-col items-stretch border-t">
          <AnnouncementAttachmentList attachments={announcement.attachments} />
        </CardFooter>
      ) : null}
    </Card>
  );
}
