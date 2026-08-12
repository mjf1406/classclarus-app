import { SearchIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { SeatConstraintsPlainList } from "@/components/assigners/SeatConstraintsPlainList";
import { SeatConstraintsRosterTable } from "@/components/assigners/SeatConstraintsRosterTable";
import { RosterColumnVisibilityMenu } from "@/components/roster/RosterColumnVisibilityMenu";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useClassUserSettings } from "@/hooks/roster/useClassUserSettings";
import { useRosterConsumerColumnVisibility } from "@/hooks/roster/useRosterConsumerColumnVisibility";
import { useLocalStorageValue } from "@/hooks/useLocalStorageValue";
import type { SeatConstraint, SeatConstraintList } from "@/lib/assigners/seatConstraints";
import {
  normalizeColumnOrder,
  normalizeColumnVisibility,
  type RosterNameFormat,
  type StudentRosterEntry,
} from "@/lib/roster/roster";
import type { Id } from "../../../convex/_generated/dataModel";

const SEAT_CONSTRAINTS_ROSTER_SURFACE = "seat-constraints";

type ConstraintsViewMode = "plain" | "table";

function isConstraintsViewMode(value: string): value is ConstraintsViewMode {
  return value === "plain" || value === "table";
}

type SeatConstraintsViewProps = {
  classId: Id<"classes">;
  constraints: SeatConstraintList;
  roster: StudentRosterEntry[];
  nameFormat: RosterNameFormat;
  canManage: boolean;
  onEdit: (constraint: SeatConstraint) => void;
  onDelete: (constraint: SeatConstraint) => void;
};

export function SeatConstraintsView({
  classId,
  constraints,
  roster,
  nameFormat,
  canManage,
  onEdit,
  onDelete,
}: SeatConstraintsViewProps) {
  const { t } = useTranslation("assigners");
  const { t: tClasses } = useTranslation("classes");
  const { data: settings } = useClassUserSettings(classId);

  const [viewMode, setViewMode] = useLocalStorageValue(
    `assigners:constraints-view:${classId}`,
    "plain",
    isConstraintsViewMode,
  );
  const [nameQuery, setNameQuery] = useState("");

  const columnOrder = normalizeColumnOrder(settings?.studentsColumnOrder);
  const baseColumnVisibility = normalizeColumnVisibility(settings?.studentsColumnVisibility);
  const { columnVisibility, setColumnVisibility } = useRosterConsumerColumnVisibility(
    classId,
    SEAT_CONSTRAINTS_ROSTER_SURFACE,
    baseColumnVisibility,
  );

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <InputGroup className="max-w-md">
          <InputGroupAddon>
            <SearchIcon aria-hidden="true" />
          </InputGroupAddon>
          <InputGroupInput
            value={nameQuery}
            onChange={(event) => setNameQuery(event.target.value)}
            placeholder={t("constraintNameSearchPlaceholder")}
            aria-label={t("constraintNameSearchLabel")}
            autoComplete="off"
            spellCheck={false}
          />
          {nameQuery ? (
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                size="icon-xs"
                variant="ghost"
                aria-label={tClasses("membersSearchClear")}
                onClick={() => setNameQuery("")}
              >
                <XIcon />
              </InputGroupButton>
            </InputGroupAddon>
          ) : null}
        </InputGroup>

        <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup
            variant="outline"
            spacing={0}
            value={[viewMode]}
            onValueChange={(values) => {
              const next = values[0];
              if (isConstraintsViewMode(next)) {
                setViewMode(next);
              }
            }}
          >
            <ToggleGroupItem value="plain" aria-label={t("constraintsViewPlain")}>
              {t("constraintsViewPlain")}
            </ToggleGroupItem>
            <ToggleGroupItem value="table" aria-label={t("constraintsViewTable")}>
              {t("constraintsViewTable")}
            </ToggleGroupItem>
          </ToggleGroup>

          {viewMode === "table" ? (
            <RosterColumnVisibilityMenu
              columnOrder={columnOrder}
              columnVisibility={columnVisibility}
              onColumnVisibilityChange={setColumnVisibility}
            />
          ) : null}
        </div>
      </div>

      {viewMode === "plain" ? (
        <SeatConstraintsPlainList
          constraints={constraints}
          roster={roster}
          nameFormat={nameFormat}
          nameQuery={nameQuery}
          canManage={canManage}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ) : (
        <SeatConstraintsRosterTable
          constraints={constraints}
          roster={roster}
          nameFormat={nameFormat}
          nameQuery={nameQuery}
          columnOrder={columnOrder}
          columnVisibility={columnVisibility}
          canManage={canManage}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      )}
    </div>
  );
}
