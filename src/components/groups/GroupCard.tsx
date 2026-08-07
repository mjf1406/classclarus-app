import { Copy, Pencil, Plus, Trash2, UserPlus, UsersRound } from "lucide-react";
import { useTranslation } from "react-i18next";

import { FontAwesomeIconFromId } from "@/components/icons/FontAwesomeIconFromId";
import { StudentDropZone } from "@/components/groups/StudentDropZone";
import { ActionMenu } from "@/components/ui/action-menu";
import type { BoardGroup, BoardTeam } from "@/lib/groups/groups";
import { isOptimisticId } from "@/lib/groups/groupFormSchema";
import type { Id } from "../../../convex/_generated/dataModel";

type GroupCardProps = {
  group: BoardGroup;
  canManage: boolean;
  canCopyTeam: boolean;
  hiddenStudentId?: Id<"users"> | null;
  onEditGroup: (group: BoardGroup) => void;
  onDeleteGroup: (group: BoardGroup) => void;
  onMoveStudents: (group: BoardGroup) => void;
  onAddTeam: (groupId: Id<"groups">) => void;
  onEditTeam: (groupId: Id<"groups">, team: BoardTeam) => void;
  onCopyTeam: (groupId: Id<"groups">, team: BoardTeam) => void;
  onDeleteTeam: (team: BoardTeam) => void;
};

export function GroupCard({
  group,
  canManage,
  canCopyTeam,
  hiddenStudentId = null,
  onEditGroup,
  onDeleteGroup,
  onMoveStudents,
  onAddTeam,
  onEditTeam,
  onCopyTeam,
  onDeleteTeam,
}: GroupCardProps) {
  const { t } = useTranslation("classes");
  const pending = isOptimisticId(group._id);

  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
      <header className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <FontAwesomeIconFromId
              id={group.icon}
              className="size-4"
              fallback={<UsersRound className="size-4" />}
            />
          </div>
          <div className="min-w-0">
            <h3 className="truncate font-semibold">{group.name}</h3>
            {group.description ? (
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                {group.description}
              </p>
            ) : null}
          </div>
        </div>
        {canManage && !pending ? (
          <ActionMenu
            label={t("groupsGroupActions")}
            items={[
              {
                id: "edit-group",
                label: t("groupsEditAction"),
                icon: <Pencil />,
                permission: "groups:manage",
                onSelect: () => onEditGroup(group),
              },
              {
                id: "move-students",
                label: t("groupsMoveStudentsAction"),
                icon: <UserPlus />,
                permission: "groups:manage",
                onSelect: () => onMoveStudents(group),
              },
              {
                id: "add-team",
                label: t("teamsCreateAction"),
                icon: <Plus />,
                permission: "groups:manage",
                onSelect: () => onAddTeam(group._id),
              },
              {
                id: "delete-group",
                label: t("groupsDeleteAction"),
                icon: <Trash2 />,
                permission: "groups:manage",
                variant: "destructive",
                onSelect: () => onDeleteGroup(group),
              },
            ]}
          />
        ) : null}
      </header>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-muted-foreground">{t("groupsNoTeamLabel")}</p>
        <StudentDropZone
          id={`group:${group._id}`}
          target={{ kind: "group", groupId: group._id }}
          students={group.students}
          canManage={canManage}
          emptyLabel={t("groupsDropEmpty")}
          disabled={pending}
          hiddenStudentId={hiddenStudentId}
        />
      </div>

      {group.teams.map((team) => {
        const teamPending = isOptimisticId(team._id);
        return (
          <div key={team._id} className="flex flex-col gap-2 rounded-xl bg-muted/40 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <FontAwesomeIconFromId
                  id={team.icon}
                  className="size-3.5 text-muted-foreground"
                  fallback={<UsersRound className="size-3.5 text-muted-foreground" />}
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{team.name}</p>
                  {team.description ? (
                    <p className="line-clamp-2 text-xs text-muted-foreground">{team.description}</p>
                  ) : null}
                </div>
              </div>
              {canManage && !teamPending ? (
                <ActionMenu
                  label={t("teamsTeamActions")}
                  items={[
                    {
                      id: "edit-team",
                      label: t("teamsEditAction"),
                      icon: <Pencil />,
                      permission: "groups:manage",
                      onSelect: () => onEditTeam(group._id, team),
                    },
                    ...(canCopyTeam
                      ? [
                          {
                            id: "copy-team",
                            label: t("teamsCopyAction"),
                            icon: <Copy />,
                            permission: "groups:manage" as const,
                            onSelect: () => onCopyTeam(group._id, team),
                          },
                        ]
                      : []),
                    {
                      id: "delete-team",
                      label: t("teamsDeleteAction"),
                      icon: <Trash2 />,
                      permission: "groups:manage",
                      variant: "destructive" as const,
                      onSelect: () => onDeleteTeam(team),
                    },
                  ]}
                />
              ) : null}
            </div>
            <StudentDropZone
              id={`team:${team._id}`}
              target={{ kind: "team", groupId: group._id, teamId: team._id }}
              students={team.students}
              canManage={canManage}
              emptyLabel={t("groupsDropEmpty")}
              disabled={pending || teamPending}
              hiddenStudentId={hiddenStudentId}
            />
          </div>
        );
      })}
    </section>
  );
}
