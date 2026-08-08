import { Link, useNavigate } from "@tanstack/react-router";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { ActionMenu, type ActionMenuItem } from "@/components/ui/action-menu";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatLocalizedDateTime, formatLocalizedDueDate } from "@/i18n/formatDate";
import { isAssignmentPastDue, type AssignmentListItem } from "@/lib/assignments/assignments";
import { cn } from "@/lib/utils";
import type { Id } from "../../../convex/_generated/dataModel";

type AssignmentCardProps = {
  classId: Id<"classes">;
  assignment: AssignmentListItem;
  onDelete: (assignment: AssignmentListItem) => void;
};

export function AssignmentCard({ classId, assignment, onDelete }: AssignmentCardProps) {
  const { t } = useTranslation("assignments");
  const navigate = useNavigate();
  const pastDue = isAssignmentPastDue(assignment.dueDateKey);

  const menuItems = useMemo<Array<ActionMenuItem>>(
    () => [
      {
        id: "view",
        label: t("viewAction"),
        icon: <Eye />,
        group: "navigate",
        onSelect: () => {
          void navigate({
            to: "/class/$classId/assignments/$assignmentId",
            params: { classId, assignmentId: assignment._id },
          });
        },
      },
      {
        id: "edit",
        label: t("editAction"),
        icon: <Pencil />,
        permission: "assignments:manage",
        group: "manage",
        onSelect: () => {
          void navigate({
            to: "/class/$classId/assignments/$assignmentId/edit",
            params: { classId, assignmentId: assignment._id },
          });
        },
      },
      {
        id: "delete",
        label: t("deleteAction"),
        icon: <Trash2 />,
        permission: "assignments:manage",
        variant: "destructive",
        group: "danger",
        onSelect: () => onDelete(assignment),
      },
    ],
    [assignment, classId, navigate, onDelete, t],
  );

  const meta = [assignment.subject, assignment.unit].filter(Boolean).join(" · ");

  return (
    <Card size="sm" className={cn("transition-colors hover:bg-accent/40")}>
      <CardHeader className="flex flex-row items-start gap-3">
        <div className="min-w-0 flex-1">
          <CardTitle className="text-base font-semibold">
            <Link
              to="/class/$classId/assignments/$assignmentId"
              params={{ classId, assignmentId: assignment._id }}
              className="rounded-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            >
              {assignment.name}
            </Link>
          </CardTitle>
          {meta ? <CardDescription className="mt-1">{meta}</CardDescription> : null}
        </div>
        <div className="shrink-0">
          <ActionMenu items={menuItems} label={t("actions")} />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
        <p>
          {t("statsHandedIn", {
            handedIn: assignment.handedInStudentCount,
            total: assignment.studentCount,
          })}
        </p>
        <p>{t("statsLinks", { count: assignment.linkCount })}</p>
        {assignment.dueDateKey ? (
          <p className={cn(pastDue && "text-destructive")}>
            {t("dueDateValue", { date: formatLocalizedDueDate(assignment.dueDateKey) })}
            {pastDue ? ` · ${t("statusLate")}` : null}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-1.5">
          {assignment.hasInstructions ? (
            <Badge variant="secondary">{t("badgeInstructions")}</Badge>
          ) : null}
          {assignment.hasProcedure ? (
            <Badge variant="secondary">{t("badgeProcedure")}</Badge>
          ) : null}
        </div>
      </CardContent>
      <CardFooter className="border-t text-xs text-muted-foreground">
        {t("updatedAt", { date: formatLocalizedDateTime(assignment.updatedAt) })}
      </CardFooter>
    </Card>
  );
}
