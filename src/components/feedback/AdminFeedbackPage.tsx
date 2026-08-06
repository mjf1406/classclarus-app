import { useMemo, useState } from "react";
import { ArchiveIcon, ArchiveRestoreIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  createAdminFeedbackColumns,
  type AdminFeedbackRow,
} from "@/components/feedback/admin-feedback-columns";
import { AdminFeedbackDataTable } from "@/components/feedback/AdminFeedbackDataTable";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useFeedbackAdminList } from "@/hooks/feedback/useFeedbackAdminList";
import { useSetFeedbackArchived } from "@/hooks/feedback/useSetFeedbackArchived";
import { formatLocalizedDateTime } from "@/i18n/formatDate";

export function AdminFeedbackPage() {
  const { t } = useTranslation("feedback");
  const [archived, setArchived] = useState(false);
  const [selected, setSelected] = useState<AdminFeedbackRow | null>(null);
  const listArgs = useMemo(() => ({ archived }), [archived]);
  const listQuery = useFeedbackAdminList(listArgs);
  const setArchivedMutation = useSetFeedbackArchived(listArgs);

  const rows = (listQuery.data ?? []) as AdminFeedbackRow[];
  const columns = useMemo(() => createAdminFeedbackColumns(t), [t]);

  const isPending = listQuery.isPending || listQuery.isAuthLoading;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-semibold tracking-tight">{t("adminTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("adminDescription")}</p>
        </div>
        <ToggleGroup
          variant="outline"
          spacing={0}
          value={[archived ? "archived" : "active"]}
          onValueChange={(values) => {
            const value = values[0] as "active" | "archived" | undefined;
            if (value === "archived") {
              setArchived(true);
              setSelected(null);
            } else if (value === "active") {
              setArchived(false);
              setSelected(null);
            }
          }}
          className="justify-start"
        >
          <ToggleGroupItem value="active">{t("filterActive")}</ToggleGroupItem>
          <ToggleGroupItem value="archived">{t("filterArchived")}</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {listQuery.isError ? (
        <ErrorState
          title={t("adminLoadFailed")}
          description={listQuery.error.message}
          onRetry={() => {
            void listQuery.refetch();
          }}
        />
      ) : null}

      {isPending ? <Skeleton className="h-72 w-full" /> : null}

      {!isPending && !listQuery.isError ? (
        <AdminFeedbackDataTable
          columns={columns}
          data={rows}
          onRowClick={setSelected}
          emptyLabel={archived ? t("adminEmptyArchivedTitle") : t("adminEmptyTitle")}
        />
      ) : null}

      <Sheet
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <SheetContent className="flex w-full flex-col gap-4 sm:max-w-lg">
          {selected ? (
            <>
              <SheetHeader>
                <SheetDescription className="text-xs font-medium uppercase tracking-wide">
                  {t(`type_${selected.type}`)}
                </SheetDescription>
                <SheetTitle>{selected.title}</SheetTitle>
                <p className="text-xs text-muted-foreground">
                  {formatLocalizedDateTime(selected.createdAt)}
                </p>
              </SheetHeader>

              <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
                <DetailBlock label={t("bodyLabel")} value={selected.body} />

                {selected.type === "bug" ? (
                  <>
                    {selected.severity ? (
                      <DetailBlock
                        label={t("severityLabel")}
                        value={t(`severity_${selected.severity}`)}
                      />
                    ) : null}
                    {selected.stepsToReproduce ? (
                      <DetailBlock label={t("stepsLabel")} value={selected.stepsToReproduce} />
                    ) : null}
                    {selected.expected ? (
                      <DetailBlock label={t("expectedLabel")} value={selected.expected} />
                    ) : null}
                    {selected.actual ? (
                      <DetailBlock label={t("actualLabel")} value={selected.actual} />
                    ) : null}
                  </>
                ) : null}

                {selected.type === "feature" ? (
                  <>
                    {selected.importance ? (
                      <DetailBlock
                        label={t("importanceLabel")}
                        value={t(`importance_${selected.importance}`)}
                      />
                    ) : null}
                    {selected.useCase ? (
                      <DetailBlock label={t("useCaseLabel")} value={selected.useCase} />
                    ) : null}
                    {selected.proposedSolution ? (
                      <DetailBlock
                        label={t("proposedSolutionLabel")}
                        value={selected.proposedSolution}
                      />
                    ) : null}
                  </>
                ) : null}

                {selected.type === "concern" && selected.impact ? (
                  <DetailBlock label={t("impactLabel")} value={selected.impact} />
                ) : null}

                <div className="rounded-md bg-muted/40 px-3 py-2 text-sm">
                  <p className="font-medium">{t("submitterLabel")}</p>
                  <p className="text-muted-foreground">
                    {selected.userName ? `${selected.userName} · ` : ""}
                    {selected.userEmail ?? t("submitterNoEmail")}
                  </p>
                  {selected.wantReply ? (
                    <p className="mt-1 text-xs text-muted-foreground">{t("wantReplyBadge")}</p>
                  ) : null}
                </div>

                {selected.attachments.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-sm font-medium">{t("attachmentsLabel")}</p>
                    <div className="flex flex-wrap gap-2">
                      {selected.attachments.map((attachment) =>
                        attachment.url ? (
                          <a
                            key={attachment.fileId}
                            href={attachment.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="overflow-hidden rounded-md border"
                          >
                            <img
                              src={attachment.url}
                              alt={attachment.name}
                              className="size-24 object-cover"
                            />
                          </a>
                        ) : (
                          <span key={attachment.fileId} className="text-xs text-muted-foreground">
                            {attachment.name}
                          </span>
                        ),
                      )}
                    </div>
                  </div>
                ) : null}

                <Button
                  type="button"
                  variant="outline"
                  disabled={setArchivedMutation.isPending}
                  onClick={() => {
                    const feedbackId = selected._id;
                    void setArchivedMutation
                      .mutateAsync({
                        feedbackId,
                        archived: !archived,
                      })
                      .then(() => setSelected(null));
                  }}
                >
                  {archived ? (
                    <ArchiveRestoreIcon data-icon="inline-start" />
                  ) : (
                    <ArchiveIcon data-icon="inline-start" />
                  )}
                  {archived ? t("unarchive") : t("archive")}
                </Button>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function DetailBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="whitespace-pre-wrap text-sm">{value}</p>
    </div>
  );
}
