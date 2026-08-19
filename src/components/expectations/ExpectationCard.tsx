import { Link, useNavigate } from "@tanstack/react-router";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { ActionMenu, type ActionMenuItem } from "@/components/ui/action-menu";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ExpectationListItem } from "@/lib/expectations/expectations";
import type { Id } from "../../../convex/_generated/dataModel";

type ExpectationCardProps = {
  classId: Id<"classes">;
  expectation: ExpectationListItem;
  onEdit: (expectation: ExpectationListItem) => void;
  onDelete: (expectation: ExpectationListItem) => void;
};

export function ExpectationCard({ classId, expectation, onEdit, onDelete }: ExpectationCardProps) {
  const { t } = useTranslation("expectations");
  const navigate = useNavigate();

  const menuItems = useMemo<Array<ActionMenuItem>>(
    () => [
      {
        id: "view",
        label: t("viewAction"),
        icon: <Eye />,
        group: "navigate",
        onSelect: () => {
          void navigate({
            to: "/class/$classId/expectations/$expectationId",
            params: { classId, expectationId: expectation._id },
          });
        },
      },
      {
        id: "edit",
        label: t("editAction"),
        icon: <Pencil />,
        permission: "expectations:manage",
        group: "manage",
        onSelect: () => onEdit(expectation),
      },
      {
        id: "delete",
        label: t("deleteAction"),
        icon: <Trash2 />,
        permission: "expectations:manage",
        variant: "destructive",
        group: "danger",
        onSelect: () => onDelete(expectation),
      },
    ],
    [classId, expectation, navigate, onDelete, onEdit, t],
  );

  const description = expectation.description?.trim() || t("emptyDescriptionPreview");
  const inputTypeLabel =
    expectation.inputType === "numberRange" ? t("inputTypeNumberRange") : t("inputTypeNumber");

  return (
    <Card size="sm" className="h-full transition-colors hover:bg-accent/40">
      <CardHeader className="flex flex-row items-start gap-3">
        <div className="min-w-0 flex-1">
          <CardTitle className="text-base font-semibold">
            <Link
              to="/class/$classId/expectations/$expectationId"
              params={{ classId, expectationId: expectation._id }}
              className="rounded-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            >
              {expectation.name}
            </Link>
          </CardTitle>
          <CardDescription className="mt-1 line-clamp-2">{description}</CardDescription>
        </div>
        <div className="shrink-0">
          <ActionMenu items={menuItems} label={t("actions")} />
        </div>
      </CardHeader>
      <CardContent className="space-y-1 text-sm text-muted-foreground">
        <p>
          <span className="font-medium text-foreground">{t("inputTypeLabel")}: </span>
          {inputTypeLabel}
        </p>
        <p>
          <span className="font-medium text-foreground">{t("unitLabel")}: </span>
          {expectation.unit}
        </p>
      </CardContent>
      <CardFooter className="mt-auto text-xs text-muted-foreground">
        {t("valueCount", { count: expectation.valueCount })}
      </CardFooter>
    </Card>
  );
}
