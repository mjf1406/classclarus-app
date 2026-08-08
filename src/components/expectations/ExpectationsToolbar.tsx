import { LayoutGridIcon, PlusIcon, SearchIcon, TableIcon, XIcon } from "lucide-react";
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
import type { ExpectationsViewMode } from "@/lib/expectations/expectations";

type ExpectationsToolbarProps = {
  searchQuery: string;
  resultCount: number;
  viewMode: ExpectationsViewMode;
  canCreate: boolean;
  onSearchChange: (value: string) => void;
  onViewModeChange: (mode: ExpectationsViewMode) => void;
  onCreate: () => void;
};

export function ExpectationsToolbar({
  searchQuery,
  resultCount,
  viewMode,
  canCreate,
  onSearchChange,
  onViewModeChange,
  onCreate,
}: ExpectationsToolbarProps) {
  const { t } = useTranslation("expectations");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("title")}</h1>
          <p className="hidden text-muted-foreground sm:block">{t("description")}</p>
        </div>
        <div className="flex items-center gap-2">
          <ToggleGroup
            variant="outline"
            spacing={0}
            value={[viewMode]}
            onValueChange={(values) => {
              const next = values[0];
              if (next === "grid" || next === "table") onViewModeChange(next);
            }}
          >
            <ToggleGroupItem value="grid" aria-label={t("viewGrid")}>
              <LayoutGridIcon />
            </ToggleGroupItem>
            <ToggleGroupItem value="table" aria-label={t("viewTable")}>
              <TableIcon />
            </ToggleGroupItem>
          </ToggleGroup>
          {canCreate ? (
            <div className="hidden sm:block">
              <Button type="button" onClick={onCreate}>
                <PlusIcon data-icon="inline-start" />
                {t("createAction")}
              </Button>
            </div>
          ) : null}
        </div>
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
