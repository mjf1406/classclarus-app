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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  UNSET_FILTER,
  type AssignmentSortDirection,
  type AssignmentSortKey,
} from "@/lib/assignments/assignments";

type AssignmentsToolbarProps = {
  sortKey: AssignmentSortKey;
  sortDirection: AssignmentSortDirection;
  searchQuery: string;
  resultCount: number;
  canCreate: boolean;
  subjects: string[];
  units: string[];
  subjectFilter: string | null;
  unitFilter: string | null;
  onSearchChange: (value: string) => void;
  onSortChange: (key: AssignmentSortKey) => void;
  onSubjectFilterChange: (value: string | null) => void;
  onUnitFilterChange: (value: string | null) => void;
  onClearFilters: () => void;
  onCreate: () => void;
};

function sortLabel(
  key: AssignmentSortKey,
  activeKey: AssignmentSortKey,
  direction: AssignmentSortDirection,
  labels: Record<AssignmentSortKey, string>,
): string {
  const base = labels[key];
  if (key !== activeKey) return base;
  if (key === "name") {
    return `${base} ${direction === "asc" ? "↓" : "↑"}`;
  }
  return `${base} ${direction === "asc" ? "↑" : "↓"}`;
}

export function AssignmentsToolbar({
  sortKey,
  sortDirection,
  searchQuery,
  resultCount,
  canCreate,
  subjects,
  units,
  subjectFilter,
  unitFilter,
  onSearchChange,
  onSortChange,
  onSubjectFilterChange,
  onUnitFilterChange,
  onClearFilters,
  onCreate,
}: AssignmentsToolbarProps) {
  const { t } = useTranslation("assignments");
  const labels: Record<AssignmentSortKey, string> = {
    name: t("sortName"),
    created: t("sortCreated"),
    updated: t("sortUpdated"),
    due: t("sortDue"),
  };
  const hasFilters = subjectFilter !== null || unitFilter !== null;
  const labelFor = (value: string) => (value === UNSET_FILTER ? t("filterUnset") : value);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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

      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
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

        <Select
          value={subjectFilter ?? "__all__"}
          onValueChange={(value) =>
            onSubjectFilterChange(!value || value === "__all__" ? null : value)
          }
        >
          <SelectTrigger className="w-full sm:w-44" aria-label={t("filterSubject")}>
            <SelectValue>
              {subjectFilter === null
                ? `${t("filterSubject")}: ${t("filterAll")}`
                : `${t("filterSubject")}: ${labelFor(subjectFilter)}`}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="__all__">{t("filterAll")}</SelectItem>
              {subjects.map((subject) => (
                <SelectItem key={subject} value={subject}>
                  {labelFor(subject)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <Select
          value={unitFilter ?? "__all__"}
          onValueChange={(value) =>
            onUnitFilterChange(!value || value === "__all__" ? null : value)
          }
        >
          <SelectTrigger className="w-full sm:w-44" aria-label={t("filterUnit")}>
            <SelectValue>
              {unitFilter === null
                ? `${t("filterUnit")}: ${t("filterAll")}`
                : `${t("filterUnit")}: ${labelFor(unitFilter)}`}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="__all__">{t("filterAll")}</SelectItem>
              {units.map((unit) => (
                <SelectItem key={unit} value={unit}>
                  {labelFor(unit)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        {hasFilters ? (
          <Button type="button" variant="ghost" size="sm" onClick={onClearFilters}>
            <XIcon data-icon="inline-start" />
            {t("filterClear")}
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup
          variant="outline"
          spacing={0}
          value={[sortKey]}
          onValueChange={(values) => {
            const next = values[0] as AssignmentSortKey | undefined;
            onSortChange(next ?? sortKey);
          }}
          className="flex-wrap"
        >
          {(["name", "due", "created", "updated"] as const).map((key) => (
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
