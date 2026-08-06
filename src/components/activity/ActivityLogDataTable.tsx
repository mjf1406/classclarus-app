import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ChevronsUpDownIcon, SearchIcon, XIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  ACTIVITY_ACTIONS,
  ACTIVITY_FILTER_ROLES,
  activityActionLabelKey,
  activityRoleLabel,
  type ActivityLogRow,
} from "@/components/activity/activity-log-columns";
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
import { useActivityLogFilter } from "@/hooks/activity/useActivityLogFilter";

type ActivityLogDataTableProps = {
  columns: ColumnDef<ActivityLogRow, unknown>[];
  data: ActivityLogRow[];
  emptyLabel: string;
};

function toggleValue(values: string[], value: string, checked: boolean): string[] {
  if (checked) {
    return values.includes(value) ? values : [...values, value];
  }
  return values.filter((entry) => entry !== value);
}

export function ActivityLogDataTable({ columns, data, emptyLabel }: ActivityLogDataTableProps) {
  const { t } = useTranslation("classes");
  const [sorting, setSorting] = useState<SortingState>([{ id: "createdAt", desc: true }]);
  const [emailQuery, setEmailQuery] = useState("");
  const [summaryQuery, setSummaryQuery] = useState("");
  const [actionFilter, setActionFilter] = useState<string[]>([]);
  const [roleFilter, setRoleFilter] = useState<string[]>([]);

  const { filtered, isFiltering } = useActivityLogFilter({
    rows: data,
    emailQuery,
    summaryQuery,
    actions: actionFilter,
    roles: roleFilter,
  });

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const hasFilters =
    emailQuery.trim().length > 0 ||
    summaryQuery.trim().length > 0 ||
    actionFilter.length > 0 ||
    roleFilter.length > 0;

  const actionOptions = useMemo(
    () =>
      ACTIVITY_ACTIONS.map((value) => ({
        value,
        label: t(activityActionLabelKey(value)),
      })),
    [t],
  );

  const roleOptions = useMemo(
    () =>
      ACTIVITY_FILTER_ROLES.map((value) => ({
        value,
        label: activityRoleLabel(value, t),
      })),
    [t],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <InputGroup className="w-full sm:max-w-56">
          <InputGroupAddon>
            <SearchIcon aria-hidden="true" />
          </InputGroupAddon>
          <InputGroupInput
            value={emailQuery}
            onChange={(event) => {
              setEmailQuery(event.target.value);
            }}
            placeholder={t("activityFilterEmailPlaceholder")}
            aria-label={t("activityFilterEmailPlaceholder")}
            autoComplete="off"
            spellCheck={false}
          />
          {emailQuery ? (
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                size="icon-xs"
                variant="ghost"
                aria-label={t("activityFilterClear")}
                onClick={() => {
                  setEmailQuery("");
                }}
              >
                <XIcon />
              </InputGroupButton>
            </InputGroupAddon>
          ) : null}
        </InputGroup>

        <MultiSelectFilter
          label={t("activityColumnRole")}
          options={roleOptions}
          selected={roleFilter}
          onChange={setRoleFilter}
        />

        <MultiSelectFilter
          label={t("activityColumnAction")}
          options={actionOptions}
          selected={actionFilter}
          onChange={setActionFilter}
        />

        <InputGroup className="w-full sm:max-w-64">
          <InputGroupAddon>
            <SearchIcon aria-hidden="true" />
          </InputGroupAddon>
          <InputGroupInput
            value={summaryQuery}
            onChange={(event) => {
              setSummaryQuery(event.target.value);
            }}
            placeholder={t("activityFilterSummaryPlaceholder")}
            aria-label={t("activityFilterSummaryPlaceholder")}
            autoComplete="off"
            spellCheck={false}
          />
          {summaryQuery ? (
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                size="icon-xs"
                variant="ghost"
                aria-label={t("activityFilterClear")}
                onClick={() => {
                  setSummaryQuery("");
                }}
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
              setEmailQuery("");
              setSummaryQuery("");
              setActionFilter([]);
              setRoleFilter([]);
            }}
          >
            {t("activityFilterClear")}
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
                <TableRow key={row.id} className={isFiltering ? "opacity-80" : undefined}>
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
