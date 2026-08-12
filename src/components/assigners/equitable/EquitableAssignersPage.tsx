import { Link, useNavigate } from "@tanstack/react-router";
import { convexQuery } from "@convex-dev/react-query";
import { FileDown, Monitor, Pencil, Play, Plus, Scale, Trash2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";

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
import { useEquitableAssigners } from "@/hooks/assigners/equitable/useEquitableAssigners";
import { useRemoveEquitableAssigner } from "@/hooks/assigners/equitable/useRemoveEquitableAssigner";
import { useRunEquitableAssigner } from "@/hooks/assigners/equitable/useRunEquitableAssigner";
import { useClass } from "@/hooks/classes/useClass";
import { useCan } from "@/hooks/permissions/useCan";
import {
  equitableAssignerDisplayUrl,
  formatEquitableAssignerScope,
  type EquitableAssignerListItem,
} from "@/lib/assigners/equitableAssigners";
import {
  printRandomAssignerRun,
  randomAssignerPrintLogoAlt,
} from "@/lib/assigners/randomAssignerPrint";
import { openDisplayTab } from "@/lib/display/openDisplayTab";
import { messageFromError } from "@/lib/errors/convexError";
import { cn } from "@/lib/utils";
import { resolveRosterNameFormat } from "@/lib/roster/roster";

import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

const GRID_CLASS = "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3";
const CARD_ITEM_PREVIEW_LIMIT = 10;
const CARD_ITEM_COLUMN_THRESHOLD = 5;

type EquitableAssignersPageProps = {
  classId: Id<"classes">;
};

export function EquitableAssignersPage({ classId }: EquitableAssignersPageProps) {
  const { t } = useTranslation("assigners");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const logAccess = useLogClassAccess();
  const { can } = useCan();
  const canManage = can("assigners:manage");
  const { data: classDoc } = useClass(classId);
  const nameFormat = resolveRosterNameFormat(classDoc ?? {});
  const { data, isPending, isError, refetch } = useEquitableAssigners(classId);
  const removeAssigner = useRemoveEquitableAssigner();
  const runAssigner = useRunEquitableAssigner();
  const [deleting, setDeleting] = useState<EquitableAssignerListItem | null>(null);

  const printRun = useCallback(
    async (assigner: EquitableAssignerListItem, runId: Id<"equitableAssignerRuns">) => {
      const printRunDetail = await queryClient.fetchQuery(
        convexQuery(api.equitableAssigners.getRun, {
          classId,
          assignerId: assigner._id,
          runId,
        }),
      );
      await printRandomAssignerRun(
        printRunDetail,
        {
          documentTitle: `${printRunDetail.assignerName} — ${t("equitablePrintDocumentTitle")}`,
          heading: printRunDetail.assignerName,
          subtitle: t("equitablePrintSubtitle", {
            count: printRunDetail.assignments.length,
            date: new Date(printRunDetail.ranAt).toLocaleString(),
          }),
          itemColumn: t("equitablePrintItemColumn"),
          classColumn: t("equitableScopeClass"),
          ungroupedColumn: t("randomUngroupedLabel"),
          logoAlt: randomAssignerPrintLogoAlt(),
        },
        nameFormat,
      );
      logAccess.mutate({
        classId,
        resourceType: "equitableAssigner",
        resourceId: runId,
        summary: `Exported equitable assigner "${assigner.name}" PDF`,
        summaryKey: "activitySummary_exportedEquitableAssignerPdf",
        metadata: { name: assigner.name },
      });
    },
    [classId, logAccess, nameFormat, queryClient, t],
  );

  const handlePrintLatest = useCallback(
    async (assigner: EquitableAssignerListItem) => {
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

  const handleDisplayLatest = useCallback((assigner: EquitableAssignerListItem) => {
    if (!assigner.latestRunId) return;
    openDisplayTab(equitableAssignerDisplayUrl(assigner.latestRunId));
  }, []);

  const handleRunAndPrint = useCallback(
    async (assigner: EquitableAssignerListItem) => {
      try {
        const runId = await runAssigner.mutateAsync({
          classId,
          assignerId: assigner._id,
          scope: assigner.defaultScope,
          balanceGender: assigner.defaultBalanceGender,
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

  return (
    <div className="flex w-full flex-col gap-4 px-4 py-8 sm:px-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("equitableTitle")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("equitableDescription")}</p>
        </div>
        {canManage ? (
          <Button
            type="button"
            nativeButton={false}
            render={<Link to="/class/$classId/assigners/equitable/new" params={{ classId }} />}
          >
            <Plus className="size-4" />
            {t("equitableCreate")}
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
          title={t("equitableLoadFailed")}
          description={t("equitableLoadFailedDescription")}
          onRetry={() => void refetch()}
        />
      ) : null}

      {!isPending && !isError && data && data.length === 0 ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Scale />
            </EmptyMedia>
            <EmptyTitle>{t("equitableEmptyTitle")}</EmptyTitle>
            <EmptyDescription>{t("equitableEmptyDescription")}</EmptyDescription>
          </EmptyHeader>
          {canManage ? (
            <EmptyContent>
              <Button
                type="button"
                nativeButton={false}
                render={<Link to="/class/$classId/assigners/equitable/new" params={{ classId }} />}
              >
                <Plus className="size-4" />
                {t("equitableCreate")}
              </Button>
            </EmptyContent>
          ) : null}
        </Empty>
      ) : null}

      {!isPending && !isError && data && data.length > 0 ? (
        <ul className={GRID_CLASS}>
          {data.map((assigner) => (
            <EquitableAssignerCard
              key={assigner._id}
              assigner={assigner}
              canManage={canManage}
              onNavigate={() => {
                void navigate({
                  to: "/class/$classId/assigners/equitable/$assignerId",
                  params: { classId, assignerId: assigner._id },
                });
              }}
              onEdit={() => {
                void navigate({
                  to: "/class/$classId/assigners/equitable/$assignerId/edit",
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
        title={t("equitableDeleteTitle")}
        description={t("equitableDeleteDescription", { name: deleting?.name ?? "" })}
        confirmLabel={t("equitableDeleteConfirm")}
        onConfirm={async () => {
          if (!deleting) return;
          await removeAssigner.mutateAsync({ classId, assignerId: deleting._id });
          setDeleting(null);
        }}
      />
    </div>
  );
}

function EquitableAssignerCard({
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
  assigner: EquitableAssignerListItem;
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
        label: t("equitableRunAndPrint"),
        icon: <Play />,
        permission: "assigners:manage",
        onSelect: onRunAndPrint,
      });
    }
    if (hasLatest) {
      items.push(
        {
          id: "display",
          label: t("equitableDisplayLatest"),
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
          label: t("equitableEdit"),
          icon: <Pencil />,
          permission: "assigners:manage",
          group: "manage",
          onSelect: onEdit,
        },
        {
          id: "delete",
          label: t("equitableDelete"),
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
              {t("equitableCardMeta", {
                itemCount: assigner.items.length,
                runCount: assigner.runCount,
                scope: formatEquitableAssignerScope(assigner.defaultScope, t),
              })}
            </CardDescription>
          </div>
          <div
            className="shrink-0"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <ActionMenu items={menuItems} label={t("equitableActions")} />
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
              {t("equitableMoreItems", { count: remainingCount })}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </li>
  );
}
