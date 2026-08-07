"use no memo";

import { useEffect, useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type PaginationState,
  type SortingState,
} from "@tanstack/react-table";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  ChevronsUpDownIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";
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
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useActivityLogFilter } from "@/hooks/activity/useActivityLogFilter";

const PAGE_SIZE_OPTIONS = [10, 20, 25, 30, 40, 50] as const;

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
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
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

  // Live Convex/loadMore updates would otherwise keep snapping back to page 0.
  useEffect(() => {
    setPagination((prev) => (prev.pageIndex === 0 ? prev : { ...prev, pageIndex: 0 }));
  }, [emailQuery, summaryQuery, actionFilter, roleFilter]);

  // Keep pageIndex in range when the filtered set shrinks.
  useEffect(() => {
    const pageCount = Math.max(1, Math.ceil(filtered.length / pagination.pageSize));
    const maxIndex = pageCount - 1;
    if (pagination.pageIndex > maxIndex) {
      setPagination((prev) => ({ ...prev, pageIndex: maxIndex }));
    }
  }, [filtered.length, pagination.pageIndex, pagination.pageSize]);

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    // Data grows/refreshes via Convex; only reset page when filters change (above).
    autoResetPageIndex: false,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
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

  const pageCount = Math.max(table.getPageCount(), 1);
  const canPreviousPage = table.getCanPreviousPage();
  const canNextPage = table.getCanNextPage();

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

      <ActivityLogPagination
        pageIndex={pagination.pageIndex}
        pageSize={pagination.pageSize}
        pageCount={pageCount}
        canPreviousPage={canPreviousPage}
        canNextPage={canNextPage}
        onPageSizeChange={(pageSize) => {
          setPagination((prev) => {
            const topRowIndex = prev.pageSize * prev.pageIndex;
            return {
              pageSize,
              pageIndex: Math.floor(topRowIndex / pageSize),
            };
          });
        }}
        onFirstPage={() => {
          setPagination((prev) => ({ ...prev, pageIndex: 0 }));
        }}
        onPreviousPage={() => {
          setPagination((prev) => ({
            ...prev,
            pageIndex: Math.max(0, prev.pageIndex - 1),
          }));
        }}
        onNextPage={() => {
          setPagination((prev) => ({
            ...prev,
            pageIndex: Math.min(pageCount - 1, prev.pageIndex + 1),
          }));
        }}
        onLastPage={() => {
          setPagination((prev) => ({ ...prev, pageIndex: pageCount - 1 }));
        }}
      />
    </div>
  );
}

type ActivityLogPaginationProps = {
  pageIndex: number;
  pageSize: number;
  pageCount: number;
  canPreviousPage: boolean;
  canNextPage: boolean;
  onPageSizeChange: (pageSize: number) => void;
  onFirstPage: () => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
  onLastPage: () => void;
};

function ActivityLogPagination({
  pageIndex,
  pageSize,
  pageCount,
  canPreviousPage,
  canNextPage,
  onPageSizeChange,
  onFirstPage,
  onPreviousPage,
  onNextPage,
  onLastPage,
}: ActivityLogPaginationProps) {
  const { t } = useTranslation("classes");

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium">{t("activityRowsPerPage")}</p>
        <Select
          value={String(pageSize)}
          onValueChange={(next) => {
            if (next != null) {
              onPageSizeChange(Number(next));
            }
          }}
        >
          <SelectTrigger size="sm" className="w-16" aria-label={t("activityRowsPerPage")}>
            <SelectValue>{pageSize}</SelectValue>
          </SelectTrigger>
          <SelectContent side="top" align="start">
            <SelectGroup>
              {PAGE_SIZE_OPTIONS.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {option}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-4 sm:gap-6">
        <p className="text-sm font-medium">
          {t("activityPageStatus", {
            page: pageIndex + 1,
            pageCount,
          })}
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="hidden lg:inline-flex"
            onClick={onFirstPage}
            disabled={!canPreviousPage}
            aria-label={t("activityFirstPage")}
          >
            <ChevronsLeftIcon />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={onPreviousPage}
            disabled={!canPreviousPage}
            aria-label={t("activityPreviousPage")}
          >
            <ChevronLeftIcon />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={onNextPage}
            disabled={!canNextPage}
            aria-label={t("activityNextPage")}
          >
            <ChevronRightIcon />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="hidden lg:inline-flex"
            onClick={onLastPage}
            disabled={!canNextPage}
            aria-label={t("activityLastPage")}
          >
            <ChevronsRightIcon />
          </Button>
        </div>
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
