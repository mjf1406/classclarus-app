import { Link, useNavigate } from "@tanstack/react-router";
import { Dices, FileDown, Monitor, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { DeleteNamedCredenza } from "@/components/groups/DeleteNamedCredenza";
import { ActionMenu, type ActionMenuItem } from "@/components/ui/action-menu";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { toast } from "@/components/ui/toast-manager";
import { useLogClassAccess } from "@/hooks/activity/useLogClassAccess";
import { useRemoveRandomAssigner } from "@/hooks/assigners/random/useRemoveRandomAssigner";
import { useRandomAssigners } from "@/hooks/assigners/random/useRandomAssigners";
import { useRunRandomAssigner } from "@/hooks/assigners/random/useRunRandomAssigner";
import { useClass } from "@/hooks/classes/useClass";
import { useCan } from "@/hooks/permissions/useCan";
import {
  formatRandomAssignerScope,
  randomAssignerDisplayUrl,
  type RandomAssignerListItem,
} from "@/lib/assigners/randomAssigners";
import {
  printRandomAssignerRun,
  randomAssignerPrintLogoAlt,
} from "@/lib/assigners/randomAssignerPrint";
import { openDisplayTab } from "@/lib/display/openDisplayTab";
import { messageFromError } from "@/lib/errors/convexError";
import { resolveRosterNameFormat } from "@/lib/roster/roster";
import { cn } from "@/lib/utils";
import { convexQuery } from "@convex-dev/react-query";
import { useQueryClient } from "@tanstack/react-query";

import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

const GRID_CLASS = "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3";
const CARD_ITEM_PREVIEW_LIMIT = 10;
const CARD_ITEM_COLUMN_THRESHOLD = 5;

type RandomAssignersPageProps = {
  classId: Id<"classes">;
};

export function RandomAssignersPage({ classId }: RandomAssignersPageProps) {
  const { t } = useTranslation("assigners");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const logAccess = useLogClassAccess();
  const { can } = useCan();
  const canManage = can("assigners:manage");
  const { data: classDoc } = useClass(classId);
  const nameFormat = resolveRosterNameFormat(classDoc ?? {});
  const { data, isPending, isError, refetch } = useRandomAssigners(classId);
  const removeAssigner = useRemoveRandomAssigner();
  const runAssigner = useRunRandomAssigner();
  const [deleting, setDeleting] = useState<RandomAssignerListItem | null>(null);

  const printRun = useCallback(
    async (assigner: RandomAssignerListItem, runId: Id<"randomAssignerRuns">) => {
      const run = await queryClient.fetchQuery(
        convexQuery(api.randomAssigners.getRun, {
          classId,
          assignerId: assigner._id,
          runId,
        }),
      );
      await printRandomAssignerRun(
        run,
        {
          documentTitle: `${run.assignerName} — ${t("randomPrintDocumentTitle")}`,
          heading: run.assignerName,
          subtitle: t("randomPrintSubtitle", {
            count: run.assignments.length,
            date: new Date(run.ranAt).toLocaleString(),
          }),
          itemColumn: t("randomPrintItemColumn"),
          classColumn: t("randomScopeClass"),
          ungroupedColumn: t("randomUngroupedLabel"),
          logoAlt: randomAssignerPrintLogoAlt(),
        },
        nameFormat,
      );
      logAccess.mutate({
        classId,
        resourceType: "randomAssigner",
        resourceId: runId,
        summary: `Exported random assigner "${assigner.name}" PDF`,
        summaryKey: "activitySummary_exportedRandomAssignerPdf",
        metadata: { name: assigner.name },
      });
    },
    [classId, logAccess, nameFormat, queryClient, t],
  );

  const handlePrintLatest = useCallback(
    async (assigner: RandomAssignerListItem) => {
      if (!assigner.latestRunId) return;
      try {
        await printRun(assigner, assigner.latestRunId);
      } catch (error) {
        toast.add({
          title: messageFromError(error, t("printPdfFailed")),
          type: "error",
        });
      }
    },
    [printRun, t],
  );

  const handleRunAndPrint = useCallback(
    async (assigner: RandomAssignerListItem) => {
      try {
        const runId = await runAssigner.mutateAsync({
          classId,
          assignerId: assigner._id,
          scope: assigner.defaultScope,
          replicates: assigner.defaultReplicates,
        });
        try {
          await printRun(assigner, runId);
        } catch (error) {
          toast.add({
            title: messageFromError(error, t("printPdfFailed")),
            type: "error",
          });
        }
      } catch {
        // toast handled in hook
      }
    },
    [classId, printRun, runAssigner, t],
  );

  const handleDisplayLatest = useCallback((assigner: RandomAssignerListItem) => {
    if (!assigner.latestRunId) return;
    openDisplayTab(randomAssignerDisplayUrl(assigner.latestRunId));
  }, []);

  return (
    <div className="flex w-full flex-col gap-4 px-4 py-8 sm:px-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("randomTitle")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("randomDescription")}</p>
        </div>
        {canManage ? (
          <Button
            type="button"
            nativeButton={false}
            render={<Link to="/class/$classId/assigners/random/new" params={{ classId }} />}
          >
            <Plus className="size-4" />
            {t("randomCreate")}
          </Button>
        ) : null}
      </div>

      {isPending ? (
        <div className={GRID_CLASS}>
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-40 w-full rounded-2xl" />
          ))}
        </div>
      ) : null}

      {isError ? (
        <ErrorState
          title={t("randomLoadFailed")}
          description={t("randomLoadFailedDescription")}
          onRetry={() => void refetch()}
        />
      ) : null}

      {!isPending && !isError && data && data.length === 0 ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Dices />
            </EmptyMedia>
            <EmptyTitle>{t("randomEmptyTitle")}</EmptyTitle>
            <EmptyDescription>{t("randomEmptyDescription")}</EmptyDescription>
          </EmptyHeader>
          {canManage ? (
            <EmptyContent>
              <Button
                type="button"
                nativeButton={false}
                render={<Link to="/class/$classId/assigners/random/new" params={{ classId }} />}
              >
                <Plus className="size-4" />
                {t("randomCreate")}
              </Button>
            </EmptyContent>
          ) : null}
        </Empty>
      ) : null}

      {!isPending && !isError && data && data.length > 0 ? (
        <ul className={GRID_CLASS}>
          {data.map((assigner) => (
            <RandomAssignerCard
              key={assigner._id}
              assigner={assigner}
              classId={classId}
              canManage={canManage}
              onNavigate={() => {
                void navigate({
                  to: "/class/$classId/assigners/random/$assignerId",
                  params: { classId, assignerId: assigner._id },
                });
              }}
              onEdit={() => {
                void navigate({
                  to: "/class/$classId/assigners/random/$assignerId/edit",
                  params: { classId, assignerId: assigner._id },
                });
              }}
              onDelete={() => setDeleting(assigner)}
              onDisplayLatest={() => handleDisplayLatest(assigner)}
              onPrintLatest={() => handlePrintLatest(assigner)}
              onRunAndPrint={() => handleRunAndPrint(assigner)}
              t={t}
            />
          ))}
        </ul>
      ) : null}

      <DeleteNamedCredenza
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title={t("randomDeleteTitle")}
        description={t("randomDeleteDescription", { name: deleting?.name ?? "" })}
        confirmLabel={t("randomDeleteConfirm")}
        onConfirm={async () => {
          if (!deleting) return;
          await removeAssigner.mutateAsync({ classId, assignerId: deleting._id });
          setDeleting(null);
        }}
      />
    </div>
  );
}

function RandomAssignerCard({
  assigner,
  canManage,
  onNavigate,
  onEdit,
  onDelete,
  onDisplayLatest,
  onPrintLatest,
  onRunAndPrint,
  t,
}: {
  assigner: RandomAssignerListItem;
  classId: Id<"classes">;
  canManage: boolean;
  onNavigate: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDisplayLatest: () => void;
  onPrintLatest: () => void | Promise<void>;
  onRunAndPrint: () => void | Promise<void>;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const hasLatest = assigner.latestRunId !== null;
  const previewItems = assigner.items.slice(0, CARD_ITEM_PREVIEW_LIMIT);
  const useColumns = previewItems.length > CARD_ITEM_COLUMN_THRESHOLD;
  const remainingCount = assigner.items.length - CARD_ITEM_PREVIEW_LIMIT;

  const menuItems = useMemo<Array<ActionMenuItem>>(() => {
    const items: Array<ActionMenuItem> = [];
    if (canManage) {
      items.push({
        id: "run-and-print",
        label: t("randomRunAndPrint"),
        icon: <Play />,
        permission: "assigners:manage",
        onSelect: onRunAndPrint,
      });
    }
    if (hasLatest) {
      items.push(
        {
          id: "display",
          label: t("randomDisplayLatest"),
          icon: <Monitor />,
          onSelect: onDisplayLatest,
        },
        {
          id: "print",
          label: t("printPdf"),
          icon: <FileDown />,
          onSelect: onPrintLatest,
        },
      );
    }
    if (canManage) {
      items.push(
        {
          id: "edit",
          label: t("randomEdit"),
          icon: <Pencil />,
          permission: "assigners:manage",
          group: "manage",
          onSelect: onEdit,
        },
        {
          id: "delete",
          label: t("randomDelete"),
          icon: <Trash2 />,
          permission: "assigners:manage",
          variant: "destructive",
          group: "danger",
          onSelect: onDelete,
        },
      );
    }
    return items;
  }, [canManage, hasLatest, onDelete, onDisplayLatest, onEdit, onPrintLatest, onRunAndPrint, t]);

  return (
    <li>
      <Card
        size="sm"
        className="h-full cursor-pointer transition-colors hover:bg-accent/40"
        onClick={onNavigate}
      >
        <CardHeader className="flex flex-row items-start gap-3">
          <div className="min-w-0 flex-1">
            <CardTitle className="truncate text-base font-semibold">{assigner.name}</CardTitle>
            <CardDescription className="mt-1">
              {t("randomCardMeta", {
                itemCount: assigner.items.length,
                runCount: assigner.runCount,
                scope: formatRandomAssignerScope(assigner.defaultScope, t),
              })}
            </CardDescription>
          </div>
          <div
            className="shrink-0"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <ActionMenu items={menuItems} label={t("randomActions")} />
          </div>
        </CardHeader>
        <CardContent className="border-t pt-0">
          <ul
            className={cn(
              useColumns ? "grid grid-cols-2 gap-x-3" : "divide-y",
              useColumns && "gap-y-0",
            )}
          >
            {previewItems.map((item) => (
              <li
                key={item}
                className={cn(
                  "truncate text-sm text-muted-foreground",
                  useColumns ? "py-1.5" : "py-2",
                )}
                title={item}
              >
                {item}
              </li>
            ))}
          </ul>
          {remainingCount > 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {t("randomMoreItems", { count: remainingCount })}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </li>
  );
}
