import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { GroupTeamFilterButtons } from "@/components/groups/GroupTeamFilterButtons";
import { RosterColumnVisibilityMenu } from "@/components/roster/RosterColumnVisibilityMenu";
import { RosterTable, type RosterNameColumnFilters } from "@/components/roster/RosterTable";
import { Skeleton } from "@/components/ui/skeleton";
import { useGroupTeamFilterState } from "@/hooks/groups/useGroupTeamFilterState";
import { useGroupsBoard } from "@/hooks/groups/useGroupsBoard";
import { useCan } from "@/hooks/permissions/useCan";
import { useClassUserSettings } from "@/hooks/roster/useClassUserSettings";
import { useRosterConsumerColumnVisibility } from "@/hooks/roster/useRosterConsumerColumnVisibility";
import { useStudentRoster } from "@/hooks/roster/useStudentRoster";
import { useStudentRosterFilter } from "@/hooks/students/useStudentRosterFilter";
import {
  buildAssignerPreviewRows,
  filterAssignerPreviewRows,
  isAssignerPreviewRosterRow,
  type AssignerPreviewAssignment,
} from "@/lib/assigners/assignerRunPreview";
import { buildMembershipIndex } from "@/lib/groups/groupTeamFilters";
import {
  normalizeColumnOrder,
  normalizeColumnVisibility,
  type StudentRosterEntry,
} from "@/lib/roster/roster";
import type { Id } from "../../../convex/_generated/dataModel";

const ASSIGNER_PREVIEW_ROSTER_SURFACE = "assigner-run-preview";

type AssignerRunPreviewTableProps = {
  classId: Id<"classes">;
  assignments: readonly AssignerPreviewAssignment[];
  title: string;
  itemColumnLabel: string;
};

function AssignerRunPreviewTableView({
  classId,
  assignments,
  title,
  itemColumnLabel,
  roster,
}: AssignerRunPreviewTableProps & {
  roster: ReturnType<typeof useStudentRoster>["data"];
}) {
  const { t } = useTranslation("assigners");
  const { t: tClasses } = useTranslation("classes");
  const { data: settings } = useClassUserSettings(classId);
  const { data: board, isPending: boardPending } = useGroupsBoard(classId);
  const groupTeamFilterState = useGroupTeamFilterState(classId);
  const [firstNameQuery, setFirstNameQuery] = useState("");
  const [lastNameQuery, setLastNameQuery] = useState("");
  const [nameQuery, setNameQuery] = useState("");

  const columnOrder = useMemo(
    () => normalizeColumnOrder(settings?.studentsColumnOrder),
    [settings?.studentsColumnOrder],
  );
  const baseColumnVisibility = useMemo(
    () => normalizeColumnVisibility(settings?.studentsColumnVisibility),
    [settings?.studentsColumnVisibility],
  );
  const { columnVisibility, setColumnVisibility } = useRosterConsumerColumnVisibility(
    classId,
    ASSIGNER_PREVIEW_ROSTER_SURFACE,
    baseColumnVisibility,
  );

  const rows = useMemo(() => buildAssignerPreviewRows(assignments, roster), [assignments, roster]);
  const membershipByUserId = useMemo(() => (board ? buildMembershipIndex(board) : {}), [board]);
  const filterState = useMemo(
    () =>
      board
        ? {
            groupIds: groupTeamFilterState.groupIds,
            teamIds: groupTeamFilterState.teamIds,
            includeUngrouped: groupTeamFilterState.includeUngrouped,
          }
        : { groupIds: [], teamIds: [], includeUngrouped: false },
    [
      board,
      groupTeamFilterState.groupIds,
      groupTeamFilterState.includeUngrouped,
      groupTeamFilterState.teamIds,
    ],
  );
  const { filtered: membershipFiltered } = useStudentRosterFilter({
    members: rows,
    query: "",
    membershipByUserId,
    filterState,
  });
  const filteredRows = useMemo(
    () =>
      filterAssignerPreviewRows(membershipFiltered, {
        firstName: firstNameQuery,
        lastName: lastNameQuery,
        name: nameQuery,
      }),
    [firstNameQuery, lastNameQuery, membershipFiltered, nameQuery],
  );

  const nameColumnFilters = useMemo((): RosterNameColumnFilters => {
    const placeholder = t("constraintNameSearchPlaceholder");
    const ariaLabel = t("constraintNameSearchLabel");
    return {
      firstName: {
        value: firstNameQuery,
        onChange: setFirstNameQuery,
        placeholder,
        "aria-label": `${tClasses("rosterColumnFirstName")}. ${ariaLabel}`,
      },
      lastName: {
        value: lastNameQuery,
        onChange: setLastNameQuery,
        placeholder,
        "aria-label": `${tClasses("rosterColumnLastName")}. ${ariaLabel}`,
      },
      name: {
        value: nameQuery,
        onChange: setNameQuery,
        placeholder,
        "aria-label": `${tClasses("rosterColumnName")}. ${ariaLabel}`,
      },
    };
  }, [firstNameQuery, lastNameQuery, nameQuery, t, tClasses]);

  const extraColumns = useMemo((): ColumnDef<StudentRosterEntry, unknown>[] => {
    return [
      {
        id: "assignedItem",
        accessorFn: (row) => (isAssignerPreviewRosterRow(row) ? row.assignedItem : ""),
        header: itemColumnLabel,
        cell: ({ row }) => {
          if (!isAssignerPreviewRosterRow(row.original)) return null;
          return (
            <span>
              {row.original.assignedItem}
              {row.original.assignedGroupName ? (
                <span className="ml-2 text-xs text-muted-foreground">
                  ({row.original.assignedGroupName})
                </span>
              ) : null}
            </span>
          );
        },
        enableSorting: true,
      },
    ];
  }, [itemColumnLabel]);

  if (boardPending) {
    return <Skeleton className="h-48 w-full rounded-xl" />;
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <GroupTeamFilterButtons classId={classId} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-medium">{title}</h2>
        <RosterColumnVisibilityMenu
          columnOrder={columnOrder}
          columnVisibility={columnVisibility}
          onColumnVisibilityChange={setColumnVisibility}
        />
      </div>
      <RosterTable
        data={filteredRows}
        columnOrder={columnOrder}
        columnVisibility={columnVisibility}
        extraColumns={extraColumns}
        nameColumnFilters={nameColumnFilters}
        getRowId={(row) =>
          isAssignerPreviewRosterRow(row) ? `${row.userId}:${row.assignmentIndex}` : row.userId
        }
      />
    </div>
  );
}

function AssignerRunPreviewTableWithRoster(props: AssignerRunPreviewTableProps) {
  const { data: roster, isPending } = useStudentRoster(props.classId);
  if (isPending) {
    return <Skeleton className="h-48 w-full rounded-xl" />;
  }
  return <AssignerRunPreviewTableView {...props} roster={roster} />;
}

export function AssignerRunPreviewTable(props: AssignerRunPreviewTableProps) {
  const { can, isPending } = useCan();
  if (isPending) {
    return <Skeleton className="h-48 w-full rounded-xl" />;
  }
  if (can("students:read")) {
    return <AssignerRunPreviewTableWithRoster {...props} />;
  }
  return <AssignerRunPreviewTableView {...props} roster={undefined} />;
}
