import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { AnnouncementAttachmentList } from "@/components/announcements/AnnouncementAttachmentList";
import { CalendarEventFormCredenza } from "@/components/calendar/CalendarEventFormCredenza";
import { Button } from "@/components/ui/button";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useCalendarEvent } from "@/hooks/calendar/useCalendarEvent";
import { useRemoveCalendarEvent } from "@/hooks/calendar/useRemoveCalendarEvent";
import { useUpdateCalendarEvent } from "@/hooks/calendar/useUpdateCalendarEvent";
import { useCan } from "@/hooks/permissions/useCan";
import { useClass } from "@/hooks/classes/useClass";
import { formatEventTimeLabel } from "@/lib/calendar/calendar";
import { toIntlLocale } from "@/lib/languages";
import { CALENDAR_AUDIENCE_ROLES } from "../../../convex/lib/calendar/audience";
import { classNowDateKey } from "../../../convex/lib/calendar/monthGrid";
import { isValidTimeZone } from "../../../convex/lib/calendar/timeZone";
import type { Id } from "../../../convex/_generated/dataModel";

const ROLE_LABEL_KEYS = {
  owner: "roleOwner",
  teacher: "roleTeacher",
  assistant_teacher: "roleAssistantTeacher",
  student: "roleStudent",
  guardian: "roleGuardian",
} as const;

type CalendarEventDetailPageProps = {
  classId: Id<"classes">;
  eventId: Id<"calendarEvents">;
};

export function CalendarEventDetailPage({ classId, eventId }: CalendarEventDetailPageProps) {
  const { t, i18n } = useTranslation("calendar");
  const { t: tClasses } = useTranslation("classes");
  const navigate = useNavigate();
  const locale = toIntlLocale(i18n.language);
  const { can, isPending: permissionsPending } = useCan();
  const canManage = !permissionsPending && can("calendar:manage");
  const { data: classDoc } = useClass(classId);
  const classTimeZone = classDoc?.timezone;
  const zone = classTimeZone && isValidTimeZone(classTimeZone) ? classTimeZone : "UTC";
  const todayKey = classNowDateKey(Date.now(), zone);
  const { data, isPending, isError, refetch } = useCalendarEvent(classId, eventId);
  const updateEvent = useUpdateCalendarEvent();
  const removeEvent = useRemoveCalendarEvent();
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
          render={<Link to="/class/$classId/calendar" params={{ classId }} />}
        >
          <ArrowLeft className="size-4" />
          {t("backToCalendar")}
        </Button>
        <ErrorState title={t("notFoundTitle")} description={t("notFoundDescription")} />
      </div>
    );
  }

  const audienceLabel =
    data.audienceKind === "all"
      ? t("audienceAll")
      : data.audienceRoles
          .filter((role): role is (typeof CALENDAR_AUDIENCE_ROLES)[number] =>
            (CALENDAR_AUDIENCE_ROLES as ReadonlyArray<string>).includes(role),
          )
          .map((role) => tClasses(ROLE_LABEL_KEYS[role]))
          .join(", ");

  return (
    <div className="flex w-full flex-col gap-6 px-4 py-8 sm:px-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-2">
          <Button
            type="button"
            variant="ghost"
            className="w-fit"
            render={<Link to="/class/$classId/calendar" params={{ classId }} />}
          >
            <ArrowLeft className="size-4" />
            {t("backToCalendar")}
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">{data.title}</h1>
          <p className="text-sm text-muted-foreground">
            {formatEventTimeLabel(data, zone, locale)}
          </p>
          <p className="text-sm text-muted-foreground">
            {t("audienceLabel")}: {audienceLabel}
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

      {data.description ? (
        <p className="whitespace-pre-wrap text-sm leading-6">{data.description}</p>
      ) : null}

      {data.attachments.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-medium">{t("attachmentsLabel")}</h2>
          <AnnouncementAttachmentList attachments={data.attachments} />
        </div>
      ) : null}

      {canManage ? (
        <>
          <CalendarEventFormCredenza
            open={editOpen}
            onOpenChange={setEditOpen}
            mode="edit"
            classId={classId}
            classTimeZone={classTimeZone}
            todayKey={data.startDateKey ?? todayKey}
            initial={data}
            onSubmit={async (values) => {
              await updateEvent.mutateAsync({
                ...values,
                classId,
                eventId: data._id,
                classTimeZone,
              });
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
                  disabled={removeEvent.isPending}
                  onClick={() => {
                    setDeleteOpen(false);
                    void removeEvent
                      .mutateAsync({ classId, eventId: data._id })
                      .then(() => {
                        void navigate({
                          to: "/class/$classId/calendar",
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
