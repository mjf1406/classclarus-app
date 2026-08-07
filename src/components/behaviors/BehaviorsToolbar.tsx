import { FolderPlus, Import, PlusIcon, SearchIcon, XIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";

type BehaviorsToolbarProps = {
  searchQuery: string;
  resultCount: number;
  canManage: boolean;
  onSearchChange: (value: string) => void;
  onCreateBehavior: () => void;
  onCreateFolder: () => void;
  onImport: () => void;
};

export function BehaviorsToolbar({
  searchQuery,
  resultCount,
  canManage,
  onSearchChange,
  onCreateBehavior,
  onCreateFolder,
  onImport,
}: BehaviorsToolbarProps) {
  const { t } = useTranslation("behaviors");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("title")}</h1>
          <p className="hidden text-muted-foreground sm:block">{t("description")}</p>
        </div>
        {canManage ? (
          <div className="hidden flex-wrap gap-2 sm:flex">
            <Button type="button" variant="outline" onClick={onImport}>
              <Import data-icon="inline-start" />
              {t("importAction")}
            </Button>
            <Button type="button" variant="outline" onClick={onCreateFolder}>
              <FolderPlus data-icon="inline-start" />
              {t("folderCreateAction")}
            </Button>
            <Button type="button" onClick={onCreateBehavior}>
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

      {canManage ? (
        <div className="flex flex-col gap-2 sm:hidden">
          <Button type="button" className="w-full" onClick={onCreateBehavior}>
            <PlusIcon data-icon="inline-start" />
            {t("createAction")}
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" onClick={onCreateFolder}>
              <FolderPlus data-icon="inline-start" />
              {t("folderCreateAction")}
            </Button>
            <Button type="button" variant="outline" onClick={onImport}>
              <Import data-icon="inline-start" />
              {t("importAction")}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
