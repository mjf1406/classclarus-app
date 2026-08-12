import type { ColumnDef } from "@tanstack/react-table";
import { SearchIcon, XIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { DataTableSortableHeader } from "@/components/feedback/DataTableSortableHeader";
import { EquitableAssignerItemCountCell } from "@/components/assigners/equitable/EquitableAssignerItemCountCell";
import { EquitableAssignerShell } from "@/components/assigners/equitable/EquitableAssignerShell";
import { RosterColumnVisibilityMenu } from "@/components/roster/RosterColumnVisibilityMenu";
import { RosterTable } from "@/components/roster/RosterTable";
import { ErrorState } from "@/components/ui/error-state";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { useLogClassAccessOnce } from "@/hooks/activity/useLogClassAccess";
import { useEquitableAssigner } from "@/hooks/assigners/equitable/useEquitableAssigners";
import { useEquitableRosterMatrix } from "@/hooks/assigners/equitable/useEquitableRosterMatrix";
import { useClassUserSettings } from "@/hooks/roster/useClassUserSettings";
import { useRosterConsumerColumnVisibility } from "@/hooks/roster/useRosterConsumerColumnVisibility";
import { memberMatchesQuery, normalizeSearchText } from "@/lib/members/memberSearch";
import {
  normalizeColumnOrder,
  normalizeColumnVisibility,
  type StudentRosterEntry,
} from "@/lib/roster/roster";
import type { Id } from "../../../../convex/_generated/dataModel";

const EQUITABLE_DATA_ROSTER_SURFACE = "equitable-data";

type EquitableAssignerDataPageProps = {
  classId: Id<"classes">;
  assignerId: Id<"equitableAssigners">;
};

export function EquitableAssignerDataPage({ classId, assignerId }: EquitableAssignerDataPageProps) {
  const { t } = useTranslation("assigners");
  const { t: tClasses } = useTranslation("classes");
  const [nameQuery, setNameQuery] = useState("");
  const { data: assigner } = useEquitableAssigner(classId, assignerId);
  const {
    data: matrix,
    isPending,
    isError,
    refetch,
  } = useEquitableRosterMatrix(classId, assignerId);
  const { data: userSettings } = useClassUserSettings(classId);

  useLogClassAccessOnce(
    matrix !== undefined && assigner !== undefined,
    assigner
      ? {
          classId,
          resourceType: "roster",
          resourceId: assignerId,
          summary: `Viewed equitable assigner data for "${assigner.name}"`,
          summaryKey: "activitySummary_viewedEquitableAssignerData",
          metadata: { name: assigner.name },
        }
      : null,
  );

  const countsByStudentId = useMemo(() => {
    const map = new Map<Id<"users">, Map<string, number>>();
    for (const row of matrix?.countsByStudent ?? []) {
      map.set(
        row.studentUserId,
        new Map(row.counts.map((entry) => [entry.item, entry.count] as const)),
      );
    }
    return map;
  }, [matrix?.countsByStudent]);

  const roster = useMemo((): StudentRosterEntry[] => {
    return (matrix?.students ?? []).map((student) => ({
      userId: student.userId,
      rosterNumber: student.rosterNumber,
      firstName: student.firstName,
      lastName: student.lastName,
      name: student.name,
      image: student.image,
      email: student.email,
      role: "student" as const,
    }));
  }, [matrix?.students]);

  const filteredRoster = useMemo(() => {
    const normalizedQuery = normalizeSearchText(nameQuery);
    if (!normalizedQuery) return roster;
    return roster.filter((student) =>
      memberMatchesQuery(
        {
          id: student.userId,
          name: student.name,
          firstName: student.firstName,
          lastName: student.lastName,
          email: student.email,
        },
        normalizedQuery,
      ),
    );
  }, [nameQuery, roster]);

  const extraColumns = useMemo((): ColumnDef<StudentRosterEntry, unknown>[] => {
    return (matrix?.items ?? []).map((item) => ({
      id: `equitable-item-${item}`,
      accessorFn: (student) => countsByStudentId.get(student.userId)?.get(item) ?? 0,
      header: ({ column }) => (
        <DataTableSortableHeader
          label={item}
          sorted={column.getIsSorted()}
          onSort={() => column.toggleSorting(column.getIsSorted() === "asc")}
          truncate
        />
      ),
      enableSorting: true,
      cell: ({ row }) => {
        const count = countsByStudentId.get(row.original.userId)?.get(item) ?? 0;
        return (
          <EquitableAssignerItemCountCell
            classId={classId}
            assignerId={assignerId}
            studentUserId={row.original.userId}
            item={item}
            count={count}
          />
        );
      },
    }));
  }, [assignerId, classId, countsByStudentId, matrix?.items]);

  const columnOrder = useMemo(
    () => normalizeColumnOrder(userSettings?.studentsColumnOrder),
    [userSettings?.studentsColumnOrder],
  );
  const baseColumnVisibility = useMemo(
    () => normalizeColumnVisibility(userSettings?.studentsColumnVisibility),
    [userSettings?.studentsColumnVisibility],
  );
  const { columnVisibility, setColumnVisibility } = useRosterConsumerColumnVisibility(
    classId,
    EQUITABLE_DATA_ROSTER_SURFACE,
    baseColumnVisibility,
  );

  if (isError) {
    return (
      <EquitableAssignerShell
        classId={classId}
        assignerId={assignerId}
        tab="data"
        description={t("equitableDataDescription")}
      >
        <ErrorState
          title={t("equitableLoadFailed")}
          description={t("equitableLoadFailedDescription")}
          onRetry={() => void refetch()}
        />
      </EquitableAssignerShell>
    );
  }

  if (isPending || !matrix) {
    return (
      <EquitableAssignerShell
        classId={classId}
        assignerId={assignerId}
        tab="data"
        description={t("equitableDataDescription")}
      >
        <Skeleton className="h-64 w-full rounded-xl" />
      </EquitableAssignerShell>
    );
  }

  return (
    <EquitableAssignerShell
      classId={classId}
      assignerId={assignerId}
      tab="data"
      description={t("equitableDataDescription", { count: matrix.items.length })}
    >
      {roster.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("equitableDataEmptyStudents")}</p>
      ) : matrix.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("equitableDataEmptyItems")}</p>
      ) : (
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <InputGroup className="max-w-md">
              <InputGroupAddon>
                <SearchIcon aria-hidden="true" />
              </InputGroupAddon>
              <InputGroupInput
                value={nameQuery}
                onChange={(event) => setNameQuery(event.target.value)}
                placeholder={t("constraintNameSearchPlaceholder")}
                aria-label={t("constraintNameSearchLabel")}
                autoComplete="off"
                spellCheck={false}
              />
              {nameQuery ? (
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    size="icon-xs"
                    variant="ghost"
                    aria-label={tClasses("membersSearchClear")}
                    onClick={() => setNameQuery("")}
                  >
                    <XIcon />
                  </InputGroupButton>
                </InputGroupAddon>
              ) : null}
            </InputGroup>
            <RosterColumnVisibilityMenu
              columnOrder={columnOrder}
              columnVisibility={columnVisibility}
              onColumnVisibilityChange={setColumnVisibility}
            />
          </div>
          {filteredRoster.length === 0 ? (
            <p className="text-sm text-muted-foreground">{tClasses("membersSearchNoResults")}</p>
          ) : (
            <RosterTable
              data={filteredRoster}
              columnOrder={columnOrder}
              columnVisibility={columnVisibility}
              extraColumns={extraColumns}
            />
          )}
        </div>
      )}
    </EquitableAssignerShell>
  );
}
