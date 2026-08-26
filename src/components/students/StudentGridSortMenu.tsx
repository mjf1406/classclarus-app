import { CheckIcon, ChevronDownIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type StudentGridSortMenuProps<K extends string> = {
  keys: readonly K[];
  sortKey: K;
  sortDirection: "asc" | "desc";
  labels: Record<K, string>;
  labelsShort: Record<K, string>;
  ariaLabel: string;
  onSortChange: (key: K) => void;
};

export function StudentGridSortMenu<K extends string>({
  keys,
  sortKey,
  sortDirection,
  labels,
  labelsShort,
  ariaLabel,
  onSortChange,
}: StudentGridSortMenuProps<K>) {
  const directionMark = sortDirection === "asc" ? "↑" : "↓";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button type="button" variant="outline" className="shrink-0" aria-label={ariaLabel} />
        }
      >
        {/* Stack all short labels invisibly so the trigger width never shifts. */}
        <span className="inline-grid justify-items-start">
          {keys.map((key) => (
            <span
              key={key}
              className="invisible col-start-1 row-start-1 whitespace-nowrap"
              aria-hidden="true"
            >
              {labelsShort[key]} <span className="inline-block w-[1em] text-center">↑</span>
            </span>
          ))}
          <span className="col-start-1 row-start-1 whitespace-nowrap">
            {labelsShort[sortKey]}{" "}
            <span className="inline-block w-[1em] text-center">{directionMark}</span>
          </span>
        </span>
        <ChevronDownIcon data-icon="inline-end" className="opacity-70" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-auto min-w-44">
        <DropdownMenuGroup>
          {keys.map((key) => {
            const active = key === sortKey;
            return (
              <DropdownMenuItem key={key} onClick={() => onSortChange(key)}>
                <span className="min-w-0 flex-1">
                  {labels[key]}
                  {active ? ` ${directionMark}` : null}
                </span>
                {active ? <CheckIcon /> : null}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
