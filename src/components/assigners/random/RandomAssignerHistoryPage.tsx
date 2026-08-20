import { convexQuery } from "@convex-dev/react-query";
import { FileDown, Monitor, Play, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";

import { AssignerRunPreviewTable } from "@/components/assigners/AssignerRunPreviewTable";
import { RandomAssignerShell } from "@/components/assigners/random/RandomAssignerShell";
import { DeleteNamedCredenza } from "@/components/groups/DeleteNamedCredenza";
import { DataTableSortableHeader } from "@/components/feedback/DataTableSortableHeader";
import { ActionMenu, type ActionMenuItem } from "@/components/ui/action-menu";
import { AsyncButton } from "@/components/ui/async-button";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Credenza,
  CredenzaBody,
  CredenzaClose,
  CredenzaContent,
  CredenzaDescription,
  CredenzaFooter,
  CredenzaHeader,
  CredenzaTitle,
} from "@/components/ui/credenza";
import { ErrorState } from "@/components/ui/error-state";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/components/ui/toast-manager";
import { useLogClassAccess } from "@/hooks/activity/useLogClassAccess";
import { useRemoveRandomAssignerRun } from "@/hooks/assigners/random/useRemoveRandomAssignerRun";
import { useRunRandomAssigner } from "@/hooks/assigners/random/useRunRandomAssigner";
import {
  useRandomAssigner,
  useRandomAssignerRun,
  useRandomAssignerRuns,
} from "@/hooks/assigners/random/useRandomAssigners";
import { useClass } from "@/hooks/classes/useClass";
import { useCan } from "@/hooks/permissions/useCan";
import {
  formatRandomAssignerReplicates,
  formatRandomAssignerScope,
  nextRandomAssignerRunSortState,
  randomAssignerDisplayUrl,
  sortRandomAssignerRuns,
  type RandomAssignerRunListItem,
  type RandomAssignerRunSortDirection,
  type RandomAssignerRunSortKey,
  type RandomAssignerScope,
} from "@/lib/assigners/randomAssigners";
import {
  printRandomAssignerRun,
  randomAssignerPrintLogoAlt,
} from "@/lib/assigners/randomAssignerPrint";
import { openDisplayTab } from "@/lib/display/openDisplayTab";
import { messageFromError } from "@/lib/errors/convexError";
import { resolveRosterNameFormat } from "@/lib/roster/roster";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

type RandomAssignerHistoryPageProps = {
  classId: Id<"classes">;
  assignerId: Id<"randomAssigners">;
};

export function RandomAssignerHistoryPage({ classId, assignerId }: RandomAssignerHistoryPageProps) {
  const { t } = useTranslation("assigners");
  const queryClient = useQueryClient();
  const logAccess = useLogClassAccess();
  const { can } = useCan();
  const canManage = can("assigners:manage");
  const { data: classDoc } = useClass(classId);
  const nameFormat = resolveRosterNameFormat(classDoc ?? {});
  const {
    data: assigner,
    isPending: assignerPending,
    isError: assignerError,
    refetch,
  } = useRandomAssigner(classId, assignerId);
  const {
    data: runs,
    isPending: runsPending,
    isError: runsError,
    refetch: refetchRuns,
  } = useRandomAssignerRuns(classId, assignerId);
  const runMutation = useRunRandomAssigner();
  const removeRun = useRemoveRandomAssignerRun();
  const [scope, setScope] = useState<RandomAssignerScope>("class");
  const [replicates, setReplicates] = useState(false);
  const [runDialogOpen, setRunDialogOpen] = useState(false);
  const [deletingRun, setDeletingRun] = useState<RandomAssignerRunListItem | null>(null);
  const [previewRunId, setPreviewRunId] = useState<Id<"randomAssignerRuns"> | null>(null);
  const [sortKey, setSortKey] = useState<RandomAssignerRunSortKey>("ranAt");
  const [sortDirection, setSortDirection] = useState<RandomAssignerRunSortDirection>("desc");

  const isPending = assignerPending || runsPending;
  const isError = assignerError || runsError;

  const sortedRuns = useMemo(
    () => (runs ? sortRandomAssignerRuns(runs, sortKey, sortDirection) : []),
    [runs, sortDirection, sortKey],
  );

  const handleSort = useCallback(
    (nextKey: RandomAssignerRunSortKey) => {
      const next = nextRandomAssignerRunSortState(sortKey, sortDirection, nextKey);
      setSortKey(next.sortKey);
      setSortDirection(next.sortDirection);
    },
    [sortDirection, sortKey],
  );

  const sortState = useCallback(
    (key: RandomAssignerRunSortKey) => (sortKey === key ? sortDirection : false),
    [sortDirection, sortKey],
  );

  const resetRunOptions = useCallback(() => {
    if (!assigner) return;
    setScope(assigner.defaultScope);
    setReplicates(assigner.defaultReplicates);
  }, [assigner]);

  useEffect(() => {
    resetRunOptions();
  }, [resetRunOptions]);

  const handleRunDialogOpenChange = useCallback(
    (open: boolean) => {
      setRunDialogOpen(open);
      if (open) resetRunOptions();
    },
    [resetRunOptions],
  );

  const handleRun = useCallback(async () => {
    if (!assigner) return;
    setRunDialogOpen(false);
    try {
      const runId = await runMutation.mutateAsync({
        classId,
        assignerId,
        scope,
        replicates,
      });
      setPreviewRunId(runId);
    } catch {
      // toast handled in hook
      setRunDialogOpen(true);
    }
  }, [assigner, assignerId, classId, replicates, runMutation, scope]);

  const fetchRun = useCallback(
    async (runId: Id<"randomAssignerRuns">) =>
      queryClient.fetchQuery(
        convexQuery(api.randomAssigners.getRun, { classId, assignerId, runId }),
      ),
    [assignerId, classId, queryClient],
  );

  const handlePrint = useCallback(
    async (runId: Id<"randomAssignerRuns">, assignerName: string) => {
      try {
        const run = await fetchRun(runId);
        await printRandomAssignerRun(
          run,
          {
            documentTitle: `${assignerName} — ${t("randomPrintDocumentTitle")}`,
            heading: assignerName,
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
          summary: `Exported random assigner "${assignerName}" PDF`,
          summaryKey: "activitySummary_exportedRandomAssignerPdf",
          metadata: { name: assignerName },
        });
      } catch (error) {
        toast.add({
          title: messageFromError(error, t("printPdfFailed")),
          type: "error",
        });
      }
    },
    [classId, fetchRun, logAccess, nameFormat, t],
  );

  const handleDisplay = useCallback((runId: Id<"randomAssignerRuns">) => {
    openDisplayTab(randomAssignerDisplayUrl(runId));
  }, []);

  const latestRunId = runs?.[0]?._id ?? null;
  const effectivePreviewRunId = previewRunId ?? latestRunId;

  if (isError) {
    return (
      <div className="flex w-full flex-col gap-4 px-4 py-8 sm:px-8">
        <ErrorState
          title={t("randomLoadFailed")}
          description={t("randomLoadFailedDescription")}
          onRetry={() => {
            void refetch();
            void refetchRuns();
          }}
        />
      </div>
    );
  }

  if (isPending || !assigner) {
    return (
      <div className="flex w-full flex-col gap-4 px-4 py-8 sm:px-8">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <RandomAssignerShell
      classId={classId}
      assignerId={assignerId}
      tab="dashboard"
      description={t("randomHistoryDescription", { count: assigner.items.length })}
      onRunClick={canManage ? () => handleRunDialogOpenChange(true) : undefined}
    >
      <Credenza open={runDialogOpen} onOpenChange={handleRunDialogOpenChange}>
        <CredenzaContent className="sm:max-w-md">
          <CredenzaHeader>
            <CredenzaTitle>{t("randomRunDialogTitle")}</CredenzaTitle>
            <CredenzaDescription>{t("randomRunDialogDescription")}</CredenzaDescription>
          </CredenzaHeader>
          <CredenzaBody>
            <FieldGroup className="gap-4">
              <Field>
                <FieldLabel>{t("randomRunScopeLabel")}</FieldLabel>
                <Select
                  value={scope}
                  onValueChange={(value) => setScope(value as RandomAssignerScope)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {scope === "groups" ? t("randomScopeGroups") : t("randomScopeClass")}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="class">{t("randomScopeClass")}</SelectItem>
                    <SelectItem value="groups">{t("randomScopeGroups")}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field orientation="horizontal">
                <Checkbox
                  id="run-replicates"
                  checked={replicates}
                  onCheckedChange={(checked) => setReplicates(checked === true)}
                />
                <FieldLabel htmlFor="run-replicates" className="font-normal">
                  {t("randomReplicatesLabel")}
                </FieldLabel>
              </Field>
            </FieldGroup>
          </CredenzaBody>
          <CredenzaFooter className="flex-row justify-between gap-2">
            <CredenzaClose render={<Button type="button" variant="outline" className="flex-1" />}>
              {t("randomCancel")}
            </CredenzaClose>
            <AsyncButton
              type="button"
              className="flex-1"
              onClick={() => void handleRun()}
              pending={runMutation.isPending}
            >
              <Play className="size-4" />
              {t("randomRunAction")}
            </AsyncButton>
          </CredenzaFooter>
        </CredenzaContent>
      </Credenza>

      {sortedRuns.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <DataTableSortableHeader
                    label={t("randomHistoryWhen")}
                    sorted={sortState("ranAt")}
                    onSort={() => handleSort("ranAt")}
                  />
                </TableHead>
                <TableHead>
                  <DataTableSortableHeader
                    label={t("randomHistoryScope")}
                    sorted={sortState("scope")}
                    onSort={() => handleSort("scope")}
                  />
                </TableHead>
                <TableHead>
                  <DataTableSortableHeader
                    label={t("randomHistoryReplicates")}
                    sorted={sortState("replicates")}
                    onSort={() => handleSort("replicates")}
                  />
                </TableHead>
                <TableHead className="text-right">
                  <div className="flex justify-end">
                    <DataTableSortableHeader
                      label={t("randomHistoryCount")}
                      sorted={sortState("assignmentCount")}
                      onSort={() => handleSort("assignmentCount")}
                    />
                  </div>
                </TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">{t("randomActions")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRuns.map((run) => {
                const menuItems: Array<ActionMenuItem> = [
                  {
                    id: "display",
                    label: t("randomDisplayRun"),
                    icon: <Monitor />,
                    onSelect: () => handleDisplay(run._id),
                  },
                  {
                    id: "print",
                    label: t("printPdf"),
                    icon: <FileDown />,
                    onSelect: () => void handlePrint(run._id, assigner.name),
                  },
                ];
                if (canManage) {
                  menuItems.push({
                    id: "delete",
                    label: t("randomDeleteRun"),
                    icon: <Trash2 />,
                    permission: "assigners:manage",
                    variant: "destructive",
                    onSelect: () => setDeletingRun(run),
                  });
                }
                return (
                  <TableRow
                    key={run._id}
                    className={effectivePreviewRunId === run._id ? "bg-accent/30" : undefined}
                    onClick={() => setPreviewRunId(run._id)}
                  >
                    <TableCell>{new Date(run.ranAt).toLocaleString()}</TableCell>
                    <TableCell>{formatRandomAssignerScope(run.scope, t)}</TableCell>
                    <TableCell>{formatRandomAssignerReplicates(run.replicates, t)}</TableCell>
                    <TableCell className="text-right tabular-nums">{run.assignmentCount}</TableCell>
                    <TableCell onClick={(event) => event.stopPropagation()}>
                      <ActionMenu items={menuItems} label={t("randomRunActions")} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t("randomHistoryEmpty")}</p>
      )}

      {effectivePreviewRunId ? (
        <RandomAssignerPreview
          classId={classId}
          assignerId={assignerId}
          runId={effectivePreviewRunId}
        />
      ) : null}

      <DeleteNamedCredenza
        open={deletingRun !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingRun(null);
        }}
        title={t("randomRunDeleteTitle")}
        description={t("randomRunDeleteDescription")}
        confirmLabel={t("randomDeleteConfirm")}
        onConfirm={async () => {
          if (!deletingRun) return;
          await removeRun.mutateAsync({
            classId,
            assignerId,
            runId: deletingRun._id,
          });
          if (previewRunId === deletingRun._id) {
            setPreviewRunId(null);
          }
          setDeletingRun(null);
        }}
      />
    </RandomAssignerShell>
  );
}

function RandomAssignerPreview({
  classId,
  assignerId,
  runId,
}: {
  classId: Id<"classes">;
  assignerId: Id<"randomAssigners">;
  runId: Id<"randomAssignerRuns">;
}) {
  const { t } = useTranslation("assigners");
  const { data: run, isPending, isError } = useRandomAssignerRun(classId, assignerId, runId);

  if (isPending) {
    return <Skeleton className="h-48 w-full rounded-xl" />;
  }

  if (isError || !run) {
    return <p className="text-sm text-muted-foreground">{t("randomLoadFailed")}</p>;
  }

  return (
    <AssignerRunPreviewTable
      key={runId}
      classId={classId}
      assignments={run.assignments}
      title={t("randomPreviewTitle")}
      itemColumnLabel={t("randomPrintItemColumn")}
    />
  );
}
