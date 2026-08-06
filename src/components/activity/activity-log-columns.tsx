import type { ColumnDef } from "@tanstack/react-table";
import type { TFunction } from "i18next";

import type { Id } from "../../../convex/_generated/dataModel";
import { DataTableSortableHeader } from "@/components/feedback/DataTableSortableHeader";
import { formatLocalizedDateTime } from "@/i18n/formatDate";

export const ACTIVITY_ACTIONS = ["read", "write", "update", "delete"] as const;
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

export const ACTIVITY_FILTER_ROLES = [
  "owner",
  "teacher",
  "assistant_teacher",
  "student",
  "guardian",
  "(unknown)",
] as const;
export type ActivityFilterRole = (typeof ACTIVITY_FILTER_ROLES)[number];

export type ActivityLogRow = {
  _id: Id<"classActivityEvents">;
  createdAt: number;
  actorEmail: string;
  actorRole: string;
  action: ActivityAction;
  summary: string;
};

const ACTIVITY_ACTION_LABEL_KEYS = {
  read: "activityAction_read",
  write: "activityAction_write",
  update: "activityAction_update",
  delete: "activityAction_delete",
} as const;

const ACTIVITY_ROLE_LABEL_KEYS = {
  owner: "roleOwner",
  teacher: "roleTeacher",
  assistant_teacher: "roleAssistantTeacher",
  student: "roleStudent",
  guardian: "roleGuardian",
  "(unknown)": "activityRoleUnknown",
} as const;

export function activityActionLabelKey(
  action: ActivityAction,
): (typeof ACTIVITY_ACTION_LABEL_KEYS)[ActivityAction] {
  return ACTIVITY_ACTION_LABEL_KEYS[action];
}

export function activityRoleLabel(role: string, t: TFunction<"classes">): string {
  if (role in ACTIVITY_ROLE_LABEL_KEYS) {
    return t(ACTIVITY_ROLE_LABEL_KEYS[role as keyof typeof ACTIVITY_ROLE_LABEL_KEYS]);
  }
  return role;
}

export function createActivityLogColumns(t: TFunction<"classes">): ColumnDef<ActivityLogRow>[] {
  return [
    {
      accessorKey: "createdAt",
      header: ({ column }) => (
        <DataTableSortableHeader
          label={t("activityColumnTime")}
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
    {
      accessorKey: "actorEmail",
      header: ({ column }) => (
        <DataTableSortableHeader
          label={t("activityColumnEmail")}
          sorted={column.getIsSorted()}
          onSort={() => column.toggleSorting(column.getIsSorted() === "asc")}
        />
      ),
      cell: ({ row }) => <span className="max-w-56 truncate">{row.original.actorEmail}</span>,
    },
    {
      accessorKey: "actorRole",
      header: ({ column }) => (
        <DataTableSortableHeader
          label={t("activityColumnRole")}
          sorted={column.getIsSorted()}
          onSort={() => column.toggleSorting(column.getIsSorted() === "asc")}
        />
      ),
      cell: ({ row }) => activityRoleLabel(row.original.actorRole, t),
      sortingFn: (rowA, rowB, columnId) => {
        const a = activityRoleLabel(String(rowA.getValue(columnId)), t);
        const b = activityRoleLabel(String(rowB.getValue(columnId)), t);
        return a.localeCompare(b);
      },
    },
    {
      accessorKey: "action",
      header: ({ column }) => (
        <DataTableSortableHeader
          label={t("activityColumnAction")}
          sorted={column.getIsSorted()}
          onSort={() => column.toggleSorting(column.getIsSorted() === "asc")}
        />
      ),
      cell: ({ row }) => t(ACTIVITY_ACTION_LABEL_KEYS[row.original.action]),
    },
    {
      accessorKey: "summary",
      header: ({ column }) => (
        <DataTableSortableHeader
          label={t("activityColumnSummary")}
          sorted={column.getIsSorted()}
          onSort={() => column.toggleSorting(column.getIsSorted() === "asc")}
        />
      ),
      cell: ({ row }) => <span className="max-w-md whitespace-normal">{row.original.summary}</span>,
    },
  ];
}
