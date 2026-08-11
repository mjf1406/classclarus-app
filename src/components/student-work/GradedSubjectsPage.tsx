import { Link, useNavigate } from "@tanstack/react-router";
import { BookOpen, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { FontAwesomeIconFromId } from "@/components/icons/FontAwesomeIconFromId";
import { DeleteNamedCredenza } from "@/components/groups/DeleteNamedCredenza";
import { GradeScalesShell } from "@/components/student-work/GradeScalesShell";
import { ActionMenu, type ActionMenuItem } from "@/components/ui/action-menu";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useAssignments } from "@/hooks/assignments/useAssignments";
import { useGradeScales } from "@/hooks/gradeScales/useGradeScales";
import { useGradedSubjects } from "@/hooks/gradedSubjects/useGradedSubjects";
import { useRemoveGradedSubject } from "@/hooks/gradedSubjects/useRemoveGradedSubject";
import { useCan } from "@/hooks/permissions/useCan";
import { resolveGradeScaleDisplayName } from "@/lib/gradeScales/gradeScales";
import {
  describeGradedSubjectItem,
  formatWeightPercent,
  gradedSubjectItemKey,
  weightPercentDisplayDecimals,
  type GradedSubjectListItem,
} from "@/lib/gradedSubjects/gradedSubjects";
import type { Id } from "../../../convex/_generated/dataModel";

const GRID_CLASS = "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3";

type GradedSubjectsPageProps = {
  classId: Id<"classes">;
};

export function GradedSubjectsPage({ classId }: GradedSubjectsPageProps) {
  const { t } = useTranslation("studentWork");
  const navigate = useNavigate();
  const { can } = useCan();
  const canManage = can("gradeScales:manage");
  const { data, isPending, isError, refetch } = useGradedSubjects(classId);
  const { data: gradeScales } = useGradeScales(classId);
  const { data: assignments } = useAssignments(classId);
  const removeSubject = useRemoveGradedSubject();
  const [deleting, setDeleting] = useState<GradedSubjectListItem | null>(null);

  const assignmentRows = assignments ?? [];

  const scaleNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const scale of gradeScales ?? []) {
      if (scale.isHidden) continue;
      map.set(scale._id, resolveGradeScaleDisplayName(scale, t, t("unnamedScale")));
    }
    return map;
  }, [gradeScales, t]);

  return (
    <GradeScalesShell
      classId={classId}
      tab="subjects"
      description={t("subjectsDescription")}
      action={
        canManage ? (
          <Button
            type="button"
            nativeButton={false}
            render={<Link to="/class/$classId/sw/graded-subjects/new" params={{ classId }} />}
          >
            <Plus className="size-4" />
            {t("createSubject")}
          </Button>
        ) : null
      }
    >
      {isPending ? (
        <div className={GRID_CLASS}>
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-48 w-full rounded-2xl" />
          ))}
        </div>
      ) : null}

      {isError ? (
        <ErrorState
          title={t("subjectsLoadFailed")}
          description={t("subjectsLoadFailedDescription")}
          onRetry={() => void refetch()}
        />
      ) : null}

      {!isPending && !isError && data && data.length === 0 ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BookOpen />
            </EmptyMedia>
            <EmptyTitle>{t("subjectsEmptyTitle")}</EmptyTitle>
            <EmptyDescription>{t("subjectsEmptyDescription")}</EmptyDescription>
          </EmptyHeader>
          {canManage ? (
            <EmptyContent>
              <Button
                type="button"
                nativeButton={false}
                render={<Link to="/class/$classId/sw/graded-subjects/new" params={{ classId }} />}
              >
                <Plus className="size-4" />
                {t("createSubject")}
              </Button>
            </EmptyContent>
          ) : null}
        </Empty>
      ) : null}

      {!isPending && !isError && data && data.length > 0 ? (
        <ul className={GRID_CLASS}>
          {data.map((subject) => {
            const scaleName = scaleNameById.get(subject.gradeScaleId) ?? t("unnamedScale");
            const weightPercents = subject.items.map((item) => item.weight * 100);
            const weightDecimals = weightPercentDisplayDecimals(weightPercents);
            const menuItems: Array<ActionMenuItem> = [
              {
                id: "edit",
                label: t("editAction"),
                icon: <Pencil />,
                permission: "gradeScales:manage",
                group: "manage",
                onSelect: () => {
                  void navigate({
                    to: "/class/$classId/sw/graded-subjects/$gradedSubjectId/edit",
                    params: { classId, gradedSubjectId: subject._id },
                  });
                },
              },
              {
                id: "delete",
                label: t("deleteAction"),
                icon: <Trash2 />,
                permission: "gradeScales:manage",
                variant: "destructive",
                group: "danger",
                onSelect: () => setDeleting(subject),
              },
            ];

            return (
              <li key={subject._id}>
                <Card size="sm" className="h-full transition-colors hover:bg-accent/40">
                  <CardHeader className="flex flex-row items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <FontAwesomeIconFromId
                        id={subject.icon}
                        className="size-5"
                        fallback={<BookOpen className="size-5" />}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <CardTitle className="truncate text-base font-semibold">
                        {subject.name}
                      </CardTitle>
                      <CardDescription className="mt-1">{scaleName}</CardDescription>
                    </div>
                    <div className="shrink-0">
                      <ActionMenu items={menuItems} label={t("subjectActions")} />
                    </div>
                  </CardHeader>
                  <CardContent className="border-t pt-0">
                    <ul className="divide-y">
                      {subject.items.map((item, index) => (
                        <li
                          key={gradedSubjectItemKey(item)}
                          className="flex items-center justify-between gap-3 py-2 text-sm"
                        >
                          <span className="min-w-0 truncate font-medium">
                            {describeGradedSubjectItem(item, assignmentRows)}
                          </span>
                          <span className="shrink-0 text-muted-foreground tabular-nums">
                            {formatWeightPercent(weightPercents[index] ?? 0, weightDecimals)}%
                          </span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      ) : null}

      <DeleteNamedCredenza
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title={t("deleteSubjectTitle")}
        description={t("deleteSubjectDescription", {
          name: deleting?.name ?? "",
        })}
        confirmLabel={t("confirmDelete")}
        onConfirm={async () => {
          if (!deleting) return;
          await removeSubject.mutateAsync({
            classId,
            gradedSubjectId: deleting._id,
          });
        }}
      />
    </GradeScalesShell>
  );
}
