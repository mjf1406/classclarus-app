import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { AnnouncementAttachmentList } from "@/components/announcements/AnnouncementAttachmentList";
import { AnnouncementBody } from "@/components/announcements/AnnouncementBody";
import { AnnouncementFormCredenza } from "@/components/announcements/AnnouncementFormCredenza";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import {
  Credenza,
  CredenzaClose,
  CredenzaContent,
  CredenzaDescription,
  CredenzaFooter,
  CredenzaHeader,
  CredenzaTitle,
} from "@/components/ui/credenza";
import { ErrorState } from "@/components/ui/error-state";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useAnnouncement } from "@/hooks/announcements/useAnnouncement";
import { useRemoveAnnouncement } from "@/hooks/announcements/useRemoveAnnouncement";
import { useSetAnnouncementPublic } from "@/hooks/announcements/useSetAnnouncementPublic";
import { useUpdateAnnouncement } from "@/hooks/announcements/useUpdateAnnouncement";
import { useCan } from "@/hooks/permissions/useCan";
import { formatLocalizedDateTime } from "@/i18n/formatDate";
import { announcementPublicUrl } from "@/lib/announcements/announcementUrls";
import type { Id } from "../../../convex/_generated/dataModel";

type AnnouncementDetailPageProps = {
  classId: Id<"classes">;
  announcementId: Id<"announcements">;
};

export function AnnouncementDetailPage({ classId, announcementId }: AnnouncementDetailPageProps) {
  const { t } = useTranslation("announcements");
  const navigate = useNavigate();
  const { can } = useCan();
  const canManage = can("announcements:manage");
  const { data, isPending, isError, refetch } = useAnnouncement(classId, announcementId);
  const updateAnnouncement = useUpdateAnnouncement();
  const removeAnnouncement = useRemoveAnnouncement();
  const setPublic = useSetAnnouncementPublic();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (isPending) {
    return (
      <div className="flex w-full flex-col gap-4 px-4 py-8 sm:px-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="px-4 py-8 sm:px-8">
        <ErrorState
          title={t("loadFailed")}
          description={t("loadFailedDescription")}
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex w-full flex-col gap-4 px-4 py-8 sm:px-8">
        <Button
          type="button"
          variant="ghost"
          className="w-fit"
          render={<Link to="/class/$classId/announcements" params={{ classId }} />}
        >
          <ArrowLeft className="size-4" />
          {t("backToList")}
        </Button>
        <ErrorState title={t("notFoundTitle")} description={t("notFoundDescription")} />
      </div>
    );
  }

  const publicUrl = data.isPublic && data.publicSlug ? announcementPublicUrl(data.publicSlug) : "";

  return (
    <div className="flex w-full flex-col gap-6 px-4 py-8 sm:px-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-2">
          <Button
            type="button"
            variant="ghost"
            className="w-fit"
            render={<Link to="/class/$classId/announcements" params={{ classId }} />}
          >
            <ArrowLeft className="size-4" />
            {t("backToList")}
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">{data.title}</h1>
          <p className="text-sm text-muted-foreground">
            {formatLocalizedDateTime(data.createdAt)}
            {data.updatedAt !== data.createdAt
              ? ` · ${t("updatedAt", { date: formatLocalizedDateTime(data.updatedAt) })}`
              : null}
          </p>
        </div>
        {canManage ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="size-4" />
              {t("editAction")}
            </Button>
            <Button type="button" variant="destructive" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="size-4" />
              {t("deleteAction")}
            </Button>
          </div>
        ) : null}
      </div>

      {canManage ? (
        <div className="flex flex-col gap-3 rounded-xl border border-border p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <Label htmlFor="announcement-public">{t("publicLabel")}</Label>
              <p className="text-sm text-muted-foreground">{t("publicDescription")}</p>
            </div>
            <Switch
              id="announcement-public"
              checked={data.isPublic}
              disabled={setPublic.isPending}
              onCheckedChange={(checked) => {
                void setPublic.mutateAsync({
                  classId,
                  announcementId,
                  isPublic: checked,
                });
              }}
            />
          </div>
          {data.isPublic && publicUrl ? (
            <div className="flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-2 py-1 text-xs">
                {publicUrl}
              </code>
              <CopyButton type="link" value={publicUrl} aria-label={t("copyPublicLink")} />
            </div>
          ) : null}
        </div>
      ) : data.isPublic ? (
        <p className="text-sm text-muted-foreground">{t("publicBadge")}</p>
      ) : null}

      <AnnouncementBody bodyJson={data.bodyJson} />

      {data.attachments.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-medium">{t("attachmentsLabel")}</h2>
          <AnnouncementAttachmentList attachments={data.attachments} />
        </div>
      ) : null}

      {canManage ? (
        <>
          <AnnouncementFormCredenza
            open={editOpen}
            onOpenChange={setEditOpen}
            classId={classId}
            mode="edit"
            initial={data}
            onSubmit={async (values) => {
              await updateAnnouncement.mutateAsync({
                classId,
                announcementId,
                title: values.title,
                bodyJson: values.bodyJson,
                attachmentFileIds: values.attachmentFileIds,
              });
              if (values.isPublic !== data.isPublic) {
                await setPublic.mutateAsync({
                  classId,
                  announcementId,
                  isPublic: values.isPublic,
                });
              }
            }}
          />
          <Credenza open={deleteOpen} onOpenChange={setDeleteOpen}>
            <CredenzaContent>
              <CredenzaHeader>
                <CredenzaTitle>{t("deleteConfirmTitle", { name: data.title })}</CredenzaTitle>
                <CredenzaDescription>{t("deleteConfirmDescription")}</CredenzaDescription>
              </CredenzaHeader>
              <CredenzaFooter>
                <CredenzaClose render={<Button type="button" variant="outline" />}>
                  {t("cancel")}
                </CredenzaClose>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={removeAnnouncement.isPending}
                  onClick={() => {
                    setDeleteOpen(false);
                    void removeAnnouncement
                      .mutateAsync({ classId, announcementId })
                      .then(() => {
                        void navigate({
                          to: "/class/$classId/announcements",
                          params: { classId },
                        });
                      })
                      .catch(() => {
                        setDeleteOpen(true);
                      });
                  }}
                >
                  {t("deleteAction")}
                </Button>
              </CredenzaFooter>
            </CredenzaContent>
          </Credenza>
        </>
      ) : null}
    </div>
  );
}
