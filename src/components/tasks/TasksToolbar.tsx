import { PlusIcon, SearchIcon, XIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { TaskSortDirection, TaskSortKey } from "@/lib/tasks/tasks";

type TasksToolbarProps = {
  sortKey: TaskSortKey;
  sortDirection: TaskSortDirection;
  searchQuery: string;
  resultCount: number;
  canCreate: boolean;
  onSearchChange: (value: string) => void;
  onSortChange: (key: TaskSortKey) => void;
  onCreate: () => void;
};

function sortLabel(
  key: TaskSortKey,
  activeKey: TaskSortKey,
  direction: TaskSortDirection,
  labels: Record<TaskSortKey, string>,
): string {
  const base = labels[key];
  if (key !== activeKey) return base;
  if (key === "name") {
    return `${base} ${direction === "asc" ? "↓" : "↑"}`;
  }
  return `${base} ${direction === "asc" ? "↑" : "↓"}`;
}

export function TasksToolbar({
  sortKey,
  sortDirection,
  searchQuery,
  resultCount,
  canCreate,
  onSearchChange,
  onSortChange,
  onCreate,
}: TasksToolbarProps) {
  const { t } = useTranslation("tasks");
  const labels: Record<TaskSortKey, string> = {
    name: t("sortName"),
    created: t("sortCreated"),
    updated: t("sortUpdated"),
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("title")}</h1>
          <p className="hidden text-muted-foreground sm:block">{t("description")}</p>
        </div>
        {canCreate ? (
          <div className="hidden sm:block">
            <Button type="button" onClick={onCreate}>
              <PlusIcon data-icon="inline-start" />
              {t("createAction")}
            </Button>
          </div>
        ) : null}
      </div>

      <InputGroup className="max-w-md">
        <InputGroupInput
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchLabel")}
          autoComplete="off"
          spellCheck={false}
        />
        <InputGroupAddon>
          <SearchIcon aria-hidden="true" />
        </InputGroupAddon>
        <InputGroupAddon align="inline-end">
          <InputGroupText>{t("searchResults", { count: resultCount })}</InputGroupText>
          {searchQuery ? (
            <InputGroupButton
              size="icon-xs"
              aria-label={t("searchClear")}
              onClick={() => onSearchChange("")}
            >
              <XIcon />
            </InputGroupButton>
          ) : null}
        </InputGroupAddon>
      </InputGroup>

      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup
          variant="outline"
          spacing={0}
          value={[sortKey]}
          onValueChange={(values) => {
            const next = values[0] as TaskSortKey | undefined;
            onSortChange(next ?? sortKey);
          }}
          className="flex-wrap"
        >
          {(["name", "created", "updated"] as const).map((key) => (
            <ToggleGroupItem key={key} value={key} className="px-3">
              {sortLabel(key, sortKey, sortDirection, labels)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {canCreate ? (
        <div className="sm:hidden">
          <Button type="button" className="w-full" onClick={onCreate}>
            <PlusIcon data-icon="inline-start" />
            {t("createAction")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
