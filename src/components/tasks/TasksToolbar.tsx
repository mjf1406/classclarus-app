import { ArchiveIcon, ArchiveXIcon, PlusIcon, SearchIcon, XIcon } from "lucide-react";
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

type ArchiveVisibility = "hide" | "show";

type TasksToolbarProps = {
  searchQuery: string;
  resultCount: number;
  canCreate: boolean;
  showArchived?: boolean;
  personalView: boolean;
  onSearchChange: (value: string) => void;
  onToggleArchived?: () => void;
  onCreate: () => void;
};

export function TasksToolbar({
  searchQuery,
  resultCount,
  canCreate,
  showArchived = false,
  personalView,
  onSearchChange,
  onToggleArchived,
  onCreate,
}: TasksToolbarProps) {
  const { t } = useTranslation("tasks");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("title")}</h1>
          <p className="hidden text-muted-foreground sm:block">
            {personalView ? t("descriptionPersonal") : t("description")}
          </p>
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

      {onToggleArchived ? (
        <ToggleGroup
          variant="outline"
          spacing={0}
          value={[showArchived ? "show" : "hide"]}
          onValueChange={(values) => {
            const next = values[0] as ArchiveVisibility | undefined;
            if (!next) return;
            if ((next === "show") !== showArchived) onToggleArchived();
          }}
          className="w-fit"
        >
          <ToggleGroupItem value="hide" aria-label={t("hideArchived")}>
            <ArchiveXIcon />
          </ToggleGroupItem>
          <ToggleGroupItem value="show" aria-label={t("showArchived")}>
            <ArchiveIcon />
          </ToggleGroupItem>
        </ToggleGroup>
      ) : null}

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
