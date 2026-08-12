import { ArrowDownIcon, ArrowUpIcon, ArrowUpDownIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DataTableSortableHeaderProps = {
  label: string;
  sorted: false | "asc" | "desc";
  onSort: () => void;
  /** Truncate long labels so the sort icon stays visible in narrow columns. */
  truncate?: boolean;
};

export function DataTableSortableHeader({
  label,
  sorted,
  onSort,
  truncate = false,
}: DataTableSortableHeaderProps) {
  const sortIcon =
    sorted === "asc" ? (
      <ArrowUpIcon data-icon="inline-end" />
    ) : sorted === "desc" ? (
      <ArrowDownIcon data-icon="inline-end" />
    ) : (
      <ArrowUpDownIcon data-icon="inline-end" />
    );

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn("-ml-2 h-8", truncate && "max-w-32 min-w-0 justify-start")}
      onClick={onSort}
      title={truncate ? label : undefined}
    >
      {truncate ? <span className="min-w-0 truncate">{label}</span> : label}
      {sortIcon}
    </Button>
  );
}
