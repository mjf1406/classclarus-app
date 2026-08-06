import { ArrowDownIcon, ArrowUpIcon, ArrowUpDownIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

type DataTableSortableHeaderProps = {
  label: string;
  sorted: false | "asc" | "desc";
  onSort: () => void;
};

export function DataTableSortableHeader({ label, sorted, onSort }: DataTableSortableHeaderProps) {
  return (
    <Button variant="ghost" size="sm" className="-ml-2 h-8" onClick={onSort}>
      {label}
      {sorted === "asc" ? (
        <ArrowUpIcon data-icon="inline-end" />
      ) : sorted === "desc" ? (
        <ArrowDownIcon data-icon="inline-end" />
      ) : (
        <ArrowUpDownIcon data-icon="inline-end" />
      )}
    </Button>
  );
}
