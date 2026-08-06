import type { ColumnDef, FilterFn } from "@tanstack/react-table";
import type { TFunction } from "i18next";

import { DataTableSortableHeader } from "@/components/feedback/DataTableSortableHeader";
import { Badge } from "@/components/ui/badge";
import type { Id } from "../../../convex/_generated/dataModel";
import { formatLocalizedDateTime } from "@/i18n/formatDate";

export const SEVERITY_NONE = "__none__";

export type AdminFeedbackRow = {
  _id: Id<"feedback">;
  type: "bug" | "feature" | "concern" | "other";
  title: string;
  body: string;
  stepsToReproduce?: string;
  expected?: string;
  actual?: string;
  severity?: "low" | "medium" | "high";
  useCase?: string;
  proposedSolution?: string;
  importance?: "nice" | "important" | "critical";
  impact?: string;
  wantReply: boolean;
  createdAt: number;
  archivedAt?: number;
  isSeed?: boolean;
  userId: Id<"users">;
  userEmail: string | null;
  userName?: string;
  attachments: Array<{
    fileId: Id<"files">;
    name: string;
    contentType: string;
    url: string | null;
  }>;
};

const multiSelectFilter: FilterFn<AdminFeedbackRow> = (row, columnId, filterValue) => {
  const selected = filterValue as string[] | undefined;
  if (!selected || selected.length === 0) return true;
  const value = row.getValue<string>(columnId);
  return selected.includes(value);
};

const submitterSearchFilter: FilterFn<AdminFeedbackRow> = (row, _columnId, filterValue) => {
  const query = String(filterValue ?? "")
    .trim()
    .toLowerCase();
  if (!query) return true;
  const email = row.original.userEmail?.toLowerCase() ?? "";
  const name = row.original.userName?.toLowerCase() ?? "";
  return email.includes(query) || name.includes(query);
};

export function createAdminFeedbackColumns(
  t: TFunction<"feedback">,
): ColumnDef<AdminFeedbackRow>[] {
  return [
    {
      accessorKey: "type",
      header: ({ column }) => (
        <DataTableSortableHeader
          label={t("typeLabel")}
          sorted={column.getIsSorted()}
          onSort={() => column.toggleSorting(column.getIsSorted() === "asc")}
        />
      ),
      cell: ({ row }) => <Badge variant="secondary">{t(`type_${row.original.type}`)}</Badge>,
      filterFn: multiSelectFilter,
    },
    {
      id: "severity",
      accessorFn: (row) => row.severity ?? SEVERITY_NONE,
      header: ({ column }) => (
        <DataTableSortableHeader
          label={t("severityLabel")}
          sorted={column.getIsSorted()}
          onSort={() => column.toggleSorting(column.getIsSorted() === "asc")}
        />
      ),
      cell: ({ row }) =>
        row.original.severity ? (
          <Badge variant="outline">{t(`severity_${row.original.severity}`)}</Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
      filterFn: multiSelectFilter,
    },
    {
      accessorKey: "title",
      header: ({ column }) => (
        <DataTableSortableHeader
          label={t("titleLabel")}
          sorted={column.getIsSorted()}
          onSort={() => column.toggleSorting(column.getIsSorted() === "asc")}
        />
      ),
      cell: ({ row }) => (
        <span className="max-w-64 truncate font-medium">{row.original.title}</span>
      ),
    },
    {
      id: "submitter",
      accessorFn: (row) => row.userEmail ?? row.userName ?? "",
      header: ({ column }) => (
        <DataTableSortableHeader
          label={t("submitterLabel")}
          sorted={column.getIsSorted()}
          onSort={() => column.toggleSorting(column.getIsSorted() === "asc")}
        />
      ),
      cell: ({ row }) => (
        <span className="max-w-48 truncate text-muted-foreground">
          {row.original.userEmail ?? row.original.userName ?? t("submitterNoEmail")}
        </span>
      ),
      filterFn: submitterSearchFilter,
    },
    {
      accessorKey: "wantReply",
      header: ({ column }) => (
        <DataTableSortableHeader
          label={t("wantReplyBadge")}
          sorted={column.getIsSorted()}
          onSort={() => column.toggleSorting(column.getIsSorted() === "asc")}
        />
      ),
      cell: ({ row }) =>
        row.original.wantReply ? (
          <Badge variant="outline">{t("wantReplyBadge")}</Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => (
        <DataTableSortableHeader
          label={t("columnDate")}
          sorted={column.getIsSorted()}
          onSort={() => column.toggleSorting(column.getIsSorted() === "asc")}
        />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {formatLocalizedDateTime(row.original.createdAt)}
        </span>
      ),
    },
  ];
}
