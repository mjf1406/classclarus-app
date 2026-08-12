import { Pencil, Trash2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Trans, useTranslation } from "react-i18next";

import { ConstraintKindIcons } from "@/components/assigners/SeatConstraintKind";
import { DataTableSortableHeader } from "@/components/feedback/DataTableSortableHeader";
import { ActionMenu, type ActionMenuItem } from "@/components/ui/action-menu";
import {
  buildSeatConstraintRosterRows,
  seatConstraintPlainLanguageParts,
  type SeatConstraint,
  type SeatConstraintList,
  type SeatConstraintRosterRow,
} from "@/lib/assigners/seatConstraints";
import { memberMatchesQuery, normalizeSearchText } from "@/lib/members/memberSearch";
import {
  getRosterDisplayName,
  type RosterNameFormat,
  type StudentRosterEntry,
} from "@/lib/roster/roster";
import type { Id } from "../../../convex/_generated/dataModel";

type NameSortColumn = "firstName" | "lastName";
type SortDirection = "asc" | "desc";

type SeatConstraintsPlainListProps = {
  constraints: SeatConstraintList;
  roster: StudentRosterEntry[];
  nameFormat: RosterNameFormat;
  nameQuery: string;
  canManage: boolean;
  onEdit: (constraint: SeatConstraint) => void;
  onDelete: (constraint: SeatConstraint) => void;
};

function compareNameParts(
  left: string | null | undefined,
  right: string | null | undefined,
  direction: SortDirection,
): number {
  const result = (left ?? "").localeCompare(right ?? "", undefined, { sensitivity: "base" });
  return direction === "asc" ? result : -result;
}

export function SeatConstraintsPlainList({
  constraints,
  roster,
  nameFormat,
  nameQuery,
  canManage,
  onEdit,
  onDelete,
}: SeatConstraintsPlainListProps) {
  const { t } = useTranslation("assigners");
  const { t: tClasses } = useTranslation("classes");

  const [sortColumn, setSortColumn] = useState<NameSortColumn>("lastName");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const unnamed = tClasses("unnamedMember");

  const constraintById = useMemo(() => {
    const map = new Map<Id<"seatConstraints">, SeatConstraint>();
    for (const constraint of constraints) {
      map.set(constraint._id, constraint);
    }
    return map;
  }, [constraints]);

  const studentNameById = useMemo(() => {
    const map = new Map<Id<"users">, string>();
    for (const student of roster) {
      map.set(student.userId, getRosterDisplayName(student, unnamed, nameFormat));
    }
    return map;
  }, [nameFormat, roster, unnamed]);

  const studentName = useCallback(
    (userId: Id<"users">) => studentNameById.get(userId) ?? t("constraintUnknownStudent"),
    [studentNameById, t],
  );

  const rows = useMemo(
    () => buildSeatConstraintRosterRows(constraints, roster),
    [constraints, roster],
  );

  const filteredSortedRows = useMemo(() => {
    const nameQ = normalizeSearchText(nameQuery);

    const filtered = rows.filter((row) => {
      if (!nameQ) return true;
      return memberMatchesQuery(
        {
          id: row.userId,
          name: row.name,
          firstName: row.firstName,
          lastName: row.lastName,
        },
        nameQ,
      );
    });

    return [...filtered].sort((left, right) => {
      const primary = compareNameParts(
        sortColumn === "lastName" ? left.lastName : left.firstName,
        sortColumn === "lastName" ? right.lastName : right.firstName,
        sortDirection,
      );
      if (primary !== 0) return primary;

      const secondaryColumn: NameSortColumn = sortColumn === "lastName" ? "firstName" : "lastName";
      const secondary = compareNameParts(
        secondaryColumn === "lastName" ? left.lastName : left.firstName,
        secondaryColumn === "lastName" ? right.lastName : right.firstName,
        sortDirection,
      );
      if (secondary !== 0) return secondary;

      return left.constraintId.localeCompare(right.constraintId);
    });
  }, [nameQuery, rows, sortColumn, sortDirection]);

  const toggleSort = (column: NameSortColumn) => {
    if (sortColumn === column) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortColumn(column);
    setSortDirection("asc");
  };

  const renderRowActions = (row: SeatConstraintRosterRow) => {
    const constraint = constraintById.get(row.constraintId);
    if (!canManage || !constraint) return null;

    const items: Array<ActionMenuItem> = [
      {
        id: "edit",
        label: t("editConstraint"),
        icon: <Pencil className="size-4" />,
        permission: "assigners:manage",
        onSelect: () => onEdit(constraint),
      },
      {
        id: "delete",
        label: t("deleteConstraint"),
        icon: <Trash2 className="size-4" />,
        permission: "assigners:manage",
        variant: "destructive",
        onSelect: () => onDelete(constraint),
      },
    ];

    return <ActionMenu items={items} label={t("constraintActions")} />;
  };

  const sortHeaders = (
    <div className="flex flex-wrap items-center gap-2 border-b pb-2">
      <DataTableSortableHeader
        label={tClasses("rosterColumnLastName")}
        sorted={sortColumn === "lastName" ? sortDirection : false}
        onSort={() => toggleSort("lastName")}
      />
      <DataTableSortableHeader
        label={tClasses("rosterColumnFirstName")}
        sorted={sortColumn === "firstName" ? sortDirection : false}
        onSort={() => toggleSort("firstName")}
      />
    </div>
  );

  if (filteredSortedRows.length === 0) {
    return (
      <div className="flex min-w-0 flex-col gap-3">
        {sortHeaders}
        <p className="text-sm text-muted-foreground">{t("constraintsPlainEmpty")}</p>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {sortHeaders}
      <ol className="flex flex-col gap-2">
        {filteredSortedRows.map((row, index) => {
          const constraint = constraintById.get(row.constraintId);
          if (!constraint) return null;
          const { key, values } = seatConstraintPlainLanguageParts(constraint, studentName, t);

          return (
            <li
              key={row.constraintId}
              className="flex items-start justify-between gap-3 rounded-lg border px-3 py-2"
            >
              <p className="flex min-w-0 items-center gap-1.5 text-sm">
                <span className="text-muted-foreground tabular-nums">{index + 1}.</span>
                <ConstraintKindIcons polarity={constraint.polarity} type={constraint.type} />
                <span className="min-w-0">
                  <Trans
                    ns="assigners"
                    i18nKey={key}
                    values={values}
                    components={{ bold: <strong className="font-medium" /> }}
                  />
                </span>
              </p>
              {renderRowActions(row)}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
