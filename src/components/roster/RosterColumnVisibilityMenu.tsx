import { Columns3Icon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROSTER_COLUMN_IDS, type RosterColumnId } from "@/lib/roster/roster";

const COLUMN_LABEL_KEYS = {
  rosterNumber: "rosterColumnRosterNumber",
  lastName: "rosterColumnLastName",
  firstName: "rosterColumnFirstName",
  name: "rosterColumnName",
  email: "rosterColumnEmail",
  gender: "rosterColumnGender",
  pronouns: "rosterColumnPronouns",
} as const satisfies Record<RosterColumnId, string>;

type RosterColumnVisibilityMenuProps = {
  columnOrder: RosterColumnId[];
  columnVisibility: Record<RosterColumnId, boolean>;
  onColumnVisibilityChange: (visibility: Record<RosterColumnId, boolean>) => void;
};

export function RosterColumnVisibilityMenu({
  columnOrder,
  columnVisibility,
  onColumnVisibilityChange,
}: RosterColumnVisibilityMenuProps) {
  const { t } = useTranslation("classes");
  const orderedIds = columnOrder.length > 0 ? columnOrder : [...ROSTER_COLUMN_IDS];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button type="button" variant="outline" size="sm" className="gap-2" />}
      >
        <Columns3Icon data-icon="inline-start" />
        {t("rosterColumnsMenu")}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("rosterColumnsMenu")}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {orderedIds.map((id) => (
            <DropdownMenuCheckboxItem
              key={id}
              checked={columnVisibility[id]}
              onCheckedChange={(next) => {
                onColumnVisibilityChange({
                  ...columnVisibility,
                  [id]: next === true,
                });
              }}
            >
              {t(COLUMN_LABEL_KEYS[id])}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
