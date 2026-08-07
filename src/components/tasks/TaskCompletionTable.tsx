"use no memo";

import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { useTranslation } from "react-i18next";

import { DataTableSortableHeader } from "@/components/feedback/DataTableSortableHeader";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getRosterDisplayName, type RosterNameFormat } from "@/lib/roster/roster";
import type { Id } from "../../../convex/_generated/dataModel";

export type TaskCompletionStudent = {
  userId: Id<"users">;
  rosterNumber?: number;
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
};

type TaskCompletionRow = TaskCompletionStudent & {
  displayName: string;
  completed: boolean;
};

type TaskCompletionTableMeta = {
  canComplete: boolean;
  isToggling: boolean;
  onToggle: (studentUserId: Id<"users">, completed: boolean) => void;
  completeAria: (name: string) => string;
};

type TaskCompletionTableProps = {
  students: readonly TaskCompletionStudent[];
  completedStudentIds: ReadonlySet<Id<"users">>;
  nameFormat: RosterNameFormat;
  canComplete: boolean;
  isToggling: boolean;
  onToggle: (studentUserId: Id<"users">, completed: boolean) => void;
};

export function TaskCompletionTable({
  students,
  completedStudentIds,
  nameFormat,
  canComplete,
  isToggling,
  onToggle,
}: TaskCompletionTableProps) {
  const { t } = useTranslation("tasks");
  const { t: tClasses } = useTranslation("classes");
  const [sorting, setSorting] = useState<SortingState>([{ id: "rosterNumber", desc: false }]);

  const unnamed = tClasses("unnamedMember");
  const rows = useMemo(
    (): TaskCompletionRow[] =>
      students.map((student) => ({
        ...student,
        displayName: getRosterDisplayName(student, unnamed, nameFormat),
        completed: completedStudentIds.has(student.userId),
      })),
    [completedStudentIds, nameFormat, students, unnamed],
  );

  const columns = useMemo((): ColumnDef<TaskCompletionRow>[] => {
    return [
      {
        accessorKey: "rosterNumber",
        header: ({ column }) => (
          <DataTableSortableHeader
            label={tClasses("rosterColumnRosterNumber")}
            sorted={column.getIsSorted()}
            onSort={() => column.toggleSorting(column.getIsSorted() === "asc")}
          />
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground tabular-nums">
            {row.original.rosterNumber ?? "—"}
          </span>
        ),
        sortingFn: (rowA, rowB) => {
          const a = rowA.original.rosterNumber;
          const b = rowB.original.rosterNumber;
          if (a === undefined && b === undefined) return 0;
          if (a === undefined) return 1;
          if (b === undefined) return -1;
          return a - b;
        },
      },
      {
        accessorKey: "displayName",
        header: ({ column }) => (
          <DataTableSortableHeader
            label={t("columnStudent")}
            sorted={column.getIsSorted()}
            onSort={() => column.toggleSorting(column.getIsSorted() === "asc")}
          />
        ),
        cell: ({ row }) => <span className="font-medium">{row.original.displayName}</span>,
        sortingFn: (rowA, rowB) =>
          rowA.original.displayName.localeCompare(rowB.original.displayName, undefined, {
            sensitivity: "base",
          }),
      },
      {
        accessorKey: "completed",
        header: ({ column }) => (
          <div className="flex justify-center">
            <DataTableSortableHeader
              label={t("columnDone")}
              sorted={column.getIsSorted()}
              onSort={() => column.toggleSorting(column.getIsSorted() === "asc")}
            />
          </div>
        ),
        cell: ({ row, table }) => {
          const student = row.original;
          const meta = table.options.meta as TaskCompletionTableMeta;
          return (
            <div className="flex justify-center">
              <Checkbox
                checked={student.completed}
                disabled={!meta.canComplete || meta.isToggling}
                aria-label={meta.completeAria(student.displayName)}
                onCheckedChange={(value) => {
                  if (!meta.canComplete) return;
                  const next = value === true;
                  if (next === student.completed) return;
                  meta.onToggle(student.userId, next);
                }}
              />
            </div>
          );
        },
        sortingFn: (rowA, rowB) =>
          Number(rowA.original.completed) - Number(rowB.original.completed),
      },
    ];
  }, [t, tClasses]);

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => row.userId,
    meta: {
      canComplete,
      isToggling,
      onToggle,
      completeAria: (name: string) => t("completeAria", { name }),
    } satisfies TaskCompletionTableMeta,
  });

  return (
    <div className="max-w-md">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className={
                    header.column.id === "rosterNumber"
                      ? "w-14"
                      : header.column.id === "completed"
                        ? "w-20"
                        : undefined
                  }
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
