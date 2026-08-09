import { Megaphone, Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { AnnouncementCard } from "@/components/announcements/AnnouncementCard";
import { AnnouncementFormCredenza } from "@/components/announcements/AnnouncementFormCredenza";
import { DeleteNamedCredenza } from "@/components/groups/DeleteNamedCredenza";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useAnnouncements } from "@/hooks/announcements/useAnnouncements";
import { useCreateAnnouncement } from "@/hooks/announcements/useCreateAnnouncement";
import { useRemoveAnnouncement } from "@/hooks/announcements/useRemoveAnnouncement";
import { useSetAnnouncementPublic } from "@/hooks/announcements/useSetAnnouncementPublic";
import { useUpdateAnnouncement } from "@/hooks/announcements/useUpdateAnnouncement";
import { useCan } from "@/hooks/permissions/useCan";
import type { Announcement } from "@/lib/announcements/announcements";
import type { Id } from "../../../convex/_generated/dataModel";

type AnnouncementsPageProps = {
  classId: Id<"classes">;
};

export function AnnouncementsPage({ classId }: AnnouncementsPageProps) {
  const { t } = useTranslation("announcements");
  const { can } = useCan();
  const canManage = can("announcements:manage");
  const { data, isPending, isError, refetch } = useAnnouncements(classId);
  const createAnnouncement = useCreateAnnouncement();
  const updateAnnouncement = useUpdateAnnouncement();
  const removeAnnouncement = useRemoveAnnouncement();
  const setPublic = useSetAnnouncementPublic();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [deleting, setDeleting] = useState<Announcement | null>(null);

  return (
    <div className="flex w-full flex-col gap-4 px-4 py-8 sm:px-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("title")}</h1>
          <p className="hidden text-muted-foreground sm:block">{t("description")}</p>
        </div>
        {canManage ? (
          <Button type="button" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            {t("createAction")}
          </Button>
        ) : null}
      </div>

      {isPending ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
        </div>
      ) : null}

      {isError ? (
        <ErrorState
          title={t("loadFailed")}
          description={t("loadFailedDescription")}
          onRetry={() => void refetch()}
        />
      ) : null}

      {!isPending && !isError && data && data.length === 0 ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Megaphone />
            </EmptyMedia>
            <EmptyTitle>{t("emptyTitle")}</EmptyTitle>
            <EmptyDescription>{t("emptyDescription")}</EmptyDescription>
          </EmptyHeader>
          {canManage ? (
            <EmptyContent>
              <Button type="button" onClick={() => setCreateOpen(true)}>
                <Plus className="size-4" />
                {t("createAction")}
              </Button>
            </EmptyContent>
          ) : null}
        </Empty>
      ) : null}

      {!isPending && !isError && data && data.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {data.map((announcement) => (
            <li key={announcement._id}>
              <AnnouncementCard
                classId={classId}
                announcement={announcement}
                onEdit={setEditing}
                onDelete={setDeleting}
                onTogglePublic={(item, isPublic) => {
                  void setPublic.mutateAsync({
                    classId,
                    announcementId: item._id,
                    isPublic,
                  });
                }}
              />
            </li>
          ))}
        </ul>
      ) : null}

      {canManage ? (
        <>
          <AnnouncementFormCredenza
            open={createOpen}
            onOpenChange={setCreateOpen}
            classId={classId}
            mode="create"
            onSubmit={async (values) => {
              await createAnnouncement.mutateAsync({
                classId,
                title: values.title,
                bodyJson: values.bodyJson,
                attachmentFileIds: values.attachmentFileIds,
                isPublic: values.isPublic,
              });
            }}
          />
          <AnnouncementFormCredenza
            open={editing !== null}
            onOpenChange={(open) => {
              if (!open) setEditing(null);
            }}
            classId={classId}
            mode="edit"
            initial={editing}
            onSubmit={async (values) => {
              if (!editing) return;
              await updateAnnouncement.mutateAsync({
                classId,
                announcementId: editing._id,
                title: values.title,
                bodyJson: values.bodyJson,
                attachmentFileIds: values.attachmentFileIds,
              });
              if (values.isPublic !== undefined && values.isPublic !== editing.isPublic) {
                await setPublic.mutateAsync({
                  classId,
                  announcementId: editing._id,
                  isPublic: values.isPublic,
                });
              }
              setEditing(null);
            }}
          />
          <DeleteNamedCredenza
            open={deleting !== null}
            onOpenChange={(open) => {
              if (!open) setDeleting(null);
            }}
            title={t("deleteConfirmTitle", { name: deleting?.title ?? "" })}
            description={t("deleteConfirmDescription")}
            confirmLabel={t("deleteAction")}
            onConfirm={async () => {
              if (!deleting) return;
              await removeAnnouncement.mutateAsync({
                classId,
                announcementId: deleting._id,
              });
              setDeleting(null);
            }}
          />
        </>
      ) : null}
    </div>
  );
}
