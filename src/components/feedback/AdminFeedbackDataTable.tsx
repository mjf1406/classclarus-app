import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
} from "@tanstack/react-table";
import { ChevronsUpDownIcon, SearchIcon, XIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { SEVERITY_NONE, type AdminFeedbackRow } from "@/components/feedback/admin-feedback-columns";
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
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FEEDBACK_SEVERITIES, FEEDBACK_TYPES } from "@/lib/feedback/feedbackFormSchema";

type AdminFeedbackDataTableProps = {
  columns: ColumnDef<AdminFeedbackRow, unknown>[];
  data: AdminFeedbackRow[];
  onRowClick: (row: AdminFeedbackRow) => void;
  emptyLabel: string;
};

function toggleValue(values: string[], value: string, checked: boolean): string[] {
  if (checked) {
    return values.includes(value) ? values : [...values, value];
  }
  return values.filter((entry) => entry !== value);
}

export function AdminFeedbackDataTable({
  columns,
  data,
  onRowClick,
  emptyLabel,
}: AdminFeedbackDataTableProps) {
  const { t } = useTranslation("feedback");
  const [sorting, setSorting] = useState<SortingState>([{ id: "createdAt", desc: true }]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const typeFilter = (table.getColumn("type")?.getFilterValue() as string[] | undefined) ?? [];
  const severityFilter =
    (table.getColumn("severity")?.getFilterValue() as string[] | undefined) ?? [];
  const submitterFilter =
    (table.getColumn("submitter")?.getFilterValue() as string | undefined) ?? "";

  const hasFilters =
    typeFilter.length > 0 || severityFilter.length > 0 || submitterFilter.length > 0;

  const typeOptions = useMemo(
    () => FEEDBACK_TYPES.map((value) => ({ value, label: t(`type_${value}`) })),
    [t],
  );
  const severityOptions = useMemo(
    () => [
      ...FEEDBACK_SEVERITIES.map((value) => ({ value, label: t(`severity_${value}`) })),
      { value: SEVERITY_NONE, label: t("severity_none") },
    ],
    [t],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <MultiSelectFilter
          label={t("typeLabel")}
          options={typeOptions}
          selected={typeFilter}
          onChange={(next) =>
            table.getColumn("type")?.setFilterValue(next.length > 0 ? next : undefined)
          }
        />
        <MultiSelectFilter
          label={t("severityLabel")}
          options={severityOptions}
          selected={severityFilter}
          onChange={(next) =>
            table.getColumn("severity")?.setFilterValue(next.length > 0 ? next : undefined)
          }
        />
        <InputGroup className="w-full sm:max-w-64">
          <InputGroupAddon>
            <SearchIcon aria-hidden="true" />
          </InputGroupAddon>
          <InputGroupInput
            value={submitterFilter}
            onChange={(event) =>
              table
                .getColumn("submitter")
                ?.setFilterValue(event.target.value ? event.target.value : undefined)
            }
            placeholder={t("filterFromPlaceholder")}
            aria-label={t("filterFromPlaceholder")}
            autoComplete="off"
            spellCheck={false}
          />
          {submitterFilter ? (
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                size="icon-xs"
                variant="ghost"
                aria-label={t("filterClear")}
                onClick={() => table.getColumn("submitter")?.setFilterValue(undefined)}
              >
                <XIcon />
              </InputGroupButton>
            </InputGroupAddon>
          ) : null}
        </InputGroup>
        {hasFilters ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              table.resetColumnFilters();
            }}
          >
            {t("filterClear")}
          </Button>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => onRowClick(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  {emptyLabel}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: Array<{ value: string; label: string }>;
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button type="button" variant="outline" size="sm" className="justify-between gap-2" />
        }
      >
        <span>{label}</span>
        {selected.length > 0 ? <Badge variant="secondary">{selected.length}</Badge> : null}
        <ChevronsUpDownIcon data-icon="inline-end" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-48">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{label}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {options.map((option) => {
            const checked = selected.includes(option.value);
            return (
              <DropdownMenuCheckboxItem
                key={option.value}
                checked={checked}
                onCheckedChange={(next) => {
                  onChange(toggleValue(selected, option.value, next === true));
                }}
              >
                {option.label}
              </DropdownMenuCheckboxItem>
            );
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
