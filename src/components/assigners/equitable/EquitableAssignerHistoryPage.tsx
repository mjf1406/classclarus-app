import { Link } from "@tanstack/react-router";
import { convexQuery } from "@convex-dev/react-query";
import { ArrowLeft, Monitor, Pencil, Play, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";

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
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
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
import { useRemoveEquitableAssignerRun } from "@/hooks/assigners/equitable/useRemoveEquitableAssignerRun";
import { useRunEquitableAssigner } from "@/hooks/assigners/equitable/useRunEquitableAssigner";
import {
  useEquitableAssigner,
  useEquitableAssignerRuns,
} from "@/hooks/assigners/equitable/useEquitableAssigners";
import { useCan } from "@/hooks/permissions/useCan";
import {
  equitableAssignerDisplayUrl,
  formatEquitableAssignerBalanceGender,
  formatEquitableAssignerScope,
  nextEquitableAssignerRunSortState,
  sortEquitableAssignerRuns,
  type EquitableAssignerRunListItem,
  type EquitableAssignerRunSortDirection,
  type EquitableAssignerRunSortKey,
  type EquitableAssignerScope,
} from "@/lib/assigners/equitableAssigners";
import { openDisplayTab } from "@/lib/display/openDisplayTab";
import { messageFromError } from "@/lib/errors/convexError";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

type EquitableAssignerHistoryPageProps = {
  classId: Id<"classes">;
  assignerId: Id<"equitableAssigners">;
};

export function EquitableAssignerHistoryPage({
  classId,
  assignerId,
}: EquitableAssignerHistoryPageProps) {
  const { t } = useTranslation("assigners");
  const { can } = useCan();
  const canManage = can("assigners:manage");
  const {
    data: assigner,
    isPending: assignerPending,
    isError: assignerError,
    refetch,
  } = useEquitableAssigner(classId, assignerId);
  const {
    data: runs,
    isPending: runsPending,
    isError: runsError,
    refetch: refetchRuns,
  } = useEquitableAssignerRuns(classId, assignerId);
  const runMutation = useRunEquitableAssigner();
  const removeRun = useRemoveEquitableAssignerRun();
  const [scope, setScope] = useState<EquitableAssignerScope>("class");
  const [balanceGender, setBalanceGender] = useState(false);
  const [runDialogOpen, setRunDialogOpen] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [deletingRun, setDeletingRun] = useState<EquitableAssignerRunListItem | null>(null);
  const [previewRunId, setPreviewRunId] = useState<Id<"equitableAssignerRuns"> | null>(null);
  const [sortKey, setSortKey] = useState<EquitableAssignerRunSortKey>("ranAt");
  const [sortDirection, setSortDirection] = useState<EquitableAssignerRunSortDirection>("desc");

  const isPending = assignerPending || runsPending;
  const isError = assignerError || runsError;

  const sortedRuns = useMemo(
    () => (runs ? sortEquitableAssignerRuns(runs, sortKey, sortDirection) : []),
    [runs, sortDirection, sortKey],
  );

  const handleSort = useCallback(
    (nextKey: EquitableAssignerRunSortKey) => {
      const next = nextEquitableAssignerRunSortState(sortKey, sortDirection, nextKey);
      setSortKey(next.sortKey);
      setSortDirection(next.sortDirection);
    },
    [sortDirection, sortKey],
  );

  const sortState = useCallback(
    (key: EquitableAssignerRunSortKey) => (sortKey === key ? sortDirection : false),
    [sortDirection, sortKey],
  );

  const resetRunOptions = useCallback(() => {
    if (!assigner) return;
    setScope(assigner.defaultScope);
    setBalanceGender(assigner.defaultBalanceGender);
    setRunError(null);
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
    setRunError(null);
    try {
      const runId = await runMutation.mutateAsync({
        classId,
        assignerId,
        scope,
        balanceGender,
      });
      setRunDialogOpen(false);
      setPreviewRunId(runId);
    } catch (error) {
      setRunError(messageFromError(error, t("equitableRunFailed")));
    }
  }, [assigner, assignerId, balanceGender, classId, runMutation, scope, t]);

  const handleDisplay = useCallback((runId: Id<"equitableAssignerRuns">) => {
    openDisplayTab(equitableAssignerDisplayUrl(runId));
  }, []);

  const latestRunId = runs?.[0]?._id ?? null;
  const effectivePreviewRunId = previewRunId ?? latestRunId;

  if (isError) {
    return (
      <div className="flex w-full flex-col gap-4 px-4 py-8 sm:px-8">
        <ErrorState
          title={t("equitableLoadFailed")}
          description={t("equitableLoadFailedDescription")}
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
    <div className="flex w-full flex-col gap-6 px-4 py-8 sm:px-8">
      <div className="flex flex-wrap items-start gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          nativeButton={false}
          render={
            <Link
              to="/class/$classId/assigners/equitable"
              params={{ classId }}
              aria-label={t("equitableBackToList")}
            />
          }
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">{assigner.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("equitableHistoryDescription", { count: assigner.items.length })}
          </p>
        </div>
        {canManage ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              nativeButton={false}
              render={
                <Link
                  to="/class/$classId/assigners/equitable/$assignerId/edit"
                  params={{ classId, assignerId }}
                />
              }
            >
              <Pencil className="size-4" />
              {t("equitableEdit")}
            </Button>
            <Button type="button" onClick={() => handleRunDialogOpenChange(true)}>
              <Play className="size-4" />
              {t("equitableRunAction")}
            </Button>
          </div>
        ) : null}
      </div>

      <Credenza open={runDialogOpen} onOpenChange={handleRunDialogOpenChange}>
        <CredenzaContent className="sm:max-w-md">
          <CredenzaHeader>
            <CredenzaTitle>{t("equitableRunDialogTitle")}</CredenzaTitle>
            <CredenzaDescription>{t("equitableRunDialogDescription")}</CredenzaDescription>
          </CredenzaHeader>
          <CredenzaBody>
            <FieldGroup className="gap-4">
              <Field>
                <FieldLabel>{t("equitableRunScopeLabel")}</FieldLabel>
                <Select
                  value={scope}
                  onValueChange={(value) => setScope(value as EquitableAssignerScope)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {scope === "groups" ? t("equitableScopeGroups") : t("equitableScopeClass")}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="class">{t("equitableScopeClass")}</SelectItem>
                    <SelectItem value="groups">{t("equitableScopeGroups")}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field orientation="horizontal">
                <Checkbox
                  id="run-balance-gender"
                  checked={balanceGender}
                  onCheckedChange={(checked) => setBalanceGender(checked === true)}
                />
                <FieldLabel htmlFor="run-balance-gender" className="font-normal">
                  {t("equitableBalanceGenderLabel")}
                </FieldLabel>
              </Field>
              {runError ? <FieldError>{runError}</FieldError> : null}
            </FieldGroup>
          </CredenzaBody>
          <CredenzaFooter className="flex-row justify-between gap-2">
            <CredenzaClose render={<Button type="button" variant="outline" className="flex-1" />}>
              {t("equitableCancel")}
            </CredenzaClose>
            <AsyncButton
              type="button"
              className="flex-1"
              onClick={() => void handleRun()}
              pending={runMutation.isPending}
            >
              <Play className="size-4" />
              {t("equitableRunAction")}
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
                    label={t("equitableHistoryWhen")}
                    sorted={sortState("ranAt")}
                    onSort={() => handleSort("ranAt")}
                  />
                </TableHead>
                <TableHead>
                  <DataTableSortableHeader
                    label={t("equitableHistoryScope")}
                    sorted={sortState("scope")}
                    onSort={() => handleSort("scope")}
                  />
                </TableHead>
                <TableHead>
                  <DataTableSortableHeader
                    label={t("equitableHistoryBalanceGender")}
                    sorted={sortState("balanceGender")}
                    onSort={() => handleSort("balanceGender")}
                  />
                </TableHead>
                <TableHead className="text-right">
                  <div className="flex justify-end">
                    <DataTableSortableHeader
                      label={t("equitableHistoryCount")}
                      sorted={sortState("assignmentCount")}
                      onSort={() => handleSort("assignmentCount")}
                    />
                  </div>
                </TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">{t("equitableActions")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRuns.map((run) => {
                const menuItems: Array<ActionMenuItem> = [
                  {
                    id: "display",
                    label: t("equitableDisplayRun"),
                    icon: <Monitor />,
                    onSelect: () => handleDisplay(run._id),
                  },
                ];
                if (canManage) {
                  menuItems.push({
                    id: "delete",
                    label: t("equitableDeleteRun"),
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
                    <TableCell>{formatEquitableAssignerScope(run.scope, t)}</TableCell>
                    <TableCell>
                      {formatEquitableAssignerBalanceGender(run.balanceGender, t)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{run.assignmentCount}</TableCell>
                    <TableCell onClick={(event) => event.stopPropagation()}>
                      <ActionMenu items={menuItems} label={t("equitableRunActions")} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t("equitableHistoryEmpty")}</p>
      )}

      {effectivePreviewRunId ? (
        <EquitableAssignerPreview
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
        title={t("equitableRunDeleteTitle")}
        description={t("equitableRunDeleteDescription")}
        confirmLabel={t("equitableDeleteConfirm")}
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
    </div>
  );
}

function EquitableAssignerPreview({
  classId,
  assignerId,
  runId,
}: {
  classId: Id<"classes">;
  assignerId: Id<"equitableAssigners">;
  runId: Id<"equitableAssignerRuns">;
}) {
  const { t } = useTranslation("assigners");
  const queryClient = useQueryClient();
  const [assignments, setAssignments] = useState<Array<{
    studentDisplayName: string;
    item: string;
    groupName?: string;
  }> | null>(null);

  useEffect(() => {
    let cancelled = false;
    void queryClient
      .fetchQuery(convexQuery(api.equitableAssigners.getRun, { classId, assignerId, runId }))
      .then((run) => {
        if (cancelled) return;
        setAssignments(
          [...run.assignments].sort((a, b) =>
            a.studentDisplayName.localeCompare(b.studentDisplayName),
          ),
        );
      });
    return () => {
      cancelled = true;
    };
  }, [assignerId, classId, queryClient, runId]);

  if (!assignments) {
    return <Skeleton className="h-48 w-full rounded-xl" />;
  }

  return (
    <div className="rounded-xl border">
      <div className="border-b px-4 py-3">
        <h2 className="text-sm font-medium">{t("equitablePreviewTitle")}</h2>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("equitablePrintStudentColumn")}</TableHead>
              <TableHead>{t("equitablePrintItemColumn")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assignments.map((row, index) => (
              <TableRow key={`${row.studentDisplayName}-${row.item}-${index}`}>
                <TableCell>
                  {row.studentDisplayName}
                  {row.groupName ? (
                    <span className="ml-2 text-xs text-muted-foreground">({row.groupName})</span>
                  ) : null}
                </TableCell>
                <TableCell>{row.item}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
