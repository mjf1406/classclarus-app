import type { ColumnDef } from "@tanstack/react-table";
import { ChevronsUpDownIcon, Pencil, Trash2, XIcon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  ConstraintKindBadge,
  ConstraintKindIcons,
} from "@/components/assigners/SeatConstraintKind";
import { DataTableSortableHeader } from "@/components/feedback/DataTableSortableHeader";
import { RosterTable } from "@/components/roster/RosterTable";
import { ActionMenu, type ActionMenuItem } from "@/components/ui/action-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { constraintKindLabel } from "@/lib/assigners/seatConstraints";
import {
  buildSeatConstraintRosterRows,
  isSeatConstraintRosterRow,
  type SeatConstraint,
  type SeatConstraintList,
  type SeatConstraintPolarity,
  type SeatConstraintType,
} from "@/lib/assigners/seatConstraints";
import { memberMatchesQuery, normalizeSearchText } from "@/lib/members/memberSearch";
import {
  getRosterDisplayName,
  type RosterColumnId,
  type RosterNameFormat,
  type StudentRosterEntry,
} from "@/lib/roster/roster";
import type { Id } from "../../../convex/_generated/dataModel";

type ConstraintKindFilter = `${SeatConstraintPolarity}:${SeatConstraintType}`;

const CONSTRAINT_KIND_FILTERS: ConstraintKindFilter[] = [
  "must:neighbor",
  "mustNot:neighbor",
  "must:teammate",
  "mustNot:teammate",
  "must:zone",
  "mustNot:zone",
];

type SeatConstraintsRosterTableProps = {
  constraints: SeatConstraintList;
  roster: StudentRosterEntry[];
  nameFormat: RosterNameFormat;
  nameQuery: string;
  columnOrder: RosterColumnId[];
  columnVisibility: Record<RosterColumnId, boolean>;
  canManage: boolean;
  onEdit: (constraint: SeatConstraint) => void;
  onDelete: (constraint: SeatConstraint) => void;
};

function constraintKindKey(constraint: SeatConstraint): ConstraintKindFilter {
  return `${constraint.polarity}:${constraint.type}`;
}

function constraintTypeLabel(constraint: SeatConstraint, t: (key: string) => string): string {
  return constraintKindLabel(constraint.polarity, constraint.type, t);
}

function constraintKindOptionLabel(kind: ConstraintKindFilter, t: (key: string) => string): string {
  const [polarity, type] = kind.split(":") as [SeatConstraintPolarity, SeatConstraintType];
  return constraintKindLabel(polarity, type, t);
}

function constraintTargetLabel(
  constraint: SeatConstraint,
  studentName: (userId: Id<"users">) => string,
  t: (key: string) => string,
): string {
  if (constraint.type === "zone") {
    return constraint.zoneName?.trim() || t("constraintUnknownStudent");
  }
  if (!constraint.otherStudentUserId) {
    return t("constraintUnknownStudent");
  }
  return studentName(constraint.otherStudentUserId);
}

function toggleKind(
  selected: ConstraintKindFilter[],
  value: ConstraintKindFilter,
  checked: boolean,
): ConstraintKindFilter[] {
  if (checked) {
    if (selected.includes(value)) return selected;
    return [...selected, value];
  }
  return selected.filter((entry) => entry !== value);
}

function TypeMultiSelectFilter({
  label,
  clearLabel,
  options,
  selected,
  onChange,
}: {
  label: string;
  clearLabel: string;
  options: Array<{ value: ConstraintKindFilter; label: string }>;
  selected: ConstraintKindFilter[];
  onChange: (next: ConstraintKindFilter[]) => void;
}) {
  return (
    <div className="flex w-full items-center gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 min-w-0 flex-1 justify-between gap-2"
            />
          }
        >
          <span className="truncate">{label}</span>
          {selected.length > 0 ? <Badge variant="secondary">{selected.length}</Badge> : null}
          <ChevronsUpDownIcon data-icon="inline-end" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-48">
          <DropdownMenuGroup>
            <DropdownMenuLabel>{label}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {options.map((option) => {
              const checked = selected.includes(option.value);
              const [polarity, type] = option.value.split(":") as [
                SeatConstraintPolarity,
                SeatConstraintType,
              ];
              return (
                <DropdownMenuCheckboxItem
                  key={option.value}
                  checked={checked}
                  onCheckedChange={(next) => {
                    onChange(toggleKind(selected, option.value, next === true));
                  }}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <ConstraintKindIcons polarity={polarity} type={type} />
                    <span>{option.label}</span>
                  </span>
                </DropdownMenuCheckboxItem>
              );
            })}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {selected.length > 0 ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="size-8 shrink-0"
          aria-label={clearLabel}
          onClick={() => onChange([])}
        >
          <XIcon />
        </Button>
      ) : null}
    </div>
  );
}

export function SeatConstraintsRosterTable({
  constraints,
  roster,
  nameFormat,
  nameQuery,
  columnOrder,
  columnVisibility,
  canManage,
  onEdit,
  onDelete,
}: SeatConstraintsRosterTableProps) {
  const { t } = useTranslation("assigners");
  const { t: tClasses } = useTranslation("classes");

  const [targetQuery, setTargetQuery] = useState("");
  const [selectedKinds, setSelectedKinds] = useState<ConstraintKindFilter[]>([]);

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

  const filteredRows = useMemo(() => {
    const nameQ = normalizeSearchText(nameQuery);
    const targetQ = normalizeSearchText(targetQuery);
    const kindSet = selectedKinds.length > 0 ? new Set(selectedKinds) : null;

    return rows.filter((row) => {
      const constraint = constraintById.get(row.constraintId);
      if (!constraint) return false;

      if (
        nameQ &&
        !memberMatchesQuery(
          {
            id: row.userId,
            name: row.name,
            firstName: row.firstName,
            lastName: row.lastName,
          },
          nameQ,
        )
      ) {
        return false;
      }

      if (kindSet && !kindSet.has(constraintKindKey(constraint))) return false;

      if (targetQ) {
        const target = constraintTargetLabel(constraint, studentName, t);
        if (!normalizeSearchText(target).includes(targetQ)) return false;
      }

      return true;
    });
  }, [constraintById, nameQuery, rows, selectedKinds, studentName, t, targetQuery]);

  const typeOptions = useMemo(
    () =>
      CONSTRAINT_KIND_FILTERS.map((kind) => ({
        value: kind,
        label: constraintKindOptionLabel(kind, t),
      })),
    [t],
  );

  const extraColumns = useMemo((): ColumnDef<StudentRosterEntry, unknown>[] => {
    return [
      {
        id: "constraintType",
        accessorFn: (row) => {
          if (!isSeatConstraintRosterRow(row)) return "";
          const constraint = constraintById.get(row.constraintId);
          return constraint ? constraintTypeLabel(constraint, t) : "";
        },
        header: ({ column }) => (
          <div className="flex min-w-40 flex-col gap-1 py-1">
            <DataTableSortableHeader
              label={t("constraintColumnType")}
              sorted={column.getIsSorted()}
              onSort={() => column.toggleSorting(column.getIsSorted() === "asc")}
            />
            <TypeMultiSelectFilter
              label={t("constraintTypeFilterLabel")}
              clearLabel={t("constraintTypeFilterClear")}
              options={typeOptions}
              selected={selectedKinds}
              onChange={setSelectedKinds}
            />
          </div>
        ),
        cell: ({ row }) => {
          if (!isSeatConstraintRosterRow(row.original)) return null;
          const constraint = constraintById.get(row.original.constraintId);
          if (!constraint) return null;
          return (
            <ConstraintKindBadge
              polarity={constraint.polarity}
              type={constraint.type}
              label={constraintTypeLabel(constraint, t)}
            />
          );
        },
        enableSorting: true,
      },
      {
        id: "constraintTarget",
        accessorFn: (row) => {
          if (!isSeatConstraintRosterRow(row)) return "";
          const constraint = constraintById.get(row.constraintId);
          return constraint ? constraintTargetLabel(constraint, studentName, t) : "";
        },
        header: ({ column }) => (
          <div className="flex min-w-36 flex-col gap-1 py-1">
            <DataTableSortableHeader
              label={t("constraintColumnTarget")}
              sorted={column.getIsSorted()}
              onSort={() => column.toggleSorting(column.getIsSorted() === "asc")}
            />
            <Input
              value={targetQuery}
              onChange={(event) => setTargetQuery(event.target.value)}
              placeholder={t("constraintTargetSearchPlaceholder")}
              aria-label={t("constraintTargetSearchLabel")}
              autoComplete="off"
              spellCheck={false}
              className="h-8 rounded-lg"
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
            />
          </div>
        ),
        cell: ({ row }) => {
          if (!isSeatConstraintRosterRow(row.original)) return null;
          const constraint = constraintById.get(row.original.constraintId);
          if (!constraint) return null;
          return (
            <span className="text-sm">{constraintTargetLabel(constraint, studentName, t)}</span>
          );
        },
        enableSorting: true,
      },
    ];
  }, [constraintById, selectedKinds, studentName, t, targetQuery, typeOptions]);

  const renderRowActions = useCallback(
    ({ student }: { student: StudentRosterEntry }) => {
      if (!canManage || !isSeatConstraintRosterRow(student)) return null;
      const constraint = constraintById.get(student.constraintId);
      if (!constraint) return null;
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
    },
    [canManage, constraintById, onDelete, onEdit, t],
  );

  return (
    <RosterTable
      data={filteredRows}
      columnOrder={columnOrder}
      columnVisibility={columnVisibility}
      extraColumns={extraColumns}
      getRowId={(row) => (isSeatConstraintRosterRow(row) ? row.constraintId : row.userId)}
      renderRowActions={canManage ? renderRowActions : undefined}
    />
  );
}
