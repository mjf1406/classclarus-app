import { Copy, Pencil, Plus, Trash2, UserPlus } from "lucide-react";
import { useTranslation } from "react-i18next";

import { GroupImageIcon } from "@/components/groups/GroupImageIcon";
import { StudentDropZone } from "@/components/groups/StudentDropZone";
import { ActionMenu } from "@/components/ui/action-menu";
import type { BoardGroup, BoardTeam } from "@/lib/groups/groups";
import { isOptimisticId } from "@/lib/groups/groupFormSchema";
import { cn } from "@/lib/utils";
import type { Id } from "../../../convex/_generated/dataModel";

type GroupCardProps = {
  group: BoardGroup;
  canManage: boolean;
  canCopyTeam: boolean;
  hiddenStudentId?: Id<"users"> | null;
  viewerUserId?: Id<"users"> | null;
  onEditGroup: (group: BoardGroup) => void;
  onDeleteGroup: (group: BoardGroup) => void;
  onMoveStudents: (group: BoardGroup) => void;
  onAddTeam: (groupId: Id<"groups">) => void;
  onEditTeam: (groupId: Id<"groups">, team: BoardTeam) => void;
  onCopyTeam: (groupId: Id<"groups">, team: BoardTeam) => void;
  onDeleteTeam: (team: BoardTeam) => void;
};

function groupContainsViewer(group: BoardGroup, viewerUserId: Id<"users"> | null | undefined) {
  if (!viewerUserId) return false;
  if (group.students.some((student) => student.userId === viewerUserId)) return true;
  return group.teams.some((team) =>
    team.students.some((student) => student.userId === viewerUserId),
  );
}

export function GroupCard({
  group,
  canManage,
  canCopyTeam,
  hiddenStudentId = null,
  viewerUserId = null,
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
  const isViewerGroup = groupContainsViewer(group, viewerUserId);

  return (
    <section
      className={cn(
        "flex flex-col gap-3 rounded-2xl p-4",
        isViewerGroup ? "bg-primary/5 ring-2 ring-primary/50" : "bg-card ring-1 ring-foreground/10",
      )}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <GroupImageIcon
            imageFileId={group.imageFileId}
            icon={group.icon}
            alt={t("groupsImagePreviewAlt")}
          />
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
          viewerUserId={viewerUserId}
        />
      </div>

      {group.teams.map((team) => {
        const teamPending = isOptimisticId(team._id);
        const isViewerTeam =
          viewerUserId != null && team.students.some((student) => student.userId === viewerUserId);
        return (
          <div
            key={team._id}
            className={cn(
              "flex flex-col gap-2 rounded-xl p-3",
              isViewerTeam ? "bg-primary/10 ring-1 ring-primary/40" : "bg-muted/40",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <GroupImageIcon
                  imageFileId={team.imageFileId}
                  icon={team.icon}
                  alt={t("groupsImagePreviewAlt")}
                  className="size-7 rounded-md"
                  iconClassName="size-3.5 text-muted-foreground"
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
              viewerUserId={viewerUserId}
            />
          </div>
        );
      })}
    </section>
  );
}
