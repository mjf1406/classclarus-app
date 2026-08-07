import { useTranslation } from "react-i18next";

import { AnnouncementAttachmentList } from "@/components/announcements/AnnouncementAttachmentList";
import { AnnouncementBody } from "@/components/announcements/AnnouncementBody";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { usePublicAnnouncement } from "@/hooks/announcements/usePublicAnnouncement";
import { formatLocalizedDateTime } from "@/i18n/formatDate";
import { APP_CONFIG } from "@/config/app";

type PublicAnnouncementPageProps = {
  publicSlug: string;
};

export function PublicAnnouncementPage({ publicSlug }: PublicAnnouncementPageProps) {
  const { t } = useTranslation("announcements");
  const { data, isPending, isError, refetch } = usePublicAnnouncement(publicSlug);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <p className="text-sm text-muted-foreground">{APP_CONFIG.name}</p>

      {isPending ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : null}

      {isError ? (
        <ErrorState
          title={t("publicLoadFailed")}
          description={t("publicLoadFailedDescription")}
          onRetry={() => void refetch()}
        />
      ) : null}

      {!isPending && !isError && !data ? (
        <ErrorState title={t("publicNotFoundTitle")} description={t("publicNotFoundDescription")} />
      ) : null}

      {!isPending && !isError && data ? (
        <article className="flex flex-col gap-6">
          <header className="flex flex-col gap-2">
            <h1 className="text-3xl font-semibold tracking-tight">{data.title}</h1>
            <p className="text-sm text-muted-foreground">
              {formatLocalizedDateTime(data.createdAt)}
            </p>
          </header>
          <AnnouncementBody bodyJson={data.bodyJson} />
          {data.attachments.length > 0 ? (
            <div className="flex flex-col gap-2">
              <h2 className="text-sm font-medium">{t("attachmentsLabel")}</h2>
              <AnnouncementAttachmentList attachments={data.attachments} />
            </div>
          ) : null}
        </article>
      ) : null}
    </div>
  );
}
