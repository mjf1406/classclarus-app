import { Link } from "@tanstack/react-router";
import { ArchiveIcon, ArchiveRestoreIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { ClassRoleBadge } from "@/components/badges/ClassRoleBadges";
import { ClassIconDisplay } from "@/components/classes/ClassIconDisplay";
import { ActionMenu, type ActionMenuItem } from "@/components/ui/action-menu";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ClassPublic } from "@/lib/classes/classes";
import type { ClassViewMode } from "@/lib/classes/classSort";
import { cn } from "@/lib/utils";

type ClassCardProps = {
  classDoc: ClassPublic;
  viewMode: ClassViewMode;
  onEdit: (classDoc: ClassPublic) => void;
  onArchiveToggle: (classDoc: ClassPublic) => void;
  onDelete: (classDoc: ClassPublic) => void;
};

function formatTimestamp(value: number, language: string): string {
  return new Intl.DateTimeFormat(language, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function ClassCard({
  classDoc,
  viewMode,
  onEdit,
  onArchiveToggle,
  onDelete,
}: ClassCardProps) {
  const { t, i18n } = useTranslation("classes");
  const isArchived = classDoc.archivedAt !== undefined;
  const description = classDoc.description?.trim() || t("noDescription");

  const menuItems = useMemo<Array<ActionMenuItem>>(
    () => [
      {
        id: "edit",
        label: t("editAction"),
        icon: <PencilIcon />,
        permission: "class:update",
        group: "manage",
        onSelect: () => onEdit(classDoc),
      },
      {
        id: "archive",
        label: isArchived ? t("restoreAction") : t("archiveAction"),
        icon: isArchived ? <ArchiveRestoreIcon /> : <ArchiveIcon />,
        permission: "class:archive",
        group: "manage",
        onSelect: () => onArchiveToggle(classDoc),
      },
      {
        id: "delete",
        label: t("deleteAction"),
        icon: <Trash2Icon />,
        permission: "class:delete",
        variant: "destructive",
        group: "danger",
        onSelect: () => onDelete(classDoc),
      },
    ],
    [classDoc, isArchived, onArchiveToggle, onDelete, onEdit, t],
  );

  const menu = <ActionMenu items={menuItems} label={t("classActions")} />;

  const openLink = (
    <Link
      to="/class/$classId"
      params={{ classId: classDoc._id }}
      className="absolute inset-0 z-0 rounded-[inherit] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      aria-label={t("openClass", { name: classDoc.name })}
    />
  );

  if (viewMode === "list") {
    return (
      <div
        className={cn(
          "relative flex items-center gap-3 rounded-2xl bg-card p-4 ring-1 ring-foreground/10 transition-colors hover:bg-accent/40",
          isArchived && "opacity-80",
        )}
      >
        {openLink}
        <ClassIconDisplay icon={classDoc.icon} />
        <div className="relative z-10 min-w-0 flex-1 pointer-events-none">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-medium text-foreground">{classDoc.name}</p>
            <span className="text-sm text-muted-foreground">{classDoc.year}</span>
            <ClassRoleBadge role={classDoc.role} />
          </div>
          <p className="truncate text-sm text-muted-foreground">{description}</p>
        </div>
        {menu}
      </div>
    );
  }

  return (
    <Card
      size="sm"
      className={cn("relative transition-colors hover:bg-accent/40", isArchived && "opacity-80")}
    >
      {openLink}
      <CardHeader className="relative z-10 flex flex-row items-start gap-3 pointer-events-none">
        <ClassIconDisplay icon={classDoc.icon} />
        <div className="min-w-0 flex-1">
          <CardTitle className="truncate text-base font-semibold">{classDoc.name}</CardTitle>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <p className="text-sm text-muted-foreground">{classDoc.year}</p>
            <ClassRoleBadge role={classDoc.role} />
          </div>
        </div>
        <div className="shrink-0 pointer-events-auto">{menu}</div>
      </CardHeader>
      <CardContent className="relative z-10 flex flex-col gap-3 pointer-events-none">
        <CardDescription className="line-clamp-3">{description}</CardDescription>
        <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
          <span>
            {t("createdAt", {
              date: formatTimestamp(classDoc._creationTime, i18n.language),
            })}
          </span>
          <span>
            {t("updatedAt", {
              date: formatTimestamp(classDoc.updatedAt, i18n.language),
            })}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
