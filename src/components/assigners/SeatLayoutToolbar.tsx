import {
  Armchair,
  Eraser,
  Grid3x3,
  LayoutGrid,
  Presentation,
  Printer,
  Redo2,
  Save,
  Scan,
  Square,
  Trash2,
  Type,
  Undo2,
  UsersRound,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  commonTeamAssignment,
  MAX_DESK_GRID_COLS,
  MAX_DESK_GRID_ROWS,
  SEAT_ORIENTATION_LABEL_KEYS,
  type SeatLayoutItem,
  type SeatLayoutItemKind,
  type SeatOrientation,
  type SeatTeamAssignment,
} from "@/lib/assigners/seatLayouts";
import type { Id } from "../../../convex/_generated/dataModel";

type GroupOption = {
  _id: Id<"groups">;
  name: string;
  teams: Array<{ _id: Id<"teams">; name: string }>;
};

type SharedTeamName = {
  teamName: string;
  groupNames: Array<string>;
};

type SeatLayoutToolbarProps = {
  canManage: boolean;
  snapToGrid: boolean;
  onSnapToGridChange: (next: boolean) => void;
  orientation: SeatOrientation;
  onOrientationChange: (next: SeatOrientation) => void;
  onPrint: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  saving: boolean;
  dirty: boolean;
  onAddItem: (kind: SeatLayoutItemKind) => void;
  deskGridCols: number;
  deskGridRows: number;
  onDeskGridColsChange: (next: number) => void;
  onDeskGridRowsChange: (next: number) => void;
  onAddDeskGrid: () => void;
  selectedDesks: Array<SeatLayoutItem>;
  groups: Array<GroupOption>;
  sharedNames: Array<SharedTeamName>;
  onTeamAssignmentChange: (teamAssignment: SeatTeamAssignment | undefined) => void;
  hasSelection: boolean;
  onDeleteSelected: () => void;
  canClear: boolean;
  onClearCanvas: () => void;
};

type ToolbarIconButtonProps = {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  pressed?: boolean;
  variant?: "outline" | "default" | "destructive";
  shortcut?: ReactNode;
  children: ReactNode;
};

function ToolbarIconButton({
  label,
  onClick,
  disabled = false,
  pressed,
  variant = "outline",
  shortcut,
  children,
}: ToolbarIconButtonProps) {
  const resolvedVariant = pressed ? "default" : variant;
  const content = (
    <>
      {children}
      <span className="sr-only">{label}</span>
    </>
  );

  return (
    <Tooltip>
      {disabled ? (
        <TooltipTrigger render={<span className="inline-flex" />}>
          <Button
            type="button"
            size="icon"
            variant={resolvedVariant}
            disabled
            aria-pressed={pressed}
          >
            {content}
          </Button>
        </TooltipTrigger>
      ) : (
        <TooltipTrigger
          render={
            <Button
              type="button"
              size="icon"
              variant={resolvedVariant}
              aria-pressed={pressed}
              onClick={onClick}
            />
          }
        >
          {content}
        </TooltipTrigger>
      )}
      <TooltipContent side="top">
        {label}
        {shortcut}
      </TooltipContent>
    </Tooltip>
  );
}

function ToolbarSeparator() {
  return <Separator orientation="vertical" className="mx-0.5 h-6" />;
}

export function SeatLayoutToolbar({
  canManage,
  snapToGrid,
  onSnapToGridChange,
  orientation,
  onOrientationChange,
  onPrint,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onSave,
  saving,
  dirty,
  onAddItem,
  deskGridCols,
  deskGridRows,
  onDeskGridColsChange,
  onDeskGridRowsChange,
  onAddDeskGrid,
  selectedDesks,
  groups,
  sharedNames,
  onTeamAssignmentChange,
  hasSelection,
  onDeleteSelected,
  canClear,
  onClearCanvas,
}: SeatLayoutToolbarProps) {
  const { t } = useTranslation("assigners");
  const { t: tCommon } = useTranslation("common");
  const [deskGridOpen, setDeskGridOpen] = useState(false);
  const [teamAssignOpen, setTeamAssignOpen] = useState(false);

  const orientationLabel = t(SEAT_ORIENTATION_LABEL_KEYS[orientation]);
  const snapHint = snapToGrid ? t("snapHintGrid") : t("snapHint");

  return (
    <div
      role="toolbar"
      aria-label={t("seatsTitle")}
      className="flex flex-nowrap items-center gap-1"
    >
      {canManage ? (
        <>
          <ToolbarIconButton label={t("addTeacherDesk")} onClick={() => onAddItem("teacherDesk")}>
            <Armchair />
          </ToolbarIconButton>
          <ToolbarIconButton label={t("addBoard")} onClick={() => onAddItem("board")}>
            <Presentation />
          </ToolbarIconButton>
          <ToolbarIconButton label={t("addDesk")} onClick={() => onAddItem("desk")}>
            <Square />
          </ToolbarIconButton>
          <ToolbarIconButton label={t("defaultRectLabel")} onClick={() => onAddItem("rect")}>
            <Type />
          </ToolbarIconButton>

          <ToolbarSeparator />

          <Popover open={deskGridOpen} onOpenChange={setDeskGridOpen}>
            <Tooltip>
              <TooltipTrigger render={<span className="inline-flex" />}>
                <PopoverTrigger render={<Button type="button" size="icon" variant="outline" />}>
                  <LayoutGrid />
                  <span className="sr-only">{t("addDeskGrid")}</span>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent side="top">{t("addDeskGrid")}</TooltipContent>
            </Tooltip>
            <PopoverContent side="top" align="start" className="w-64 gap-3 p-3">
              <PopoverHeader className="gap-1">
                <PopoverTitle className="text-sm">{t("addDeskGrid")}</PopoverTitle>
              </PopoverHeader>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="desk-grid-cols">{t("deskGridCols")}</Label>
                  <Input
                    id="desk-grid-cols"
                    type="number"
                    min={1}
                    max={MAX_DESK_GRID_COLS}
                    value={deskGridCols}
                    onChange={(event) => {
                      const next = Number(event.target.value);
                      onDeskGridColsChange(
                        Math.min(
                          MAX_DESK_GRID_COLS,
                          Math.max(1, Math.floor(Number.isFinite(next) ? next : 1) || 1),
                        ),
                      );
                    }}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="desk-grid-rows">{t("deskGridRows")}</Label>
                  <Input
                    id="desk-grid-rows"
                    type="number"
                    min={1}
                    max={MAX_DESK_GRID_ROWS}
                    value={deskGridRows}
                    onChange={(event) => {
                      const next = Number(event.target.value);
                      onDeskGridRowsChange(
                        Math.min(
                          MAX_DESK_GRID_ROWS,
                          Math.max(1, Math.floor(Number.isFinite(next) ? next : 1) || 1),
                        ),
                      );
                    }}
                  />
                </div>
              </div>
              <Button
                type="button"
                onClick={() => {
                  onAddDeskGrid();
                  setDeskGridOpen(false);
                }}
              >
                {t("addDeskGridAction")}
              </Button>
            </PopoverContent>
          </Popover>

          {selectedDesks.length > 0 || hasSelection ? (
            <>
              <ToolbarSeparator />
              {selectedDesks.length > 0 ? (
                <Popover open={teamAssignOpen} onOpenChange={setTeamAssignOpen}>
                  <Tooltip>
                    <TooltipTrigger render={<span className="inline-flex" />}>
                      <PopoverTrigger
                        render={<Button type="button" size="icon" variant="outline" />}
                      >
                        <UsersRound />
                        <span className="sr-only">
                          {selectedDesks.length > 1
                            ? t("teamAssignMulti", { count: selectedDesks.length })
                            : t("teamAssign")}
                        </span>
                      </PopoverTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      {selectedDesks.length > 1
                        ? t("teamAssignMulti", { count: selectedDesks.length })
                        : t("teamAssign")}
                    </TooltipContent>
                  </Tooltip>
                  <PopoverContent side="top" align="start" className="w-72 gap-3 p-3">
                    <PopoverHeader className="gap-1">
                      <PopoverTitle className="text-sm">
                        {selectedDesks.length > 1
                          ? t("teamAssignMulti", { count: selectedDesks.length })
                          : t("teamAssign")}
                      </PopoverTitle>
                    </PopoverHeader>
                    <TeamAssignControls
                      key={selectedDesks.map((desk) => desk.id).join(",")}
                      groups={groups}
                      sharedNames={sharedNames}
                      assignment={commonTeamAssignment(selectedDesks)}
                      onChange={onTeamAssignmentChange}
                    />
                  </PopoverContent>
                </Popover>
              ) : null}
              {hasSelection ? (
                <ToolbarIconButton
                  label={t("deleteItem")}
                  variant="destructive"
                  onClick={onDeleteSelected}
                  shortcut={<Kbd>Del</Kbd>}
                >
                  <Trash2 />
                </ToolbarIconButton>
              ) : null}
            </>
          ) : null}

          <ToolbarSeparator />

          <ToolbarIconButton label={t("clearCanvas")} disabled={!canClear} onClick={onClearCanvas}>
            <Eraser />
          </ToolbarIconButton>

          <ToolbarSeparator />

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  size="icon"
                  variant={snapToGrid ? "default" : "outline"}
                  aria-pressed={snapToGrid}
                  onClick={() => onSnapToGridChange(!snapToGrid)}
                />
              }
            >
              <Grid3x3 />
              <span className="sr-only">{t("snapToGridLabel")}</span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-56 flex-col items-start gap-0.5">
              <span>{t("snapToGridLabel")}</span>
              <span className="font-normal opacity-80">{snapHint}</span>
            </TooltipContent>
          </Tooltip>
        </>
      ) : null}

      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger render={<span className="inline-flex" />}>
            <DropdownMenuTrigger render={<Button type="button" size="icon" variant="outline" />}>
              <Scan />
              <span className="sr-only">
                {t("orientationLabel")}: {orientationLabel}
              </span>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="top">
            {t("orientationLabel")}: {orientationLabel}
          </TooltipContent>
        </Tooltip>
        <DropdownMenuContent side="top" align="start">
          <DropdownMenuRadioGroup
            value={orientation}
            onValueChange={(value) => {
              if (value === "front" || value === "back" || value === "left" || value === "right") {
                onOrientationChange(value);
              }
            }}
          >
            <DropdownMenuLabel>{t("orientationLabel")}</DropdownMenuLabel>
            <DropdownMenuRadioItem value="front" closeOnClick>
              {t("orientationFront")}
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="back" closeOnClick>
              {t("orientationBack")}
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="left" closeOnClick>
              {t("orientationLeft")}
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="right" closeOnClick>
              {t("orientationRight")}
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <ToolbarIconButton label={t("printPdf")} onClick={onPrint}>
        <Printer />
      </ToolbarIconButton>

      {canManage ? (
        <>
          <ToolbarSeparator />
          <ToolbarIconButton
            label={tCommon("undo")}
            disabled={!canUndo}
            onClick={onUndo}
            shortcut={<Kbd>⌘Z</Kbd>}
          >
            <Undo2 />
          </ToolbarIconButton>
          <ToolbarIconButton
            label={tCommon("redo")}
            disabled={!canRedo}
            onClick={onRedo}
            shortcut={<Kbd>⌘Y</Kbd>}
          >
            <Redo2 />
          </ToolbarIconButton>
          <ToolbarIconButton
            label={saving ? t("editorSaveStatusSaving") : t("saveAction")}
            disabled={!dirty || saving}
            variant="default"
            onClick={onSave}
          >
            <Save />
          </ToolbarIconButton>
        </>
      ) : null}
    </div>
  );
}

function TeamAssignControls({
  groups,
  sharedNames,
  assignment,
  onChange,
}: {
  groups: Array<GroupOption>;
  sharedNames: Array<SharedTeamName>;
  assignment: SeatTeamAssignment | undefined;
  onChange: (next: SeatTeamAssignment | undefined) => void;
}) {
  const { t } = useTranslation("assigners");
  const mode = assignment?.mode ?? "none";
  const [groupId, setGroupId] = useState<string>(
    assignment?.mode === "single" ? assignment.groupId : (groups[0]?._id ?? ""),
  );
  const selectedGroup = groups.find((group) => group._id === groupId);
  const teams = selectedGroup?.teams ?? [];

  if (groups.every((group) => group.teams.length === 0)) {
    return <p className="text-sm text-muted-foreground">{t("teamAssignNoTeams")}</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <Select
        value={mode}
        onValueChange={(value) => {
          if (value == null || value === "none") {
            onChange(undefined);
            return;
          }
          if (value === "single" && selectedGroup?.teams[0]) {
            onChange({
              mode: "single",
              groupId: selectedGroup._id,
              teamId: selectedGroup.teams[0]._id,
            });
          }
          if (value === "byName" && sharedNames[0]) {
            onChange({ mode: "byName", teamName: sharedNames[0].teamName });
          }
        }}
      >
        <SelectTrigger>
          <SelectValue>
            {mode === "none"
              ? t("teamAssignNone")
              : mode === "single"
                ? t("teamAssignSingle")
                : t("teamAssignByName")}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">{t("teamAssignNone")}</SelectItem>
          <SelectItem value="single">{t("teamAssignSingle")}</SelectItem>
          <SelectItem value="byName" disabled={sharedNames.length === 0}>
            {t("teamAssignByName")}
          </SelectItem>
        </SelectContent>
      </Select>

      {mode === "single" ? (
        <>
          <Label>{t("teamAssignGroup")}</Label>
          <Select
            value={groupId}
            onValueChange={(value) => {
              if (value == null) return;
              setGroupId(value);
              const group = groups.find((g) => g._id === value);
              const team = group?.teams[0];
              if (group && team) {
                onChange({ mode: "single", groupId: group._id, teamId: team._id });
              }
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {groups.map((group) => (
                <SelectItem key={group._id} value={group._id} disabled={group.teams.length === 0}>
                  {group.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Label>{t("teamAssignTeam")}</Label>
          <Select
            value={assignment?.mode === "single" ? assignment.teamId : ""}
            onValueChange={(value) => {
              if (value == null || !selectedGroup) return;
              onChange({
                mode: "single",
                groupId: selectedGroup._id,
                teamId: value as Id<"teams">,
              });
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {teams.map((team) => (
                <SelectItem key={team._id} value={team._id}>
                  {team.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      ) : null}

      {mode === "byName" ? (
        <>
          <Label>{t("teamAssignTeamName")}</Label>
          <Select
            value={assignment?.mode === "byName" ? assignment.teamName : ""}
            onValueChange={(value) => {
              if (value == null) return;
              onChange({ mode: "byName", teamName: value });
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sharedNames.map((entry) => (
                <SelectItem key={entry.teamName} value={entry.teamName}>
                  {entry.teamName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {assignment?.mode === "byName" ? (
            <p className="text-xs text-muted-foreground">
              {t("teamAssignMatches", {
                groups:
                  sharedNames
                    .find(
                      (entry) => entry.teamName.toLowerCase() === assignment.teamName.toLowerCase(),
                    )
                    ?.groupNames.join(", ") ?? "",
              })}
            </p>
          ) : null}
        </>
      ) : null}

      {assignment ? (
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange(undefined)}>
          {t("teamAssignClear")}
        </Button>
      ) : null}
    </div>
  );
}
